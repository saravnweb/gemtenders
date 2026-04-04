import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCount() {
  const now = new Date().toISOString();
  
  const { count, error } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .gte("end_date", now);

  if (error) {
    console.error("Count Error:", error);
  } else {
    console.log("Full active count:", count);
  }

  const { data, error: fetchError } = await supabase
    .from("tenders")
    .select("id")
    .gte("end_date", now)
    .limit(5000);

  if (fetchError) {
    console.error("Fetch Error:", fetchError);
  } else {
    console.log("Fetched rows (limit 5000):", data?.length);
  }
}

debugCount();
