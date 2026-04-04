/**
 * Leaf-Page Enricher — Navigates GeM listing, downloads PDFs per-page context.
 *
 * GeM validates PDF downloads against the active listing session — direct URL
 * access returns 0 bytes. This script stays on the listing page while it downloads
 * each visible bid's PDF (via page.request.get), replicating real browser behaviour.
 *
 * Usage:
 *   npm run leaf-enrich                          # all unenriched active tenders
 *   npm run leaf-enrich -- --workers=3           # N parallel listing browsers
 *   npm run leaf-enrich -- --start=100           # resume from listing page 100
 *   npm run leaf-enrich -- --reset               # clear checkpoint and restart
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { extractTenderDataGroq } from '../lib/groq-ai.js';
import { normalizeState, normalizeCity, extractCityStateFromConsigneeTable, cityToState } from '../lib/locations.js';
import { detectCategory } from '../lib/categories.js';

chromium.use(stealth());

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const argv       = process.argv.slice(2);
const WORKERS    = parseInt(argv.find(a => a.startsWith('--workers='))?.split('=')[1]  || '2',    10);
const START_PAGE = parseInt(argv.find(a => a.startsWith('--start='))?.split('=')[1]   || '1',    10);
const PAGE_DELAY = parseInt(argv.find(a => a.startsWith('--delay='))?.split('=')[1]   || '3000', 10);
const RESET      = argv.includes('--reset');
const CHECKPOINT = path.join(process.cwd(), 'leaf-enrich-progress.json');
const TMP_DIR    = path.join(process.cwd(), 'tmp');
// ─────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectBidType(bidNo: string, title: string): string {
  if (/\/RA\//i.test(bidNo) || /reverse\s*auction/i.test(title)) return 'Reverse Auction';
  if (/custom\s*bid/i.test(title)) return 'Custom Bid';
  return 'Open Bid';
}

function parseGeMDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (!dateMatch) return null;
    const [, day, month, year] = dateMatch;
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
    let h = '00', m = '00', s = '00';
    if (timeMatch) {
      h = timeMatch[1].padStart(2, '0');
      m = timeMatch[2];
      if (timeMatch[3]) s = timeMatch[3];
      if (timeMatch[4]?.toUpperCase() === 'PM' && parseInt(h) < 12) h = String(parseInt(h) + 12).padStart(2, '0');
      if (timeMatch[4]?.toUpperCase() === 'AM' && h === '12') h = '00';
    }
    return new Date(`${year}-${month}-${day}T${h}:${m}:${s}+05:30`).toISOString();
  } catch { return null; }
}

async function parsePdf(buffer: Buffer): Promise<string | null> {
  try {
    const _lib: any = await import('pdf-parse');
    const pdfLib = _lib.default || _lib;
    const ParserClass = pdfLib.PDFParse || pdfLib;
    if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
      const instance = new ParserClass({ data: buffer, max: 0 });
      const result = await instance.getText();
      await instance.destroy?.();
      return result.text?.trim() || null;
    }
    const fn = typeof pdfLib === 'function' ? pdfLib : pdfLib.default;
    const result = await fn(buffer, { max: 0 });
    return result.text?.trim() || null;
  } catch { return null; }
}

function loadCheckpoint(): { page: number; totalEnriched: number } {
  if (RESET || !fs.existsSync(CHECKPOINT)) return { page: START_PAGE, totalEnriched: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf-8')); }
  catch { return { page: START_PAGE, totalEnriched: 0 }; }
}

function saveCheckpoint(page: number, totalEnriched: number) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ page, totalEnriched, updatedAt: new Date().toISOString() }));
}

// ─── Download PDF via listing-page session ────────────────────────────────────
// MUST be called while the browser page is on an all-bids listing page that
// shows this bid — GeM validates the session against the active listing context.
async function downloadPdf(page: any, pdfUrl: string): Promise<Buffer | null> {
  try {
    const resp = await page.request.get(pdfUrl, {
      timeout: 20000,
      headers: {
        'Referer': 'https://bidplus.gem.gov.in/all-bids',
        'Accept': 'application/pdf,*/*',
      },
    });
    if (!resp.ok()) return null;
    const body = await resp.body();
    if (!body || body.length < 1000) return null;
    return Buffer.from(body);
  } catch { return null; }
}

