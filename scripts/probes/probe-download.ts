/**
 * Probe: Test Playwright download-event interception for GeM PDFs.
 *
 * leaf-enrich.ts uses page.request.get() which returns 0 bytes (GeM blocks HTTP-level requests).
 * This probe uses page.waitForEvent('download') + page.goto() — a real browser download —
 * to check if the actual PDF bytes are returned via the browser download mechanism.
 *
 * Usage:  npx tsx scripts/probe-download.ts
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

chromium.use(stealth());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

async function probe() {
  // Pick 3 active tenders with known PDF URLs
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url, title')
    .gte('end_date', new Date().toISOString())
    .not('details_url', 'is', null)
    .limit(3);

  if (!tenders?.length) {
    console.log('No active tenders found.');
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-gpu'],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: true,  // KEY: enable downloads so we can intercept them
  });

  const page = await ctx.newPage();

  // Step 1: Visit listing page to establish session (same as leaf-enrich)
  console.log('\n[1] Visiting listing page to establish session...');
  await page.goto('https://bidplus.gem.gov.in/all-bids', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector('.card', { timeout: 20000 }).catch(() => null);
  console.log('    Session established.');

  for (const tender of tenders) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Bid:  ${tender.bid_number}`);
    console.log(`PDF URL: ${tender.details_url}`);

    // Approach A: page.request.get() — the current leaf-enrich approach (known to fail)
    console.log('\n  [A] page.request.get() (current approach):');
    try {
      const resp = await page.request.get(tender.details_url, {
        timeout: 15000,
        headers: {
          'Referer': 'https://bidplus.gem.gov.in/all-bids',
          'Accept': 'application/pdf,*/*',
        },
      });
      const body = await resp.body();
      console.log(`      Status: ${resp.status()} | Content-Type: ${resp.headers()['content-type']} | Bytes: ${body.length}`);
    } catch (e: any) {
      console.log(`      ERROR: ${e.message}`);
    }

    // Approach B: waitForEvent('download') + page.goto() — browser download interception
    console.log('\n  [B] Browser download event interception (new approach):');
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 20000 }),
        page.goto(tender.details_url, { timeout: 20000, waitUntil: 'commit' }).catch(() => null),
      ]);

      const tmpPath = path.join(TMP_DIR, `probe-${tender.bid_number.replace(/[^a-z0-9]/gi, '-')}.pdf`);
      await download.saveAs(tmpPath);

      const stat = fs.existsSync(tmpPath) ? fs.statSync(tmpPath) : null;
      const bytes = stat?.size || 0;
      const preview = bytes > 0 ? fs.readFileSync(tmpPath).slice(0, 5).toString('ascii') : '';

      console.log(`      Downloaded: ${bytes} bytes`);
      console.log(`      Header: ${preview || '(empty)'}`);
      console.log(`      Is PDF: ${preview.startsWith('%PDF') ? '✅ YES' : '❌ NO'}`);

      if (bytes > 0) fs.unlinkSync(tmpPath);
    } catch (e: any) {
      console.log(`      ERROR: ${e.message}`);
    }

    // Navigate back to listing to re-establish session context
    await page.goto('https://bidplus.gem.gov.in/all-bids', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    }).catch(() => null);
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log('\n\nProbe complete.');
}

probe().catch(console.error);
