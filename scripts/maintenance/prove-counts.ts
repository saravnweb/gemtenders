
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeState, INDIAN_STATES } from '../../lib/locations-client.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function proveCounts() {
  console.log('>>> [PROOFER] Fetching data from database...');
  const now = new Date().toISOString();
  
  // 1. Get total active tenders (matching requirePublicListingReady criteria)
  const { count: totalActive, error: countErr } = await supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true })
    .gte('end_date', now)
    .not('ai_summary', 'is', null);

  if (countErr) {
    console.error('Error fetching total count:', countErr);
    return;
  }

  // 2. Fetch all states to calculate frequencies
  let allRows: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('tenders')
      .select('state')
      .gte('end_date', now)
      .not('ai_summary', 'is', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching data:', error);
      break;
    }
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break; 
  }

  const stateCounts: Record<string, number> = {};
  allRows.forEach(row => {
    const normalized = normalizeState(row.state) || "Unknown State";
    stateCounts[normalized] = (stateCounts[normalized] || 0) + 1;
  });

  const sumOfStateCounts = Object.values(stateCounts).reduce((a, b) => a + b, 0);

  console.log('\n--- PROOF RESULTS ---');
  console.log(`- TOTAL ACTIVE TENDERS (Main Badge): ${totalActive}`);
  console.log(`- SUM OF ALL STATE DROPDOWN COUNTS:  ${sumOfStateCounts}`);
  console.log(`- DISCREPANCY:                       ${totalActive! - sumOfStateCounts}`);
  
  console.log('\n--- BOTTOM COUNTERS (Usually the missing ones) ---');
  console.log(`- Unknown State: ${stateCounts['Unknown State'] || 0}`);
  
  if (totalActive === sumOfStateCounts) {
    console.log('\n✅ PROOF COMPLETE: The total matches exactly.');
  } else {
    console.log('\n❌ DISCREPANCY DETECTED: Something is wrong.');
  }
}

proveCounts();
