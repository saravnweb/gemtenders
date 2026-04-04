import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrganisations() {
  const now = new Date().toISOString();
  
  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("id, organisation_name, created_at")
    .gte("end_date", now)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching tenders:", error);
    return;
  }

  const withOrg = tenders?.filter(t => t.organisation_name && t.organisation_name !== 'null').length;
  console.log(`Out of 100 RECENT active tenders, ${withOrg} have organisation_name populated.`);
  
  if (withOrg > 0) {
      console.log("Sample recent organisations:");
      tenders?.filter(t => t.organisation_name && t.organisation_name !== 'null').slice(0, 5).forEach(t => {
          console.log(`- ${t.organisation_name} (${t.created_at})`);
      });
  } else {
      console.log("Looking for ANY organisation in active tenders...");
      const { data: anyOrg } = await supabase
        .from("tenders")
        .select("id, organisation_name")
        .gte("end_date", now)
        .not("organisation_name", "is", null)
        .neq("organisation_name", "null")
        .limit(5);
      console.log("Any org result:", anyOrg);
  }

  const { count: orgTotal } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .gte("end_date", now)
    .not("organisation_name", "is", null)
    .neq("organisation_name", "null");

  console.log(`\nTotal active tenders with organisation_name populated: ${orgTotal}`);
}

checkOrganisations();
