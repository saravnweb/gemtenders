import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const now = new Date().toISOString();
  const { count: total } = await supabase.from('tenders').select('*', { count: 'exact', head: true });
  const { count: active } = await supabase.from('tenders').select('*', { count: 'exact', head: true }).gte('end_date', now);
  
  console.log(`--- DB HEALTH CHECK ---`);
  console.log(`Total:  ${total}`);
  console.log(`Active: ${active}`);
}

check();
