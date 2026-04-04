import { normalizeState, normalizeCity } from "./locations";

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507";

function buildPrompt(cleanedText: string): string {
  return `
    You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
    The document layout is a table with Hindi and English headers. The values are usually in English.

    CRITICAL EXTRACTION RULES:
    1. AUTHORITY HIERARCHY & LOCATIONS:
       - ministry: Look for the field marked "(Ministry)" or "Ministry of...".
       - department: Look for the field marked "(Department)" or "Department of...".
       - organisation: Look for "(Organisation)" or "Organisation Name". If multiple are present, pick the most specific one (e.g., "Indian Army", "Border Security Force").
       - office: Look for "(Office)" or "Office Name".
       - state: Extract the exact STATE perfectly from the full buyer address.
       - city: Extract the exact CITY or DISTRICT from the buyer address.
       - consignee_state: From "Consignees/Reporting Officer" table — STATE only.
       - consignee_city: From "Consignees/Reporting Officer" table — CITY/DISTRICT only.
       DO NOT leave these null if they are present in the text. Treat "N/A" as null.
    2. ITEM DETAILS:
       - tender_title: FULL, UNTRUNCATED Item Category or BOQ Title. NEVER end with '...'.
       - quantity: Extract the "Total Quantity". It must be a NUMBER.
    3. GeMARPTS & CATEGORIES:
       - gemarpts_strings, gemarpts_result, relevant_categories: extract as-is.
    4. DATES (ISO-8601):
       - bid_start_date, bid_end_date, bid_opening_date.
    5. RELAXATIONS & PREFERENCES:
       - msme: Look for "MSE Purchase Preference" or "एम एस ई खरीद वरीयता". If "Yes" or "हाँ", set to true.
       - mii: Look for "MII Compliance" or "एम आई आई अनुपालन". If "Yes" or "हाँ", set to true.
       - startup: Look for "Startup Relaxation" or "स्टार्टअप छूट". If "Yes" or "हाँ", set to true.
    6. LANGUAGE:
       - DO NOT INCLUDE ANY HINDI TEXT in your output. If a value contains both English and Hindi, extract ONLY the English portion. Omit all Hindi characters entirely.
    7. FRONTEND PARAMETERS:
       - You MUST extract these specific keys perfectly into the "parameters" object. Do not rename the keys.
       - "CONTRACT PERIOD", "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER", "ESTIMATED BID VALUE",
       - "EPBG DETAIL", "CONSIGNEES/REPORTING OFFICER AND QUANTITY", "DOCUMENT REQUIRED FROM SELLER",
       - "insight": Provide a 1-sentence professional summary of this tender (what is being bought and for whom).
    8. CLASSIFICATION (based on what is being procured):
       - category: Pick EXACTLY ONE ID: "it","office","transport","medical","furniture","electrical","industrial","security","services","civil","textile","environment","professional","defence","others"
    9. PROCUREMENT TYPE:
       - procurement_type: Choose "Goods" if buying physical products, "Works" if construction/installation/repair work, "Services" if hiring people or services.
    10. KEYWORDS:
       - keywords: Array of 5-8 most specific English keywords describing what is being procured (e.g. ["16 channel IP DVR", "2MP dome camera"]).

    Output ONLY valid JSON matching this schema exactly:
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
