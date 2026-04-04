import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const { data } = await supabase
    .from('tenders')
    .select('id, bid_number, state, city')
    .eq('bid_number', 'GEM/2026/B/7375630')
    .single();

  console.log("DB Entry:", data);
}

check();
