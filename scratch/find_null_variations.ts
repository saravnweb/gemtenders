
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findNulls() {
    const { data } = await supabase
        .from('tenders')
        .select('ministry_name, organisation_name')
        .or('ministry_name.ilike.null,organisation_name.ilike.null');

    const mins = new Set();
    const orgs = new Set();

    data?.forEach(t => {
        if (typeof t.ministry_name === 'string' && t.ministry_name.toLowerCase() === 'null') mins.add(t.ministry_name);
        if (typeof t.organisation_name === 'string' && t.organisation_name.toLowerCase() === 'null') orgs.add(t.organisation_name);
    });

    console.log("Ministry values matching 'null':", Array.from(mins));
    console.log("Organisation values matching 'null':", Array.from(orgs));
}
findNulls();
