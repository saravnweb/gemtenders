import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import axios from 'axios';
import https from 'https';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { getComputedFields } from '../lib/computed-fields';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const argv = process.argv.slice(2);
const LIMIT = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);

async function getGeMSession() {
  try {
    const res = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 30000,
    });
    const cookies = res.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
    return { cookies };
  } catch (error) {
    return { cookies: '' };
  }
}

function extractNumeric(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '');
  const match = cleaned.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

async function scrapeLeafContent(bId: string, cookies: string): Promise<Record<string, any> | null> {
  const url = `https://bidplus.gem.gov.in/bidding/bid/bidBoeShow/${bId}`;
  try {
    const r = await axios.get(url, {
      httpsAgent,
      headers: { 
        Cookie: cookies, 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
        'Referer': 'https://bidplus.gem.gov.in/all-bids' 
      },
      timeout: 15000,
    });
    
    if (r.status !== 200 || !r.data) return null;
    
    const $ = cheerio.load(r.data);
    const data: Record<string, any> = {};
    
    data.raw_text = $('body').text().replace(/\s+/g, ' ').trim();
    
    $('tr').each((_, el) => {
      const th = $(el).find('th, td:first-child').text().trim().toLowerCase();
      const td = $(el).find('td:last-child').text().trim();
      
      if (!th || !td) return;
      
      if (th.includes('estimated bid value')) {
        data.estimated_value = extractNumeric(td);
      } else if (th.includes('epbg')) {
        data.epbg_percentage = extractNumeric(td);
      } else if (th.includes('minimum average annual turnover')) {
        data.min_turnover_lakhs = extractNumeric(td);
      } else if (th.includes('experience')) {
        data.experience_years = extractNumeric(td);
      } else if (th.includes('delivery period')) {
        data.delivery_days = extractNumeric(td);
      }
    });

    const consigneeRows = $('table').not('.summary-table').find('tr').length;
    if (consigneeRows > 2) {
       data.num_consignees = consigneeRows - 1; 
    }

    return Object.keys(data).length > 0 ? data : null;
  } catch (e: any) {
    return null; 
  }
}

async function main() {
  console.log(`\n>>> [SCRAPE-HTML] Starting Leaf Page Scraper via HTTP GET`);
  console.log(`    Limit: ${LIMIT}\n`);
  
  const sess = await getGeMSession();
  if (!sess.cookies) {
    console.error("❌ Failed to establish GeM session/cookies.");
    return;
  }
  console.log("✅ GeM session established.");
  
  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, details_url')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .is('estimated_value', null)
    .not('details_url', 'is', null)
    .range(0, LIMIT - 1);
    
  if (error) {
    console.error(`DB Error: ${error.message}`);
    return;
  }
    
  if (!tenders || tenders.length === 0) {
    console.log("No tenders found needing structural extraction from Leaf pages.");
    return;
  }
  
  let ok = 0, fail = 0;
  
  for (const t of tenders) {
    const bId = t.details_url?.split('/').pop();
    if (!bId) continue;
    
    process.stdout.write(`Fetching ${t.bid_number} (ID: ${bId})... `);
    const scraped = await scrapeLeafContent(bId, sess.cookies!);
    
    if (scraped && (scraped.estimated_value || scraped.epbg_percentage || scraped.min_turnover_lakhs)) { 
      // Add computed fields
      const computed = getComputedFields(scraped);
      Object.assign(scraped, computed);

      await supabase.from('tenders').update(scraped).eq('id', t.id);
      console.log(`✅ OK (Value: ${scraped.estimated_value || 'None'})`);
      ok++;
    } else {
      console.log(`❌ FAILED or empty structural data`);
      fail++;
      
      const updateData = scraped?.raw_text ? { raw_text: scraped.raw_text, enrichment_tried_at: new Date().toISOString() } : { enrichment_tried_at: new Date().toISOString() };
      await supabase.from('tenders').update(updateData).eq('id', t.id);
    }
    
    await new Promise(r => setTimeout(r, 600)); 
  }
  
  console.log(`\n\n>>> Done!`);
  console.log(`    Successfully updated deep fields: ${ok} | Failed/404: ${fail}\n`);
}

main().catch(console.error);
