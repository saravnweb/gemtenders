import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMinistries() {
  const now = new Date().toISOString();
  
  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("id, ministry_name, state, end_date")
    .gte("end_date", now)
    .limit(10);

  if (error) {
    console.error("Error fetching tenders:", error);
    return;
  }

  console.log(`Checking ${tenders?.length} active tenders for ministry_name:`);
  tenders?.forEach((t, i) => {
    console.log(`${i+1}. [${t.id}] ministry_name: "${t.ministry_name}" | state: "${t.state}" | end_date: ${t.end_date}`);
  });

  const { count: ministryCount } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .gte("end_date", now)
    .not("ministry_name", "is", null);

  console.log(`\nTotal active tenders with ministry_name populated: ${ministryCount}`);
}

checkMinistries();
