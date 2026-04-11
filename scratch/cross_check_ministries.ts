
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function crossCheckMinistries() {
    console.log("Cross-checking for suspicious ministry names...");

    // 1. Ending with " of"
    const { data: endsWithOf, error: err1 } = await supabase
        .from('tenders')
        .select('bid_number, ministry_name')
        .ilike('ministry_name', '% of');

    console.log(`- Ending with " of": ${endsWithOf?.length ?? 0}`);
    endsWithOf?.forEach(t => console.log(`  [${t.bid_number}] ${t.ministry_name}`));

    // 2. Ending with " of "
    const { data: endsWithOfSpace, error: err2 } = await supabase
        .from('tenders')
        .select('bid_number, ministry_name')
        .ilike('ministry_name', '% of ');
    
    console.log(`- Ending with " of ": ${endsWithOfSpace?.length ?? 0}`);

    // 3. Very short names (but not null/NA)
    // Supabase doesn't easily support length filter in select, but we can use raw SQL if we had an RPC, 
    // or just fetch first 1000 and filter in JS.
    const { data: allMinistries, error: err3 } = await supabase
        .from('tenders')
        .select('bid_number, ministry_name')
        .not('ministry_name', 'is', null)
        .limit(2000);

    const shorts = allMinistries?.filter(m => m.ministry_name.length < 5 && !['N/A', 'NA', 'N/a', 'N/A ', 'Goa'].includes(m.ministry_name)) || [];
    console.log(`- Very short names (<5 chars): ${shorts.length}`);
    shorts.forEach(t => console.log(`  [${t.bid_number}] ${t.ministry_name}`));
}

crossCheckMinistries();
