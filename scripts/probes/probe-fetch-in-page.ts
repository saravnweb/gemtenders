/**
 * Probe: Test fetching GeM PDF from WITHIN the page's JS context using fetch().
 *
 * page.request.get() is a Node.js HTTP call — it misses SameSite=Strict cookies.
 * page.evaluate(fetch) runs inside the browser, shares the exact same origin,
 * and carries ALL cookies including HttpOnly + SameSite ones.
 *
 * Usage:  npx tsx scripts/probe-fetch-in-page.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';

chromium.use(stealth());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function probe() {
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url, title')
    .gte('end_date', new Date().toISOString())
    .not('details_url', 'is', null)
    .limit(3);

  if (!tenders?.length) { console.log('No active tenders.'); return; }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-gpu'],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: false,
  });
  const page = await ctx.newPage();

  // Establish session on listing page
  console.log('[1] Establishing session on listing page...');
  await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('.card', { timeout: 20000 }).catch(() => null);

  // Log all cookies set
  const cookies = await ctx.cookies();
  console.log(`    Cookies set: ${cookies.map(c => `${c.name}=${c.value.slice(0,8)}...`).join(', ')}`);

  for (const tender of tenders) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Bid: ${tender.bid_number}`);
    console.log(`URL: ${tender.details_url}`);

    // Extract just the path for same-origin fetch
    const urlObj = new URL(tender.details_url);
    const pdfPath = urlObj.pathname; // e.g. /showbidDocument/8720660

    // Approach: fetch() from within page JS context (same origin = full cookie access)
    console.log('\n  [in-page fetch] Running fetch() from page JS context:');
    try {
      const result = await page.evaluate(async (pdfPath: string) => {
        try {
          const resp = await fetch(pdfPath, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/pdf,*/*',
              'Referer': 'https://bidplus.gem.gov.in/all-bids',
            },
          });
          const buf = await resp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          return {
            status: resp.status,
            contentType: resp.headers.get('content-type'),
            contentLength: resp.headers.get('content-length'),
            byteLength: bytes.length,
            // First 5 bytes as numbers to check PDF header (%PDF = 37,80,68,70)
            header: Array.from(bytes.slice(0, 8)),
          };
        } catch (e: any) {
          return { error: e.message };
        }
      }, pdfPath);

      console.log(`  Status: ${result.status}`);
      console.log(`  Content-Type: ${result.contentType}`);
      console.log(`  Content-Length header: ${result.contentLength}`);
      console.log(`  Actual bytes received: ${result.byteLength ?? 'N/A'}`);
      if (result.header) {
        const headerStr = result.header.map((b: number) => String.fromCharCode(b)).join('');
        console.log(`  PDF header chars: "${headerStr}"`);
        console.log(`  Is PDF: ${headerStr.startsWith('%PDF') ? '✅ YES' : '❌ NO'}`);
      }
      if (result.error) console.log(`  ERROR: ${result.error}`);
    } catch (e: any) {
      console.log(`  Playwright error: ${e.message}`);
    }

    // Also try navigating listing page to page that SHOWS this bid, then fetch
    // to see if the listing context matters
  }

  await browser.close();
  console.log('\nProbe complete.');
}

probe().catch(console.error);
