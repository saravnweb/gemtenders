import { supabase } from '../lib/supabase';
import { extractTenderData } from '../lib/gemini';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// ─── CONFIG ────────────────────────────────────────────────────────────────
// How many tenders to process per run. Keep this small (50-100) to be safe.
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;
// ────────────────────────────────────────────────────────────────────────────

async function enrichTenders() {
  console.log(`\n>>> [ENRICHER] Starting enrichment run. Processing up to ${LIMIT} tenders...\n`);

  // Fetch tenders that are missing PDF data (not yet enriched)
  const { data: pendingTenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .is('pdf_url', null)
    .order('created_at', { ascending: true })
    .limit(LIMIT);

  if (error) {
    console.error('>>> [ENRICHER] Failed to fetch pending tenders:', error.message);
    return;
  }

  if (!pendingTenders || pendingTenders.length === 0) {
    console.log('>>> [ENRICHER] No pending tenders found. All tenders are fully enriched!');
    return;
  }

  console.log(`>>> [ENRICHER] Found ${pendingTenders.length} tenders to enrich.`);

  // Launch browser to handle PDF downloads
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  let successCount = 0;
  let failCount = 0;

  for (const tender of pendingTenders) {
    console.log(`\n>>> [ENRICHER] Processing ${tender.bid_number} ...`);

    // Build the PDF link from the bid number
    const pdfLink = `https://bidplus.gem.gov.in/showbiddata/${tender.bid_number}`;
    let pdfPublicUrl: string | null = null;
    let aiData: any = null;

    try {
      // ── Step 1: Download PDF ──────────────────────────────────────────────
      let buffer: Buffer | undefined;
      const downloadPage = await context.newPage();

      try {
        const downloadPromise = downloadPage.waitForEvent('download', { timeout: 30000 });
        await downloadPage.goto(pdfLink, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
        const download = await downloadPromise;
        const tempPath = path.join(process.cwd(), 'tmp', `enrich_${tender.bid_number.replace(/\//g, '-')}.pdf`);
        await download.saveAs(tempPath);
        buffer = fs.readFileSync(tempPath);
        fs.unlinkSync(tempPath);
      } catch {
        // Try direct request as fallback
        const response = await context.request.get(pdfLink).catch(() => null);
        if (response && response.headers()['content-type']?.includes('pdf')) {
          buffer = Buffer.from(await response.body());
        }
      } finally {
        await downloadPage.close();
      }

      if (!buffer || buffer.length < 5000) {
        console.warn(`>>> [ENRICHER] PDF too small or missing for ${tender.bid_number}. Skipping.`);
        failCount++;
        continue;
      }

      // ── Step 2: Upload PDF to Supabase Storage ────────────────────────────
      const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('tender-documents')
        .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadErr) {
        console.error(`>>> [ENRICHER] Upload error: ${uploadErr.message}`);
      } else {
        const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(uploadData.path);
        pdfPublicUrl = urlData.publicUrl;
        console.log(`>>> [ENRICHER] PDF uploaded: ${pdfPublicUrl}`);
      }

      // ── Step 3: Extract text & call AI ───────────────────────────────────
      let extractedText = '';
      try {
        const parserFunc = typeof pdf === 'function' ? pdf : (pdf as any).default;
        if (typeof parserFunc === 'function') {
          const data = await parserFunc(buffer);
          extractedText = data.text || '';
        }
      } catch (e: any) {
        console.warn(`>>> [ENRICHER] PDF parse error: ${e.message}`);
      }

      if (extractedText.length > 50) {
        console.log(`>>> [ENRICHER] Calling AI for ${tender.bid_number}...`);
        aiData = await extractTenderData(extractedText);
      }

      // ── Step 4: Update the tender record ─────────────────────────────────
      const auth = aiData?.authority;
      const updatePayload: any = {
        pdf_url: pdfPublicUrl,
      };

      if (aiData) {
        updatePayload.title = aiData.tender_title || undefined;
        updatePayload.ministry_name = auth?.ministry || null;
        updatePayload.department_name = auth?.department || null;
        updatePayload.organisation_name = auth?.organisation || null;
        updatePayload.office_name = auth?.office || null;
        updatePayload.state = auth?.state || null;
        updatePayload.city = auth?.city || null;
        updatePayload.department = auth?.organisation || auth?.department || auth?.ministry || null;
        updatePayload.emd_amount = aiData.emd_amount ?? null;
        updatePayload.ai_summary = aiData.technical_summary || null;
        updatePayload.eligibility_msme = aiData.eligibility?.msme || false;
        updatePayload.eligibility_mii = aiData.eligibility?.mii || false;
        updatePayload.mse_relaxation = aiData.relaxations?.mse_experience || null;
        updatePayload.startup_relaxation = aiData.relaxations?.startup_experience || null;
        updatePayload.documents_required = aiData.documents_required || [];
        updatePayload.opening_date = aiData.bid_opening_date || null;
      }

      const { error: updateErr } = await supabase
        .from('tenders')
        .update(updatePayload)
        .eq('id', tender.id);

      if (updateErr) {
        console.error(`>>> [ENRICHER] DB update error: ${updateErr.message}`);
        failCount++;
      } else {
        console.log(`>>> [ENRICHER] ✓ SUCCESS: ${tender.bid_number}`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`>>> [ENRICHER] Unexpected error for ${tender.bid_number}: ${err.message}`);
      failCount++;
    }

    // Small delay to avoid overloading the system and API rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();

  console.log(`\n>>> [ENRICHER] Run complete.`);
  console.log(`    ✓ Enriched: ${successCount}`);
  console.log(`    ✗ Failed:   ${failCount}`);
  console.log(`    Remaining:  Run again to process the next batch.\n`);
}

enrichTenders();
