import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
async function run() {
  const { data } = await supabase.from('tenders').select('bid_number, department, ministry_name, department_name, organisation_name, office_name').eq('bid_number', 'GEM/2026/B/7265098');
  console.log(JSON.stringify(data, null, 2));
}
run();
