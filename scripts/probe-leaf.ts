/**
 * Probe GeM HTML leaf page URL format.
 * Tries different URL patterns and logs page title + body text snippet.
 * Run before leaf-enrich.ts to confirm the correct URL format.
 *
 * Usage:
 *   tsx scripts/probe-leaf.ts
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
  // Pick 3 active tenders from DB
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url, title')
    .gte('end_date', new Date().toISOString())
    .not('details_url', 'is', null)
    .limit(3);

  if (!tenders?.length) {
    console.log('No active tenders found in DB.');
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-gpu'],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: false,
  });

  // ── Inspect live listing page to find actual a.bid_no_hover href ────────────
  const page = await ctx.newPage();
  await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  await page.waitForSelector('.card', { timeout: 15000 }).catch(() => null);

  const liveLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a.bid_no_hover')).slice(0, 3).map(el => ({
      text: el.textContent?.trim(),
      href: (el as HTMLAnchorElement).href,
      attr: el.getAttribute('href'),
    }));
  });

  console.log('\n=== LIVE a.bid_no_hover LINKS FROM LISTING PAGE ===');
  liveLinks.forEach(l => console.log(`  text: ${l.text}\n  href (absolute): ${l.href}\n  attr (raw): ${l.attr}\n`));
  console.log('===================================================\n');

  for (const tender of tenders) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Bid: ${tender.bid_number}`);
    console.log(`Title: ${tender.title}`);
    console.log(`details_url (PDF): ${tender.details_url}`);

    // Extract numeric b_id from details_url e.g. showbidDocument/8720660 → 8720660
    const bId = tender.details_url?.split('/').pop() || '';

    // URL candidates to try
    const candidates = [
      `https://bidplus.gem.gov.in/viewbid/${tender.bid_number}`,
      `https://bidplus.gem.gov.in/viewbid/${tender.bid_number.replace(/\//g, '-')}`,
      `https://bidplus.gem.gov.in/viewbid/${bId}`,
      `https://bidplus.gem.gov.in/showbiddata/${bId}`,
      `https://bidplus.gem.gov.in/bidletter/${bId}`,
      `https://bidplus.gem.gov.in/showbidDocument/${bId}`,  // try the known PDF URL with HTML capture
    ];

    for (const url of candidates) {
      console.log(`\n  → Trying: ${url}`);
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });

        const status = response?.status() ?? 0;
        const title  = await page.title().catch(() => '');
        const text   = await page.textContent('body').catch(() => '');
        const snippet = (text || '').replace(/\s+/g, ' ').trim().slice(0, 400);

        console.log(`  Status: ${status}`);
        console.log(`  Title:  ${title}`);
        console.log(`  Body snippet: ${snippet}`);

        // Check for meaningful content (contains GeM-typical keywords)
        const meaningful = /ministry|department|organisation|tender|bid|consignee/i.test(snippet);
        console.log(`  Contains tender data: ${meaningful ? '✅ YES' : '❌ NO'}`);

        if (meaningful) break;  // Found working URL, no need to try rest
      } catch (e: any) {
        console.log(`  ERROR: ${e.message}`);
      }
    }
  }

  await browser.close();
  console.log('\n\nProbe complete.');
}

probe().catch(console.error);
