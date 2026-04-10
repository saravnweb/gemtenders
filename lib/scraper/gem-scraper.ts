import { normalizeTitle } from '../computed-fields';
import { chromium } from "playwright-extra";
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(stealthPlugin());
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import path from "path";
import fs from "fs";
import { extractTenderData, generateSlug } from "@/lib/gemini";
import { extractVerifiedCity, normalizeState, normalizeCity, extractCityStateFromConsigneeTable } from "../locations";
import { detectCategory } from "../categories";

function detectBidType(bidNo: string, title: string): string {
  if (/\/RA\//i.test(bidNo) || /reverse\s*auction/i.test(title)) return "Reverse Auction";
  if (/custom\s*bid/i.test(title)) return "Custom Bid";
  return "Open Bid";
}
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

function extractEmdFallback(text: string): number | null {
  const patterns = [
    /EMD\s+Amount\s*[:\-]?\s*([\d,]+)/i,
    /EMD\s+Amount\s*[\t ]+([\d,]+)/i,
    /Earnest\s+Money\s+Deposit\s*[:\-]?\s*([\d,]+)/i,
    /EMD\s*[:\-]\s*([\d,]+)/i
  ];

  if (/EMD\s+Amount\s*[:\-]?\s*No/i.test(text)) return 0;
  if (/Earnest\s+Money\s+Deposit\s*[:\-]?\s*No/i.test(text)) return 0;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseInt(match[1].replace(/,/g, ''));
      if (!isNaN(val)) return val;
    }
  }
  return null;
}

function extractLocationFallback(text: string): { state: string | null; city: string | null } {
  // Primary: use consignee table extraction (covers masked, Dist, PIN patterns)
  const consigneeResult = extractCityStateFromConsigneeTable(text);
  if (consigneeResult.city || consigneeResult.state) {
    return { state: consigneeResult.state, city: consigneeResult.city };
  }

  // Secondary: scan for full state names in the text
  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh"
  ];

  let foundState: string | null = null;
  for (const state of states) {
    if (new RegExp(`\\b${state}\\b`, 'i').test(text)) { foundState = state; break; }
  }
  if (!foundState) {
    if (/\bM\.P\.\b|\bMP\b/i.test(text)) foundState = "Madhya Pradesh";
    else if (/\bU\.P\.\b|\bUP\b/i.test(text)) foundState = "Uttar Pradesh";
    else if (/\bW\.B\.\b|\bWB\b/i.test(text)) foundState = "West Bengal";
    else if (/\bT\.N\.\b|\bTN\b/i.test(text)) foundState = "Tamil Nadu";
    else if (/\bG\.J\.\b|\bGJ\b/i.test(text)) foundState = "Gujarat";
    else if (/\bM\.H\.\b|\bMH\b/i.test(text)) foundState = "Maharashtra";
  }

  const foundCity = extractVerifiedCity(text);
  return { state: foundState, city: foundCity };
}



