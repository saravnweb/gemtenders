import { chromium } from "playwright";
import { supabase } from "@/lib/supabase";
import { extractTenderData, generateSlug } from "@/lib/gemini";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

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
      
      // Extract Department
      const cardBody = el.querySelector('.card-body');
      const deptCol = cardBody?.querySelector('.col-md-4:last-child p');
      const department = deptCol?.textContent?.replace('Department Name And Address:', '')?.trim() || "N/A";

      // Extract Items (Description)
      const itemsCol = cardBody?.querySelector('.col-md-4:nth-child(2)');
      const popoverEl = itemsCol?.querySelector('a[data-toggle="popover"]');
      let description = "";
      if (popoverEl) {
        description = popoverEl.getAttribute('data-content') || popoverEl.textContent?.trim() || "";
      } else {
        description = itemsCol?.querySelector('.row:first-child p')?.textContent?.replace('Items:', '')?.trim() || "";
      }
      
      const startDateEl = el.querySelector('.col-md-3 .row:nth-child(1) span');
      const endDateEl = el.querySelector('.col-md-3 .row:nth-child(2) span');
      
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
    
    if (bid.pdfLink && bid.pdfLink.includes('showbidDocument')) {
      try {
        console.log(`>>> [SCRAPER] Downloading PDF...`);
        const response = await page.request.get(bid.pdfLink);
        const contentType = response.headers()['content-type'] || "";
        const buffer = await response.body();

        if (buffer && buffer.length > 5000 && contentType.includes('pdf')) { 
          const fileName = `${bid.bidNo.replace(/\//g, "-")}.pdf`;
          
          console.log(`>>> [SCRAPER] Uploading PDF (${(buffer.length / 1024).toFixed(1)} KB)...`);
          const { data, error: uploadErr } = await supabase.storage
            .from("tender-documents")
            .upload(fileName, buffer, { contentType: "application/pdf", upsert: true });

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage.from("tender-documents").getPublicUrl(data.path);
            pdfPublicUrl = publicUrlData.publicUrl;
          } else {
            console.error(`>>> [SCRAPER] Storage Error: ${uploadErr.message}`);
          }

          console.log(`>>> [SCRAPER] Extracting text & calling AI...`);
          try {
            const pdfData = await pdf(buffer);
            if (pdfData.text) {
              aiData = await extractTenderData(pdfData.text);
              console.log(`>>> [SCRAPER] AI matched: ${aiData?.tender_title?.substring(0, 30)}...`);
            }
          } catch (e) {
            console.warn(`>>> [SCRAPER] PDF/AI parsing failed.`);
          }
        } else {
          console.warn(`>>> [SCRAPER] Invalid PDF response (Type: ${contentType}, Size: ${buffer?.length})`);
        }
      } catch (err: any) {
        console.warn(`>>> [SCRAPER] Network Error: ${err.message}`);
      }
    }

    // FINAL DATA ASSEMBLY
    // Prioritize AI title, then HTML description, then generic
    const finalTitle = aiData?.tender_title || bid.description || `Tender ${bid.bidNo}`;
    const finalDept = aiData?.department_name || bid.department || "N/A";
    const slug = generateSlug(bid.bidNo, finalTitle);

    const { error } = await supabase.from("tenders").upsert({
      bid_number: bid.bidNo,
      slug,
      title: finalTitle,
      department: finalDept,
      start_date: parseGeMDate(bid.startDate),
      end_date: parseGeMDate(bid.endDate),
      pdf_url: pdfPublicUrl || existing?.pdf_url, 
      details_url: `https://bidplus.gem.gov.in/showbiddata/${bid.bidNo}`, 
      ai_summary: aiData?.technical_summary || null,
      emd_amount: aiData?.emd_amount || null,
      eligibility_msme: aiData?.eligibility?.msme || false,
      eligibility_mii: aiData?.eligibility?.mii || false,
    }, { onConflict: 'bid_number' });

    if (error) {
      console.error(`>>> [SCRAPER] Database Error: ${error.message}`);
    } else {
      console.log(`>>> [SCRAPER] SUCCESS! Saved: ${bid.bidNo}`);
    }
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
