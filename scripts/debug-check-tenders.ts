
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from('tenders')
    .select('id, bid_number, end_date, title')
    .is('ai_summary', null)
    .is('enrichment_tried_at', null)
    .gte('end_date', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching tenders:', error);
    return;
  }

  console.log('Sample Tenders for Enrichment:');
  console.log(JSON.stringify(data, null, 2));
}

check();
