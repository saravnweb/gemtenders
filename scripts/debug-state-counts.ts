
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

async function debugStateCounts() {
  const now = new Date().toISOString();
  console.log('Checking active tenders (end_date > now)...');

  // Fetch all counts for all states
  // Since we can't easily group by in Supabase client, we'll fetch a larger sample or try to use an RPC if it exists.
  // Actually, I can just fetch the counts for the top states manually.
  
  const states = [
    "Uttar Pradesh", "Maharashtra", "Tamil Nadu", "Karnataka", "West Bengal", 
    "Delhi", "Madhya Pradesh", "Gujarat", "Assam", "Kerala", "Bihar", 
    "Haryana", "Chhattisgarh", "Jammu And Kashmir", "Odisha", "Telangana"
  ];

  console.log('\nACTUAL COUNTS FROM DATABASE (Active Bids):');
  console.log('-------------------------------------------');
  
  for (const state of states) {
    const { count, error } = await supabase
      .from('tenders')
      .select('id', { count: 'exact', head: true })
      .gte('end_date', now)
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
    .gte('end_date', now);
  
  console.log('-------------------------------------------');
  console.log(`TOTAL ACTIVE BIDS   : ${totalCount}`);
}

debugStateCounts();
