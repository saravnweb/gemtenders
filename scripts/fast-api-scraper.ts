import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { generateSlug } from "@/lib/gemini";

// Function to fetch CSRF Token & Cookies
async function getGeMSessionInfo() {
  const res = await fetch('https://bidplus.gem.gov.in/all-bids', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  const cookies: string[] = [];
  res.headers.forEach((val, key) => {
    if (key.toLowerCase() === 'set-cookie') cookies.push(val.split(';')[0]);
  });
  const cookieHeader = cookies.join('; ');

  const html = await res.text();
  const match = html.match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/);
  if (!match) throw new Error("Could not extract CSRF token from GeM.");
  
  return { csrf: match[1], cookies: cookieHeader };
}

// Function to fetch a specific page from the GeM API
async function fetchGeMBidsPage(page: number, csrf: string, cookies: string) {
  const postdata = {
    page,
    param: { searchParam: "searchbid" },
    filter: {} // To get all ongoing bids.
  };
  
  const formData = new URLSearchParams();
  formData.append('payload', JSON.stringify(postdata));
  formData.append('csrf_bd_gem_nk', csrf);

  const res = await fetch('https://bidplus.gem.gov.in/all-bids-data', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://bidplus.gem.gov.in',
      'Referer': 'https://bidplus.gem.gov.in/all-bids',
      'Cookie': cookies
    },
    body: formData.toString()
  });

  if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
  const data = await res.json();
  if (!data?.response?.response?.docs) return [];
  
  return data.response.response.docs;
}

export async function runFastScrape(maxPages: number, concurrency: number = 10) {
  console.log(`>>> [FAST-SCRAPE] Initializing GeM Session...`);
  const session = await getGeMSessionInfo();
  console.log(`>>> [FAST-SCRAPE] Session obtained. CSRF: ${session.csrf}`);
  
  // Test first page to see total
  console.log(`>>> [FAST-SCRAPE] Fetching page 1 to verify...`);
  const firstPage = await fetchGeMBidsPage(1, session.csrf, session.cookies);
  if (firstPage.length === 0) {
    console.log(">>> [FAST-SCRAPE] Failed to fetch first page or no items.");
    return;
  }
  
  let page = 1;
  while (page <= maxPages) {
    const promises = [];
    for (let c = 0; c < concurrency && page <= maxPages; c++, page++) {
      console.log(`>>> [FAST-SCRAPE] Enqueuing request for Page ${page}...`);
      promises.push(fetchGeMBidsPage(page, session.csrf, session.cookies).then(res => ({ page: page - c, data: res }))); // minor logging offset fix
    }
    
    const results = await Promise.allSettled(promises);
    
    // Process results
    const bidsToInsert = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        bidsToInsert.push(...result.value.data);
      } else {
        console.error(`>>> [FAST-SCRAPE] Error fetching a page:`, result.reason);
      }
    }
    
    if (bidsToInsert.length === 0) {
      console.log(">>> [FAST-SCRAPE] No items found in this chunk. Stopping.");
      break;
    }

    console.log(`>>> [FAST-SCRAPE] Processing ${bidsToInsert.length} items from batch...`);
    
    const upsertBatch = bidsToInsert.map((bid: any) => {
      const bidNo = (bid.b_bid_number ? bid.b_bid_number[0] : null) || (bid.b_bid_number_parent ? bid.b_bid_number_parent[0] : "UNKNOWN");
      const title = bid.bd_category_name ? bid.bd_category_name[0] : (bid.b_category_name ? bid.b_category_name[0] : "Tender " + bidNo);
      const deptName = bid.ba_official_details_deptName ? bid.ba_official_details_deptName[0] : null;
      const minName = bid.ba_official_details_minName ? bid.ba_official_details_minName[0] : null;
      let finalDept = deptName || minName || "N/A";
      if (minName && deptName && minName !== deptName) {
         finalDept = `${minName}, ${deptName}`;
      }
      
      let pdfId = bid.b_id_parent ? String(bid.b_id_parent[0]) : (bid.b_id ? String(bid.b_id[0]) : "");
      let docLbl = 'showbidDocument';
      if (bid.b_bid_type && bid.b_bid_type[0] === 5) {
        docLbl = 'showdirectradocumentPdf';
        pdfId = bid.b_id ? String(bid.b_id[0]) : pdfId; // RA sometimes uses b_id
      } else if (bid.b_bid_type && bid.b_bid_type[0] === 2) {
        docLbl = 'showradocumentPdf';
        pdfId = bid.b_id ? String(bid.b_id[0]) : pdfId; // RA uses b_id
      }
      
      const pdfLink = `https://bidplus.gem.gov.in/${docLbl}/${pdfId}`;
      
      let startDate = bid.final_start_date_sort ? bid.final_start_date_sort[0] : null;
      let endDate = bid.final_end_date_sort ? bid.final_end_date_sort[0] : null;
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
      
      if (!startDate || startDate.startsWith("-")) startDate = new Date().toISOString();
      if (!endDate || endDate.startsWith("-")) endDate = futureDate.toISOString();

      return {
        bid_number: bidNo,
        slug: generateSlug(bidNo, title),
        title: title,
        department: finalDept,
        start_date: startDate,
        end_date: endDate,
        details_url: pdfLink,
      };
    }).filter(b => b.bid_number !== "UNKNOWN");
    
    const uniqueBatchMap = new Map();
    for (const b of upsertBatch) {
      if (!uniqueBatchMap.has(b.bid_number)) {
        uniqueBatchMap.set(b.bid_number, b);
      }
    }
    const finalBatch = Array.from(uniqueBatchMap.values());
    
    if (finalBatch.length > 0) {
      const { supabase } = await import('@/lib/supabase');

      // Step 1: Insert NEW tenders only (skip existing ones entirely to preserve AI-enriched data)
      const { error: insertErr } = await supabase
        .from('tenders')
        .upsert(finalBatch, { onConflict: 'bid_number', ignoreDuplicates: true });
      if (insertErr) console.error(">>> [FAST-SCRAPE] Insert Error:", insertErr);

      // Step 2: Update only dates + URL for EXISTING tenders (never touch title/dept/ai_summary)
      // Postgres upsert with missing NOT NULL columns fails, so we run parallel individual updates.
      const updatePromises = finalBatch.map(b => 
        supabase
          .from('tenders')
          .update({
            start_date: b.start_date,
            end_date:   b.end_date,
            details_url: b.details_url,
          })
          .eq('bid_number', b.bid_number)
      );
      
      const updateResults = await Promise.all(updatePromises);
      const updateErrors = updateResults.map(r => r.error).filter(Boolean);
      
      if (updateErrors.length > 0) {
        console.error(">>> [FAST-SCRAPE] Date Update Error:", updateErrors[0]);
      }

      console.log(`>>> [FAST-SCRAPE] Processed ${finalBatch.length} bids (new inserted, existing dates refreshed).`);
    }
    
    // Add a small delay between chunks to avoid hard IP bans
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(">>> [FAST-SCRAPE] Complete!");
}

async function run() {
  const args = process.argv.slice(2);
  const pagesArg = args.find(a => a.startsWith('--pages='));
  const maxPages = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : 100;

  const concArg = args.find(a => a.startsWith('--concurrency='));
  const concurrency = concArg ? parseInt(concArg.split('=')[1], 10) : 10;

  await runFastScrape(maxPages, concurrency);
}

run();
