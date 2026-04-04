import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentMinistries() {
  const now = new Date().toISOString();
  
  const { data: tenders, error } = await supabase
    .from("tenders")
    .select("id, ministry_name, created_at")
    .gte("end_date", now)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching tenders:", error);
    return;
  }

  const withMinistry = tenders?.filter(t => t.ministry_name && t.ministry_name !== 'null').length;
  console.log(`Out of 100 RECENT active tenders, ${withMinistry} have ministry_name populated.`);
  
  if (withMinistry > 0) {
      console.log("Sample recent ministries:");
      tenders?.filter(t => t.ministry_name && t.ministry_name !== 'null').slice(0, 5).forEach(t => {
          console.log(`- ${t.ministry_name} (${t.created_at})`);
      });
  }
}

checkRecentMinistries();
