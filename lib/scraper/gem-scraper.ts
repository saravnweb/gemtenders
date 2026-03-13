import { chromium } from "playwright";
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

export async function scrapeGeMBids() {
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
    await page.goto("https://bidplus.gem.gov.in/all-bids", { 
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

  const initialBids = await page.evaluate(() => {
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

  console.log(`>>> [SCRAPER] Found ${initialBids.length} bid entries. Processing first 10...`);

  const bidsToProcess = initialBids.slice(0, 10);

  for (const bid of bidsToProcess) {
    console.log(`\n>>> [SCRAPER] Processing: ${bid.bidNo}`);
    
    const { data: existing } = await supabase
      .from("tenders")
      .select("id, title, pdf_url")
      .eq("bid_number", bid.bidNo)
      .maybeSingle();

    // Re-scrape if it's missing AI data (generic title/n-a) or PDF
    const isGeneric = !existing?.title || existing.title.startsWith("Tender GEM") || existing.title === "N/A";
    const isMissingPdf = !existing?.pdf_url;

    if (existing && !isGeneric && !isMissingPdf) {
      console.log(`>>> [SCRAPER] Skipping: Already indexed.`);
      continue;
    }

    let pdfPublicUrl = null;
    let aiData: any = null;
    

    if (bid.pdfLink) {
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
              aiData = await extractTenderData(extractedText);
              
              const fallbackEmd = extractEmdFallback(extractedText);
              if (fallbackEmd && (!aiData || !aiData.emd_amount)) {
                console.log(`>>> [SCRAPER] Regex Fallback Found EMD: ${fallbackEmd}`);
                if (!aiData) aiData = {};
                aiData.emd_amount = fallbackEmd;
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
    // Best name for display/listing: Organisation > Department > Ministry
    const auth = aiData?.authority;
    const finalTitle = aiData?.tender_title || bid.description || `Tender ${bid.bidNo}`;
    const finalDept = auth?.organisation || auth?.department || auth?.ministry || bid.department || "N/A";
    const slug = generateSlug(bid.bidNo, finalTitle);

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
      start_date: parseGeMDate(bid.startDate),
      end_date: parseGeMDate(bid.endDate),
      opening_date: aiData?.bid_opening_date || null,
      mse_relaxation: aiData?.relaxations?.mse_experience || null,
      startup_relaxation: aiData?.relaxations?.startup_experience || null,
      mse_turnover_relaxation: aiData?.relaxations?.mse_turnover || null,
      startup_turnover_relaxation: aiData?.relaxations?.startup_turnover || null,
      documents_required: aiData?.documents_required || [],
      pdf_url: pdfPublicUrl || existing?.pdf_url, 
      details_url: `https://bidplus.gem.gov.in/showbiddata/${bid.bidNo}`, 
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
    
    // Small delay to avoid AI rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n>>> [SCRAPER] Scrape cycle complete.");
  await browser.close();
}

function parseGeMDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    try {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('-');
        return new Date(`${year}-${month}-${day}T${timePart || '00:00:00'}`).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}
