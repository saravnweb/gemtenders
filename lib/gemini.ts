import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

export async function extractTenderData(pdfText: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Pre-process text: Strip Hindi characters to clean up the table format 
  // (Range \u0900-\u097F covers Devanagari/Hindi)
  const cleanedText = pdfText
    .replace(/[\u0900-\u097F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 30000);

  const prompt = `
    You are an expert Procurement Analyst. Extract HIGHLY ACCURATE structured information from this GeM Bid Document.
    The document contains a table of "Bid Details". Extract the text precisely as it appears in the English side of the labels.

    Output Schema (JSON):
    {
      "tender_title": "string (The official name of the procurement/Item Category)",
      "authority": {
        "ministry": "string",
        "department": "string",
        "organisation": "string",
        "office": "string",
        "state": "string (The State name, e.g. Gujarat, Delhi, etc.)",
        "city": "string (The City name extracted from Office/Address)"
      },
      "emd_amount": number,
      "bid_opening_date": "ISO-8601",
      "relaxations": {
        "mse_experience": "string (Yes/No | Details)",
        "mse_turnover": "string (Yes/No | Details)",
        "startup_experience": "string (Yes/No | Details)",
        "startup_turnover": "string (Yes/No | Details)"
      },
      "documents_required": ["string list"],
      "eligibility": {
        "msme": boolean,
        "mii": boolean
      },
      "technical_summary": "string",
      "evaluation_method": "string"
    }

    Document Text Content:
    ${cleanedText}
  `;

  try {
    console.log(`>>> [AI] Calling Gemini (Model: gemini-1.5-flash)...`);
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
