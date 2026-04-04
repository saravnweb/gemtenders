/**
 * Phase 1: URL Discovery (v13 - Complete Dump)
 * Dumps HTML output from all potential structured page candidates.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log("Starting Phase 1 Discovery (v13)...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  console.log("Establishing session on all-bids...");
  await page.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'networkidle' });

  // Get first bid number and b_id
  await page.waitForSelector('a.bid_no_hover');
  const bidInfo = await page.evaluate(() => {
    const link = document.querySelector('a.bid_no_hover');
    if (!link) return null;
    const bidNo = link.textContent?.trim() || '';
    const bId = link.getAttribute('href')?.split('/').pop() || '';
    return { bidNo, bId };
  });

  if (!bidInfo) {
    console.error("No bid info found.");
    await browser.close();
    return;
  }

  const { bidNo, bId } = bidInfo;
  console.log(`Testing with Bid: ${bidNo} | ID: ${bId}`);

  const candidates = [
    { name: 'bidBoeShow_id', url: `https://bidplus.gem.gov.in/bidding/bid/bidBoeShow/${bId}` },
    { name: 'bidBoeShow_no', url: `https://bidplus.gem.gov.in/bidding/bid/bidBoeShow/${bidNo.replace(/\//g, '-')}` },
    { name: 'showBidData_id', url: `https://bidplus.gem.gov.in/bidding/bid/showBidData/${bId}` },
    { name: 'getBidResultView_id', url: `https://bidplus.gem.gov.in/bidding/bid/getBidResultView/${bId}` },
    { name: 'publicBidOtherDetails_id', url: `https://bidplus.gem.gov.in/public-bid-other-details/${bId}` },
  ];

  for (const c of candidates) {
    console.log(`\nTesting Candidate: ${c.name} - ${c.url}`);
    try {
      if (c.name.includes('publicBidOtherDetails')) {
        // Need to POST for this one
        const csrfToken = await page.evaluate(() => {
            const input = document.querySelector('input[name="csrf_bd_gem_nk"]');
            return input ? (input as HTMLInputElement).value : '7fa6effc578dcede902399d39f95e13a'; 
        });
        const res = await page.request.post(c.url, {
            data: { csrf_bd_gem_nk: csrfToken },
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        console.log(`Status: ${res.status()}`);
        const text = await res.text();
        fs.writeFileSync(`tmp/candidate-${c.name}.txt`, text);
      } else {
        const res = await page.goto(c.url, { waitUntil: 'networkidle', timeout: 15000 });
        console.log(`Status: ${res?.status()}`);
        const content = await page.content();
        fs.writeFileSync(`tmp/candidate-${c.name}.html`, content);
        
        // Also dump text-only content for easier grepping
        const textContent = await page.evaluate(() => document.body?.innerText?.replace(/\\s+/g, ' ').trim() || '');
        fs.writeFileSync(`tmp/candidate-${c.name}-text.txt`, textContent);
      }
    } catch (e: any) {
        console.log(`Error: ${e.message}`);
    }
  }

  await browser.close();
  console.log("\nDumps saved to tmp/ folder.");
}

run().catch(console.error);
