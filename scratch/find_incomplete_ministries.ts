
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function findIncompleteMinistries() {
    console.log("Searching for incomplete ministries...");

    const { data, error } = await supabase
        .from('tenders')
        .select('id, bid_number, ministry_name, organisation_name, department_name, pdf_url')
        .or('ministry_name.ilike.Ministry of ,ministry_name.eq.Ministry of')
        .limit(100);

    if (error) {
        console.error("Error fetching tenders:", error.message);
        return;
    }

    console.log(`Found ${data.length} tenders with potentially incomplete ministry names.`);
    
    data.forEach(t => {
        console.log(`- [${t.bid_number}] Ministry: "${t.ministry_name}" | Org: "${t.organisation_name}" | Dept: "${t.department_name}"`);
    });
}

findIncompleteMinistries();
