import { normalizeState, normalizeCity, cityToState } from "./locations";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

function buildTenderPrompt(cleanedText: string): string {
  return `You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
The document layout is a table with Hindi and English headers. The values are usually in English.

CRITICAL EXTRACTION RULES:
1. AUTHORITY HIERARCHY & LOCATIONS:
   - ministry: Look for the field marked "(Ministry)" or "Ministry of...".
   - department: Look for the field marked "(Department)" or "Department of...".
   - organisation: Look for the field marked "(Organisation)". If multiple are present, pick the most specific one (e.g., "Indian Army", "Border Security Force", "Central Public Works Department").
   - office: Look for "(Office)" or "Office Name".
   - state: Extract the exact STATE perfectly from the full buyer address.
   - city: Extract the exact CITY or DISTRICT from the buyer address.
   - consignee_state: From "Consignees/Reporting Officer" table — STATE only.
     MASKED address: if address shows "**********CityName", extract "CityName" as the city.
     PIN-leading address: if address starts with a 6-digit number like "400074,RCF Ltd...", use the PIN zone to infer state.
     District pattern: look for "Dist-CityName" or "District CityName" to find the delivery city.
   - consignee_city: The CITY or DISTRICT at the consignee delivery address (apply same rules above).
   DO NOT leave these null if they are present in the text. Treat "N/A" as null.
2. ITEM DETAILS:
   - tender_title: FULL, UNTRUNCATED Item Category or BOQ Title. NEVER end with '...'.
   - quantity: NUMBER only (e.g. 1346).
3. GeMARPTS & CATEGORIES:
   - gemarpts_strings, gemarpts_result, relevant_categories: extract as-is.
4. DATES (ISO-8601): bid_start_date, bid_end_date, bid_opening_date.
5. RELAXATIONS & PREFERENCES:
   - msme: Look for "MSE Purchase Preference" or "एम एस ई खरीद वरीयता". If "Yes" or "हाँ", set to true.
   - mii: Look for "MII Compliance" or "एम आई आई अनुपालन". If "Yes" or "हाँ", set to true.
   - startup: Look for "Startup Relaxation" or "स्टार्टअप छूट". If "Yes" or "हाँ", set to true.
   - emd_amount: Look for "EMD Detail" / "ईएमडी विवरण" section. Two possible layouts:
     Layout A — has "Required" / "आवश्यकता" field:
       If "Required = No" → set emd_amount to 0 (no deposit needed).
       If "Required = Yes" → extract the numeric rupee amount from "EMD Amount" / "ईएमडी राशि" in the same section.
     Layout B — no "Required" field, directly shows "EMD Amount" / "ईएमडी राशि" with a number → extract that number.
     If the section is absent → set emd_amount to null.
6. FRONTEND PARAMETERS (extract into "parameters" object):
   - "CONTRACT PERIOD", "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER", "ESTIMATED BID VALUE",
   - "EPBG DETAIL", "CONSIGNEES/REPORTING OFFICER AND QUANTITY", "DOCUMENT REQUIRED FROM SELLER",
   - "insight": 1-sentence summary starting with the action, e.g. "Supply of X for Y".
7. P2 DIRECT NUMERIC FIELDS (extract at Top Level):
   - estimated_value, epbg_percentage, min_turnover_lakhs, experience_years, delivery_days, num_consignees, pre_bid_date.
8. CLASSIFICATION:
   - category: Pick EXACTLY ONE ID: "it","office","transport","medical","furniture","electrical","industrial","security","services","civil","textile","environment","professional","defence","others"
   - procurement_type: "Goods" | "Works" | "Services"
   - keywords: Array of 5-8 specific English keywords.

Output ONLY valid JSON matching this schema exactly:
{
  "tender_title": "string",
  "category": "string",
  "procurement_type": "Goods | Works | Services",
  "keywords": ["string"],
  "authority": { "ministry": "string", "department": "string", "organisation": "string", "office": "string", "state": "string", "city": "string", "consignee_state": "string", "consignee_city": "string" },
  "dates": { "bid_start_date": "ISO-8601", "bid_end_date": "ISO-8601", "bid_opening_date": "ISO-8601" },
  "quantity": 0,
  "gemarpts_strings": "string",
  "gemarpts_result": "string",
  "relevant_categories": "string",
  "emd_amount": 0,
  "estimated_value": 0,
  "epbg_percentage": 0,
  "min_turnover_lakhs": 0,
  "experience_years": 0,
  "delivery_days": 0,
  "num_consignees": 0,
  "pre_bid_date": "ISO-8601 | null",
  "relaxations": { "mse_experience": "string", "mse_turnover": "string", "startup_experience": "string", "startup_turnover": "string" },
  "documents_required": ["string"],
  "eligibility": { "msme": false, "mii": false },
  "parameters": { "CONTRACT PERIOD": "string", "ESTIMATED BID VALUE": "string", "EPBG DETAIL": "string", "CONSIGNEES/REPORTING OFFICER AND QUANTITY": "string", "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": "string", "DOCUMENT REQUIRED FROM SELLER": "string", "insight": "string" }
}

Document Text:
${cleanedText}`;
}

