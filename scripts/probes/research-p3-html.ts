/**
 * Priority 3 Research — Probing GeM Leaf Page HTML candidates.
 * Tries several URL patterns to find the "structured HTML table" page.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getGeMSession(): Promise<{ cookies: string }> {
  console.log("Fetching GeM session...");
  const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
    httpsAgent,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });
  const rawCookies: string[] = [];
  const setCookie = res.headers['set-cookie'];
  if (Array.isArray(setCookie)) setCookie.forEach(c => rawCookies.push(c.split(';')[0]));
  return { cookies: rawCookies.join('; ') };
}

async function run() {
  const bId = '8720660'; 
  const bidNo = 'GEM/2024/B/4462102'; // Sample bid number if needed
  
  const candidates = [
    { name: 'bidBoeShow', url: `https://bidplus.gem.gov.in/bidding/bid/bidBoeShow/${bId}` },
    { name: 'showbiddata', url: `https://bidplus.gem.gov.in/showbiddata/${bId}` },
    { name: 'viewbid-id', url: `https://bidplus.gem.gov.in/viewbid/${bId}` },
    { name: 'viewbid-no', url: `https://bidplus.gem.gov.in/viewbid/${bidNo.replace(/\//g, '-')}` },
    { name: 'bidletter', url: `https://bidplus.gem.gov.in/bidletter/${bId}` },
    { name: 'showbidDocument', url: `https://bidplus.gem.gov.in/showbidDocument/${bId}` },
  ];

  const session = await getGeMSession();

  for (const c of candidates) {
    console.log(`\n--- Testing ${c.name}: ${c.url} ---`);
    try {
      const res = await axios.get(c.url, {
        httpsAgent,
        headers: {
          Cookie: session.cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://bidplus.gem.gov.in/all-bids',
        },
        timeout: 10000,
        validateStatus: () => true 
      });

      console.log(`Status: ${res.status}`);
      const html = String(res.data);
      const snippet = html.replace(/\s+/g, ' ').slice(0, 300).trim();
      console.log(`Snippet: ${snippet}`);

      if (res.status === 200 && (html.includes('estimated') || html.includes('consignee') || html.includes('Quantity'))) {
        console.log(`[MATCH FOUND] ${c.name} looks like a structured page!`);
        const filePath = path.join(process.cwd(), 'tmp', `match-${c.name}-${bId}.html`);
        fs.writeFileSync(filePath, html);
        console.log(`Saved to ${filePath}`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
}

run().catch(console.error);
