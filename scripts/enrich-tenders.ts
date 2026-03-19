import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── CONFIG ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT       = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]       || '500', 10);
const CONCURRENCY = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '2',   10);
const BATCH_DELAY = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]       || '2000',10);
const SKIP_DAYS   = parseInt(args.find(a => a.startsWith('--skip-expired='))?.split('=')[1]|| '7',   10);
// ──────────────────────────────────────────────────────────────────────────

async function enrichTenders() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SKIP_DAYS);

  console.log(`\n>>> [ENRICHER] Starting enrichment run.`);
  console.log(`    Limit: ${LIMIT} | Concurrency: ${CONCURRENCY} | Skip expired before: ${cutoff.toDateString()}\n`);

  const { data: pending, error } = await supabase
    .from('tenders')
    .select('id, bid_number')
    .is('ai_summary', null)
    .gt('end_date', cutoff.toISOString())
    .order('end_date', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error('>>> [ENRICHER] Failed to fetch tenders:', error.message);
    return;
  }

  if (!pending?.length) {
    console.log('>>> [ENRICHER] No pending tenders found.');
    console.log('    To also process expired bids: npm run enrich -- --skip-expired=999');
    return;
  }

  console.log(`>>> [ENRICHER] Found ${pending.length} tenders to enrich.`);

  const { extractTenderData } = await import('../lib/gemini');

  // Launch ONE stealth browser for all requests
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  // Warm up — get full cookie jar including HttpOnly tokens
  console.log('>>> [ENRICHER] Warming up browser session on GeM...');
  const warmup = await context.newPage();
  await warmup.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await warmup.close();
  console.log('>>> [ENRICHER] Session ready.\n');

  let successCount = 0;
  let failCount = 0;

  const chunks: typeof pending[] = [];
  for (let i = 0; i < pending.length; i += CONCURRENCY)
    chunks.push(pending.slice(i, i + CONCURRENCY));

  for (let i = 0; i < chunks.length; i++) {
    console.log(`>>> [ENRICHER] Batch ${i + 1} / ${chunks.length}...`);

    const results = await Promise.all(chunks[i].map(async (tender) => {
      const bidUrl = `https://bidplus.gem.gov.in/showbiddata/${tender.bid_number}`;
      console.log(`    → ${tender.bid_number}`);

      // ── Step 1: Scrape the public bid detail page ─────────────────────
      const page = await context.newPage();
      let pageText = '';
      try {
        await page.goto(bidUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForSelector('table, .bid-detail, .container', { timeout: 8000 }).catch(() => {});
        pageText = await page.evaluate(() => document.body.innerText);
      } catch (e: any) {
        console.warn(`    ✗ Page load failed: ${e.message.split('\n')[0]}`);
      } finally {
        await page.close();
      }

      if (pageText.length < 200) {
        console.warn(`    ✗ No content scraped for ${tender.bid_number}`);
        return false;
      }

      // ── Step 2: AI extraction ─────────────────────────────────────────
      let aiData: any = null;
      try {
        aiData = await extractTenderData(pageText.substring(0, 10000));
      } catch (e: any) {
        if (e.message?.includes('429') || e.message?.includes('quota')) {
          console.warn(`    ✗ AI rate limit hit. Stopping batch.`);
          throw e;
        }
        console.warn(`    ✗ AI error for ${tender.bid_number}: ${e.message}`);
        return false;
      }

      // ── Step 3: Update database ───────────────────────────────────────
      const auth = aiData?.authority;
      const update: Record<string, any> = {
        ministry_name:               auth?.ministry             || null,
        department_name:             auth?.department           || null,
        organisation_name:           auth?.organisation         || null,
        office_name:                 auth?.office               || null,
        state:                       auth?.state                || null,
        city:                        auth?.city                 || null,
        department:                  auth?.organisation || auth?.department || auth?.ministry || null,
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

      if (aiData?.tender_title)             update.title        = aiData.tender_title;
      if (aiData?.dates?.bid_opening_date)  update.opening_date = aiData.dates.bid_opening_date;
      if (aiData?.dates?.bid_start_date)    update.start_date   = aiData.dates.bid_start_date;
      if (aiData?.dates?.bid_end_date)      update.end_date     = aiData.dates.bid_end_date;

      const { error: updateErr } = await supabase.from('tenders').update(update).eq('id', tender.id);
      if (updateErr) {
        console.error(`    ✗ DB error for ${tender.bid_number}: ${updateErr.message}`);
        return false;
      }

      console.log(`    ✓ ${tender.bid_number}`);
      return true;
    }));

    results.forEach(r => r ? successCount++ : failCount++);

    if (i < chunks.length - 1)
      await new Promise(r => setTimeout(r, BATCH_DELAY));
  }

  await browser.close();

  console.log(`\n>>> [ENRICHER] Run complete.`);
  console.log(`    ✓ Enriched: ${successCount}`);
  console.log(`    ✗ Failed:   ${failCount}`);
  console.log(`    Remaining:  Run again to process the next batch.\n`);
}

enrichTenders().catch(console.error);
