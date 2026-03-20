
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeState, normalizeCity } from "./locations";

const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Helper function for delay
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function extractTenderData(pdfText: string) {
  // Use llama3.2 (3B parameters), guaranteed to run on an 8GB GPU with large context windows
  const modelName = process.env.OLLAMA_MODEL || "llama3.2";

  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  const prompt = `
    You are an expert Procurement Data Scientist. Extract RAW, UNTRUNCATED structured data from this GeM (Government e-Marketplace) Bid Document.
    The document layout is a table with Hindi and English headers. The values are usually in English.
    
    CRITICAL EXTRACTION RULES:
    1. AUTHORITY HIERARCHY & LOCATION:
       - ministry: "Ministry/State Name"
       - department: "Department Name"
       - organisation: "Organisation Name" (e.g., "Indian Army")
       - office: "Office Name"
       - state: Extract the exact STATE perfectly from the buyer address or consignee location.
       - city: Extract the exact CITY or DISTRICT from the buyer address, consignee details, or anywhere in the document. It is extremely critical to identify the city.
       DO NOT leave these null if they are present in the text.
    2. ITEM DETAILS:
       - tender_title: Extract the FULL value of "Item Category" or "BOQ Title". If it's a long list of items, extract EVERYTHING.
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
        "city": "string"
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
        "msme": boolean,
        "mii": boolean
      },
      "technical_summary": "string"
    }

    Document Text Content:
    ${cleanedText}
  `;

  let retries = 3;
  let delay = 3000;

  while (retries > 0) {
    try {
      console.log(`>>> [AI] Calling Local Ollama (Model: ${modelName})...`);
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          format: "json",
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP Error: ${response.status} - Ensure Ollama is running!`);
      }

      const data = await response.json();
      const text = data.response || "{}";
      
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      
      if (parsedData?.authority) {
        if (parsedData.authority.state) {
          parsedData.authority.state = normalizeState(parsedData.authority.state);
        }
        if (parsedData.authority.city) {
          parsedData.authority.city = normalizeCity(parsedData.authority.city);
        }
      }
      return parsedData;
    } catch (error: any) {
      console.warn(`>>> [AI] Ollama Error: ${error.message}. Retrying in ${delay/1000}s...`);
      await sleep(delay);
      retries--;
      delay *= 2; 
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