// ─── Enrich one tender using its PDF buffer ───────────────────────────────────
async function enrichFromBuffer(
  tender: { id: string; bid_number: string; title: string | null },
  buffer: Buffer,
): Promise<boolean> {
  const text = await parsePdf(buffer);
  if (!text || text.length < 50) return false;

  const aiData = await extractTenderDataGroq(text);
  if (!aiData) return false;

  const auth = aiData.authority;
  const updatePayload: any = {
    ai_summary:        aiData.technical_summary || null,
    title:             aiData.tender_title || tender.title,
    ministry_name:     auth?.ministry    || null,
    department_name:   auth?.department  || null,
    organisation_name: auth?.organisation || null,
    office_name:       auth?.office      || null,
    state:             normalizeState(auth?.consignee_state || auth?.state),
    city:              normalizeCity(auth?.consignee_city  || auth?.city),
  };

  // Regex fallback for city/state when AI misses
  if (!updatePayload.city || !updatePayload.state) {
    const loc = extractCityStateFromConsigneeTable(text);
    if (!updatePayload.city  && loc.city)  updatePayload.city  = loc.city;
    if (!updatePayload.state && loc.state) updatePayload.state = loc.state;
    if (updatePayload.city && !updatePayload.state) {
      const inferred = cityToState(updatePayload.city);
      if (inferred) updatePayload.state = inferred;
    }
  }

  Object.assign(updatePayload, {
    emd_amount:       aiData.emd_amount || null,
    quantity:         aiData.quantity   || null,
    eligibility_msme: aiData.eligibility?.msme || false,
    eligibility_mii:  aiData.eligibility?.mii  || false,
    mse_relaxation:              aiData.relaxations?.mse_experience  || null,
    mse_turnover_relaxation:     aiData.relaxations?.mse_turnover    || null,
    startup_relaxation:          aiData.relaxations?.startup_experience || null,
    startup_turnover_relaxation: aiData.relaxations?.startup_turnover || null,
    documents_required: aiData.documents_required || [],
    category:     aiData.category || detectCategory((aiData.tender_title || '') + ' ' + (aiData.technical_summary || '')) || null,
    bid_type:     detectBidType(tender.bid_number, aiData.tender_title || ''),
    procurement_type: aiData.procurement_type || null,
    keywords:     aiData.keywords || [],
    estimated_value:    aiData.estimated_value || null,
    epbg_percentage:    aiData.epbg_percentage || null,
    min_turnover_lakhs: aiData.min_turnover_lakhs || null,
    experience_years:   aiData.experience_years || null,
    delivery_days:      aiData.delivery_days || null,
    num_consignees:     aiData.num_consignees || null,
    enrichment_tried_at: new Date().toISOString(),
  });

  if (aiData.dates) {
    const od = parseGeMDate(aiData.dates.bid_opening_date); if (od) updatePayload.opening_date = od;
    const sd = parseGeMDate(aiData.dates.bid_start_date);   if (sd) updatePayload.start_date   = sd;
    const pd = parseGeMDate(aiData.pre_bid_date);           if (pd) updatePayload.pre_bid_date = pd;
    const ed = parseGeMDate(aiData.dates.bid_end_date);
    if (ed && new Date(ed) > new Date()) updatePayload.end_date = ed;
  }

  await supabase.from('tenders').update(updatePayload).eq('id', tender.id);
  return true;
}

