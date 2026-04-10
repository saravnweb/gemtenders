import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkColumns() {
  const { data, error } = await supabase
    .from('tenders')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching tenders:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in tenders table:', Object.keys(data[0]));
  } else {
    console.log('No data in tenders table to check columns.');
  }
}

checkColumns();