function prepareCleanedText(pdfText: string): string {
  const cleanedFull = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const preciseIdx = cleanedFull.search(/Consignees\s*\/\s*Reporting\s+Officer\s+and\s+Quantity/i);
  const looseIdx   = cleanedFull.search(/Consignees\s*[\/|]\s*Reporting\s+Officer/i);
  const consigneeIdx = preciseIdx >= 0 ? preciseIdx : looseIdx;

  const emdIdx = cleanedFull.search(/EMD\s*Detail|ईएमडी\s*विवरण/i);

  const base = cleanedFull.substring(0, 3500);
  const extras: string[] = [];

  if (consigneeIdx > 3500) {
    extras.push('\n\n[DELIVERY/CONSIGNEE SECTION]\n' + cleanedFull.substring(consigneeIdx, consigneeIdx + 2000));
  } else if (consigneeIdx < 0) {
    extras.push(cleanedFull.substring(3500, 6000));
  }

  if (emdIdx > 3500) {
    extras.push('\n\n[EMD SECTION]\n' + cleanedFull.substring(emdIdx, emdIdx + 500));
  }

  return extras.length ? base + extras.join('') : cleanedFull.substring(0, 6000);
}

function postProcessAiData(parsedData: any): any {
  if (parsedData.parameters?.insight) {
    parsedData.parameters["AI_INSIGHT"] = parsedData.parameters.insight;
  }
  parsedData.technical_summary = JSON.stringify(parsedData.parameters ?? {});

  if (parsedData?.authority) {
    parsedData.authority.city = normalizeCity(parsedData.authority.city);
    parsedData.authority.consignee_city = normalizeCity(parsedData.authority.consignee_city);

    parsedData.authority.state = parsedData.authority.state
      ? normalizeState(parsedData.authority.state)
      : cityToState(parsedData.authority.city);

    parsedData.authority.consignee_state = parsedData.authority.consignee_state
      ? normalizeState(parsedData.authority.consignee_state)
      : cityToState(parsedData.authority.consignee_city);
  }
  return parsedData;
}

export async function extractTenderDataOllama(pdfText: string) {
  const cleanedText = prepareCleanedText(pdfText);
  const prompt = buildTenderPrompt(cleanedText);

  try {
    console.log(`>>> [AI] Calling Ollama (Model: ${OLLAMA_MODEL})...`);
    const response = await fetch(`${OLLAMA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`>>> [AI] Ollama Error: ${response.status} ${err}`);
      return null;
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsedData = JSON.parse(text.replace(/```json|```/g, "").trim());
    return postProcessAiData(parsedData);
  } catch (e: any) {
    console.error(`>>> [AI] Ollama Failed: ${e.message}`);
    return null;
  }
}

/** Auto-selects Ollama (if OLLAMA_MODEL is set) or Groq. */
export async function extractTenderData(pdfText: string) {
  if (process.env.OLLAMA_MODEL) {
    return extractTenderDataOllama(pdfText);
  }
  return extractTenderDataGroq(pdfText);
}

export async function extractTenderDataGroq(pdfText: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn(">>> [AI] GROQ_API_KEY not set, skipping Groq.");
    return null;
  }

  const cleanedText = prepareCleanedText(pdfText);
  const prompt = buildTenderPrompt(cleanedText);

  try {
    console.log(`>>> [AI] Calling Groq (Model: ${GROQ_MODEL})...`);
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (response.status === 429) {
      const err = await response.json();
      const retryMs = parseFloat(err?.error?.message?.match(/([\d.]+)ms/)?.[1] ?? "2000");
      const waitMs = Math.min(Math.ceil(retryMs) + 500, 10000);
      console.warn(`>>> [AI] Groq TPM limit. Retrying in ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
      return extractTenderDataGroq(pdfText);
    }

    if (!response.ok) {
      const err = await response.text();
      console.error(`>>> [AI] Groq Error: ${response.status} ${err}`);
      return null;
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsedData = JSON.parse(text.replace(/```json|```/g, "").trim());
    return postProcessAiData(parsedData);
  } catch (e: any) {
    console.error(`>>> [AI] Groq Failed: ${e.message}`);
    return null;
  }
}
