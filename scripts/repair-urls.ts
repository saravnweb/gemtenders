import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getGeMSessionInfo() {
  const res = await fetch('https://bidplus.gem.gov.in/all-bids', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const cookies: string[] = [];
  res.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') cookies.push(val.split(';')[0]);
  });
  const html = await res.text();
  const match = html.match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/);
  if (!match) throw new Error("Could not extract CSRF token.");
  return { csrf: match[1], cookies: cookies.join('; ') };
}

async function fetchGeMBidsPage(page: number, csrf: string, cookies: string) {
  const postdata = { page, param: { searchParam: "searchbid" }, filter: {} };
  const formData = new URLSearchParams();
  formData.append('payload', JSON.stringify(postdata));
  formData.append('csrf_bd_gem_nk', csrf);

  const res = await fetch('https://bidplus.gem.gov.in/all-bids-data', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies
    },
    body: formData.toString()
  });

  const data = await res.json();
  return data?.response?.response?.docs || [];
}

async function run() {
  console.log(">>> [REPAIR] Starting fast URL verification scanner...");
  const session = await getGeMSessionInfo();
  const CONCURRENCY = 15;
  const MAX_PAGES = Math.ceil(43574 / 10); 
  let fixedCount = 0;

  for (let page = 1; page <= MAX_PAGES; page += CONCURRENCY) {
    const promises = [];
    for (let c = 0; c < CONCURRENCY; c++) {
      if (page + c <= MAX_PAGES) promises.push(fetchGeMBidsPage(page + c, session.csrf, session.cookies));
    }
    const results = await Promise.all(promises);

    const updates = [];
    for (const docs of results) {
      for (const bid of docs) {
        const bidNo = (bid.b_bid_number ? bid.b_bid_number[0] : null) || (bid.b_bid_number_parent ? bid.b_bid_number_parent[0] : "UNKNOWN");
        // Replace incorrect b_id_parent logic with correct b_id logic
        let pdfId = bid.b_id ? String(bid.b_id[0]) : "";
        let docLbl = 'showbidDocument';
        if (bid.b_bid_type && bid.b_bid_type[0] === 5) docLbl = 'showdirectradocumentPdf';
        else if (bid.b_bid_type && bid.b_bid_type[0] === 2) docLbl = 'showradocumentPdf';
        
        const pdfLink = `https://bidplus.gem.gov.in/${docLbl}/${pdfId}`;
        updates.push({ bid_number: bidNo, details_url: pdfLink });
      }
    }

    if (updates.length > 0) {
      const updatePromises = updates.map(u => 
        supabase.from('tenders').update({ details_url: u.details_url }).eq('bid_number', u.bid_number)
      );
      await Promise.allSettled(updatePromises);
      fixedCount += updates.length;
    }
    
    process.stdout.write(`\r>>> [REPAIR] Scanned pages up to ${page + CONCURRENCY - 1}. Relinked URLs: ${fixedCount}`);
  }
  console.log("\n>>> [REPAIR] Done!");
}
run();
