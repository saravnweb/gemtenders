
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkNullFreq() {
    const { data: stringNulls } = await supabase
        .from('tenders')
        .select('ministry_name')
        .or('ministry_name.ilike.null,ministry_name.is.null');

    const counts: Record<string, number> = {};
    stringNulls?.forEach(t => {
        const key = String(t.ministry_name);
        counts[key] = (counts[key] || 0) + 1;
    });
    console.log("Ministry Name frequencies for 'null' matches:");
    console.log(counts);

    const { data: orgNulls } = await supabase
        .from('tenders')
        .select('organisation_name')
        .or('organisation_name.ilike.null,organisation_name.is.null');

    const orgCounts: Record<string, number> = {};
    orgNulls?.forEach(t => {
        const key = String(t.organisation_name);
        orgCounts[key] = (orgCounts[key] || 0) + 1;
    });
    console.log("\nOrganisation Name frequencies for 'null' matches:");
    console.log(orgCounts);
}
checkNullFreq();
