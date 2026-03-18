import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const { extractTenderData } = await import('../lib/gemini');
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

// Helper function to safely read file
const fsReadFileSync = fs.readFileSync;
const fsUnlinkSync = fs.unlinkSync;
const fsExistsSync = fs.existsSync;

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// ─── CONFIG ────────────────────────────────────────────────────────────────
// How many tenders to process per run. Set higher once on Paid Tier.
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;

// How many to process at the EXACT same time
const CONCURRENCY = 1;
// ────────────────────────────────────────────────────────────────────────────

async function enrichTenders() {
  console.log(`\n>>> [ENRICHER] Starting enrichment run. Processing up to ${LIMIT} tenders...\n`);

  // Fetch tenders that are missing PDF data (not yet enriched)
  const { data: pendingTenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url, end_date, start_date')
    .is('pdf_url', null)
    .order('created_at', { ascending: false })
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

  // Acquire GeM cookies directly via native fetch to bypass WAF
  console.log('>>> [ENRICHER] Fetching GeM cookies...');
  const cRes = await fetch('https://bidplus.gem.gov.in/all-bids', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
  });
  const cookieJar: string[] = [];
  cRes.headers.forEach((val, key) => {
      if (key.toLowerCase() === 'set-cookie') cookieJar.push(val.split(';')[0]);
  });
  const sessionCookies = cookieJar.join('; ');
  console.log('>>> [ENRICHER] Cookies acquired effectively.');

  let successCount = 0;
  let failCount = 0;

  // Helper chunking function to process in batches of CONCURRENCY
  const chunks = [];
  for (let i = 0; i < pendingTenders.length; i += CONCURRENCY) {
    chunks.push(pendingTenders.slice(i, i + CONCURRENCY));
  }

  // Launch browser once for all UI fallback operations
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://bidplus.gem.gov.in/all-bids',
      'Cookie': sessionCookies
    }
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`\n>>> [ENRICHER] Processing batch ${i + 1} of ${chunks.length} (${chunk.length} items concurrently)...`);

    const promises = chunk.map(async (tender) => {
      console.log(`>>> [ENRICHER] Processing ${tender.bid_number} ...`);

    // Use the stored details URL which preferably contains the direct PDF download link
    const pdfLink = tender.details_url || `https://bidplus.gem.gov.in/showbiddata/${tender.bid_number}`;
    let pdfPublicUrl: string | null = null;
    let aiData: any = null;

    try {
      // ── Step 1: Download PDF ──────────────────────────────────────────────
      let buffer: Buffer | undefined;
      console.log(`>>> [ENRICHER] Attempting direct download natively: ${pdfLink}`);
      try {
        const res = await fetch(pdfLink, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://bidplus.gem.gov.in/all-bids',
                'Cookie': sessionCookies
            }
        });
        
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
            buffer = Buffer.from(arrayBuf);
        } else {
            console.log(`>>> [ENRICHER] Warn: Returned buffer too small. Content: `, Buffer.from(arrayBuf).toString('utf-8').substring(0, 150));
        }
      } catch (e: any) {
        console.log(`>>> [ENRICHER] Try error: ${e.message}`);
      }

      if (!buffer || buffer.length < 1000) {
        console.warn(`>>> [ENRICHER] PDF invalid or URL expired for ${tender.bid_number} (URL: ${pdfLink}). Length: ${buffer?.length}.`);
        console.warn(`>>> [ENRICHER] ⚠️  Executing UI Fallback Request to bypass WAF & fix expired URL...`);
        
        try {
          const searchPage = await context.newPage();
          await searchPage.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'load', timeout: 30000 });
          // The search box might take a moment to load via JS
          await searchPage.waitForSelector('input[type="search"], input#searchBid, .dataTables_filter input', { timeout: 15000 });
          
          const searchInput = await searchPage.$('input[type="search"], input#searchBid, .dataTables_filter input');
          if (searchInput) {
            await searchInput.fill(tender.bid_number);
            await searchPage.keyboard.press('Enter');
            // Try clicking the search button if the enter key didn't work
            try {
              const searchBtn = await searchPage.$('button.search, button.custom_search_button, #btn-search');
              if (searchBtn) await searchBtn.click();
            } catch (e) {}
          }
          
          await searchPage.waitForSelector(`a[href*="showbidDocument"], a[href*="showdirectradocument"], a.bid_no_hover`, { timeout: 15000 });
          
          let realPdfUrl = await searchPage.evaluate(() => document.querySelector('a.bid_no_hover, a[href*="showbidDocument"]')?.getAttribute('href'));
          if (realPdfUrl && realPdfUrl.startsWith('/')) {
            realPdfUrl = 'https://bidplus.gem.gov.in' + realPdfUrl;
          }
          await searchPage.close();

          if (realPdfUrl && realPdfUrl !== pdfLink) {
             console.log(`>>> [ENRICHER] Fallback found FRESH URL: ${realPdfUrl}`);
             // Retry download via manual request with new URL
             const fallbackPage = await context.newPage();
             const fallbackResponse = await fallbackPage.request.get(realPdfUrl);
             if (fallbackResponse.headers()['content-type']?.includes('pdf')) {
                 buffer = await fallbackResponse.body();
                 console.log(`>>> [ENRICHER] Fallback Download successful: ${buffer.length} bytes.`);
             }
             await fallbackPage.close();
          }
        } catch (searchErr: any) {
          console.log(`>>> [ENRICHER] Fallback UI search failed: ${searchErr.message}`);
        }

        if (!buffer || buffer.length < 1000) {
          console.warn(`>>> [ENRICHER] ⚠️  GeM Anti-Scraping WAF Triggered / No Document Found (0 Bytes). Skipping...`);
          return false;
        }
      }

      // ── Step 2: Upload PDF to Supabase Storage ────────────────────────────
      const fileName = `${tender.bid_number.replace(/\//g, '-')}.pdf`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('tender-documents')
        .upload(fileName, buffer as Buffer, { contentType: 'application/pdf', upsert: true });

      if (uploadErr) {
        console.error(`>>> [ENRICHER] Upload error: ${uploadErr.message}`);
      } else {
        const { data: urlData } = supabase.storage.from('tender-documents').getPublicUrl(uploadData.path);
        pdfPublicUrl = urlData.publicUrl;
        console.log(`>>> [ENRICHER] PDF uploaded: ${pdfPublicUrl}`);
      }

      // ── Step 3: Extract text & call AI ───────────────────────────────────
      let extractedText = "";
      try {
        const ParserClass = (pdf as any).PDFParse || pdf;
        if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
          const instance = new (ParserClass as any)({ data: buffer });
          const textResult = await instance.getText();
          extractedText = textResult.text || "";
          await instance.destroy?.();
        } else {
          const parserFunc = typeof pdf === 'function' ? pdf : (pdf as any).default || (pdf as any).PDFParse;
          if (typeof parserFunc === 'function') {
            const data = await parserFunc(buffer);
            extractedText = data.text || "";
          }
        }
      } catch (e: any) {
        console.warn(`>>> [ENRICHER] PDF parse error: ${e.message}`);
      }

      if (extractedText.length > 50) {
        console.log(`>>> [ENRICHER] Calling AI for ${tender.bid_number}...`);
        try {
          aiData = await extractTenderData(extractedText);
        } catch (e: any) {
          if (e.message?.includes('429') || e.message?.includes('quota')) {
            console.warn(`>>> [ENRICHER] AI Rate Limit hit. Skipping AI part for this tender.`);
          } else {
            console.warn(`>>> [ENRICHER] AI Error: ${e.message}`);
          }
        }
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
        updatePayload.quantity = aiData.quantity || null;
        updatePayload.ai_summary = aiData.technical_summary || null;
        updatePayload.eligibility_msme = aiData.eligibility?.msme || false;
        updatePayload.eligibility_mii = aiData.eligibility?.mii || false;
        updatePayload.mse_relaxation = aiData.relaxations?.mse_experience || null;
        updatePayload.startup_relaxation = aiData.relaxations?.startup_experience || null;
        updatePayload.mse_turnover_relaxation = aiData.relaxations?.mse_turnover || null;
        updatePayload.startup_turnover_relaxation = aiData.relaxations?.startup_turnover || null;
        updatePayload.documents_required = aiData.documents_required || [];
        if (aiData.dates) {
          if (aiData.dates.bid_opening_date) updatePayload.opening_date = aiData.dates.bid_opening_date;
          if (aiData.dates.bid_start_date) updatePayload.start_date = aiData.dates.bid_start_date;
          if (aiData.dates.bid_end_date) updatePayload.end_date = aiData.dates.bid_end_date;
        }
        
        updatePayload.gemarpts_strings = aiData.gemarpts_strings || null;
        updatePayload.gemarpts_result = aiData.gemarpts_result || null;
        updatePayload.relevant_categories = aiData.relevant_categories || null;
      }

      const { error: updateErr } = await supabase
        .from('tenders')
        .update(updatePayload)
        .eq('id', tender.id);

      if (updateErr) {
        console.error(`>>> [ENRICHER] DB update error for ${tender.bid_number}: ${updateErr.message}`);
        return false;
      } else {
        console.log(`>>> [ENRICHER] ✓ SUCCESS: ${tender.bid_number}`);
        return true;
      }
    } catch (err: any) {
      console.error(`>>> [ENRICHER] Unexpected error for ${tender.bid_number}: ${err.message}`);
      return false;
    }
    });

    // Wait for the entire batch to finish processing concurrently
    const results = await Promise.all(promises);
    results.forEach(res => {
      if (res) successCount++;
      else failCount++;
    });

    // Pause between single items so we don't get IP blocked by GeM WAF (which sends 0 bytes back)
    await new Promise(r => setTimeout(r, 8000));
  }

  console.log(`\n>>> [ENRICHER] Run complete.`);
  console.log(`    ✓ Enriched: ${successCount}`);
  console.log(`    ✗ Failed:   ${failCount}`);
  console.log(`    Remaining:  Run again to process the next batch.\n`);

  await browser.close();
}

enrichTenders();
