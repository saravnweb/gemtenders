
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeStates() {
  console.log('Fetching state data from database...');
  const now = new Date().toISOString();
  
  let allStates: string[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('tenders')
      .select('state')
      .gte('end_date', now)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching data:', error);
      break;
    }
    if (!data || data.length === 0) break;

    allStates = allStates.concat(data.map(d => d.state).filter(Boolean));
    if (data.length < PAGE_SIZE) break;
    page++;
    if (page > 50) break; // cap at 50k
  }

  const counts: Record<string, number> = {};
  allStates.forEach(s => {
    counts[s] = (counts[s] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  
  console.log('\n--- State Value Analysis ---');
  sorted.forEach(([state, count]) => {
    console.log(`${state}: ${count}`);
  });
}

analyzeStates();
