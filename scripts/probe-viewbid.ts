/**
 * Minimal probe — gets real hrefs from listing page, then visits each link.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const ctx = await b.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();

console.log('Loading listing page...');
await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.card', { timeout: 15000 }).catch(() => null);

// Get all links from bid cards — BOTH bid_no_hover links (first=leaf, last=PDF)
const links = await page.evaluate(() => {
  const results: any[] = [];
  document.querySelectorAll('.card').forEach(card => {
    const all = Array.from(card.querySelectorAll('a.bid_no_hover')) as HTMLAnchorElement[];
    if (!all.length) return;
    results.push({
      count: all.length,
      links: all.map(a => ({
        text: a.textContent?.trim().slice(0, 40),
        href: a.href,
        attr: a.getAttribute('href'),
      })),
    });
  });
  return results.slice(0, 4);
});

console.log('\nListing card links:');
links.forEach((item, i) => {
  console.log(`\nCard ${i+1} (${item.count} links):`);
  item.links.forEach((l: any) => console.log(`  text="${l.text}" | href="${l.href}" | attr="${l.attr}"`));
});

// Now try clicking the FIRST link (leaf page) of the first card
if (links[0]?.links[0]?.href) {
  const leafUrl = links[0].links[0].href;
  console.log(`\nNavigating to first link: ${leafUrl}`);
  await page.goto(leafUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  const status = await page.evaluate(() => window.location.href);
  const title = await page.title();
  const text = await page.evaluate(() => document.body?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 800));
  console.log(`  Final URL: ${status}`);
  console.log(`  Title: ${title}`);
  console.log(`  Body text (800 chars): ${text}`);
}

await b.close();
console.log('\nDone.');
