import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
import { INDIAN_STATES, cityToState } from '../lib/locations';
import { City } from 'country-state-city';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All valid Indian city names (lowercase)
const VALID_CITIES = new Set(
  (City.getCitiesOfCountry('IN') || []).map(c => c.name.toLowerCase())
);

// Patterns that are clearly not city names
const BAD_CITY = /^(bid|not\s*mentioned|not\s*specified|not\s*available|not\s*applicable|n\/a|null|none|na|sector|energy|steel|culture|affairs|natural|fertilizers|mohan|rani|north|south|east|west|central|krishna|rajpur|nagar|aliganj|allahabad\s*project|calcutta.*division|jalpaiguri\s*project|jodhpur\s*city\s*project|nabarangapur\s*project|ernakulam\s*project|raigad\s*project|south\s*goa\s*project|medak\s*project|nagpur\s*rural\s*project|kargil\s*project|bareilly\s*project|chandigarh\s*project|gandhi\s*nagar\s*project|amritsar\s*city|amritsar\s*rural|jalandhar\s*city.*project|kanpur\s*city|jodhpur\s*city|nashik\s*city|nashik\s*rural|bangalore\s*city|thane\s*city|pune\s*city|mysore\s*city|south\s*d|thiruvananthapura\s*m|north\s*and\s*middle)/i;

// State-city mismatch: if cityToState(city) gives a KNOWN state but it differs from stored state
function isStateCityMismatch(state: string, city: string): boolean {
  const inferred = cityToState(city);
  if (!inferred) return false; // can't verify
  return inferred !== state;
}

async function revertBadLocations() {
  console.log('\n>>> [REVERT] Scanning all tenders for bad state/city values...\n');

  let offset = 0;
  let reverted = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('tenders')
      .select('id, bid_number, state, city')
      .or('state.not.is.null,city.not.is.null')
      .range(offset, offset + 999);

    if (error) { console.error('DB error:', error.message); break; }
    if (!rows?.length) break;

    for (const row of rows) {
      const update: Record<string, null> = {};

      // ── Bad state ────────────────────────────────────────────────────────
      if (row.state) {
        const isBad = !INDIAN_STATES.has(row.state);
        if (isBad) update.state = null;
      }

      // ── Bad city ─────────────────────────────────────────────────────────
      if (row.city) {
        const isBadPattern  = BAD_CITY.test(row.city.trim());
        const isStateName   = INDIAN_STATES.has(row.city);
        // City not in DB AND looks like junk (short or contains "Project" etc.)
        const isUnknownJunk = !VALID_CITIES.has(row.city.toLowerCase()) &&
                              (/project$/i.test(row.city) || /division$/i.test(row.city) || row.city.length < 3);

        if (isBadPattern || isStateName || isUnknownJunk) update.city = null;
      }

      // ── State-city mismatch (only when both are set and city is in DB) ───
      if (row.state && row.city && !update.state && !update.city) {
        if (VALID_CITIES.has(row.city.toLowerCase()) && isStateCityMismatch(row.state, row.city)) {
          // cityToState gives a different state → both are suspect, clear city
          update.city = null;
        }
      }

      if (!Object.keys(update).length) continue;

      const { error: upErr } = await supabase.from('tenders').update(update).eq('id', row.id);
      if (upErr) { console.error(`  ✗ ${row.bid_number}: ${upErr.message}`); continue; }

      reverted++;
      console.log(`  ✓ ${row.bid_number} → cleared: ${Object.keys(update).join(', ')} (was: state="${row.state ?? ''}" city="${row.city ?? ''}")`);
    }

    offset += rows.length;
    if (rows.length < 1000) break;
  }

  console.log(`\n>>> [REVERT] Done. Cleared bad values from ${reverted} tenders.`);
}

revertBadLocations().catch(console.error);
