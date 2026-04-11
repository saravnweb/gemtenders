
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

async function checkNullValues() {
    console.log("Checking for 'Null' strings and actual NULLs...");

    // Check ministry_name
    const { data: stringNulls, error: err1 } = await supabase
        .from('tenders')
        .select('id, bid_number, ministry_name, organisation_name, department_name')
        .or('ministry_name.eq.Null,ministry_name.eq.null')
        .limit(10);

    console.log(`Found ${stringNulls?.length || 0} tenders with literal "Null" strings in ministry_name.`);
    stringNulls?.forEach(t => {
        console.log(`- [${t.bid_number}] Ministry: "${t.ministry_name}" | Org: "${t.organisation_name}"`);
    });

    const { data: realNulls, error: err2 } = await supabase
        .from('tenders')
        .select('id, bid_number, ministry_name, organisation_name')
        .is('ministry_name', null)
        .limit(10);

    console.log(`Found ${realNulls?.length || 0} tenders with actual NULL in ministry_name.`);
    realNulls?.forEach(t => {
        console.log(`- [${t.bid_number}] Ministry: ${t.ministry_name} | Org: "${t.organisation_name}"`);
    });

    // Check organisation_name similarly if needed
    const { data: orgNulls, error: err3 } = await supabase
        .from('tenders')
        .select('id, bid_number, organisation_name')
        .or('organisation_name.eq.Null,organisation_name.eq.null')
        .limit(10);
    
    console.log(`Found ${orgNulls?.length || 0} tenders with literal "Null" strings in organisation_name.`);
    orgNulls?.forEach(t => {
        console.log(`- [${t.bid_number}] Org: "${t.organisation_name}"`);
    });
}

checkNullValues();
