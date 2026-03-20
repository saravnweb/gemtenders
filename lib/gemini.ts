import Groq from "groq-sdk";
import { normalizeState, normalizeCity } from "./locations";

const apiKey = process.env.GROQ_API_KEY?.trim() || "";
const groq = new Groq({ apiKey });

export async function extractTenderData(pdfText: string) {

  // PRE-PROCESS: Extract as much as possible. 
  // DO NOT STRIP HINDI. Gemini handles Hindi-English tables best when labels are present.
  const cleanedText = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ") // keep printable ASCII and Devanagari (Hindi)
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  // Helper function for delay
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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

  let retries = 6;
  let delay = 5000;
  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "gemma2-9b-it"
  ];
  let currentModelIndex = 0;

  while (retries > 0) {
    const currentModel = models[currentModelIndex];
    try {
      console.log(`>>> [AI] Calling Groq (Model: ${currentModel})...`);
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: currentModel as any, // Cast as any to appease TS for dynamic model
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      const text = completion.choices[0]?.message?.content || "{}";
      
      // Clean JSON markdown if present
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      
      // Normalize state and city
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
      const msg = error.message || "";
      const isRateLimit = error.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit_exceeded');
      
      if (isRateLimit && retries > 1) {
        // If we still have models to fall back to, do so immediately to preserve time
        if (currentModelIndex < models.length - 1) {
           console.warn(`>>> [AI] Rate limited (429) on ${currentModel}. Switching to fallback model...`);
           currentModelIndex++;
           retries--;
           continue;
        }

        // Otherwise, all models are exhausted, evaluate sleep delay
        let waitTime = delay;
        // Parse Groq's specific "Please try again in XmYY.YYs" or "X.YYs" message
        // Example: "try again in 15m28.8s" or "try again in 27.5s"
        const match = msg.match(/try again in (?:([0-9]+)m)?([0-9.]+)s/);
        if (match) {
           const mins = parseInt(match[1] || "0", 10);
           const secs = parseFloat(match[2] || "0");
           waitTime = ((mins * 60) + secs + 1) * 1000; // Exact wait time + 1s padding
        } else {
           // fallback with jitter
           waitTime += Math.floor(Math.random() * 4000);
        }

        console.warn(`>>> [AI] Rate limited (429) across all models. Retrying in ${(waitTime / 1000 / 60).toFixed(2)} mins...`);
        await sleep(waitTime);
        retries--;
        delay *= 1.5; 
        
        // After waiting, we can try to start over with the best model again
        currentModelIndex = 0;
      } else {
        console.warn(`>>> [AI] Groq Error: ${msg} - ${error.status || ''}`);
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
