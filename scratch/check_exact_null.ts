
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkExactNull() {
    const { data, count, error } = await supabase
        .from('tenders')
        .select('id', { count: 'exact' })
        .eq('ministry_name', 'Null');

    console.log(`Exact 'Null' count in ministry_name: ${count}`);
    
    const { count: orgCount } = await supabase
        .from('tenders')
        .select('id', { count: 'exact' })
        .eq('organisation_name', 'Null');

    console.log(`Exact 'Null' count in organisation_name: ${orgCount}`);
}
checkExactNull();
