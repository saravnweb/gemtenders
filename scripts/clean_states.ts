import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

import { normalizeState, normalizeCity } from '../lib/locations';

async function run() {
  console.log("Fetching tenders...");
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  let totalFixed = 0;

  while(hasMore) {
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, state, city')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error(error);
      break;
    }

    if (!tenders || tenders.length === 0) {
      hasMore = false;
      break;
    }

    let updates = 0;
    for (const t of tenders) {
      const cleanedState = normalizeState(t.state);
      const cleanedCity = normalizeCity(t.city);
      
      if (cleanedState !== t.state || cleanedCity !== t.city) {
         await supabase.from('tenders').update({ state: cleanedState, city: cleanedCity }).eq('id', t.id);
         updates++;
         totalFixed++;
      }
    }
    console.log(`Page ${page}: Updated ${updates} tenders out of ${tenders.length}`);
    page++;
  }

  console.log(`Finished updating ${totalFixed} rows!`);
}

run();
