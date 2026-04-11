
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

async function checkOtherIncomplete() {
    const prefixes = ['Ministry of', 'Department of', 'Office of', 'Organisation of'];
    
    for (const prefix of prefixes) {
        const { count, error } = await supabase
            .from('tenders')
            .select('*', { count: 'exact', head: true })
            .ilike('ministry_name', prefix);
            
        console.log(`- Exact "${prefix}": ${count ?? 0}`);

        const { data: samples } = await supabase
            .from('tenders')
            .select('ministry_name')
            .ilike('ministry_name', `${prefix}%`)
            .limit(5);
        
        console.log(`  Sample starting with "${prefix}":`, samples?.map(s => s.ministry_name));
    }
}

checkOtherIncomplete();
