/**
 * Leaf-Page Scraper v3 — SOLR Pagination
 *
 * Paginates through GeM's SOLR all-bids-data API (same approach as
 * solr-enrich.ts), matches each bid to the DB by bid_number, stores
 * the SOLR structured data as `raw_text` + fills direct fields.
 * Run `npm run bulk-enrich -- --from-raw-text` afterwards for AI enrichment.
 *
 * Usage:
 *   npm run scrape-leaves                        # all pages
 *   npm run scrape-leaves -- --start=1           # start from SOLR page N
 *   npm run scrape-leaves -- --limit=1000        # stop after N bids processed
 *   npm run scrape-leaves -- --enrich            # also run Groq AI inline
 *   npm run scrape-leaves -- --reset             # clear checkpoint
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import axios from 'axios';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { normalizeState, normalizeCity, cityToState } from '../lib/locations.js';
import { detectCategory } from '../lib/categories.js';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const argv       = process.argv.slice(2);
const LIMIT      = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1]  || '999999', 10);
const START_PAGE = parseInt(argv.find(a => a.startsWith('--start='))?.split('=')[1]  || '1',       10);
const RESET      = argv.includes('--reset');
const ENRICH     = argv.includes('--enrich');
const CHECKPOINT = path.join(process.cwd(), 'leaf-scrape-progress.json');
const SOLR_PAGE_ROWS = 10; // SOLR returns 10 per page
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── SOLR Session ─────────────────────────────────────────────────────────────
let solrCookies = '';
let solrCsrf    = '';

async function refreshSolrSession(): Promise<boolean> {
  try {
    const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      timeout: 30000,
    });
    solrCookies = res.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
    solrCsrf    = (res.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';
    return !!(solrCookies && solrCsrf);
  } catch {
    return false;
  }
}

/** Fetch one page of bids from SOLR. Returns docs array or null on error. */
async function fetchSolrPage(page: number): Promise<Record<string, any>[] | null> {
  const form = new URLSearchParams();
  form.append('payload', JSON.stringify({
    page,
    param: { searchParam: 'searchbid' },
    filter: {},
  }));
  form.append('csrf_bd_gem_nk', solrCsrf);

  try {
    const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
      httpsAgent,
      headers: {
        'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type':     'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer':          'https://bidplus.gem.gov.in/all-bids',
        'Cookie':           solrCookies,
      },
      timeout: 20000,
    });
    return r.data?.response?.response?.docs || [];
  } catch (e: any) {
    if (e.response?.status === 403 || e.response?.status === 419) {
      solrCsrf = '';
      await refreshSolrSession();
    }
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildRawText(bidNumber: string, title: string, doc: Record<string, any>): string {
  const lines: string[] = [
    `BID NUMBER: ${bidNumber}`,
    `TITLE: ${title}`,
  ];
  const add = (label: string, val: any) => {
    if (val === null || val === undefined) return;
    const v = Array.isArray(val) ? val.join(', ') : String(val);
    if (v) lines.push(`${label}: ${v}`);
  };
  add('CATEGORY', doc.b_category_name?.[0] || doc.bd_category_name?.[0]);
  add('MINISTRY', doc.ba_official_details_minName?.[0]);
  add('DEPARTMENT', doc.ba_official_details_deptName?.[0]);
  add('QUANTITY', doc.b_total_quantity?.[0]);
  add('BID TYPE', doc.b_bid_type?.[0] === 2 ? 'Reverse Auction' : 'Open Bid');
  add('START DATE', doc.final_start_date_sort?.[0]);
  add('END DATE', doc.final_end_date_sort?.[0]);
  if (doc.is_high_value) lines.push('HIGH VALUE: Yes');
  return lines.join('\n');
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────
function loadCheckpoint(): { page: number; totalDone: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { page: START_PAGE, totalDone: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { page: START_PAGE, totalDone: 0 }; }
}
function saveCheckpoint(page: number, totalDone: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ page, totalDone, updatedAt: new Date().toISOString() }));
}

