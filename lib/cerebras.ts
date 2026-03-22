import { normalizeState, normalizeCity } from "./locations";

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507";

function buildPrompt(cleanedText: string): string {
  return `
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
       - keywords: Array of 5-8 most specific and relevant English keywords describing what is being procured.

    Output ONLY valid JSON matching this schema exactly:
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
      "quantity": 0,
      "gemarpts_strings": "string",
      "gemarpts_result": "string",
      "relevant_categories": "string",
      "emd_amount": 0,
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
}

function postProcess(parsedData: any): any {
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

export async function extractTenderData(pdfText: string) {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY not set in environment.");

  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  const prompt = buildPrompt(cleanedText);

  console.log(`>>> [AI] Calling Cerebras (Model: ${CEREBRAS_MODEL})...`);

  const response = await fetch(CEREBRAS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cerebras ${response.status}: ${err}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Cerebras");

  const parsedData = JSON.parse(text.replace(/```json|```/g, "").trim());
  return postProcess(parsedData);
}
