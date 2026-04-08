import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { normalizeCity, normalizeState } from '../../lib/locations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH = 500;

async function run() {
  console.log('Fetching all tenders with city or state...');

  let page = 0;
  let totalFetched = 0;
  let updatedCount = 0;
  let nulledCount = 0;
  let intactCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from('tenders')
      .select('id, bid_number, city, state')
      .range(page * BATCH, (page + 1) * BATCH - 1)
      .order('id');

    if (error) { console.error('Fetch error:', error); break; }
    if (!data || data.length === 0) break;

    totalFetched += data.length;

    const updates: { id: string; city?: string | null; state?: string | null }[] = [];

    for (const t of data) {
      const newCity  = t.city  ? normalizeCity(t.city)   ?? null : null;
      const newState = t.state ? normalizeState(t.state) ?? null : null;

      const cityChanged  = newCity  !== t.city;
      const stateChanged = newState !== t.state;

      if (!cityChanged && !stateChanged) { intactCount++; continue; }

      const patch: Record<string, string | null> = {};
      if (cityChanged)  { patch.city  = newCity;  }
      if (stateChanged) { patch.state = newState; }

      updates.push({ id: t.id, ...patch });

      if (newCity === null && t.city) nulledCount++;
      else updatedCount++;

      const cityMsg  = cityChanged  ? `city: "${t.city}" → "${newCity}"`   : '';
      const stateMsg = stateChanged ? `state: "${t.state}" → "${newState}"` : '';
      console.log(`[FIX] ${t.bid_number}: ${[cityMsg, stateMsg].filter(Boolean).join(' | ')}`);
    }

    // Apply updates in parallel (batched)
    await Promise.all(
      updates.map(({ id, ...patch }) =>
        supabase.from('tenders').update(patch).eq('id', id)
      )
    );

    console.log(`Page ${page + 1}: ${data.length} rows, ${updates.length} updated`);
    page++;
    if (data.length < BATCH) break;
  }

  console.log('\n=== Done ===');
  console.log(`Total fetched : ${totalFetched}`);
  console.log(`Intact        : ${intactCount}`);
  console.log(`Updated/fixed : ${updatedCount}`);
  console.log(`Nulled (junk) : ${nulledCount}`);
}

run();
