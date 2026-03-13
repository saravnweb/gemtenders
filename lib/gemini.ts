import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

export async function extractTenderData(pdfText: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `
    You are an expert Procurement Analyst. Your task is to extract HIGHLY ACCURATE structured information from a Government e-Marketplace (GeM) Bid Document (PDF text). 
    
    IMPORTANT: The PDF text is the single source of truth. Extract the REAL Tender Title, Department, and all other fields from the text below.

    Output Schema (JSON):
    {
      "tender_title": "string (The official name of the procurement/item as stated in the PDF)",
      "department_name": "string (The organization/ministry name)",
      "emd_amount": number,
      "eligibility": {
        "msme": boolean,
        "mii": boolean,
        "total_annual_turnover": number
      },
      "technical_summary": "string (detailed bullet points of what is being procured)",
      "evaluation_method": "string (e.g., Total Value, Item Wise, RA, etc.)",
      "critical_dates": {
        "bid_opening": "ISO-8601",
        "bid_end": "ISO-8601"
      }
    }

    Document Text Content:
    ${pdfText.substring(0, 40000)} // Using more context for accuracy
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON markdown if present
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini AI Extraction Error:", error);
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
