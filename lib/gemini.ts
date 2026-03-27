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
8. CLASSIFICATION (based on what is being procured):
   - category: Pick EXACTLY ONE ID from this list that best matches the primary item/service being procured:
     "it" (IT & Tech: laptops, servers, CCTV, software, networking, printers, telecom)
     "civil" (Civil Works: construction, roads, buildings, renovation, waterproofing, flooring)
     "electrical" (Electrical: transformers, cables, UPS, solar panels, LED lights, generators, switchgear)
     "medical" (Medical: hospital equipment, medicines, surgical supplies, lab equipment, diagnostics)
     "furniture" (Furniture: chairs, tables, almirahs, modular workstations, racks, shelving)
     "vehicles" (Vehicles: cars, trucks, buses, tractors, electric vehicles, vehicle hiring)
     "manpower" (Manpower: staffing, labour outsourcing, data entry operators, contractual workers)
     "security" (Security: security guards, surveillance, fire safety, access control, metal detectors)
     "transport" (Transport & Logistics: freight, cargo, courier, goods shifting, packers and movers)
     "printing" (Printing: flex printing, banners, brochures, publications, stationery printing)
     "catering" (Catering & Food: food supply, canteen, mess services, rations, grocery, edible oil)
     "textile" (Textile & Uniform: uniforms, fabric, linen, bedsheets, blankets, towels, curtains)
     "maintenance" (Maintenance/AMC: annual maintenance contracts, overhauling, facility management, repair services)
     "pipes-hardware" (Pipes & Hardware: pipes, valves, pumps, bolts, nuts, steel structures, hardware items)
     "cleaning" (Cleaning: housekeeping, pest control, waste management, sanitation, horticulture)
     "events-training" (Events & Training: events, seminars, workshops, conferences, training programs)
     "supplies" (Supplies & Stationery: stationery, office supplies, toners, consumables, safety equipment)
     "survey-consulting" (Survey & Consulting: surveys, consultancy, audits, inspections, DPRs, GIS mapping)
     "water-environment" (Water & Environment: water treatment, ETP, STP, water purifiers, borewell, pollution control)
     "defence" (Defence & Specialized: military equipment, army stores, ordnance, tactical/defence items)
   - procurement_type: "Goods" if buying physical products, "Works" if construction/civil/installation work, "Services" if hiring people or services.
   - keywords: Array of 5-8 most specific and relevant English keywords describing what is being procured (e.g. ["16 channel IP DVR", "2MP dome camera", "CCTV surveillance system"]). Use specific product/service names, not generic words.

Output Schema (JSON):
{
  "tender_title": "string (FULL, UNTRUNCATED title/category)",
  "category": "string (one of the 20 category IDs listed in Rule 8)",
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
