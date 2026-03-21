import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeUptoToday() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const now = today.toISOString();
  console.log(`Purging all tenders ending before: ${now}...`);

  let totalDeletedGlobally = 0;

  while (true) {
    const { data, error } = await supabase
      .from('tenders')
      .select('id, bid_number, end_date')
      .lt('end_date', now)
      .limit(1000);

    if (error) {
        console.error("Error fetching old tenders:", error);
        break;
    }
    
    if (!data || data.length === 0) {
        break;
    }
    const ids = data.map((c: any) => c.id);
    const { error: deleteErr } = await supabase.from('tenders').delete().in('id', ids);
    if (deleteErr) {
        console.error("Error deleting a chunk:", deleteErr.message);
        break;
    } else {
        totalDeletedGlobally += ids.length;
        console.log(`Deleted chunk of ${ids.length}. Total so far: ${totalDeletedGlobally}`);
    }
  }
  console.log(`Total old tenders deleted: ${totalDeletedGlobally}`);
}

purgeUptoToday();
