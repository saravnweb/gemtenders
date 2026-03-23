import { normalizeState, normalizeCity, cityToState } from "./locations";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function extractTenderDataGroq(pdfText: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn(">>> [AI] GROQ_API_KEY not set, skipping Groq.");
    return null;
  }

  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 6000);

  const prompt = `You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
The document layout is a table with Hindi and English headers. The values are usually in English.

CRITICAL EXTRACTION RULES:
1. AUTHORITY HIERARCHY & LOCATIONS:
   - ministry: "Ministry/State Name"
   - department: "Department Name"
   - organisation: "Organisation Name"
   - office: "Office Name"
   - state: Extract the exact STATE from the buyer address.
   - city: Extract the exact CITY or DISTRICT from the buyer address.
   - consignee_state: From "Consignees/Reporting Officer" section — STATE only.
   - consignee_city: From "Consignees/Reporting Officer" section — CITY or DISTRICT only.
2. ITEM DETAILS:
   - tender_title: FULL, UNTRUNCATED Item Category or BOQ Title. NEVER end with '...'.
   - quantity: NUMBER only (e.g. 1346).
3. GeMARPTS & CATEGORIES:
   - gemarpts_strings, gemarpts_result, relevant_categories: extract as-is.
4. DATES (ISO-8601): bid_start_date, bid_end_date, bid_opening_date.
5. FRONTEND PARAMETERS (extract into "parameters" object):
   - "CONTRACT PERIOD", "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER", "ESTIMATED BID VALUE",
   - "EPBG DETAIL", "CONSIGNEES/REPORTING OFFICER AND QUANTITY", "DOCUMENT REQUIRED FROM SELLER",
   - "insight": 1-sentence summary starting with the action, e.g. "Supply of X for Y".
6. CLASSIFICATION:
   - category: ONE of: "it","civil","electrical","medical","furniture","vehicles","manpower","security","transport","printing","catering","textile","maintenance","pipes-hardware","cleaning","events-training","supplies","survey-consulting","water-environment","defence"
   - procurement_type: "Goods" | "Works" | "Services"
   - keywords: 5-8 specific English keywords.

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
  "relaxations": { "mse_experience": "string", "mse_turnover": "string", "startup_experience": "string", "startup_turnover": "string" },
  "documents_required": ["string"],
  "eligibility": { "msme": false, "mii": false },
  "parameters": { "CONTRACT PERIOD": "string", "ESTIMATED BID VALUE": "string", "EPBG DETAIL": "string", "CONSIGNEES/REPORTING OFFICER AND QUANTITY": "string", "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": "string", "DOCUMENT REQUIRED FROM SELLER": "string", "insight": "string" }
}

Document Text:
${cleanedText}`;

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
  } catch (e: any) {
    console.error(`>>> [AI] Groq Failed: ${e.message}`);
    return null;
  }
}