// ─── Optional inline AI ───────────────────────────────────────────────────────
async function enrichOne(
  tender: { id: string; bid_number: string; title: string | null },
  rawText: string,
): Promise<boolean> {
  try {
    const { extractTenderDataGroq } = await import('../lib/groq-ai.js') as any;
    const aiData = await extractTenderDataGroq(rawText);
    if (!aiData) return false;
    const auth = aiData.authority;
    const payload: any = {
      ai_summary:        aiData.technical_summary || null,
      title:             aiData.tender_title || tender.title,
      ministry_name:     auth?.ministry    || null,
      department_name:   auth?.department  || null,
      organisation_name: auth?.organisation || null,
      office_name:       auth?.office      || null,
      state:             normalizeState(auth?.consignee_state || auth?.state),
      city:              normalizeCity(auth?.consignee_city  || auth?.city),
      emd_amount:        aiData.emd_amount || null,
      quantity:          aiData.quantity   || null,
      eligibility_msme:  aiData.eligibility?.msme || false,
      eligibility_mii:   aiData.eligibility?.mii  || false,
      documents_required: aiData.documents_required || [],
      category:          aiData.category || detectCategory(tender.title || '') || null,
      bid_type:          /\/RA\//i.test(tender.bid_number) ? 'Reverse Auction' : 'Open Bid',
      procurement_type:  aiData.procurement_type || null,
      keywords:          aiData.keywords || [],
      enrichment_tried_at: new Date().toISOString(),
    };
    if (payload.city && !payload.state) {
      const inf = cityToState(payload.city); if (inf) payload.state = inf;
    }
    await supabase.from('tenders').update(payload).eq('id', tender.id);
    return true;
  } catch { return false; }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [SCRAPE-LEAVES v3] GeM SOLR Pagination Scraper`);
  console.log(`    Limit: ${LIMIT} | Start page: ${START_PAGE} | Enrich inline: ${ENRICH}`);
  console.log(`    Paginates SOLR all-bids-data, matches to DB, stores raw_text\n`);

  process.stdout.write('Connecting to GeM SOLR... ');
  const ok = await refreshSolrSession();
  if (!ok) { console.log('❌ FAILED'); process.exit(1); }
  console.log('✅ Connected\n');

  let { page: resumePage, totalDone } = loadCheckpoint();
  if (resumePage > START_PAGE) console.log(`>>> Resuming from SOLR page ${resumePage} (${totalDone} already done)\n`);

  const stats   = { saved: 0, noMatch: 0, enriched: 0 };
  const startMs = Date.now();
  let currentPage = resumePage;

  while (stats.saved + stats.noMatch < LIMIT) {
    process.stdout.write(`\r  SOLR page ${currentPage} | saved=${stats.saved} noMatch=${stats.noMatch}${ENRICH ? ` enriched=${stats.enriched}` : ''}   `);

    const docs = await fetchSolrPage(currentPage);
    if (docs === null) {
      console.log(`\n  SOLR fetch error on page ${currentPage} — refreshing session...`);
      await refreshSolrSession();
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    if (!docs.length) {
      console.log(`\n>>> No more SOLR results at page ${currentPage} — done.`);
      break;
    }

    // Extract bid numbers and look them up in DB
    const bidNumbers = docs.map(d => d.b_bid_number?.[0]).filter(Boolean) as string[];
    if (!bidNumbers.length) { currentPage++; continue; }

    const { data: dbRows } = await supabase
      .from('tenders')
      .select('id, bid_number, title, raw_text')
      .in('bid_number', bidNumbers);

    const dbMap = new Map((dbRows || []).map(r => [r.bid_number, r]));

    // Process each doc
    for (const doc of docs) {
      const bidNo = doc.b_bid_number?.[0];
      if (!bidNo) continue;

      const row = dbMap.get(bidNo);
      if (!row) { stats.noMatch++; continue; } // not in our DB
      if (row.raw_text && !RESET) { continue; } // already scraped

      const rawText = buildRawText(bidNo, row.title || bidNo, doc);

      const directUpdate: any = {
        raw_text: rawText,
        enrichment_tried_at: new Date().toISOString(),
      };

      // Apply SOLR fields directly
      if (doc.ba_official_details_minName?.[0]) directUpdate.ministry_name   = doc.ba_official_details_minName[0];
      if (doc.ba_official_details_deptName?.[0]) directUpdate.department_name = doc.ba_official_details_deptName[0];
      if (doc.b_total_quantity?.[0])            directUpdate.quantity         = doc.b_total_quantity[0];
      if (doc.b_category_name?.[0] || doc.bd_category_name?.[0]) {
        const localCat = detectCategory(row.title || '');
        if (localCat) directUpdate.category = localCat;
      }
      directUpdate.bid_type = /\/RA\//i.test(bidNo) ? 'Reverse Auction' : (doc.b_bid_type?.[0] === 2 ? 'Reverse Auction' : 'Open Bid');

      await supabase.from('tenders').update(directUpdate).eq('id', row.id);
      stats.saved++;

      if (ENRICH) {
        const ok = await enrichOne({ id: row.id, bid_number: bidNo, title: row.title }, rawText);
        if (ok) stats.enriched++;
      }
    }

    saveCheckpoint(currentPage, totalDone + stats.saved);
    currentPage++;
    await new Promise(r => setTimeout(r, 800)); // gentle rate limit
  }

  const totalMin = ((Date.now() - startMs) / 60000).toFixed(1);
  console.log(`\n\n>>> [SCRAPE-LEAVES] Done in ${totalMin}m`);
  console.log(`    Saved raw_text: ${stats.saved} | No DB match: ${stats.noMatch}${ENRICH ? ` | AI enriched: ${stats.enriched}` : ''}`);
  if (!ENRICH) console.log(`\n>>> Next: npm run bulk-enrich -- --from-raw-text`);
}

main().catch(console.error);
