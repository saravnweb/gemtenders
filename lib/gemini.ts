import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function extractTenderData(pdfText: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Pre-process text: Strip Hindi characters and common non-ASCII noise 
  // (Range \u0900-\u097F covers Devanagari/Hindi)
  const cleanedText = pdfText
    .replace(/[\u0900-\u097F]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "") // remove non-printable ASCII
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 35000);

  const prompt = `
    You are an expert Procurement Analyst. Extract HIGHLY ACCURATE structured information from this GeM (Government e-Marketplace) Bid Document.
    The document is a table with Hindi and English labels. Ignore the Hindi text and focus on the English values.

    CRITICAL INSTRUCTIONS:
    1. EXHAUSTIVE AUTHORITY EXTRACTION: 
       - Look for "Ministry/State Name", "Department Name", "Organisation Name", "Office Name".
       - Extract them separately and precisely. Do NOT merge them.
    2. LOCATION INTELLIGENCE (VERY IMPORTANT):
       - "state": Extract ONLY the Indian State/UT name (e.g. Gujarat, Madhya Pradesh, Delhi).
       - Look inside "Office Name" or the "Consignee/Reporting Officer" section.
       - Expand abbreviations: M.P. -> Madhya Pradesh, U.P. -> Uttar Pradesh, W.B. -> West Bengal, etc.
       - "city": Extract the City or District name from the address fields.
    3. KEYWORDS & TITLE:
       - Look for "Item Category" - this is the primary title.
       - Look for "GeMARPTS में खोजी गई स्ट्रिंग्स / Searched Strings used in GeMARPTS". These are the primary keywords.
       - Look for "GeMARPTS में खोजा गया परिणाम / Searched Result generated in GeMARPTS". These are detailed keywords.
       - Incorporate these keywords into the "technical_summary" field.
    4. DATES:
       - Extract "Bid End Date/Time" and "Bid Opening Date/Time".
       - Format as ISO-8601 strings.

    Output Schema (JSON):
    {
      "tender_title": "string (The official Item Category)",
      "authority": {
        "ministry": "string",
        "department": "string",
        "organisation": "string",
        "office": "string",
        "state": "string (Full State Name)",
        "city": "string (City/District Name)"
      },
      "dates": {
        "bid_start_date": "ISO-8601 (Optional)",
        "bid_end_date": "ISO-8601",
        "bid_opening_date": "ISO-8601"
      },
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
      "technical_summary": "string (Detailed summary including keywords)",
      "evaluation_method": "string"
    }

    Document Text Content:
    ${cleanedText}
  `;

  try {
    console.log(`>>> [AI] Calling Gemini (Model: gemini-2.0-flash)...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON markdown if present
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error: any) {
    console.warn(`>>> [AI] Gemini Error: ${error.message} - ${error.status || ''}`);
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
