import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function test() {
  console.log("Testing Google Gemini API (gemini-1.5-flash-latest)...");
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const res = await model.generateContent("hello short reply");
    console.log("Status: OK");
    console.log("Body:", res.response.text());
  } catch (e: any) {
    console.log("Gemini Error:", e.status, e.message);
  }
}
test();
