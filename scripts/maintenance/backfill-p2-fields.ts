/**
 * Priority 2 Backfill Script — Populates indexed columns from existing ai_summary JSON.
 * Run this AFTER applying the SQL migration to your Supabase DB.
 *
 * Usage:
 *   npx tsx scripts/backfill-p2-fields.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function parseNumeric(str: string | undefined | null): number | null {
  if (!str) return null;
  // Extract digits, commas, and decimals.
  const match = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseLakhs(str: string | undefined | null): number | null {
  if (!str) return null;
  // If it's a large number (e.g. 5,00,000), convert to Lakhs
  const val = parseNumeric(str);
  if (val === null) return null;
  if (val > 1000) return val / 100000; // Rs 100,000 = 1 Lakh
  return val; // Already in Lakhs
}

async function main() {
  console.log(">>> [P2-BACKFILL] Fetching tenders with ai_summary...");

  const { data: tenders, error } = await supabase
    .from('tenders')
    .select('id, bid_number, ai_summary')
    .not('ai_summary', 'is', null)
    .is('estimated_value', null); // Only process those not yet backfilled

  if (error) {
    console.error("Error fetching tenders:", error.message);
    return;
  }

  if (!tenders?.length) {
    console.log("No tenders found requiring backfill.");
    return;
  }

  console.log(`Processing ${tenders.length} tenders...`);

  let updated = 0;
  for (const t of tenders) {
    try {
      const params = JSON.parse(t.ai_summary || "{}");
      
      const updatePayload: any = {
        estimated_value:    parseNumeric(params["ESTIMATED BID VALUE"]),
        epbg_percentage:    parseNumeric(params["EPBG DETAIL"]),
        min_turnover_lakhs: parseLakhs(params["MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER"]),
        // Experience and consignees are often buried in other text, but we'll try best-effort.
        delivery_days:      parseNumeric(params["CONTRACT PERIOD"]),
      };

      // Clean nulls to avoid overwriting with nothing if already set
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === null) delete updatePayload[key];
      });

      if (Object.keys(updatePayload).length > 0) {
        const { error: upError } = await supabase
          .from('tenders')
          .update(updatePayload)
          .eq('id', t.id);

        if (upError) {
          console.error(`Failed to update ${t.bid_number}:`, upError.message);
        } else {
          updated++;
          process.stdout.write(`\rUpdated: ${updated}/${tenders.length}`);
        }
      }
    } catch (e) {
      console.error(`\nError parsing JSON for ${t.bid_number}`);
    }
  }

  console.log(`\n\n>>> Backfill complete! Updated ${updated} tenders.`);
}

main().catch(console.error);
