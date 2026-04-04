import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_tenders_columns'); // If get_tenders_columns RPC exists
  if (error) {
    // Fallback: try to select one row and see which columns exist
    const { data: one, error: selErr } = await supabase.from('tenders').select('*').limit(1);
    if (selErr) {
       console.error("Error selecting from tenders:", selErr.message);
       return;
    }
    if (one && one.length > 0) {
      console.log("Columns found in 'tenders' table:");
      console.log(Object.keys(one[0]).sort().join(', '));
    } else {
      console.log("Tenders table is empty, cannot detect columns via SELECT *");
    }
  } else {
    console.log("Columns:", data);
  }
}

checkSchema().catch(console.error);