// ─── Worker: runs one browser, walks listing pages ───────────────────────────
async function runWorker(workerId: number, startPage: number, stats: { enriched: number; skipped: number; noPdf: number }) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: false,  // we use page.request.get, not download events
  });

  const page = await ctx.newPage();

  try {
    // Navigate to starting listing page
    await page.goto(`https://bidplus.gem.gov.in/all-bids?page=${startPage}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForSelector('.card', { timeout: 30000 });

    let currentPage = startPage;

    while (true) {
      console.log(`\n  [W${workerId}] Page ${currentPage}`);

      // Extract all bid cards visible on this listing page
      const bids = await page.evaluate(() => {
        const items: { bidNo: string; pdfLink: string; dept: string; startDate: string; endDate: string }[] = [];
        document.querySelectorAll('.card').forEach(card => {
          const links = card.querySelectorAll('a.bid_no_hover');
          if (!links.length) return;
          const firstEl = links[0] as HTMLAnchorElement;
          const lastEl  = links[links.length - 1] as HTMLAnchorElement;
          const bidNo   = firstEl.textContent?.trim().replace(/^RA NO:?\s*/i, '').trim() || '';
          const pdfLink = lastEl.href || firstEl.href || '';

          // Department
          const deptCol = Array.from(card.querySelectorAll('.col-md-5, .col-md-4'))
            .find(c => c.textContent?.includes('Department Name And Address'));
          const deptRows = deptCol?.querySelectorAll('.row');
          const dept = deptRows && deptRows.length > 1
            ? deptRows[1].textContent?.trim() || 'N/A'
            : deptCol?.textContent?.replace('Department Name And Address:', '').trim() || 'N/A';

          const startDate = (card.querySelector('.start_date') as HTMLElement)?.textContent?.trim() || '';
          const endDate   = (card.querySelector('.end_date')   as HTMLElement)?.textContent?.trim() || '';

          if (bidNo && pdfLink) items.push({ bidNo, pdfLink, dept, startDate, endDate });
        });
        return items;
      });

      if (!bids.length) {
        console.log(`  [W${workerId}] No cards on page ${currentPage} — stopping.`);
        break;
      }

      // Check which bids are in DB
      const bidNumbers = bids.map(b => b.bidNo);
      const { data: existing } = await supabase
        .from('tenders')
        .select('id, bid_number, title, ai_summary, enrichment_tried_at, end_date')
        .in('bid_number', bidNumbers);

      const existingMap = new Map((existing || []).map(r => [r.bid_number, r]));

      // Insert stubs for bids not yet in DB
      const missing = bids.filter(b => !existingMap.has(b.bidNo));
      if (missing.length) {
        const stubs = missing.map(b => {
          const slug = b.bidNo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const sd = parseGeMDate(b.startDate) || new Date().toISOString();
          const ed = parseGeMDate(b.endDate)   || new Date(Date.now() + 30 * 864e5).toISOString();
          return { bid_number: b.bidNo, slug, title: `Tender ${b.bidNo}`, department: b.dept, start_date: sd, end_date: ed, details_url: b.pdfLink };
        }).filter(s => new Date(s.end_date) > new Date()); // active only

        if (stubs.length) {
          const { data: inserted } = await supabase
            .from('tenders')
            .upsert(stubs, { onConflict: 'bid_number', ignoreDuplicates: false })
            .select('id, bid_number, title, ai_summary, enrichment_tried_at, end_date');
          inserted?.forEach(r => existingMap.set(r.bid_number, r));
          console.log(`  [W${workerId}] +${stubs.length} new stubs inserted`);
        }
      }

      const needEnrichment = bids.filter(b => {
        const row = existingMap.get(b.bidNo);
        if (!row) return false;
        if (row.ai_summary) return false; // already enriched
        if (!row.end_date || new Date(row.end_date) < new Date()) return false; // expired
        return true;
      });

      console.log(`  [W${workerId}] ${bids.length} bids | ${needEnrichment.length} need enrichment`);

      // Download + enrich each bid WHILE staying on this listing page
      for (const bid of needEnrichment) {
        const row = existingMap.get(bid.bidNo)!;

        process.stdout.write(`\r  [W${workerId}] ${bid.bidNo} — downloading...        `);
        const buffer = await downloadPdf(page, bid.pdfLink);

        if (!buffer) {
          process.stdout.write(`\r  [W${workerId}] ${bid.bidNo} — no PDF               \n`);
          await supabase.from('tenders')
            .update({ enrichment_tried_at: new Date().toISOString() })
            .eq('id', row.id);
          stats.noPdf++;
          continue;
        }

        process.stdout.write(`\r  [W${workerId}] ${bid.bidNo} — ${buffer.length}b, enriching...   `);
        const ok = await enrichFromBuffer({ id: row.id, bid_number: bid.bidNo, title: row.title }, buffer);

        if (ok) {
          process.stdout.write(`\r  [W${workerId}] ${bid.bidNo} — ✓ enriched             \n`);
          stats.enriched++;
        } else {
          process.stdout.write(`\r  [W${workerId}] ${bid.bidNo} — AI failed               \n`);
          await supabase.from('tenders')
            .update({ enrichment_tried_at: new Date().toISOString() })
            .eq('id', row.id);
          stats.skipped++;
        }
      }

      // Navigate to next page
      currentPage++;
      const hasNext = await page.evaluate(() => {
        const btn = document.querySelector('a.page-link.next') as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (!hasNext) {
        console.log(`  [W${workerId}] No next page — done.`);
        break;
      }

      await page.waitForTimeout(PAGE_DELAY);
      await page.waitForSelector('.card', { timeout: 20000 }).catch(() => null);
    }
  } finally {
    await browser.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n>>> [LEAF-ENRICH] Listing-page PDF enricher`);
  console.log(`    Workers: ${WORKERS} | Start page: ${START_PAGE} | Delay: ${PAGE_DELAY}ms`);
  console.log(`    Downloads via page.request.get() while on listing — bypasses GeM block\n`);

  let { page: resumePage, totalEnriched } = loadCheckpoint();
  if (resumePage > START_PAGE) console.log(`>>> Resuming from listing page ${resumePage}\n`);

  const stats   = { enriched: 0, skipped: 0, noPdf: 0 };
  const startMs = Date.now();

  // Split listing pages across workers (interleaved: W1=1,3,5... W2=2,4,6...)
  await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => {
      const workerStart = resumePage + i;
      return runWorker(i + 1, workerStart, stats);
    })
  );

  const totalMin = ((Date.now() - startMs) / 60000).toFixed(1);
  console.log(`\n\n>>> [LEAF-ENRICH] Done in ${totalMin}m`);
  console.log(`    Enriched: ${stats.enriched} | No-PDF: ${stats.noPdf} | AI-fail: ${stats.skipped}`);
}

main().catch(console.error);
