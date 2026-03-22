import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { extractVerifiedCity, normalizeCity } from '../lib/locations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  console.log("Fetching all active tenders with a city...");
  
  const { data, count, error } = await supabase
    .from('tenders')
    .select('id, bid_number, city')
    .gte('end_date', new Date().toISOString())
    .not('city', 'is', null);

  if (error || !data) {
    console.error("Error fetching", error);
    return;
  }

  console.log(`Found ${data.length} active tenders with a city.`);

  let updatedCount = 0;
  let nulledCount = 0;
  let intactCount = 0;

  for (const t of data) {
    const verified = extractVerifiedCity(t.city);
    const normalizedOriginal = normalizeCity(t.city);
    
    if (!verified) {
      // The city in DB was complete garbage like "12" or "Manager"
      await supabase.from('tenders').update({ city: null }).eq('id', t.id);
      console.log(`[NULL] ${t.bid_number}: "${t.city}" -> null`);
      nulledCount++;
    } else if (normalizeCity(verified) !== normalizedOriginal) {
      // The city in DB was like "Education Officer Kanker"
      const newCity = normalizeCity(verified)!;
      await supabase.from('tenders').update({ city: newCity }).eq('id', t.id);
      console.log(`[FIX] ${t.bid_number}: "${t.city}" -> "${newCity}"`);
      updatedCount++;
    } else {
      intactCount++;
    }
  }

  console.log(`\nCleanup Complete!`);
  console.log(`Intact (Good): ${intactCount}`);
  console.log(`Fixed (Trimmed noise): ${updatedCount}`);
  console.log(`Nulled (Complete garbage): ${nulledCount}`);
}

run();
