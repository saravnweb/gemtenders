
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

import { createClient } from '@supabase/supabase-js';
import { normalizeState, INDIAN_STATES } from '../lib/locations-client.ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function proofFix() {
  const now = new Date().toISOString();
  console.log('Proof of Fix: Simulating ExploreDataFetcher with pagination...');

  let allTenders: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  
  while (true) {
    const { data: pageData, error: pageError } = await supabase
        .from("tenders")
        .select("id, title, state, ministry_name, organisation_name, emd_amount, eligibility_msme, eligibility_mii, startup_relaxation, created_at, end_date")
        .not("pdf_url", "is", null)
        .not("state", "is", null)
        .not("city", "is", null)
        .gte("end_date", now)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (pageError || !pageData || pageData.length === 0) break;
    allTenders = allTenders.concat(pageData);
    if (pageData.length < PAGE_SIZE) break;
    page++;
    if (page > 30) break;
  }

  console.log('Total tenders fetched:', allTenders.length);

  const stateCounts: Record<string, number> = {};
  allTenders.forEach(t => {
    if (!t.state) return;
    const canonical = normalizeState(t.state);
    if (canonical && INDIAN_STATES.has(canonical)) {
      stateCounts[canonical] = (stateCounts[canonical] || 0) + 1;
    }
  });

  const stateList = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => ({ state, count }));

  console.log('\nTOP 10 STATE COUNTS (Calculated from full fetched data):');
  stateList.slice(0, 10).forEach(st => {
    console.log(`${st.state.padEnd(20)}: ${st.count}`);
  });
}

proofFix();
