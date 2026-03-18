import { chromium } from "playwright-extra";
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(stealthPlugin());
import { supabase } from "@/lib/supabase";
import path from "path";
import fs from "fs";
import { extractTenderData, generateSlug } from "@/lib/gemini";
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
  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh"
  ];

  let foundState = null;
  for (const state of states) {
    if (new RegExp(`\\b${state}\\b`, 'i').test(text)) {
      foundState = state;
      break;
    }
  }

  // Common mapping for abbreviations
  if (!foundState) {
    if (/\bM\.P\.\b|\bMP\b/i.test(text)) foundState = "Madhya Pradesh";
    else if (/\bU\.P\.\b|\bUP\b/i.test(text)) foundState = "Uttar Pradesh";
    else if (/\bW\.B\.\b|\bWB\b/i.test(text)) foundState = "West Bengal";
    else if (/\bT\.N\.\b|\bTN\b/i.test(text)) foundState = "Tamil Nadu";
    else if (/\bG\.J\.\b|\bGJ\b/i.test(text)) foundState = "Gujarat";
    else if (/\bM\.H\.\b|\bMH\b/i.test(text)) foundState = "Maharashtra";
  }

  // Simple city heuristic: Look for address patterns
  let foundCity = null;
  const cityMatch = text.match(/Address\s*:\s*[^\,]+\,\s*([A-Z][a-z\s]+)\b/);
  if (cityMatch) foundCity = cityMatch[1].trim();

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
        const bidNoEl = el.querySelector('a.bid_no_hover');
        if (!bidNoEl) return;

        const bidNo = bidNoEl.textContent?.trim() || "";
        const pdfLink = (bidNoEl as HTMLAnchorElement).href || "";
        
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
            description = popoverEl.getAttribute('data-content') || popoverEl.textContent?.trim() || "";
          } else {
            description = itemsCol.textContent?.replace('Items:', '')?.replace('Quantity:', '')?.split('\n')[0]?.trim() || "";
          }
        }
        
        const startDateEl = el.querySelector('.start_date');
        const endDateEl = el.querySelector('.end_date');
        
        if (bidNo) {
          items.push({ 
            bidNo, 
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
    console.log(`>>> [SCRAPER] Found ${pageBids.length} bids on Page ${START_PAGE + p - 1}.`);

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
  const uniqueBids = Array.from(new Map(allBids.map(b => [b.bidNo, b])).values());
  console.log(`>>> [SCRAPER] Total unique bids found: ${uniqueBids.length}. Bid Nos: ${uniqueBids.map(b => b.bidNo).join(', ')}`);

  for (const bid of uniqueBids) {
    console.log(`\n>>> [SCRAPER] Processing: ${bid.bidNo}`);
    
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
      console.log(`>>> [SCRAPER] Found ${bid.bidNo}: Skipping AI (already enriched). Updating basic dates/url info only.`);
      
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
          // Use a new page to trigger download
          const downloadPage = await context.newPage();
          
          // Setup download listener
          const downloadPromise = downloadPage.waitForEvent('download', { timeout: 30000 });
          
          try {
            await downloadPage.goto(bid.pdfLink, { waitUntil: 'load', timeout: 30000 });
            // If it's a direct PDF, the goto might resolve or trigger a download
          } catch (e: any) {
            // Some links might trigger download immediately and cause navigation error, that's fine
            console.log(`>>> [SCRAPER] Navigation note: ${e.message}`);
          }
          
          try {
            const download = await downloadPromise;
            const tempPath = path.join(process.cwd(), 'tmp', `temp_${bid.bidNo.replace(/\//g, "-")}.pdf`);
            await download.saveAs(tempPath);
            buffer = fs.readFileSync(tempPath);
            fs.unlinkSync(tempPath); // cleanup
          } catch (e) {
            console.log(`>>> [SCRAPER] Standard download event not triggered. Trying manual request...`);
            const response = await page.request.get(bid.pdfLink);
            if (response.headers()['content-type']?.includes('pdf')) {
               buffer = await response.body();
            }
          }
          
          await downloadPage.close();
        } catch (e) {
          console.warn(`>>> [SCRAPER] Download attempt failed: ${e}`);
        }

        if (buffer && buffer.length > 5000) { 
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
                aiData = await extractTenderData(extractedText);
              } catch (e: any) {
                if (e.message?.includes('429') || e.message?.includes('quota')) {
                  console.warn(`>>> [SCRAPER] AI Rate Limit hit. Proceeding with fallback extraction only.`);
                } else {
                  console.warn(`>>> [SCRAPER] AI Error: ${e.message}`);
                }
              }
              
              const fallbackEmd = extractEmdFallback(extractedText);
              if (fallbackEmd !== null && (!aiData || aiData.emd_amount === null)) {
                console.log(`>>> [SCRAPER] Regex Fallback Found EMD: ${fallbackEmd}`);
                if (!aiData) aiData = {};
                aiData.emd_amount = fallbackEmd;
              }

              const locFallback = extractLocationFallback(extractedText);
              if (locFallback.state && (!aiData || !aiData.authority?.state)) {
                 console.log(`>>> [SCRAPER] Regex Fallback Found State: ${locFallback.state}`);
                 if (!aiData) aiData = { authority: {} };
                 if (!aiData.authority) aiData.authority = {};
                 aiData.authority.state = locFallback.state;
                 if (locFallback.city && !aiData.authority.city) aiData.authority.city = locFallback.city;
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
    let finalTitle = aiData?.tender_title || bid.description || `Tender ${bid.bidNo}`;
    if (aiData?.gemarp?.searched_strings && !finalTitle.includes(aiData.gemarp.searched_strings)) {
       // Only append if it's not repetitive
       // console.log("Refining title with keywords...");
    }

    const finalDept = auth?.organisation || auth?.department || auth?.ministry || bid.department || "N/A";
    const slug = generateSlug(bid.bidNo, finalTitle);

    // Use the exact start and end dates directly from the frontend UI.
    const finalStartDate = parseGeMDate(bid.startDate) || new Date().toISOString();
    const finalEndDate = parseGeMDate(bid.endDate) || new Date().toISOString();
    const finalOpeningDate = aiData?.dates?.bid_opening_date || aiData?.bid_opening_date || null;

    const { error } = await supabase.from("tenders").upsert({
      bid_number: bid.bidNo,
      slug,
      title: finalTitle,
      department: finalDept,
      ministry_name: auth?.ministry || null,
      department_name: auth?.department || null,
      organisation_name: auth?.organisation || null,
      office_name: auth?.office || null,
      state: auth?.state || null,
      city: auth?.city || null,
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
    }, { onConflict: 'bid_number' });

    if (error) {
      console.error(`>>> [SCRAPER] Database Error: ${error.message}`);
    } else {
      const storedEmd = aiData?.emd_amount === 0 ? "No" : (aiData?.emd_amount || "N/A");
      console.log(`>>> [SCRAPER] SUCCESS! Saved: ${bid.bidNo} (EMD: ${storedEmd})`);
    }
    
    // Increased delay to 5 seconds to avoid AI rate limits on free tier
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log("\n>>> [SCRAPER] Scrape cycle complete.");
  await browser.close();
}

function parseGeMDate(dateStr: string): string | null {
    if (!dateStr) return null;
    try {
        // Look for DD-MM-YYYY
        const dateMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
        if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];
            
            // Try to find time (HH:MM:SS or HH:MM)
            const timeMatch = dateStr.match(/(\d{2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
            let hours = "00";
            let minutes = "00";
            let seconds = "00";
            
            if (timeMatch) {
                hours = timeMatch[1];
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
            
            return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`).toISOString();
        }
    } catch (e) {
        // Fallthrough
    }
    return null;
}
