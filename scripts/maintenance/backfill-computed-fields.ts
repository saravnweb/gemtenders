import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { getComputedFields } from '../../lib/computed-fields';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const argv = process.argv.slice(2);
const LIMIT = parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000', 10);
const BATCH_SIZE = 100;

async function backfill() {
  console.log(`\n>>> [BACKFILL-COMPUTED] Starting backfill calculation...`);
  console.log(`    Limit: ${LIMIT} | Batch: ${BATCH_SIZE}\n`);

  let processed = 0;
  let updatedCount = 0;

  while (processed < LIMIT) {
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('id, emd_amount, eligibility_msme, eligibility_mii, estimated_value, min_turnover_lakhs, startup_relaxation, epbg_percentage')
      .is('vendor_tags', null) // Only process ones that haven't been tagged yet
      .range(0, BATCH_SIZE - 1);

    if (error) {
       // If column missing, this will fail
       if (error.message.includes('column "vendor_tags" does not exist')) {
         console.error("❌ ERROR: The 'vendor_tags' column is missing. Please run the SQL migration in your Supabase dashboard first!");
         return;
       }
       console.error(`DB Error: ${error.message}`);
       break;
    }

    if (!tenders || tenders.length === 0) {
      // Check if maybe they are just all empty strings instead of NULL?
      // Try fetching ones with empty array if null didn't work (GIN index default is '{}')
      const { data: emptyTenders } = await supabase
        .from('tenders')
        .select('id, emd_amount, eligibility_msme, eligibility_mii, estimated_value, min_turnover_lakhs, startup_relaxation, epbg_percentage')
        .eq('vendor_tags', '{}')
        .limit(BATCH_SIZE);
      
      if (!emptyTenders || emptyTenders.length === 0) {
        console.log("No more tenders found needing computed field backfill.");
        break;
      }
      tenders.push(...emptyTenders);
    }

    console.log(`Processing batch of ${tenders.length}...`);

    for (const t of tenders) {
      const computed = getComputedFields(t);
      const { error: updateError } = await supabase
        .from('tenders')
        .update(computed)
        .eq('id', t.id);
      
      if (!updateError) updatedCount++;
    }

    processed += tenders.length;
    process.stdout.write(`\r  Updated: ${updatedCount} / ${processed}   `);
  }

  console.log(`\n\n>>> Finished! Total updated: ${updatedCount}\n`);
}

backfill().catch(console.error);
