
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { normalizeState, isIndianState } from '../../lib/locations-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fixMinistryStates() {
  console.log('\n>>> [FIX-MINISTRY-STATES] Cleaning up incorrect state names in ministry/org fields...\n');

  let offset = 0;
  const BATCH = 500;
  let totalFixed = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('tenders')
      .select('id, bid_number, ministry_name, organisation_name, state')
      .gte('end_date', new Date().toISOString())
      .range(offset, offset + BATCH - 1);

    if (error || !rows || rows.length === 0) break;

    for (const row of rows) {
      const update: any = {};
      let changed = false;

      // Check Ministry
      if (row.ministry_name && isIndianState(row.ministry_name)) {
        const canonical = normalizeState(row.ministry_name);
        if (!row.state) update.state = canonical;
        update.ministry_name = null;
        changed = true;
      }

      // Check Organisation
      if (row.organisation_name && isIndianState(row.organisation_name)) {
        const canonical = normalizeState(row.organisation_name);
        if (!row.state && !update.state) update.state = canonical;
        update.organisation_name = null;
        changed = true;
      }

      if (changed) {
        const { error: upErr } = await supabase.from('tenders').update(update).eq('id', row.id);
        if (!upErr) {
          totalFixed++;
          console.log(`  ✓ ${row.bid_number}: Moved state from ministry/org to state field.`);
        } else {
          console.error(`  ✗ ${row.bid_number}: ${upErr.message}`);
        }
      }
    }

    offset += rows.length;
    if (rows.length < BATCH) break;
  }

  console.log(`\n>>> [FIX-MINISTRY-STATES] Done. Fixed ${totalFixed} rows.`);
}

fixMinistryStates().catch(console.error);
