
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeState, INDIAN_STATES } from '../../lib/locations-client.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupStates() {
  console.log('>>> Starting state column cleanup...');
  
  const now = new Date().toISOString();
  let totalProcessed = 0;
  let totalFixed = 0;
  let page = 0;
  const PAGE_SIZE = 500;

  while (true) {
    const { data: rows, error } = await supabase
      .from('tenders')
      .select('id, state')
      .gte('end_date', now)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching data:', error);
      break;
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      totalProcessed++;
      if (!row.state) continue;

      const normalized = normalizeState(row.state);
      
      // If normalized value is different from original OR original is clearly not in the canonical set
      if (normalized !== row.state) {
        // Double check if normalized is a valid state/UT
        if (normalized && (INDIAN_STATES.has(normalized))) {
            const { error: upErr } = await supabase
              .from('tenders')
              .update({ state: normalized })
              .eq('id', row.id);
            
            if (!upErr) {
              totalFixed++;
              console.log(`[FIX] ${row.id}: "${row.state}" -> "${normalized}"`);
            } else {
              console.error(`[ERROR] Failed to update ${row.id}:`, upErr.message);
            }
        } else if (normalized === null && row.state.toLowerCase() === 'null') {
             // Handle literal "null" strings
             await supabase.from('tenders').update({ state: null }).eq('id', row.id);
             totalFixed++;
             console.log(`[FIX] ${row.id}: "${row.state}" -> null`);
        }
      }
    }

    if (rows.length < PAGE_SIZE) break;
    page++;
    if (page > 100) break; // Safety cap 50k
  }

  console.log(`\n>>> Cleanup finished.`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Fixed:     ${totalFixed}`);
}

cleanupStates();
