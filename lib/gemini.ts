import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeState, normalizeCity } from "./locations";

const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Helper function for delay
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Global rate limiter to ensure we never hit Google's 15 RPM Free Cap
let lastCallTime = 0;
const MIN_DELAY_MS = 4300; // 4.3 seconds between every single request (~13.9 RPM max)

export async function extractTenderData(pdfText: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  const prompt = `
    You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
    The document layout is a table with Hindi and English headers. The values are usually in English.
    
    CRITICAL EXTRACTION RULES:
    1. AUTHORITY HIERARCHY & LOCATIONS:
       - ministry: "Ministry/State Name"
       - department: "Department Name"
       - organisation: "Organisation Name" (e.g., "Indian Army")
       - office: "Office Name"
       - state: Extract the exact STATE perfectly from the buyer address.
       - city: Extract the exact CITY or DISTRICT from the buyer address.
       - consignee_state: Look at the "Consignees/Reporting Officer" section. Extract ONLY the STATE name.
       - consignee_city: Look at the "Consignees/Reporting Officer" section. Extract ONLY the CITY or DISTRICT name (e.g. "New Delhi", "Mumbai", "Ambala"). Do not include the person's name or the state here.
       DO NOT leave these null if they are present in the text.
    2. ITEM DETAILS:
       - tender_title: Extract the FULL, UNTRUNCATED value of the Item Category or BOQ Title. Search the entire document to find the complete name without trailing '...'. NEVER return a title ending in '...'. If the document only has a truncated title, remove '...' from the end.
       - quantity: Extract the "Total Quantity" or "कुल मात्रा". It must be a NUMBER (e.g., 1346).
    3. GeMARPTS & CATEGORIES:
       - gemarpts_strings: Value of "Searched Strings used in GeMARPTS".
       - gemarpts_result: Value of "Searched Result generated in GeMARPTS".
       - relevant_categories: Value of "Relevant Categories selected for notification".
    4. DATES (ISO-8601):
       - bid_start_date: "Document Date" or "Published Date" or "Bid Start Date"
       - bid_end_date: "Bid End Date/Time"
       - bid_opening_date: "Bid Opening Date/Time" - ENSURE THIS IS EXTRACTED.
    5. RELAXATIONS:
       - Check "MSE Relaxation for Years Of Experience and Turnover" and the Startup equivalent.
    6. LANGUAGE:
       - DO NOT INCLUDE ANY HINDI TEXT in your output. If a value contains both English and Hindi, extract ONLY the English portion. Omit all Hindi characters entirely.
    7. FRONTEND PARAMETERS:
       - You MUST extract these specific keys perfectly into the "parameters" object. Do not rename the keys.
       - "CONTRACT PERIOD": Look for "Bid Offer Validity" or "Contract Period".
       - "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": Look for "Minimum Average Annual Turnover of the bidder" in Lakhs or Crores.
       - "ESTIMATED BID VALUE": Look for estimated value in INR.
       - "EPBG DETAIL": Look for ePBG percentage or details.
       - "CONSIGNEES/REPORTING OFFICER AND QUANTITY": Extract the FULL consignee details exactly as written, including the person's name, address, CITY, state, and quantity.
       - "DOCUMENT REQUIRED FROM SELLER": Give a comma-separated list of required documents.
       - "insight": Provide a 1-sentence professional summary of this tender (what is being bought and for whom).
    
    Output Schema (JSON):
    {
      "tender_title": "string (FULL, UNTRUNCATED title/category)",
      "authority": {
        "ministry": "string",
        "department": "string",
        "organisation": "string",
        "office": "string",
        "state": "string",
        "city": "string",
        "consignee_state": "string",
        "consignee_city": "string"
      },
      "dates": {
        "bid_start_date": "ISO-8601",
        "bid_end_date": "ISO-8601",
        "bid_opening_date": "ISO-8601"
      },
      "quantity": number,
      "gemarpts_strings": "string",
      "gemarpts_result": "string",
      "relevant_categories": "string",
      "emd_amount": number,
      "relaxations": {
        "mse_experience": "string",
        "mse_turnover": "string",
        "startup_experience": "string",
        "startup_turnover": "string"
      },
      "documents_required": ["string list"],
      "eligibility": {
        "msme": false,
        "mii": false
      },
      "parameters": {
        "CONTRACT PERIOD": "string or N/A",
        "QUANTITY": "string or N/A",
        "ITEM CATEGORY": "string or N/A",
        "YEARS OF PAST EXPERIENCE REQUIRED FOR SAME/SIMILAR SERVICE": "string or N/A",
        "PAST EXPERIENCE OF SIMILAR SERVICES REQUIRED": "string or N/A",
        "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": "string or N/A",
        "ADDITIONAL QUALIFICATION/DATA REQUIRED": "string or N/A",
        "ESTIMATED BID VALUE": "string or N/A",
        "EPBG DETAIL": "string or N/A",
        "CONSIGNEES/REPORTING OFFICER AND QUANTITY": "string or N/A",
        "MSE PURCHASE PREFERENCE": "Yes or No",
        "MII COMPLIANCE": "Yes or No",
        "STARTUP RELAXATION FOR YEARS OF EXPERIENCE AND TURNOVER": "string or N/A",
        "MSE RELAXATION FOR YEARS OF EXPERIENCE AND TURNOVER": "string or N/A",
        "DOCUMENT REQUIRED FROM SELLER": "string or N/A",
        "insight": "string (1-sentence executive summary)"
      }
    }

    Document Text Content:
    ${cleanedText}
  `;

  let retries = 5;
  let delay = 65000; // start at 65s so a full 1-minute rate-limit window resets

  while (retries > 0) {
    try {
      // Enforce strictly inside the loop so retries also obey the queue
      const now = Date.now();
      if (now - lastCallTime < MIN_DELAY_MS) {
        const queueWait = MIN_DELAY_MS - (now - lastCallTime);
        lastCallTime = lastCallTime + MIN_DELAY_MS;
        await sleep(queueWait);
      } else {
        lastCallTime = Date.now();
      }

      console.log(`>>> [AI] Calling Gemini (Model: gemini-2.5-flash)...`);
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      
      if (parsedData.parameters) {
        if (parsedData.parameters.insight) {
          parsedData.parameters["AI_INSIGHT"] = parsedData.parameters.insight;
        }
        parsedData.technical_summary = JSON.stringify(parsedData.parameters);
      } else {
        parsedData.technical_summary = "{}";
      }
      
      if (parsedData?.authority) {
        if (parsedData.authority.state) {
          parsedData.authority.state = normalizeState(parsedData.authority.state);
        }
        if (parsedData.authority.city) {
          parsedData.authority.city = normalizeCity(parsedData.authority.city);
        }
        if (parsedData.authority.consignee_state) {
          parsedData.authority.consignee_state = normalizeState(parsedData.authority.consignee_state);
        }
        if (parsedData.authority.consignee_city) {
          parsedData.authority.consignee_city = normalizeCity(parsedData.authority.consignee_city);
        }
      }
      return parsedData;
    } catch (error: any) {
      const msg = error.message || "";
      const isRateLimit = error.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit');
      
      if (isRateLimit && retries > 1) {
        console.warn(`>>> [AI] Rate limited (429). Retrying in ${delay / 1000}s...`);
        await sleep(delay);
        retries--;
        delay *= 2; 
      } else {
        console.warn(`>>> [AI] Gemini Error: ${msg} - ${error.status || ''}`);
        return null;
      }
    }
  }
  return null;
}

export function generateSlug(bidNumber: string, title: string): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // replace spaces with -
    .replace(/-+/g, "-") // collapse --
    .trim();

  const cleanBid = bidNumber.replace(/\//g, "-").toLowerCase();
  
  return `${cleanBid}-${cleanTitle}`.substring(0, 200);
}
