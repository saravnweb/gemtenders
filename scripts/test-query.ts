import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.from('tenders').select('*').eq('bid_number', 'GEM/2025/B/7036855');
  console.log("DB DATA:", JSON.stringify(data, null, 2));
}
run();
