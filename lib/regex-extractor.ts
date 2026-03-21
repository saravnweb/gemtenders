import { normalizeState, normalizeCity } from "./locations";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const extractField = (text: string, regex: RegExp): string => {
  const match = text.match(regex);
  return match && match[1] ? match[1].trim() : "";
};

const extractNumber = (text: string, regex: RegExp): number => {
  const match = text.match(regex);
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/,/g, ''), 10);
    return isNaN(num) ? 0 : num;
  }
  return 0; // Return exactly 0, meaning not found or none
};

const parseIndianDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}:\d{2}:\d{2})/);
  if (parts) {
    return `${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}Z`;
  }
  return dateStr;
};

export async function extractTenderDataRegex(pdfText: string) {
  // Clean up PDF text spacing
  const text = pdfText
    .replace(/[^\x20-\x7E\n\u0900-\u097F]/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, "\n")
    .trim();

  const data: any = {
    tender_title: extractField(text, /(?:Item Category|BOQ Title)\s*[:\-]?\s*([^\n]+)/i).replace(/\.{3}$/, "").trim(),
    authority: {
      ministry: extractField(text, /Ministry\/State Name\s*[:\-]?\s*([^\n]+)/i),
      department: extractField(text, /Department Name\s*[:\-]?\s*([^\n]+)/i),
      organisation: extractField(text, /Organisation Name\s*[:\-]?\s*([^\n]+)/i),
      office: extractField(text, /Office Name\s*[:\-]?\s*([^\n]+)/i),
      state: extractField(text, /State\s*[:\-]?\s*([^\n]+)/i), // basic catch
      city: extractField(text, /City\s*[:\-]?\s*([^\n]+)/i),   // basic catch
      consignee_state: "",
      consignee_city: ""
    },
    dates: {
      bid_start_date: parseIndianDate(extractField(text, /(?:Document Date|Published Date|Bid Start Date)\s*[:\-]?\s*([\d\-]+\s+[\d:]+)/i) || extractField(text, /(?:Document Date|Published Date|Bid Start Date)\s*[:\-]?\s*([^\n]+)/i)),
      bid_end_date: parseIndianDate(extractField(text, /Bid End Date\/Time\s*[:\-]?\s*([\d\-]+\s+[\d:]+)/i) || extractField(text, /Bid End Date\/Time\s*[:\-]?\s*([^\n]+)/i)),
      bid_opening_date: parseIndianDate(extractField(text, /Bid Opening Date\/Time\s*[:\-]?\s*([\d\-]+\s+[\d:]+)/i) || extractField(text, /Bid Opening Date\/Time\s*[:\-]?\s*([^\n]+)/i))
    },
    quantity: extractNumber(text, /(?:Total Quantity|कुल मात्रा)\s*[:\-]?\s*([\d,]+)/i),
    gemarpts_strings: extractField(text, /Searched Strings used in GeMARPTS\s*[:\-]?\s*([^\n]+)/i),
    gemarpts_result: extractField(text, /Searched Result generated in GeMARPTS\s*[:\-]?\s*([^\n]+)/i),
    relevant_categories: extractField(text, /Relevant Categories selected for notification\s*[:\-]?\s*([^\n]+)/i),
    emd_amount: extractNumber(text, /EMD Amount(?:(?: \([^)]+\))|).*?[:\-]?\s*([\d,]+)/i) || extractNumber(text, /EMD Amount\s*[:\-]?\s*([\d,]+)/i) || extractNumber(text, /EMD Amount (?:INR|Rs)\s*[:\-]?\s*([\d,]+)/i),
    relaxations: {
      mse_experience: text.match(/MSE Relaxation for.*?(Yes|No)/i)?.[1] || "",
      mse_turnover: text.match(/MSE Relaxation for Turnover.*?(Yes|No)/i)?.[1] || "",
      startup_experience: text.match(/Startup Relaxation for.*?(Yes|No)/i)?.[1] || "",
      startup_turnover: text.match(/Startup Relaxation for Turnover.*?(Yes|No)/i)?.[1] || ""
    },
    documents_required: [],
    eligibility: {
      msme: /MSE\s*(?:Preference|Exemption).*?(Yes|True|Applicable)/i.test(text),
      mii: /MII\s*(?:Preference|Exemption).*?(Yes|True|Applicable)/i.test(text)
    },
    technical_summary: ""
  };

  try {
    if (process.env.GEMINI_API_KEY && text.length > 50) {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are a professional tender analyst. Please provide a brief, clear 2-3 sentence technical insight (summary) of the following tender document. Focus strictly on what exact items or services are being procured, the core purpose, and any major constraints or notable elements. Do not include introductory phrases.
      
Tender Document Extract:
${text.substring(0, 10000)}`;

      const result = await model.generateContent(prompt);
      const insight = result.response.text();
      if (insight) {
        data.technical_summary = insight.trim();
      }
    }
  } catch (err) {
    console.error("Gemini insight generation failed:", err);
  }

  // Normalize
  if (data.authority.state) data.authority.state = normalizeState(data.authority.state);
  if (data.authority.city) data.authority.city = normalizeCity(data.authority.city);

  // Return data directly (0.005 seconds!)
  return data;
}
