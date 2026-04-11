
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function debugData() {
    const { data } = await supabase
        .from('tenders')
        .select('id, bid_number, ministry_name, organisation_name')
        .limit(20);

    data?.forEach(t => {
        console.log(`[${t.bid_number}]`);
        console.log(`  ministry_name: type=${typeof t.ministry_name}, value=${JSON.stringify(t.ministry_name)}`);
        console.log(`  organisation_name: type=${typeof t.organisation_name}, value=${JSON.stringify(t.organisation_name)}`);
    });
}
debugData();
