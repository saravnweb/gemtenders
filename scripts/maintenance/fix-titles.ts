import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { normalizeTitle } from '../../lib/computed-fields';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTitles() {
  console.log(">>> [FIX-TITLES] Starting database title cleanup...");

  // Fetch all tenders that likely need cleaning
  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, title')
    .or('title.ilike.%Custom Bid for%,title.ilike.%CUSTOM BID FOR%,title.ilike.\": %\",title.ilike.\"- %\"');

  if (error) {
    console.error("Error fetching tenders:", error.message);
    return;
  }

  if (!tenders || tenders.length === 0) {
    console.log(">>> [FIX-TITLES] No tenders found matching cleaning criteria.");
    return;
  }

  console.log(`>>> [FIX-TITLES] Found ${tenders.length} tenders to process.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const tender of tenders) {
    const originalTitle = tender.title || "";
    const cleanTitle = normalizeTitle(originalTitle);

    if (cleanTitle !== originalTitle) {
      console.log(`  [UPDATE] ${tender.id}`);
      console.log(`    From: "${originalTitle}"`);
      console.log(`    To:   "${cleanTitle}"`);
      
      const { error: updateError } = await supabase
        .from('tenders')
        .update({ title: cleanTitle })
        .eq('id', tender.id);

      if (updateError) {
        console.error(`    FAILED to update ${tender.id}:`, updateError.message);
      } else {
        updatedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n>>> [FIX-TITLES] Done.`);
  console.log(`    Processed: ${tenders.length}`);
  // Note: some might not change if normalizeTitle doesn't find a match despite the ilike filter
  console.log(`    Updated  : ${updatedCount}`);
  console.log(`    Skipped  : ${skippedCount}`);
}

fixTitles().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
