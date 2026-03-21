import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

import { normalizeState, normalizeCity } from '../lib/locations';
const { parseGeMDate } = await import('../lib/scraper/gem-scraper');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT       = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]       || '20000', 10);
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '1',   10);
const BATCH_DELAY = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]       || '0',10);
const BUCKET      = 'tender-documents';
// ──────────────────────────────────────────────────────────────────────────

/** Convert storage filename back to bid_number: "GEM-2026-B-7303381.pdf" → "GEM/2026/B/7303381" */
function fileNameToBidNumber(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').replace(/-/g, '/');
}

/** Fetch and parse PDF from a public URL */
async function parsePdfFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const _lib: any = await import('pdf-parse');
    const pdfLib = _lib.default || _lib;
    const ParserClass = pdfLib.PDFParse || pdfLib;
    let text = '';
    if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
      const instance = new ParserClass({ data: buf, max: 5 });
      const result = await instance.getText();
      text = result.text || '';
      await instance.destroy?.();
    } else {
      const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
      const parsed = await fn(buf, { max: 5 });
      text = parsed.text || '';
    }
    return text.trim() || null;
  } catch (e: any) {
    console.warn(`    ✗ pdf-parse error: ${e.message}`);
    return null;
  }
}

async function enrichTenders() {
  console.log(`\n>>> [ENRICHER] Starting enrichment from Supabase storage PDFs.`);
  console.log(`    Limit: ${LIMIT} | Concurrency: ${CONCURRENCY}\n`);

  // ── Step 1: List all PDF files in storage ────────────────────────────────
  console.log(`>>> [ENRICHER] Listing PDFs in bucket '${BUCKET}'...`);
  const allFiles: string[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: PAGE_SIZE, offset });

    if (error) { console.error('Storage list error:', error.message); break; }
    if (!data?.length) break;

    for (const f of data) {
      if (f.name.endsWith('.pdf')) allFiles.push(f.name);
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`>>> [ENRICHER] Found ${allFiles.length} PDFs in storage.\n`);
  if (!allFiles.length) {
    console.log('    No PDFs found in storage. Nothing to enrich.');
    return;
  }

  // ── Step 2: Find tenders that need enrichment and have a matching PDF ────
  // Convert filenames to bid_numbers
  const storageBidNumbers = allFiles.map(fileNameToBidNumber);

  // Fetch unenriched tenders that match storage PDFs (in batches of 500)
  const pending: { id: string; bid_number: string; pdf_url: string | null; title: string | null; }[] = [];

  for (let i = 0; i < storageBidNumbers.length; i += 500) {
    const chunk = storageBidNumbers.slice(i, i + 500);
    const { data, error } = await supabase
      .from('tenders')
      .select('id, bid_number, pdf_url, title')
      .in('bid_number', chunk)
      .is('ai_summary', null)
      .gte('end_date', new Date().toISOString())
      .limit(LIMIT - pending.length);

    if (error) { console.error('DB fetch error:', error.message); continue; }
    if (data) pending.push(...data);
    if (pending.length >= LIMIT) break;
  }

  if (!pending.length) {
    console.log('>>> [ENRICHER] No unenriched tenders found matching stored PDFs.');
    console.log('    All tenders with PDFs are already enriched, or none match.');
    console.log(`\n>>> [ENRICHER] Transitioning to download missing PDFs for unenriched tenders...`);
    const { runEnrichment } = await import('../lib/scraper/enricher');
    const result = await runEnrichment(LIMIT);
    console.log(`\n>>> [ENRICHER] Run complete. Downloaded & Enriched: ${result.processed}`);
    return;
  }

  console.log(`>>> [ENRICHER] Found ${pending.length} tenders to enrich from storage PDFs.\n`);

  // Build a map: bid_number → storage public URL
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  const storageUrlMap = new Map(
    allFiles.map(f => [
      fileNameToBidNumber(f),
      `${base}/storage/v1/object/public/${BUCKET}/${f}`
    ])
  );

  const { extractTenderDataRegex: extractTenderData } = await import('../lib/regex-extractor');
  const { triggerKeywordNotifications } = await import('../lib/notifications');


  let successCount = 0;
  let failCount = 0;

  const chunks: typeof pending[] = [];
  for (let i = 0; i < pending.length; i += CONCURRENCY)
    chunks.push(pending.slice(i, i + CONCURRENCY));

  for (let i = 0; i < chunks.length; i++) {
    console.log(`>>> [ENRICHER] Batch ${i + 1} / ${chunks.length}...`);

    await Promise.all(chunks[i].map(async (tender) => {
      console.log(`    → ${tender.bid_number}`);

      const pdfUrl = tender.pdf_url || storageUrlMap.get(tender.bid_number)!;

      // ── Parse PDF ────────────────────────────────────────────────────
      const pdfText = await parsePdfFromUrl(pdfUrl);
      if (!pdfText || pdfText.length < 100) {
        console.warn(`    ✗ Empty PDF: ${tender.bid_number}`);
        failCount++;
        return;
      }

      // ── AI extraction ─────────────────────────────────────────────────
      let aiData: any = null;
      try {
        aiData = await extractTenderData(pdfText.substring(0, 6000));
      } catch (e: any) {
        if (e.message?.includes('429') || e.message?.includes('quota')) {
          console.warn(`    ✗ AI rate limit hit. Stopping.`);
          throw e;
        }
        console.warn(`    ✗ AI error for ${tender.bid_number}: ${e.message}`);
        failCount++;
        return;
      }

      if (!aiData) {
        console.warn(`    ✗ No AI data returned for ${tender.bid_number}`);
        failCount++;
        return;
      }

      // ── Update database ───────────────────────────────────────────────
      const auth = aiData?.authority;
      const update: Record<string, any> = {
        pdf_url:                     pdfUrl,
        ministry_name:               auth?.ministry             || null,
        department_name:             auth?.department           || null,
        organisation_name:           auth?.organisation         || null,
        office_name:                 auth?.office               || null,
        state:                       normalizeState(auth?.state),
        city:                        normalizeCity(auth?.city),
        emd_amount:                  aiData?.emd_amount         ?? null,
        quantity:                    aiData?.quantity           || null,
        ai_summary:                  aiData?.technical_summary  || null,
        eligibility_msme:            aiData?.eligibility?.msme  || false,
        eligibility_mii:             aiData?.eligibility?.mii   || false,
        mse_relaxation:              aiData?.relaxations?.mse_experience    || null,
        startup_relaxation:          aiData?.relaxations?.startup_experience || null,
        mse_turnover_relaxation:     aiData?.relaxations?.mse_turnover      || null,
        startup_turnover_relaxation: aiData?.relaxations?.startup_turnover  || null,
        documents_required:          aiData?.documents_required || [],
        gemarpts_strings:            aiData?.gemarpts_strings   || null,
        gemarpts_result:             aiData?.gemarpts_result    || null,
        relevant_categories:         aiData?.relevant_categories || null,
      };

      const deptStr = auth?.organisation || auth?.department || auth?.ministry;
      if (deptStr) {
        update.department = deptStr;
      }

      if (aiData?.tender_title && !aiData.tender_title.trim().endsWith("...")) {
        update.title = aiData.tender_title;
      } else if (aiData?.tender_title && tender.title === "N/A") {
        update.title = aiData.tender_title;
      }
      let parsedEndDate: string | null = null;
      if (aiData?.dates?.bid_opening_date)  update.opening_date = parseGeMDate(aiData.dates.bid_opening_date) || aiData.dates.bid_opening_date;
      if (aiData?.dates?.bid_start_date)    update.start_date   = parseGeMDate(aiData.dates.bid_start_date) || aiData.dates.bid_start_date;
      if (aiData?.dates?.bid_end_date) {
         parsedEndDate = parseGeMDate(aiData.dates.bid_end_date) || aiData.dates.bid_end_date;
         update.end_date = parsedEndDate;
      }

      // If the AI discovered this tender is already expired, delete it!
      const nowMs = Date.now();
      if (parsedEndDate && new Date(parsedEndDate).getTime() < nowMs) {
          console.warn(`    ! DB discovered expired date ${parsedEndDate} for ${tender.bid_number}. Deleting...`);
          await supabase.from('tenders').delete().eq('id', tender.id);
          failCount++;
          return;
      }

      const { error: updateErr } = await supabase.from('tenders').update(update).eq('id', tender.id);
      if (updateErr) {
        console.error(`    ✗ DB error for ${tender.bid_number}: ${updateErr.message}`);
        failCount++;
        return;
      }

      console.log(`    ✓ ${tender.bid_number}`);
      
      // Trigger user keyword notifications (future integration)
      await triggerKeywordNotifications({
        id: tender.id,
        bid_number: tender.bid_number,
        ...update
      });

      successCount++;
    }));

    if (i < chunks.length - 1)
      await new Promise(r => setTimeout(r, BATCH_DELAY));
  }

  console.log(`\n>>> [ENRICHER] Local storage PDF Run complete.`);
  console.log(`    ✓ Enriched: ${successCount}`);
  console.log(`    ✗ Failed:   ${failCount}`);

  const remainingLimit = LIMIT - pending.length;
  if (remainingLimit > 0) {
    console.log(`\n>>> [ENRICHER] Processing ${remainingLimit} more unenriched tenders by downloading missing PDFs...`);
    const { runEnrichment } = await import('../lib/scraper/enricher');
    const result = await runEnrichment(remainingLimit);
    console.log(`    ✓ Downloaded & Enriched: ${result.processed}`);
  } else {
    console.log(`    Remaining:  Run again to process the next batch.\n`);
  }
}

enrichTenders().catch(console.error);
