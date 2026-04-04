// Check if bids visible on listing page 1 exist in our DB
import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' });
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';

chromium.use(stealth());
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
const page = await ctx.newPage();

await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.card', { timeout: 15000 });

const bids = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.card')).map(card => {
    const el = card.querySelector('a.bid_no_hover') as HTMLAnchorElement;
    return { bidNo: el?.textContent?.trim() || '', href: el?.href || '' };
  }).filter(b => b.bidNo)
);

await browser.close();

console.log('Bids on listing page 1:', bids.map(b => b.bidNo).join(', '));

// Check each in DB
const { data: rows } = await sb.from('tenders')
  .select('bid_number, ai_summary, enrichment_tried_at, end_date')
  .in('bid_number', bids.map(b => b.bidNo));

console.log(`\nIn DB: ${rows?.length || 0} / ${bids.length}`);
rows?.forEach(r => console.log(' ', r.bid_number, '| ai_summary:', r.ai_summary ? 'SET' : 'NULL', '| end:', r.end_date?.slice(0,10)));

const missing = bids.filter(b => !rows?.find(r => r.bid_number === b.bidNo));
if (missing.length) console.log('\nNOT in DB:', missing.map(b => b.bidNo).join(', '));
