import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseDepartmentInfo(deptString: string, currentMinistry: string | null, currentDeptName: string | null, currentOrg: string | null) {
  let ministryStr = currentMinistry || "";
  let deptStr = deptString || "";
  let orgStr = currentOrg || "";

  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", 
    "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"
  ];

  // If ministry is empty but dept contains a concatenated string
  if (!ministryStr && deptStr) {
    // 1. Try splitting by keywords
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) {
      ministryStr = match[1].trim();
      deptStr = match[2].trim();
    } else {
      // 2. Try splitting by repetition e.g. "Ministry Of CoalCoal India"
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) {
         ministryStr = repeatMatch[1].trim();
         deptStr = deptStr.substring(ministryStr.length).trim();
      }
    }
  }

  // Handle State names at the end of department string - move to front if ministry is missing
  states.forEach(state => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, 'i');
    if (stateRegex.test(deptStr)) {
       if (!ministryStr) ministryStr = state;
       deptStr = deptStr.replace(stateRegex, '$1').trim();
    }
    // Also check simple exact match ending
    const stateExactRegex = new RegExp(`\\s+${state}$`, 'i');
    if (stateExactRegex.test(deptStr)) {
       if (!ministryStr) ministryStr = state;
       deptStr = deptStr.replace(stateExactRegex, '').trim();
    }
  });

  // Final check: if dept starts with ministry, remove it to avoid duplicates
  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
     deptStr = deptStr.substring(ministryStr.length).trim();
  }
  
  // Specific fix for "Ministry Of Coalneyveli" -> "Ministry Of Coal, Neyveli"
  if (ministryStr.toLowerCase() === "ministry of coal" && deptStr.toLowerCase().startsWith("neyveli")) {
     // Already matches ministry, just ensure Neyveli is clean
  } else if (deptStr.toLowerCase().includes("ministry of coalneyveli")) {
     ministryStr = "Ministry Of Coal";
     deptStr = deptStr.replace(/ministry of coalneyveli/i, "Neyveli").trim();
  }

  // Clean up cases where keywords are stuck to previous words
  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, '$1, $2');
  
  // Actually, we want to split cleanDept into department and organisation if we can.
  // The format is usually "Ministry/State, Department Name, Organisation Name".
  // If cleanDept has a comma, we can split it.
  if (cleanDept.includes(", ")) {
    const parts = cleanDept.split(", ");
    deptStr = parts[0].trim();
    if (!orgStr && parts.length > 1) {
       orgStr = parts[1].trim();
    }
  } else {
    deptStr = cleanDept;
  }

  // Filter out duplicates if org is already mentioned
  if (orgStr && (deptStr.toLowerCase().includes(orgStr.toLowerCase()) || ministryStr.toLowerCase().includes(orgStr.toLowerCase()))) {
    orgStr = "";
  }

  // Remove repetitive tokens like "CoalCoal" -> "Coal" 
  const dedup = (s: string) => s.replace(/([A-Z][a-z]+)\1/g, "$1").trim();

  return {
    ministry_name: toTitleCase(dedup(ministryStr)) || null,
    department_name: toTitleCase(dedup(deptStr)) || null,
    organisation_name: toTitleCase(dedup(orgStr)) || null
  };
}

async function run() {
  console.log("Fetching tenders...");
  let allTenders: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: tenders, error } = await supabase
      .from("tenders")
      .select("id, bid_number, department, ministry_name, department_name, organisation_name")
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error("Error fetching tenders:", error);
      break;
    }
    
    if (!tenders || tenders.length === 0) break;
    allTenders = allTenders.concat(tenders);
    page++;
    console.log(`Fetched ${allTenders.length} tenders so far...`);
  }

  console.log(`Total tenders fetched: ${allTenders.length}`);
  
  let count = 0;

  for (const t of allTenders) {
    if (!t.department) continue;
    
    // Only process if ministry_name is null and department clearly has a problem 
    // OR if department string contains known concatenated patterns
    // Actually, just apply our smart parser to ALL where ministry_name is null
    if (!t.ministry_name || t.department.length > t.ministry_name.length) {
      const parsed = parseDepartmentInfo(t.department, t.ministry_name, t.department_name, t.organisation_name);
      
      const isChanged = 
        parsed.ministry_name !== t.ministry_name || 
        parsed.department_name !== (t.department_name || t.department) ||
        parsed.organisation_name !== t.organisation_name;
        
      if (isChanged && (parsed.ministry_name || parsed.department_name)) {
        console.log(`[UPDATE] ${t.bid_number}`);
        console.log(`  OLD: min=${t.ministry_name}, dept=${t.department_name||t.department}, org=${t.organisation_name}`);
        console.log(`  NEW: min=${parsed.ministry_name}, dept=${parsed.department_name}, org=${parsed.organisation_name}`);
        
        const { error } = await supabase
          .from("tenders")
          .update({
            ministry_name: parsed.ministry_name,
            department_name: parsed.department_name,
            organisation_name: parsed.organisation_name,
            // also update 'department' to the cleanest string maybe? No, let's keep original or standard
          })
          .eq("id", t.id);
          
        if (error) console.error("Failed to update:", error);
        else count++;
      }
    }
  }
  
  console.log(`Successfully updated ${count} records.`);
}

run();
