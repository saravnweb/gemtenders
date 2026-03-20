/**
 * Phase 1 — Fast Stub Crawler
 *
 * Scrapes all GeM BidPlus listing pages with NO AI, NO PDF downloads.
 * Saves basic stub records to DB so tenders appear on the site immediately.
 * Run Phase 2 (npm run enrich) afterwards to AI-enrich active tenders.
 *
 * Usage:
 *   npm run crawl                        # pages 1–4225
 *   npm run crawl -- --start=500         # resume from page 500
 *   npm run crawl -- --start=1 --end=100 # specific range
 *   npm run crawl -- --delay=1500        # custom ms delay between pages
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Also try .env if .env.local has no Supabase keys
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

chromium.use(stealth());

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const START_PAGE  = parseInt(args.find(a => a.startsWith('--start='))?.split('=')[1]  || '1',    10);
const END_PAGE    = parseInt(args.find(a => a.startsWith('--end='))?.split('=')[1]    || '4225', 10);
const PAGE_DELAY  = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1]  || '2000', 10);
const BATCH_SIZE  = 50; // rows per upsert
const CHECKPOINT  = path.join(process.cwd(), 'crawl-progress.json');
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simple slug: "GEM/2024/B/123456" → "gem-2024-b-123456"
function makeSlug(bidNo: string): string {
  return bidNo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseGeMDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (!dateMatch) return null;
    const [, day, month, year] = dateMatch;
    // Use \d{1,2} to match single and double digit hours (e.g. "9:00 AM" and "10:00 PM")
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
    let h = '00', m = '00', s = '00';
    if (timeMatch) {
      h = timeMatch[1].padStart(2, '0');
      m = timeMatch[2];
      s = timeMatch[3] || '00';
      const ampm = timeMatch[4]?.toUpperCase();
      if (ampm === 'PM' && parseInt(h) < 12) h = String(parseInt(h) + 12).padStart(2, '0');
      if (ampm === 'AM' && parseInt(h) === 12) h = '00';
    }
    // GeM dates are in IST (UTC+5:30) — store as UTC
    return new Date(`${year}-${month}-${day}T${h}:${m}:${s}+05:30`).toISOString();
  } catch { return null; }
}

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

async function upsertBatch(rows: any[]) {
  if (!rows.length) return;
  const { error } = await supabase
    .from('tenders')
    .upsert(rows, { onConflict: 'bid_number', ignoreDuplicates: false });
  if (error) console.error(`  [DB] Upsert error: ${error.message}`);
}

async function main() {
  // Resume from checkpoint if no explicit --start provided
  const explicitStart = args.some(a => a.startsWith('--start='));
  let resumePage = START_PAGE;
  if (!explicitStart) {
    const cp = loadCheckpoint();
    if (cp && cp >= START_PAGE) {
      resumePage = cp + 1;
      console.log(`\n>>> [CRAWL] Resuming from checkpoint: page ${resumePage}`);
    }
  }

  console.log(`\n>>> [CRAWL] Phase 1 — Fast Stub Crawler`);
  console.log(`    Pages: ${resumePage} → ${END_PAGE} | Delay: ${PAGE_DELAY}ms | Batch: ${BATCH_SIZE}`);
  console.log(`    No AI. No PDFs. Just listing data.\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Navigate to start page
  console.log(`>>> [CRAWL] Loading page ${resumePage}...`);
  try {
    await page.goto(`https://bidplus.gem.gov.in/all-bids?page=${resumePage}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    await page.waitForSelector('.card', { timeout: 30000 });
  } catch (e: any) {
    console.error(`>>> [CRAWL] Failed to load initial page: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  let totalSaved = 0;
  let currentPage = resumePage;

  for (let p = resumePage; p <= END_PAGE; p++) {
    currentPage = p;

    // Scrape all bid cards on this page
    const pageBids = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('.card').forEach(el => {
        const bidNoEl = el.querySelector('a.bid_no_hover');
        if (!bidNoEl) return;

        const bidNo = bidNoEl.textContent?.trim() || '';
        const detailsUrl = (bidNoEl as HTMLAnchorElement).href || '';
        const cardBody = el.querySelector('.card-body');

        // Department
        const deptCol = Array.from(cardBody?.querySelectorAll('.col-md-5, .col-md-4') || [])
          .find(c => c.textContent?.includes('Department Name And Address'));
        let department = 'N/A';
        if (deptCol) {
          const rows = deptCol.querySelectorAll('.row');
          department = rows.length > 1
            ? rows[1].textContent?.trim() || 'N/A'
            : deptCol.textContent?.replace('Department Name And Address:', '')?.trim() || 'N/A';
        }

        // Description / Items
        const itemsCol = Array.from(cardBody?.querySelectorAll('.col-md-4') || [])
          .find(c => c.textContent?.includes('Items:'));
        let description = '';
        if (itemsCol) {
          const popoverEl = itemsCol.querySelector('a[data-toggle="popover"]');
          description = popoverEl
            ? popoverEl.getAttribute('data-content') || popoverEl.textContent?.trim() || ''
            : itemsCol.textContent?.replace('Items:', '')?.replace('Quantity:', '')?.split('\n')[0]?.trim() || '';
        }

        const startDate = el.querySelector('.start_date')?.textContent?.trim() || '';
        const endDate   = el.querySelector('.end_date')?.textContent?.trim()   || '';

        if (bidNo) items.push({ bidNo, description, department, startDate, endDate, detailsUrl });
      });
      return items;
    });

    if (pageBids.length === 0) {
      console.log(`>>> [CRAWL] Page ${p}: no cards found — stopping.`);
      break;
    }

    // On first page, log raw date strings so we can verify the format is correct
    if (p === resumePage) {
      console.log('\n>>> [DEBUG] Raw date samples from page 1 (first 3 bids):');
      pageBids.slice(0, 3).forEach((b, i) => {
        console.log(`  Bid ${i + 1}: ${b.bidNo}`);
        console.log(`    startDate raw : "${b.startDate}"`);
        console.log(`    endDate raw   : "${b.endDate}"`);
        console.log(`    startDate parsed: ${parseGeMDate(b.startDate) || 'PARSE FAILED'}`);
        console.log(`    endDate parsed  : ${parseGeMDate(b.endDate) || 'PARSE FAILED'}`);
      });
      console.log('');
    }

    // Build DB rows — warn if date parsing fails (fallback = today, which is misleading)
    const parseFailed = pageBids.filter(b => !parseGeMDate(b.endDate));
    if (parseFailed.length > 0) {
      console.warn(`\n  [WARN] end_date parse FAILED for ${parseFailed.length} bid(s) on page ${p}:`);
      parseFailed.forEach(b => console.warn(`    ${b.bidNo}: endDate="${b.endDate}"`));
    }

    const now = new Date();
    const activeBids = pageBids.filter(b => {
      const parsedEnd = parseGeMDate(b.endDate);
      if (!parsedEnd) return true;
      return new Date(parsedEnd) > now;
    });

    // Determine which bids already exist in the database
    const bidNumbers = activeBids.map(b => b.bidNo);
    const { data: existingRecords, error: fetchErr } = await supabase
      .from('tenders')
      .select('bid_number')
      .in('bid_number', bidNumbers);

    if (fetchErr) {
      console.error(`  [DB] Fetch existing error: ${fetchErr.message}`);
    }

    const existingSet = new Set((existingRecords || []).map(r => r.bid_number));
    const newBids = activeBids.filter(b => !existingSet.has(b.bidNo));

    const DEEP_SCAN = args.includes('--deep');

    if (newBids.length === 0 && activeBids.length > 0) {
      console.log(`\n>>> [CRAWL] All active bids on page ${p} are already crawled.`);
      if (DEEP_SCAN) {
        console.log(`>>> [CRAWL] Deep scan enabled. Skipping insert and moving to next page...`);
      } else {
        console.log(`>>> [CRAWL] Stopping crawl to maintain clean and simple execution.`);
        console.log(`>>> [CRAWL] (Run with --deep to check all historical pages anyway)`);
        break;
      }
    }

    const rows = newBids.map(bid => ({
      bid_number:  bid.bidNo,
      slug:        makeSlug(bid.bidNo),
      title:       bid.description || `Tender ${bid.bidNo}`,
      department:  bid.department || 'N/A',
      start_date:  parseGeMDate(bid.startDate) || new Date().toISOString(),
      end_date:    parseGeMDate(bid.endDate)   || new Date().toISOString(),
      details_url: bid.detailsUrl.startsWith('http')
                     ? bid.detailsUrl
                     : `https://bidplus.gem.gov.in${bid.detailsUrl}`,
    }));

    // Batch upsert only new rows
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await upsertBatch(rows.slice(i, i + BATCH_SIZE));
    }

    totalSaved += rows.length;
    saveCheckpoint(p);

    // Progress log every 10 pages
    if (p % 10 === 0 || p === END_PAGE) {
      console.log(`  [CRAWL] Page ${p}/${END_PAGE} | +${rows.length} bids | Total saved: ${totalSaved}`);
    } else {
      process.stdout.write(`\r  Page ${p}/${END_PAGE} | Saved: ${totalSaved}`);
    }

    // Navigate to next page (unless last)
    if (p < END_PAGE) {
      const hasNext = await page.evaluate(() => {
        const btn = document.querySelector('a.page-link.next') as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        return false;
      });

      if (!hasNext) {
        console.log(`\n>>> [CRAWL] No next button found at page ${p}. Reached last page.`);
        break;
      }

      await page.waitForTimeout(PAGE_DELAY);

      // Wait for new cards to appear
      try {
        await page.waitForFunction(
          (prevCount: number) => document.querySelectorAll('.card').length > 0,
          pageBids.length,
          { timeout: 15000 }
        );
      } catch {
        // If timeout, just continue — page might have same count
      }
    }
  }

  await browser.close();

  // Clean up checkpoint on successful completion
  if (currentPage >= END_PAGE && fs.existsSync(CHECKPOINT)) {
    fs.unlinkSync(CHECKPOINT);
  }

  console.log(`\n\n>>> [CRAWL] Done! Total stubs saved: ${totalSaved}`);
  console.log(`>>> [CRAWL] Now run: npm run enrich -- --limit=2000 --concurrency=3`);
  console.log(`            (only active tenders will be processed by the enricher)\n`);
}

main().catch(e => {
  console.error('\n>>> [CRAWL] Fatal error:', e.message);
  process.exit(1);
});
