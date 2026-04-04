import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

import { normalizeState, normalizeCity } from '../../lib/locations';

async function run() {
  console.log("Fetching tenders erroneously categorized as Tripura...");
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  let totalFixed = 0;

  while(hasMore) {
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, state, department, organisation_name, office_name, title')
      .eq('state', 'Tripura')
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
      // Re-evaluate state from original un-mutated fields
      const combinedText = `${t.department || ''} ${t.organisation_name || ''} ${t.office_name || ''} ${t.title || ''}`;
      // In the scraper, state is extracted by AI or fallback. But since we lost it, let's just attempt to parse it from the combined info
      
      const states = [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
        "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu And Kashmir", "Ladakh", "Andaman And Nicobar", "Puducherry"
      ];
    
      let foundState = null;
      for (const st of states) {
        if (new RegExp(`\\b${st}\\b`, 'i').test(combinedText)) {
          foundState = st;
          break;
        }
      }

      if (!foundState) {
        // Fallback to our new strict normalizeState on department text
        foundState = normalizeState(t.department);
      }

      // If we *really* can't find anything, we might just set it to null or leave it?
      // Actually wait, some of them MIGHT actually be Tripura. 
      // If foundState is still null and "tripura" is not in the text, it's definitely NOT tripura.
      let finalState = foundState;
      if (!finalState && !new RegExp(`\\btripura\\b`, 'i').test(combinedText)) {
         finalState = "Central"; // Or null. We'll set to null to let it be corrected later.
      }
      
      // Keep it as Tripura only if it genuinely matches Tripura
      if (finalState && finalState !== 'Tripura') {
         await supabase.from('tenders').update({ state: finalState }).eq('id', t.id);
         updates++;
         totalFixed++;
      } else if (!finalState && !new RegExp(`\\btripura\\b`, 'i').test(combinedText)) {
         await supabase.from('tenders').update({ state: null }).eq('id', t.id);
         updates++;
         totalFixed++;
      }
    }
    console.log(`Page ${page}: Updated ${updates} tenders out of ${tenders.length}`);
    page++;
  }

  console.log(`Finished fixing ${totalFixed} rows erroneously set to Tripura!`);
}

run();
