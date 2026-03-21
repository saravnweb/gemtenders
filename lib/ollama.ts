import { normalizeState, normalizeCity } from "./locations";

export async function extractTenderDataOllama(pdfText: string) {
  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000); // Phi3 has a 4k/128k context window depending on exact model, usually we limit to what fits

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
       - consignee_state: Extract the exact STATE perfectly from the "Consignees/Reporting Officer" or delivery location.
       - consignee_city: Extract the exact CITY perfectly from the "Consignees/Reporting Officer" or delivery location.
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
      "technical_summary": "string"
    }

    Document Text Content:
    ${cleanedText}
  `;

  try {
    console.log(">>> [AI] Calling local Ollama (Model: gemma2:2b)...");
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemma2:2b",
        prompt: prompt,
        format: "json",
        stream: false,
        options: {
          temperature: 0.1,         // Lowest temp for strict extraction
          num_predict: 2000,        // Max tokens to generate
          num_ctx: 4096             // Lower context to prevent OOM
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
  } catch (error: any) {
    console.log(">>> [AI] Ollama Failed:", error.message || error);
    return null;
  }
}
