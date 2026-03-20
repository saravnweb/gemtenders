import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
async function test() {
  try {
    const res = await model.generateContent("hello");
    console.log("Success:", res.response.text());
  } catch (e: any) {
    console.log("Error details:", JSON.stringify(e, null, 2), e.message);
  }
}
test();
