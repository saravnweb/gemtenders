import { normalizeState, normalizeCity } from "./locations";

export async function extractTenderDataOllama(pdfText: string) {
  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 10000); // Drastically reduced payload to triple inference speed

  const prompt = `
    You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
    The document layout is a table with Hindi and English headers. The values are usually in English.
    
    CRITICAL EXTRACTION RULES:
    1. AUTHORITY HIERARCHY & LOCATIONS:
       - ministry: Look for the field marked "(Ministry)" or "Ministry of...".
       - department: Look for the field marked "(Department)" or "Department of...".
       - organisation: Look for the field marked "(Organisation)". If multiple are present, pick the most specific one (e.g., "Indian Army", "Border Security Force", "Central Public Works Department").
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
       - msme: Look for "MSE Purchase Preference" or "एम एस ई खरीद वरीयता". If "Yes" or "हाँ", set to true.
       - mii: Look for "MII Compliance" or "एम आई आई अनुपालन". If "Yes" or "हाँ", set to true.
       - startup: Look for "Startup Relaxation" or "स्टार्टअप छूट". If "Yes" or "हाँ", set to true.
    6. FRONTEND PARAMETERS:
       - You MUST extract these specific keys perfectly into the "parameters" object. Do not rename the keys.
       - "CONTRACT PERIOD": Look for "Bid Offer Validity" or "Contract Period".
       - "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": Look for "Minimum Average Annual Turnover of the bidder" in Lakhs or Crores.
       - "ESTIMATED BID VALUE": Look for estimated value in INR.
       - "EPBG DETAIL": Look for ePBG percentage or details.
       - "CONSIGNEES/REPORTING OFFICER AND QUANTITY": Extract the FULL consignee details exactly as written, including the person's name, address, CITY, state, and quantity.
       - "DOCUMENT REQUIRED FROM SELLER": Give a comma-separated list of required documents.
       - "insight": Provide a 1-sentence professional summary of this tender. DO NOT start with "This tender is for" or "This tender". Start directly with the action/item being procured, e.g. "Supply of [Item] for [Organization]".
    7. CLASSIFICATION (based on what is being procured):
       - category: Pick EXACTLY ONE ID: "it","office","transport","medical","furniture","electrical","industrial","security","services","civil","textile","environment","professional","defence","others"
       - procurement_type: "Goods" | "Works" | "Services"
       - keywords: Array of 5-8 most specific English keywords.

    Output Schema (JSON):
    {
      "tender_title": "string (FULL, UNTRUNCATED title/category)",
      "category": "string (one of the 15 IDs from Rule 7)",
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
        "MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER": "string or N/A",
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

  try {
    console.log(">>> [AI] Calling local Ollama (Model: qwen2.5:3b)...");
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        prompt: prompt,
        format: "json",
        stream: false,
        options: {
          temperature: 0.1,         // Lowest temp for strict extraction
          num_predict: 2048,        // Max tokens to generate
          num_ctx: 8192             // Increase context to 8192 to give enough room for PDF parsing without crashing
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(">>> [AI] Ollama Error Response:", errText);
      return null;
    }

    const jsonResp = await response.json();
    const text = jsonResp.response;
    
    const cleanJson = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsedData = JSON.parse(cleanJson);
    
    // Inject parameters as stringified JSON so the frontend parser can display it
    if (parsedData.parameters) {
      if (parsedData.parameters.insight) {
        parsedData.parameters["AI_INSIGHT"] = parsedData.parameters.insight;
      }
      parsedData.technical_summary = JSON.stringify(parsedData.parameters);
    } else {
      parsedData.technical_summary = "{}";
    }
    
    // Normalize city/state
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
  } catch (e: any) {
    console.log(">>> [AI] Ollama Failed:", e.message || e);
    return null;
  }
}

export async function generateTenderInsightOllama(extractedData: Record<string, string>): Promise<string> {
  const prompt = `
    You are an expert Procurement Officer AI. I have extracted the core technical specifications from a government tender document.
    Your job is to write a highly professional, concise 1 to 2 sentence summary describing exactly what this tender is procuring, the estimated value (if present), and any major highlighted requirement.
    
    Rules:
    - ONLY output the summary text. No JSON, no markdown, no conversational filler.
    - Keep it under 2 sentences.
    - DO NOT start with phrases like "This tender is for" or "This tender".
    - Start directly with the action or item being procured, for example: "Supply of X to organization Y" or "Procurement of X".
    
    Data:
    ${JSON.stringify(extractedData, null, 2)}
  `;

  try {
    console.log(">>> [AI] Generating Insight via Ollama (qwen2.5:3b)...");
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        prompt: prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 150 }
      })
    });
    
    if (!response.ok) return "";
    const jsonResp = await response.json();
    return jsonResp.response.trim();
  } catch (error) {
    console.error(">>> [AI] Insight generation failed:", error);
    return "";
  }
}
