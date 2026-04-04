import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkArchived() {
  const now = new Date().toISOString();
  console.log('Current time (ISO):', now);

  const { count, error } = await supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true })
    .lt('end_date', now);

  if (error) {
    console.error('Error fetching archived count:', error);
  } else {
    console.log('Archived count (end_date < now):', count);
  }

  const { data: samples, error: sampleErr } = await supabase
    .from('tenders')
    .select('bid_number, end_date')
    .order('end_date', { ascending: true })
    .limit(10);

  if (sampleErr) {
    console.error('Error fetching samples:', sampleErr);
  } else {
    console.log('Oldest 10 tenders by end_date:');
    console.table(samples);
  }
}

checkArchived();
