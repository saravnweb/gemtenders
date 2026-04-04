/**
 * backfill-locations.ts
 *
 * Infers city/state for tenders with null location by scanning the existing
 * text fields (title, department, organisation, ministry, office, ai_summary).
 * No PDF download required — runs entirely against the DB.
 *
 * Usage:  npx tsx scripts/backfill-locations.ts [--limit N]
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { extractVerifiedCity, cityToState, normalizeState, normalizeCity } from "../../lib/locations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : 5000;
const BATCH = 200;

// State names to scan for in text (longest first to avoid partial matches)
const STATE_PATTERNS: [RegExp, string][] = [
  [/\bAndhra\s+Pradesh\b/i,       'Andhra Pradesh'],
  [/\bArunachal\s+Pradesh\b/i,    'Arunachal Pradesh'],
  [/\bAssam\b/i,                  'Assam'],
  [/\bBihar\b/i,                  'Bihar'],
  [/\bChhattisgarh\b/i,           'Chhattisgarh'],
  [/\bGoa\b/i,                    'Goa'],
  [/\bGujarat\b/i,                'Gujarat'],
  [/\bHaryana\b/i,                'Haryana'],
  [/\bHimachal\s+Pradesh\b/i,     'Himachal Pradesh'],
  [/\bJharkhand\b/i,              'Jharkhand'],
  [/\bKarnataka\b/i,              'Karnataka'],
  [/\bKerala\b/i,                 'Kerala'],
  [/\bMadhya\s+Pradesh\b/i,       'Madhya Pradesh'],
  [/\bMaharashtra\b/i,            'Maharashtra'],
  [/\bManipur\b/i,                'Manipur'],
  [/\bMeghalaya\b/i,              'Meghalaya'],
  [/\bMizoram\b/i,                'Mizoram'],
  [/\bNagaland\b/i,               'Nagaland'],
  [/\bOdisha\b|\bOrissa\b/i,      'Odisha'],
  [/\bPunjab\b/i,                 'Punjab'],
  [/\bRajasthan\b/i,              'Rajasthan'],
  [/\bSikkim\b/i,                 'Sikkim'],
  [/\bTamil\s+Nadu\b/i,           'Tamil Nadu'],
  [/\bTelangana\b/i,              'Telangana'],
  [/\bTripura\b/i,                'Tripura'],
  [/\bUttar\s+Pradesh\b/i,        'Uttar Pradesh'],
  [/\bUttarakhand\b/i,            'Uttarakhand'],
  [/\bWest\s+Bengal\b/i,          'West Bengal'],
  [/\bDelhi\b|\bNew\s+Delhi\b/i,  'Delhi'],
  [/\bPuducherry\b|\bPondicherry\b/i, 'Puducherry'],
  [/\bChandigarh\b/i,             'Chandigarh'],
  [/\bJammu\b.*?\bKashmir\b|\bJ\s*&\s*K\b/i, 'Jammu And Kashmir'],
  [/\bLadakh\b/i,                 'Ladakh'],
  [/\bAndaman\b/i,                'Andaman And Nicobar'],
];

function inferFromText(text: string): { city: string | null; state: string | null } {
  let city: string | null = null;
  let state: string | null = null;

  // 1. Try extracting a verified city name
  city = extractVerifiedCity(text);
  if (city) state = cityToState(city);

  // 2. Try scanning for state names directly
  if (!state) {
    for (const [pattern, stateName] of STATE_PATTERNS) {
      if (pattern.test(text)) {
        state = stateName;
        break;
      }
    }
  }

  return { city, state };
}

async function main() {
  console.log(`\n[backfill-locations] Scanning up to ${LIMIT} tenders with missing city/state…\n`);

  let offset = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  while (offset < LIMIT) {
    const fetchSize = Math.min(BATCH, LIMIT - offset);

    const { data: tenders, error } = await supabase
      .from("tenders")
      .select("id, bid_number, title, department, organisation_name, ministry_name, department_name, office_name, ai_summary")
      .or("city.is.null,state.is.null")
      .gte("end_date", new Date().toISOString())
      .order("created_at", { ascending: false })
      .range(offset, offset + fetchSize - 1);

    if (error) { console.error("DB error:", error.message); break; }
    if (!tenders?.length) { console.log("No more tenders."); break; }

    console.log(`[offset=${offset}] Processing ${tenders.length} tenders…`);

    const updates: PromiseLike<any>[] = [];
    let batchUpdated = 0;

    for (const tender of tenders) {
      // Build search text from all available fields
      const searchText = [
        tender.title,
        tender.organisation_name,
        tender.department,
        tender.department_name,
        tender.ministry_name,
        tender.office_name,
        tender.ai_summary,
      ].filter(Boolean).join(" | ");

      const { city, state } = inferFromText(searchText);
      if (!city && !state) { totalSkipped++; continue; }

      const patch: Record<string, string> = {};
      if (city)  patch.city  = normalizeCity(city)  || city;
      if (state) patch.state = normalizeState(state) || state;

      updates.push(
        supabase.from("tenders").update(patch).eq("id", tender.id)
          .then(({ error: e }) => {
            if (e) {
              console.error(`  ✗ ${tender.bid_number}: ${e.message}`);
            } else {
              batchUpdated++;
              console.log(`  ✓ ${tender.bid_number} → city: ${patch.city ?? "—"}, state: ${patch.state ?? "—"}`);
            }
          })
      );
    }

    await Promise.all(updates);
    totalUpdated += batchUpdated;
    totalSkipped += tenders.length - batchUpdated - updates.length + updates.length; // already counted skips above
    offset += tenders.length;

    if (tenders.length < fetchSize) break; // last page
  }

  console.log(`\n[backfill-locations] Done. Updated: ${totalUpdated}\n`);
}

main().catch(console.error);
