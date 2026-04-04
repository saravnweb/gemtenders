import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const now = new Date().toISOString();
  
  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("*")
    .gte("end_date", now)
    .not("ministry_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("Fetch Error:", error);
    return;
  }

  console.log("Inspecting latest 3 enriched active tenders:");
  tenders?.forEach((t, i) => {
    console.log(`\n--- TENDER ${i+1} ---`);
    console.log(`Title: ${t.title}`);
    console.log(`Ministry: ${t.ministry_name}`);
    console.log(`Organisation: ${t.organisation_name}`);
    console.log(`State: ${t.state} | City: ${t.city}`);
    console.log(`EMD: ${t.emd_amount}`);
    console.log(`MSE: ${t.eligibility_msme} | MII: ${t.eligibility_mii}`);
    console.log(`Startup: ${t.startup_relaxation}`);
  });
}

inspect();
