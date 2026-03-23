import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let offset = 0;
const all: { bid_number: string; state: string | null; city: string | null }[] = [];

while (true) {
  const { data, error } = await supabase
    .from('tenders')
    .select('bid_number, state, city')
    .or('state.is.null,city.is.null')
    .order('bid_number')
    .range(offset, offset + 999);

  if (error) { console.error(error.message); break; }
  if (!data?.length) break;
  all.push(...data);
  if (data.length < 1000) break;
  offset += 1000;
}

const missingState = all.filter(r => !r.state);
const missingCity  = all.filter(r => !r.city);
const missingBoth  = all.filter(r => !r.state && !r.city);

console.log(`\nTotal missing state OR city: ${all.length}`);
console.log(`  Missing state: ${missingState.length}`);
console.log(`  Missing city:  ${missingCity.length}`);
console.log(`  Missing both:  ${missingBoth.length}\n`);

console.log('=== MISSING BOTH STATE & CITY ===');
missingBoth.forEach(r => console.log(r.bid_number));

console.log('\n=== MISSING STATE ONLY (has city) ===');
all.filter(r => !r.state && r.city).forEach(r => console.log(r.bid_number, '| city:', r.city));

console.log('\n=== MISSING CITY ONLY (has state) ===');
all.filter(r => r.state && !r.city).forEach(r => console.log(r.bid_number, '| state:', r.state));
