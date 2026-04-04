import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeState, normalizeCity } from "./locations";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Key Rotation ---
// Add GEMINI_API_KEY_2, GEMINI_API_KEY_3, etc. to .env.local for multiplied rate limits.
// Each key gets its own rate limiter (15 RPM per key → 3 keys = 45 RPM total).
const MIN_DELAY_MS = 2000; // 30 RPM (conservative for gemini-2.5-flash preview tier)

function loadKeyPool() {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY?.trim();
  if (primary) keys.push(primary);
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }
  if (keys.length === 0) throw new Error("No GEMINI_API_KEY found in environment.");
  console.log(`>>> [AI] Gemini: ${keys.length} key(s) loaded (~${keys.length * 12} RPM capacity)`);
  return keys.map(k => ({ genAI: new GoogleGenerativeAI(k), lastCallTime: 0 }));
}

const keyPool = loadKeyPool();
let keyIndex = 0;
let globalLastCallTime = 0; // shared queue across all keys

async function getNextClient(): Promise<GoogleGenerativeAI> {
  const slot = keyPool[keyIndex % keyPool.length];
  keyIndex++;

  // Single global queue — one call every MIN_DELAY_MS regardless of which key is used.
  // This prevents bursting when multiple keys share the same GCP project quota.
  const now = Date.now();
  if (now - globalLastCallTime < MIN_DELAY_MS) {
    const wait = MIN_DELAY_MS - (now - globalLastCallTime);
    globalLastCallTime = globalLastCallTime + MIN_DELAY_MS;
    await sleep(wait);
  } else {
    globalLastCallTime = Date.now();
  }

  return slot.genAI;
}

// ─── Shared extraction prompt ─────────────────────────────────────────────────
const EXTRACTION_INSTRUCTION = `
You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
The document layout is a table with Hindi and English headers. The values are usually in English.

CRITICAL EXTRACTION RULES:
1. AUTHORITY HIERARCHY & LOCATIONS:
   - ministry: Look for the field marked "(Ministry)" or "Ministry of...".
   - department: Look for the field marked "(Department)" or "Department of...".
   - organisation: Look for the field marked "(Organisation)" or "Organisation Name". If multiple are present, pick the most specific one (e.g., "Indian Army", "Border Security Force", "Central Public Works Department").
   - office: Look for "(Office)" or "Office Name".
   - state: Extract the exact STATE perfectly from the full buyer address.
   - city: Extract the exact CITY or DISTRICT from the buyer address.
   - consignee_state: Look at the "Consignees/Reporting Officer" table. Extract ONLY the STATE name.
   - consignee_city: Look at the "Consignees/Reporting Officer" table. Extract ONLY the CITY or DISTRICT name.
   DO NOT leave these null if they are present in the text. Treat "N/A" as null.
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
5. RELAXATIONS & PREFERENCES:
   - msme: Look for "MSE Purchase Preference" or "एम एस ई खरीद वरीयता". If it says "Yes" or "हाँ", set to true.
   - mii: Look for "MII Compliance" or "एम आई आई अनुपालन". If it says "Yes" or "हाँ", set to true.
   - startup: Look for "Startup Relaxation" or "स्टार्टअप छूट". If "Yes" or "हाँ", set to true.
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
8. CLASSIFICATION (based on what is being procured):
   - category: Pick EXACTLY ONE ID from this list that best matches the primary item/service being procured:
     "it" (Computers & IT: laptops, servers, software, networking, printers, CCTV, telecom)
     "office" (Office & Building: office machines, stationery, consumables, appliances, HVAC)
     "transport" (Automobiles & Transport: vehicles, spare parts, electric vehicles, hiring services, logistics)
     "medical" (Healthcare & Medical: hospital equipment, medicines, surgical supplies, lab equipment)
     "furniture" (Furniture & Fixtures: chairs, tables, almirahs, modular workstations, shelving)
     "electrical" (Electrical & Power: transformers, cables, UPS, solar power, LED lighting, switchgear)
     "industrial" (Industrial & Hardware: pipes, valves, pumps, steel, industrial gases, hand tools)
     "security" (Security & Safety: security guards, surveillance, fire safety, access control)
     "services" (Manpower & Services: staffing, cleaning, catering, facility management, outsourcing)
     "civil" (Civil & Construction: buildings, roads, repairs, infrastructure, project management)
     "textile" (Textile & Training: uniforms, fabric, events, seminars, training programs)
     "environment" (Environment & Water: water supply, STP, waste management, pollution control)
     "professional" (Professional Services: consulting, audits, surveys, legal, project reports)
     "defence" (Defence & Military: tactical gear, assault equipment, military stores, ordnance)
     "others" (Others: miscellaneous items not fitting above)
9. PROCUREMENT TYPE:
   - procurement_type: Choose "Goods" if buying physical products, "Works" if construction/civil/installation/repair work, "Services" if hiring people, agencies, or AMC.
10. KEYWORDS:
   - keywords: Provide an array of 5-8 most specific English keywords describing what is being procured (e.g. ["16 channel IP DVR", "2MP dome camera", "CCTV surveillance system"]). Omit generic words like "tender" or "bid".

Output Schema (JSON):
{
  "tender_title": "string (FULL, UNTRUNCATED title/category)",
  "category": "string (one of the 15 category IDs listed in Rule 8)",
  "procurement_type": "Goods | Works | Services",
  "keywords": ["string", "string"],
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
}`;

