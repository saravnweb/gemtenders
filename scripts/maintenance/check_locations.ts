import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const { data, count, error } = await supabase
    .from('tenders')
    .select('id, bid_number, state, city, pdf_url', { count: 'exact' })
    .gte('end_date', new Date().toISOString());

  if (error) {
    console.error(error);
    return;
  }

  const total = count || 0;
  const missingState = data.filter(d => !d.state).length;
  const missingCity = data.filter(d => !d.city).length;
  const missingBoth = data.filter(d => !d.state && !d.city).length;

  console.log(`Total active tenders: ${total}`);
  console.log(`Missing State: ${missingState}`);
  console.log(`Missing City: ${missingCity}`);
  console.log(`Missing Both: ${missingBoth}`);
}

check();
