
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

async function debugStateCountsWithFilter() {
  const now = new Date().toISOString();
  console.log('Checking PUBLIC LISTING READY tenders (pdf_url is not null, state is not null, city is not null, end_date > now)...');

  const states = [
    "Uttar Pradesh", "Maharashtra", "Tamil Nadu", "Karnataka", "West Bengal", 
    "Delhi", "Madhya Pradesh", "Gujarat", "Assam", "Kerala", "Bihar", 
    "Haryana", "Chhattisgarh", "Jammu And Kashmir", "Odisha", "Telangana"
  ];

  console.log('\nACTUAL COUNTS FROM DATABASE (Public Listing Ready):');
  console.log('-------------------------------------------');
  
  for (const state of states) {
    const { count, error } = await supabase
      .from('tenders')
      .select('id', { count: 'exact', head: true })
      .gte('end_date', now)
      .not('pdf_url', 'is', null)
      .not('state', 'is', null)
      .not('city', 'is', null)
      .ilike('state', state);
    
    if (error) {
      console.error(`Error for ${state}:`, error.message);
    } else {
      console.log(`${state.padEnd(20)}: ${count}`);
    }
  }

  // Also check total
  const { count: totalCount } = await supabase
    .from('tenders')
    .select('id', { count: 'exact', head: true })
    .gte('end_date', now)
    .not('pdf_url', 'is', null)
    .not('state', 'is', null)
    .not('city', 'is', null);
  
  console.log('-------------------------------------------');
  console.log(`TOTAL PUBLIC LISTING READY: ${totalCount}`);
}

debugStateCountsWithFilter();
