
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkAndaman() {
  const now = new Date().toISOString();
  
  const variants = ['Andaman & Nicobar', 'Andaman And Nicobar', 'Andaman & Nicobar Islands'];
  for (const v of variants) {
    const { count } = await supabase
      .from('tenders')
      .select('id', { count: 'exact', head: true })
      .gte('end_date', now)
      .not('pdf_url', 'is', null)
      .not('state', 'is', null)
      .not('city', 'is', null)
      .ilike('state', v);
    console.log(`${v}: ${count}`);
  }
}

checkAndaman();