export async function scrapeGeMBids(options?: { lightMode?: boolean; maxPages?: number; startPage?: number }) {
  const isLightMode = options?.lightMode ?? false;
  const SETTING_MAX_PAGES = options?.maxPages ?? 5;
  const START_PAGE = options?.startPage ?? 1;
  console.log(">>> [SCRAPER] Launching Playwright browser...");
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu'
    ]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  console.log(">>> [SCRAPER] Navigating to GeM BidPlus...");
  try {
    await page.goto(`https://bidplus.gem.gov.in/all-bids?page=${START_PAGE}`, { 
      waitUntil: "networkidle", 
      timeout: 60000 
    });
    
    await page.waitForTimeout(5000);
    await page.waitForSelector('.card', { timeout: 30000 });

    // Sort by Bid Start Date (latest first)
    try {
      const sorted = await page.evaluate(() => {
        // Find the "Start Date" / "Bid Start Date" sort link in the table header
        const allLinks = Array.from(document.querySelectorAll('th a, th span, .sort-link, [data-sort]'));
        const sortEl = allLinks.find(el =>
          /start.?date|bid.?start/i.test(el.textContent || '') ||
          /start.?date|bid.?start/i.test((el as HTMLElement).dataset?.sort || '')
        ) as HTMLElement | undefined;
        if (sortEl) { sortEl.click(); return true; }
        return false;
      });

      if (sorted) {
        await page.waitForTimeout(3000);
        await page.waitForSelector('.card', { timeout: 15000 });

        // Click again if currently ascending (to get descending = latest first)
        await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('th a, th span, .sort-link, [data-sort]'));
          const sortEl = allLinks.find(el =>
            /start.?date|bid.?start/i.test(el.textContent || '') ||
            /start.?date|bid.?start/i.test((el as HTMLElement).dataset?.sort || '')
          ) as HTMLElement | undefined;
          // Click again only if ascending indicator present
          const isAsc = sortEl?.closest('th')?.classList.contains('asc') ||
                        sortEl?.querySelector('.fa-sort-asc, .asc') !== null;
          if (isAsc) sortEl?.click();
        });

        await page.waitForTimeout(3000);
        await page.waitForSelector('.card', { timeout: 15000 });
        console.log(">>> [SCRAPER] Sorted by Bid Start Date (latest first).");
      } else {
        console.warn(">>> [SCRAPER] Could not find Start Date sort control — using default order.");
      }
    } catch (sortErr: any) {
      console.warn(">>> [SCRAPER] Sort attempt failed:", sortErr.message);
    }
  } catch (e: any) {
    console.error(">>> [SCRAPER] Navigation failed:", e.message);
    await browser.close();
    return;
  }

  const allBids: any[] = [];
  const MAX_PAGES = SETTING_MAX_PAGES;

  for (let p = 1; p <= MAX_PAGES; p++) {
    console.log(`>>> [SCRAPER] Scraping items from Page ${START_PAGE + p - 1}...`);
    
    const pageBids = await page.evaluate(() => {
      const items: any[] = [];
      const elements = document.querySelectorAll(".card");
      
      elements.forEach(el => {
        const bidNoEls = el.querySelectorAll('a.bid_no_hover');
        if (!bidNoEls || bidNoEls.length === 0) return;

        // Always use the FIRST link as the canonical Bid No. (original bid, e.g. GEM/2026/B/...)
        // The last link may be an RA (GEM/2026/R/...) — store it separately
        const firstBidEl = bidNoEls[0];
        const lastBidEl = bidNoEls[bidNoEls.length - 1];
        let bidNo = firstBidEl.textContent?.trim() || "";
        bidNo = bidNo.replace(/^RA NO:?\s*/i, '').replace(/^Bid No.\s*:?\s*/i, '').trim();

        // Extract RA number if a second link exists and it looks like an RA
        let raNo: string | null = null;
        if (bidNoEls.length > 1) {
          const raText = lastBidEl.textContent?.trim() || "";
          const cleaned = raText.replace(/^RA NO:?\s*/i, '').trim();
          if (/GEM\/\d+\/R\//i.test(cleaned)) raNo = cleaned;
        }

        // Use the last element's href (RA link has the correct PDF if present), else fall back to first
        const pdfLink = (lastBidEl as HTMLAnchorElement).href || (firstBidEl as HTMLAnchorElement).href || "";
        
        const cardBody = el.querySelector('.card-body');
        
        // Extract Department - Look for the col-md-5 container
        const deptCol = Array.from(cardBody?.querySelectorAll('.col-md-5, .col-md-4') || [])
          .find(c => c.textContent?.includes('Department Name And Address'));
        
        let department = "N/A";
        if (deptCol) {
          // Clear the label to get only the address/name
          const rows = deptCol.querySelectorAll('.row');
          if (rows.length > 1) {
            department = rows[1].textContent?.trim() || "N/A";
          } else {
            department = deptCol.textContent?.replace('Department Name And Address:', '')?.trim() || "N/A";
          }
        }

        // Extract Items (Description) - Look for col-md-4 container
        const itemsCol = Array.from(cardBody?.querySelectorAll('.col-md-4') || [])
          .find(c => c.textContent?.includes('Items:'));
        
        let description = "";
        if (itemsCol) {
          const popoverEl = itemsCol.querySelector('a[data-toggle="popover"]');
          if (popoverEl) {
            const htmlContent = popoverEl.getAttribute('data-content') || popoverEl.getAttribute('data-original-title') || "";
            if (htmlContent) {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = htmlContent;
              description = tempDiv.textContent?.trim() || "";
            } else {
              description = popoverEl.textContent?.trim() || "";
            }
          } else {
            description = itemsCol.textContent?.replace('Items:', '')?.replace('Quantity:', '')?.split('\\n')[0]?.trim() || "";
          }
        }
        
        const startDateEl = el.querySelector('.start_date');
        const endDateEl = el.querySelector('.end_date');
        
        if (bidNo) {
          items.push({
            bidNo,
            raNo,
            description: description || "Tender Description Unavailable",
            department: department || "N/A",
            startDate: startDateEl?.textContent?.trim() || "",
            endDate: endDateEl?.textContent?.trim() || "",
            pdfLink: pdfLink.startsWith('http') ? pdfLink : `https://bidplus.gem.gov.in${pdfLink}`
          });
        }
      });
      return items;
    });

    allBids.push(...pageBids);

    // Smart duplication check: if all valid bids on this page already exist, we can stop scraping further pages
    const bidNos = pageBids.map(b => b.bidNo).filter(Boolean);
    let allExist = false;
    
    if (bidNos.length > 0) {
      const { data: existingPageBids } = await supabase
        .from("tenders")
        .select("bid_number")
        .in("bid_number", bidNos);

      const existingCount = existingPageBids?.length || 0;
      console.log(`>>> [SCRAPER] Found ${pageBids.length} bids on Page ${START_PAGE + p - 1}. (${existingCount} already in DB)`);
      
      // If every bid on this page is already in the database, assume we've caught up with the previous scrape.
      if (existingCount === bidNos.length) {
        console.log(">>> [SCRAPER] All bids on this page are already in the database! Stopping pagination early to save resources.");
        allExist = true;
      }
    } else {
      console.log(`>>> [SCRAPER] Found ${pageBids.length} bids on Page ${START_PAGE + p - 1}.`);
    }

    if (allExist) break;

    if (p < MAX_PAGES) {
      const nextClicked = await page.evaluate(() => {
        const nextBtn = document.querySelector('a.page-link.next') as HTMLElement;
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });

      if (!nextClicked) {
        console.log(">>> [SCRAPER] No 'Next' button found. Ending page loop.");
        break;
      }
      
      // Wait for the next page to load
      await page.waitForTimeout(5000); 
    }
  }

  // Filter out duplicates (though GeM pagination should handle it)
  let uniqueBids = Array.from(new Map(allBids.map(b => [b.bidNo, b])).values());
  const now = new Date();
  
  // Filter: only keep tenders closing tomorrow or later (skip today and past)
  const tomorrow = new Date(now); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1);
  uniqueBids = uniqueBids.filter(bid => {
    if (bid.bidNo && bid.bidNo.match(/GEM\/(2018|2019|2020|2021|2022|2023|2024|2025)\//)) return false;

    const parsedEnd = parseGeMDate(bid.endDate);
    if (!parsedEnd) return true; // Keep if we can't parse date, to be safe
    return new Date(parsedEnd) >= tomorrow;
  });

  console.log(`>>> [SCRAPER] Total active unique bids found: ${uniqueBids.length}. Bid Nos: ${uniqueBids.map(b => b.bidNo).join(', ')}`);

  const stats = { total: uniqueBids.length, new: 0, skipped: 0, aiCalls: 0, pdfBytes: 0, errors: 0 };
  const startTime = Date.now();

  for (const [bidIdx, bid] of uniqueBids.entries()) {
    console.log(`\n>>> [SCRAPER] [${bidIdx + 1}/${stats.total}] Processing: ${bid.bidNo}`);
    console.log(`>>> [SCRAPER]   Raw dates — start: "${bid.startDate}" | end: "${bid.endDate}"`);
    
    const { data: existing } = await supabase
      .from("tenders")
      .select("id, title, pdf_url, state, city")
      .eq("bid_number", bid.bidNo)
      .maybeSingle();

    // AI/PDF ENRICHMENT CHECK: Should we do the expensive part?
    const isGeneric = !existing?.title || existing.title.startsWith("Tender GEM") || existing.title === "N/A";
    const isMissingPdf = !existing?.pdf_url;
    const isMissingLocation = !existing?.state || !existing?.city;

    if (existing && (isLightMode || (!isGeneric && !isMissingPdf && !isMissingLocation))) {
      stats.skipped++;
      console.log(`>>> [SCRAPER] [${bidIdx + 1}/${stats.total}] Found ${bid.bidNo}: Skipping AI (already enriched). Updating basic dates/url info only.`);
      
      // Update basic info just in case end dates or URLs were updated on GeM
      const parsedEndDate = parseGeMDate(bid.endDate);
      const parsedStartDate = parseGeMDate(bid.startDate);
      
      const shallowUpdate: any = {
        bid_number: bid.bidNo,
        details_url: bid.pdfLink,
        department: bid.department || "N/A",
      };
      
      if (parsedEndDate) shallowUpdate.end_date = parsedEndDate;
      if (parsedStartDate) shallowUpdate.start_date = parsedStartDate;
      
      await supabase.from("tenders").upsert(shallowUpdate, { onConflict: 'bid_number' });
      continue;
    }

    let pdfPublicUrl = null;
    let aiData: any = null;
    

    if (bid.pdfLink && !isLightMode) {
      try {
        console.log(`>>> [SCRAPER] Downloading PDF for ${bid.bidNo}...`);
        
        let buffer: Buffer | undefined;
        try {
          // Try direct HTTP request first — simpler and avoids browser page crashes
          const response = await page.request.get(bid.pdfLink, { timeout: 30000 });
          const contentType = response.headers()['content-type'] || '';
          if (response.ok() && contentType.includes('pdf')) {
            buffer = Buffer.from(await response.body());
            console.log(`>>> [SCRAPER] Direct request got PDF (${(buffer.length / 1024).toFixed(1)} KB)`);
          }
        } catch (e: any) {
          console.log(`>>> [SCRAPER] Direct request failed: ${e.message}`);
        }

        // Fall back to browser-based download if direct request didn't get a PDF
        if (!buffer) {
          try {
            const downloadPage = await context.newPage();
            const downloadPromise = downloadPage.waitForEvent('download', { timeout: 30000 });

            try {
              await downloadPage.goto(bid.pdfLink, { waitUntil: 'load', timeout: 30000 });
            } catch (e: any) {
              console.log(`>>> [SCRAPER] Navigation note: ${e.message}`);
            }

            try {
              const download = await downloadPromise;
              const tempPath = path.join(process.cwd(), 'tmp', `temp_${bid.bidNo.replace(/\//g, "-")}.pdf`);
              await download.saveAs(tempPath);
              buffer = fs.readFileSync(tempPath);
              fs.unlinkSync(tempPath);
            } catch (e) {
              console.log(`>>> [SCRAPER] Download event not triggered for browser fallback.`);
            }

            await downloadPage.close();
          } catch (e) {
            console.warn(`>>> [SCRAPER] Download attempt failed: ${e}`);
          }
        }

        if (buffer && buffer.length > 5000) {
          stats.pdfBytes += buffer.length;
          const fileName = `${bid.bidNo.replace(/\//g, "-")}.pdf`;
          
          console.log(`>>> [SCRAPER] Uploading PDF (${(buffer.length / 1024).toFixed(1)} KB)...`);
          const { data, error: uploadErr } = await supabase.storage
            .from("tender-documents")
            .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from("tender-documents").getPublicUrl(data.path);
            pdfPublicUrl = publicUrlData.publicUrl;
            console.log(`>>> [SCRAPER] Upload SUCCESS: ${pdfPublicUrl}`);
          } else {
            console.error(`>>> [SCRAPER] Upload ERROR: ${uploadErr.message}`, uploadErr);
          }

          console.log(`>>> [SCRAPER] Extracting text & calling AI...`);
          let extractedText = "";
          try {
            console.log(`>>> [SCRAPER] Parsing PDF content...`);
            
            // Handle new PDFParse class API (v2.x)
            const ParserClass = (pdf as any).PDFParse || pdf;
            if (typeof ParserClass === 'function' && ParserClass.toString().includes('class')) {
              const instance = new (ParserClass as any)({ data: buffer });
              const textResult = await instance.getText();
              extractedText = textResult.text || "";
              await instance.destroy?.();
            } else {
              // Fallback to legacy function API (v1.x or similar)
              const parserFunc = typeof pdf === 'function' ? pdf : (pdf as any).default || (pdf as any).PDFParse;
              if (typeof parserFunc === 'function') {
                const data = await parserFunc(buffer);
                extractedText = data.text || "";
              }
            }

            if (extractedText && extractedText.length > 50) {
              console.log(`>>> [SCRAPER] PDF text extracted (${extractedText.length} chars). Calling AI...`);
              try {
                stats.aiCalls++;
              aiData = await extractTenderData(extractedText);
              } catch (e: any) {
                if (e.message?.includes('429') || e.message?.includes('quota')) {
                  console.warn(`>>> [SCRAPER] AI Rate Limit hit. Proceeding with fallback extraction only.`);
                } else {
                  console.warn(`>>> [SCRAPER] AI Error: ${e.message}`);
                }
              }
              
              const fallbackEmd = extractEmdFallback(extractedText);
              if (fallbackEmd !== null && (!aiData || aiData.emd_amount == null)) {
                console.log(`>>> [SCRAPER] Regex Fallback Found EMD: ${fallbackEmd}`);
                if (!aiData) aiData = {};
                aiData.emd_amount = fallbackEmd;
              }

              const locFallback = extractLocationFallback(extractedText);
              if (locFallback.state && (!aiData || (!aiData.authority?.state && !aiData.authority?.consignee_state))) {
                 console.log(`>>> [SCRAPER] Regex Fallback Found State: ${locFallback.state}`);
                 if (!aiData) aiData = { authority: {} };
                 if (!aiData.authority) aiData.authority = {};
                 aiData.authority.state = locFallback.state;
                 if (locFallback.city && !aiData.authority.city && !aiData.authority.consignee_city) aiData.authority.city = locFallback.city;
              }

              if (aiData) {
                console.log(`>>> [SCRAPER] AI SUCCESS: ${aiData?.tender_title?.substring(0, 50)}`);
              } else {
                console.warn(`>>> [SCRAPER] AI returned null for ${bid.bidNo}`);
              }
            } else {
              console.warn(`>>> [SCRAPER] PDF text is too short or empty for ${bid.bidNo}`);
            }
          } catch (e: any) {
            console.warn(`>>> [SCRAPER] PDF parsing Error: ${e.message}`);
          }
        }
      } catch (err: any) {
        console.warn(`>>> [SCRAPER] PDF Process Error: ${err.message}`);
      }
    }

    // FINAL DATA ASSEMBLY
    const auth = aiData?.authority;
    
    // Improve title with GeMARPTS info if possible
    let finalTitle = bid.description || `Tender ${bid.bidNo}`;
    if (aiData?.tender_title && (!aiData.tender_title.trim().endsWith("...") || !bid.description || bid.description.length <= aiData.tender_title.length)) {
       finalTitle = aiData.tender_title;
    }

    finalTitle = normalizeTitle(finalTitle);

    if (aiData?.gemarp?.searched_strings && !finalTitle.includes(aiData.gemarp.searched_strings)) {
       // Only append if it's not repetitive
       // console.log("Refining title with keywords...");
    }

    const isNA = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim());
    const finalDept = (!isNA(auth?.organisation) ? auth?.organisation : null) || auth?.department || auth?.ministry || bid.department || "N/A";
    const slug = generateSlug(bid.bidNo, finalTitle);

    // Use the exact start and end dates directly from the frontend UI.
    const parsedStart = parseGeMDate(bid.startDate);
    const parsedEnd = parseGeMDate(bid.endDate);
    if (!parsedStart) console.warn(`>>> [SCRAPER] WARNING: start_date parse failed for "${bid.startDate}" — using today as fallback`);
    if (!parsedEnd) console.warn(`>>> [SCRAPER] WARNING: end_date parse failed for "${bid.endDate}" — using today as fallback`);
    const finalStartDate = parsedStart || new Date().toISOString();
    const finalEndDate = parsedEnd || new Date().toISOString();
    const finalOpeningDate = aiData?.dates?.bid_opening_date || aiData?.bid_opening_date || null;

    const { error } = await supabase.from("tenders").upsert({
      bid_number: bid.bidNo,
      slug,
      title: finalTitle,
      department: finalDept,
      ministry_name: auth?.ministry || null,
      department_name: auth?.department || null,
      organisation_name: !isNA(auth?.organisation) ? (auth?.organisation || null) : (auth?.department || null),
      office_name: auth?.office || null,
      state: normalizeState(auth?.consignee_state || auth?.state) || null,
      city: normalizeCity(auth?.consignee_city || auth?.city) || null,
      start_date: finalStartDate,
      end_date: finalEndDate,
      opening_date: finalOpeningDate,
      mse_relaxation: aiData?.relaxations?.mse_experience || null,
      startup_relaxation: aiData?.relaxations?.startup_experience || null,
      mse_turnover_relaxation: aiData?.relaxations?.mse_turnover || null,
      startup_turnover_relaxation: aiData?.relaxations?.startup_turnover || null,
      documents_required: aiData?.documents_required || [],
      pdf_url: pdfPublicUrl || existing?.pdf_url,
      details_url: bid.pdfLink,
      ai_summary: aiData?.technical_summary || null,
      emd_amount: aiData?.emd_amount ?? null,
      eligibility_msme: aiData?.eligibility?.msme || false,
      eligibility_mii: aiData?.eligibility?.mii || false,
      category: aiData?.category || detectCategory(finalTitle + ' ' + (aiData?.technical_summary || '')) || null,
      bid_type: detectBidType(bid.bidNo, finalTitle),
      procurement_type: aiData?.procurement_type || null,
      keywords: aiData?.keywords || [],
      ra_number: bid.raNo || null,
    }, { onConflict: 'bid_number' });

    if (error) {
      stats.errors++;
      console.error(`>>> [SCRAPER] Database Error: ${error.message}`);
    } else {
      stats.new++;
      const storedEmd = aiData?.emd_amount === 0 ? "No" : (aiData?.emd_amount || "N/A");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const remaining = stats.total - (bidIdx + 1);
      console.log(`>>> [SCRAPER] [${bidIdx + 1}/${stats.total}] SUCCESS: ${bid.bidNo} (EMD: ${storedEmd}) | ${remaining} remaining | ${elapsed}s elapsed`);
    }

    // Increased delay to 5 seconds to avoid AI rate limits on free tier
    await new Promise(r => setTimeout(r, 5000));
  }

  // ── Cost & progress summary ────────────────────────────────────────────────
  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  // Gemini 2.5 Flash pricing: input ~$0.075/1M tokens, output ~$0.30/1M tokens
  // Average PDF ~20K chars ≈ ~5K tokens input + ~500 tokens output per call
  const estimatedCostUSD = stats.aiCalls * ((5000 * 0.075 + 500 * 0.30) / 1_000_000);
  console.log(`
>>> [SCRAPER] ── Run Summary ──────────────────────────────
  Total bids found : ${stats.total}
  New / enriched   : ${stats.new}
  Skipped (exist.) : ${stats.skipped}
  AI calls made    : ${stats.aiCalls}
  PDF data         : ${(stats.pdfBytes / 1024 / 1024).toFixed(1)} MB
  Errors           : ${stats.errors}
  Elapsed          : ${elapsedMin} min
  Est. Gemini cost : ~$${estimatedCostUSD.toFixed(4)} USD (~₹${(estimatedCostUSD * 84).toFixed(2)})
──────────────────────────────────────────────────`);

  await browser.close();
}

export function parseGeMDate(dateStr: string): string | null {
    if (!dateStr) return null;
    try {
        // Look for DD-MM-YYYY
        const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
        if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];

            // Use \d{1,2} to match both single and double digit hours (e.g. "9:00 AM" and "10:00 PM")
            const timeMatch = dateStr.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
            let hours = "00";
            let minutes = "00";
            let seconds = "00";

            if (timeMatch) {
                hours = timeMatch[1].padStart(2, '0');
                minutes = timeMatch[2];
                if (timeMatch[3]) {
                    seconds = timeMatch[3];
                }
                const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

                if (ampm === "PM" && parseInt(hours) < 12) {
                    hours = (parseInt(hours) + 12).toString().padStart(2, '0');
                } else if (ampm === "AM" && parseInt(hours) === 12) {
                    hours = "00";
                }
            }

            // GeM dates are in IST (UTC+5:30) — store as UTC
            return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`).toISOString();
        }
    } catch (e) {
        // Fallthrough
    }
    return null;
}
