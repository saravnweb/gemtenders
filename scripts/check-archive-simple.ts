import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkArchived() {
  const now = new Date().toISOString();
  console.log(`Current ISO Time: ${now}`);

  const { count, error } = await supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true })
    .lt('end_date', now);

  if (error) {
    console.log(`Error: ${error.message}`);
  } else {
    console.log(`Archived count (end_date < ${now}): ${count}`);
  }

  const { data: samples, error: sampleErr } = await supabase
    .from('tenders')
    .select('bid_number, end_date')
    .order('end_date', { ascending: true })
    .limit(5);

  if (sampleErr) {
    console.log(`Sample Error: ${sampleErr.message}`);
  } else {
    console.log('Oldest 5 tenders:');
    samples?.forEach(s => {
      console.log(`- Bid: ${s.bid_number}, End: ${s.end_date}`);
    });
  }
}

checkArchived();
