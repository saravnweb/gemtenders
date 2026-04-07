/**
 * Fast API Scraper — Direct GeM API caller (no browser)
 *
 * Fetches all active tenders via the GeM internal API.
 * Much faster than the Playwright crawler — handles ~35,000 tenders.
 *
 * Usage:
 *   npm run fast-scrape                          # all pages (auto-detected from API)
 *   npm run fast-scrape -- --pages=500           # first 500 pages
 *   npm run fast-scrape -- --start=200           # resume from page 200
 *   npm run fast-scrape -- --concurrency=5       # parallel requests per batch
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';

// Bypass SSL issues common with Indian government websites
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const CHECKPOINT = path.join(process.cwd(), 'fast-scrape-progress.json');

function generateSlug(bidNumber: string, title: string): string {
  const cleanBid   = bidNumber.replace(/\//g, '-').toLowerCase();
  const cleanTitle = title.toLowerCase()
    .replace(/_/g, '-') // Replace underscores with dashes
    .replace(/[^\w\s-]/g, '') // Keep alphanumeric, whitespace, and dashes
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Collapse multiple dashes
    .trim();
  return `${cleanBid}-${cleanTitle}`.slice(0, 120);
}
const MAX_SESSION_RETRY = 3;

// ─── Checkpoint helpers ───────────────────────────────────────────────────────
function saveCheckpoint(page: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastCompletedPage: page, updatedAt: new Date().toISOString() }));
}

function loadCheckpoint(): number | null {
  try {
    if (fs.existsSync(CHECKPOINT)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8'));
      return data.lastCompletedPage ?? null;
    }
  } catch {}
  return null;
}

// ─── Session ─────────────────────────────────────────────────────────────────
async function getGeMSessionInfo() {
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
    timeout: 30000,
  });

  const rawCookies: string[] = [];
  const setCookie = res.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    setCookie.forEach(c => rawCookies.push(c.split(';')[0]));
  }
  const cookieHeader = rawCookies.join('; ');

  const html: string = res.data;
  const match = html.match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/);
  if (!match) throw new Error("Could not extract CSRF token from GeM.");

  return { csrf: match[1], cookies: cookieHeader };
}

// ─── Single page fetch ────────────────────────────────────────────────────────
async function fetchGeMBidsPage(pageNum: number, csrf: string, cookies: string, sort = "Bid-End-Date-Oldest"): Promise<{ docs: any[]; numFound: number | null }> {
  const postdata = {
    page: pageNum,
    param: { searchParam: "searchbid" },
    filter: {
      bidStatusType: "ongoing_bids",
      byType: "all",
      sort,
    }
  };

  const formData = new URLSearchParams();
  formData.append('payload', JSON.stringify(postdata));
  formData.append('csrf_bd_gem_nk', csrf);

  const res = await axios.post('https://bidplus.gem.gov.in/all-bids-data', formData.toString(), {
    httpsAgent,
    headers: {
      'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Content-Type':     'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin':           'https://bidplus.gem.gov.in',
      'Referer':          'https://bidplus.gem.gov.in/all-bids',
      'Cookie':           cookies,
    },
    timeout: 30000,
  });

  const data = res.data;
  if (!data?.response?.response?.docs) return { docs: [], numFound: null };
  return {
    docs:     data.response.response.docs,
    numFound: data.response.response.numFound ?? null,
  };
}

// ─── Detect if a raw API doc is an RA bid ────────────────────────────────────
function isRaBid(bid: any): boolean {
  const bidType = bid.b_bid_type?.[0];
  return bidType === 2 || bidType === 5;
}

// ─── Map RA bid → update record for the ORIGINAL bid ─────────────────────────
// RA bids are NOT new tenders — they are procurement events on an existing bid.
// We update the original bid (b_bid_number_parent) with the RA details.
function mapRaToUpdate(bid: any): { parentBidNo: string; raNumber: string; raEndDate: string; raDetailsUrl: string } | null {
  const parentBidNo = bid.b_bid_number_parent?.[0];
  const raNumber    = bid.b_bid_number?.[0];
  if (!parentBidNo || !raNumber) return null;

  const bidType = bid.b_bid_type?.[0];
  const docLbl  = bidType === 5 ? 'showdirectradocumentPdf' : 'showradocumentPdf';
  const pdfId   = bid.b_id ? String(bid.b_id[0]) : '';
  const raDetailsUrl = `https://bidplus.gem.gov.in/${docLbl}/${pdfId}`;

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  let raEndDate = bid.final_end_date_sort?.[0] || '';
  if (!raEndDate || raEndDate.startsWith('-')) raEndDate = futureDate.toISOString();

  return { parentBidNo, raNumber, raEndDate, raDetailsUrl };
}

// ─── Map regular bid → DB row ─────────────────────────────────────────────────
function mapBidToRow(bid: any) {
  const bidNo = (bid.b_bid_number?.[0]) || (bid.b_bid_number_parent?.[0]) || "UNKNOWN";
  const title = bid.bd_category_name?.[0] || bid.b_category_name?.[0] || `Tender ${bidNo}`;

  const deptName = bid.ba_official_details_deptName?.[0] || null;
  const minName  = bid.ba_official_details_minName?.[0]  || null;
  let department = deptName || minName || "N/A";
  if (minName && deptName && minName !== deptName) department = `${minName}, ${deptName}`;

  const pdfId = bid.b_id_parent ? String(bid.b_id_parent[0]) : (bid.b_id ? String(bid.b_id[0]) : "");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  let startDate: string = bid.final_start_date_sort?.[0] || '';
  let endDate:   string = bid.final_end_date_sort?.[0]   || '';
  if (!startDate || startDate.startsWith('-')) startDate = new Date().toISOString();
  if (!endDate   || endDate.startsWith('-'))   endDate   = futureDate.toISOString();

  return {
    bid_number:  bidNo,
    slug:        generateSlug(bidNo, title),
    title,
    department,
    start_date:  startDate,
    end_date:    endDate,
    details_url: `https://bidplus.gem.gov.in/showbidDocument/${pdfId}`,
    is_high_value: bid.is_high_value?.[0] !== undefined ? bid.is_high_value[0] : false,
    is_single_packet: bid.ba_is_single_packet?.[0] === 1,
    is_bunch: bid.b_is_bunch?.[0] === 1,
    quantity: bid.b_total_quantity?.[0] !== undefined ? bid.b_total_quantity[0] : null,
    gem_category: bid.bd_category_name?.[0] || bid.b_category_name?.[0] || null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function runFastScrape(maxPages: number, concurrency: number = 5, startPage: number = 1, todayOnly = false) {
  const sort = todayOnly ? "Bid-Start-Date-Latest" : "Bid-End-Date-Oldest";
  const todayCutoff    = new Date(); todayCutoff.setHours(0, 0, 0, 0);    // midnight today
  const tomorrowCutoff = new Date(todayCutoff.getTime() + 24 * 60 * 60 * 1000); // midnight tomorrow

  console.log(`\n>>> [FAST-SCRAPE] Initializing GeM Session...`);
  let session = await getGeMSessionInfo();
  console.log(`>>> [FAST-SCRAPE] Session obtained. CSRF: ${session.csrf}`);
  console.log(`>>> [FAST-SCRAPE] Pages: ${startPage} → ${maxPages === Infinity ? 'auto' : maxPages} | Concurrency: ${concurrency} | Mode: ${todayOnly ? 'TODAY-ONLY' : 'ALL'}\n`);

  const { supabase } = await import('../lib/supabase.js');

  let page         = startPage;
  let totalSaved   = 0;
  let dynamicMax   = maxPages; // may be tightened after first page reveals numFound

  while (page <= dynamicMax) {
    const batchStart = page;

    // Build concurrent fetch promises for this batch
    const promises: Promise<{ pageNum: number; docs: any[]; numFound: number | null; ok: boolean; err?: string }>[] = [];
    for (let c = 0; c < concurrency && page <= dynamicMax; c++, page++) {
      const p = page;
      promises.push(
        fetchGeMBidsPage(p, session.csrf, session.cookies, sort)
          .then(({ docs, numFound }) => ({ pageNum: p, docs, numFound, ok: true }))
          .catch(e  => ({ pageNum: p, docs: [], numFound: null, ok: false, err: String(e.message) }))
      );
    }

    const results = await Promise.all(promises);

    // On first batch, read numFound and cap dynamicMax
    if (dynamicMax === maxPages) {
      const found = results.find(r => r.numFound !== null)?.numFound;
      if (found != null) {
        const apiMax = Math.ceil(found / 10);
        dynamicMax = Math.min(maxPages, apiMax);
        console.log(`>>> [FAST-SCRAPE] API reports ${found} records → ${apiMax} pages. Capping at ${dynamicMax}.\n`);
      }
    }

    // Detect session expiry: all requests failed with HTTP errors
    const httpFailed = results.filter(r => !r.ok);
    if (httpFailed.length === results.length) {
      console.warn(`\n>>> [FAST-SCRAPE] All pages in batch failed (pages ${batchStart}-${page - 1}). Refreshing session...`);

      let refreshed = false;
      for (let attempt = 1; attempt <= MAX_SESSION_RETRY; attempt++) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        try {
          session = await getGeMSessionInfo();
          console.log(`>>> [FAST-SCRAPE] Session refreshed (attempt ${attempt}). Retrying batch...`);
          refreshed = true;
          break;
        } catch (e: any) {
          console.error(`>>> [FAST-SCRAPE] Refresh attempt ${attempt} failed: ${e.message}`);
        }
      }

      if (!refreshed) {
        console.error(`>>> [FAST-SCRAPE] Could not refresh session after ${MAX_SESSION_RETRY} attempts. Stopping.`);
        break;
      }

      // Retry the same batch with fresh session
      page = batchStart;
      continue;
    }

    // Collect all docs from successful pages
    const allDocs: any[] = [];
    for (const r of results) {
      if (r.ok && r.docs.length > 0) allDocs.push(...r.docs);
      else if (!r.ok) console.warn(`  [WARN] Page ${r.pageNum} failed: ${r.err}`);
    }

    // If the entire batch came back empty, we've passed the last page of data
    if (allDocs.length === 0) {
      console.log(`\n>>> [FAST-SCRAPE] Empty batch at pages ${batchStart}-${page - 1}. Reached end of data.`);
      break;
    }

    // --today mode: stop when all docs on this batch started before today
    if (todayOnly) {
      const allOld = allDocs.every(bid => {
        const s = bid.final_start_date_sort?.[0];
        return s && new Date(s) < todayCutoff;
      });
      if (allOld) {
        console.log(`\n>>> [FAST-SCRAPE] All bids in batch started before today. Stopping early.`);
        break;
      }
    }

    // Split docs: RA bids vs regular bids
    const rowMap   = new Map<string, any>();
    const raUpdates: ReturnType<typeof mapRaToUpdate>[] = [];

    for (const bid of allDocs) {
      if (isRaBid(bid)) {
        const ra = mapRaToUpdate(bid);
        if (ra) raUpdates.push(ra);
      } else {
        const row = mapBidToRow(bid);
        if (row.bid_number === "UNKNOWN") continue;
        // Skip tenders closing today or earlier — only keep closing tomorrow onwards
        if (row.end_date && new Date(row.end_date) < tomorrowCutoff) continue;
        // --today: skip bids that started before today
        if (todayOnly && row.start_date && new Date(row.start_date) < todayCutoff) continue;
        if (!rowMap.has(row.bid_number)) rowMap.set(row.bid_number, row);
      }
    }
    const rows = Array.from(rowMap.values());

    // ── Insert / update regular bids ──────────────────────────────────────────
    if (rows.length > 0) {
      const { error: insertErr } = await supabase
        .from('tenders')
        .upsert(rows, { onConflict: 'bid_number', ignoreDuplicates: true });
      if (insertErr) console.error(">>> [FAST-SCRAPE] Insert Error:", insertErr.message);

      const updateResults = await Promise.all(
        rows.map(b =>
          supabase.from('tenders')
            .update({ 
              start_date: b.start_date, 
              end_date: b.end_date, 
              details_url: b.details_url,
              is_high_value: b.is_high_value,
              is_single_packet: b.is_single_packet,
              is_bunch: b.is_bunch,
              quantity: b.quantity,
              gem_category: b.gem_category
            })
            .eq('bid_number', b.bid_number)
        )
      );
      const updateErrors = updateResults.map(r => r.error).filter(Boolean);
      if (updateErrors.length > 0) console.error(">>> [FAST-SCRAPE] Update Error:", updateErrors[0]);

      totalSaved += rows.length;
    }

    // ── Update original bids with RA info ─────────────────────────────────────
    // For each RA, find the original bid and attach the RA number + deadline.
    // If the original bid was archived but the RA is still active → unarchive it.
    let raLinked = 0;
    for (const ra of raUpdates) {
      if (!ra) continue;
      const now = new Date();
      const raActive = new Date(ra.raEndDate) > now;

      const updatePayload: any = {
        ra_number:    ra.raNumber,
        ra_end_date:  ra.raEndDate,
        ra_notified:  false,          // trigger notification on next notify run
        details_url:  ra.raDetailsUrl, // point to the publicly accessible RA doc
      };

      // Unarchive if the RA is still active
      if (raActive) {
        updatePayload.is_archived  = false;
        updatePayload.archived_at  = null;
        updatePayload.end_date     = ra.raEndDate; // extend deadline to RA deadline
      }

      const { error } = await supabase
        .from('tenders')
        .update(updatePayload)
        .eq('bid_number', ra.parentBidNo);

      if (!error) raLinked++;
      else console.warn(`  [WARN] RA link failed for ${ra.parentBidNo}: ${error.message}`);
    }

    saveCheckpoint(page - 1);
    const raMsg = raLinked > 0 ? ` | RA linked: ${raLinked}` : '';
    console.log(`  Pages ${batchStart}–${page - 1} | +${rows.length} bids${raMsg} | Total saved: ${totalSaved}`);

    // Small delay between batches to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  // Remove checkpoint on successful completion
  if (page > dynamicMax && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);

  console.log(`\n>>> [FAST-SCRAPE] Done! Total saved: ${totalSaved}`);
}

// ─── CLI entry ────────────────────────────────────────────────────────────────
async function run() {
  const args = process.argv.slice(2);

  const pagesArg    = args.find(a => a.startsWith('--pages='))?.split('=')[1];
  const maxPages    = pagesArg ? parseInt(pagesArg, 10) : Infinity;
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5', 10);
  const todayOnly   = args.includes('--today');

  // Explicit --start overrides checkpoint
  let startPage = 1;
  const explicitStart = args.find(a => a.startsWith('--start='));
  if (explicitStart) {
    startPage = parseInt(explicitStart.split('=')[1], 10);
  } else if (!todayOnly) {
    // Only resume from checkpoint in full-scrape mode
    const cp = loadCheckpoint();
    if (cp) {
      startPage = cp + 1;
      console.log(`>>> [FAST-SCRAPE] Resuming from checkpoint: page ${startPage}`);
    }
  }

  await runFastScrape(maxPages, concurrency, startPage, todayOnly);
}

run().catch(e => {
  console.error('\n>>> [FAST-SCRAPE] Fatal error:', e.message);
  process.exit(1);
});
