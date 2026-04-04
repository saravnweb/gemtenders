import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const apiKey = process.env.GEMINI_API_KEY?.trim() || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function parseWithAI(departmentStr: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = `
    You are an expert at parsing administrative strings from the GeM portal.
    I will provide a concatenated string that usually contains the "Ministry / State Name", "Department Name", and sometimes "Organisation Name", stuck together without spaces or punctuation.
    
    Split and correct the following string into its constituent parts. 
    Output strictly as a JSON object with these keys:
    - "ministry": (string or null) The Ministry or State name (e.g. "Ministry Of Civil Aviation", "Odisha", etc.)
    - "department": (string or null) The Department name
    - "organisation": (string or null) The Organisation name (e.g. "Airports Authority Of India (AAI)", "Coal India Limited", etc.)
    
    If something is not present, use null.
    Convert values to proper Title Case. 
    
    Given String: "${departmentStr}"
  `;
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Parse Error:", error);
    return null;
  }
}

async function run() {
  console.log("Fetching tenders...");
  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("id, bid_number, department, ministry_name, department_name, organisation_name");
      
  if (error || !tenders) {
    console.error("Error fetching tenders:", error);
    return;
  }
  
  console.log(`Total tenders: ${tenders.length}`);
  
  let count = 0;
  // We'll process sequentially to avoid rate limits, maybe batch of 5?
  // Let's just process sequentially for simplicity since it's only a few
  
  for (const t of tenders) {
    if (!t.department || t.department.toLowerCase() === "n/a") continue;
    
    // Process if it's clearly concatenated
    const needsFix = 
        !t.ministry_name 
        || t.department.length > t.ministry_name.length 
        || t.ministry_name.includes(t.department)
        || t.department.includes(t.ministry_name);
        
    // Let's just force-fix everything where ministry_name looks like it's concatenated
    // e.g. "Ministry Of Civil Aviationairports Authority Of India (Aai)"
    const isMessyMinistry = t.ministry_name && (
        t.ministry_name.toLowerCase().includes("authority") || 
        t.ministry_name.toLowerCase().includes("department") && t.ministry_name.toLowerCase().includes("ministry")
    );

    if (needsFix || isMessyMinistry) {
      console.log(`\nParsing: ${t.department}`);
      const aiParsed = await parseWithAI(t.department);
      
      if (aiParsed) {
        console.log(`  => Min: ${aiParsed.ministry}, Dept: ${aiParsed.department}, Org: ${aiParsed.organisation}`);
        
        const { error: updErr } = await supabase
          .from("tenders")
          .update({
            ministry_name: aiParsed.ministry,
            department_name: aiParsed.department,
            organisation_name: aiParsed.organisation,
          })
          .eq("id", t.id);
          
        if (updErr) console.error("Failed to update:", updErr.message);
        else count++;
      }
      
      // small delay to respect rate limit
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`Successfully updated ${count} records using AI.`);
}

run();