// ─── Shared JSON parsing + normalization ──────────────────────────────────────
function parseGeminiResponse(rawText: string) {
  const cleanJson = rawText.replace(/```json|```/g, "").trim();
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
    if (parsedData.authority.state) parsedData.authority.state = normalizeState(parsedData.authority.state);
    if (parsedData.authority.city) parsedData.authority.city = normalizeCity(parsedData.authority.city);
    if (parsedData.authority.consignee_state) parsedData.authority.consignee_state = normalizeState(parsedData.authority.consignee_state);
    if (parsedData.authority.consignee_city) parsedData.authority.consignee_city = normalizeCity(parsedData.authority.consignee_city);
  }
  return parsedData;
}

// ─── Extract from plain text (existing path) ─────────────────────────────────
export async function extractTenderData(pdfText: string) {
  const genAI = await getNextClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  const prompt = `${EXTRACTION_INSTRUCTION}\n\nDocument Text Content:\n${cleanedText}`;

  try {
    console.log(`>>> [AI] Calling Gemini (Model: gemini-2.5-flash)...`);
    const result = await model.generateContent(prompt);
    return parseGeminiResponse(result.response.text());
  } catch (error: any) {
    const msg = error.message || "";
    const isRateLimit = error.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit');

    if (isRateLimit) {
      console.warn(`>>> [AI] Gemini rate limited (429). Falling back to Groq...`);
      const { extractTenderDataGroq } = await import('./groq-ai');
      return extractTenderDataGroq(pdfText);
    }

    console.warn(`>>> [AI] Gemini Error: ${msg} - ${error.status || ''}`);
    return null;
  }
}

// ─── Extract from raw PDF bytes (no pdf-parse needed) ────────────────────────
// Gemini reads the PDF natively — better extraction quality than text dumps.
export async function extractTenderDataFromPdfBytes(pdfBuffer: Buffer) {
  const genAI = await getNextClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  try {
    console.log(`>>> [AI] Calling Gemini with inline PDF (${pdfBuffer.length} bytes)...`);
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf" as const,
          data: pdfBuffer.toString("base64"),
        },
      },
      { text: EXTRACTION_INSTRUCTION },
    ]);
    return parseGeminiResponse(result.response.text());
  } catch (error: any) {
    const msg = error.message || "";
    const isRateLimit = error.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit');

    if (isRateLimit) {
      console.warn(`>>> [AI] Gemini rate limited (429). Retrying after delay...`);
      await sleep(5000);
      return extractTenderDataFromPdfBytes(pdfBuffer);
    }

    console.warn(`>>> [AI] Gemini PDF Error: ${msg} - ${error.status || ''}`);
    return null;
  }
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
