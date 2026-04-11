
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

async function cleanNullStrings() {
    console.log("Starting cleanup of literal 'null' strings...");

    const fields = ['ministry_name', 'organisation_name', 'department_name', 'state', 'city', 'office_name'];
    let totalFixed = 0;

    for (const field of fields) {
        console.log(`Checking field: ${field}...`);
        
        // Find them first to see count (ilike handles Null, null, NULL)
        const { data, count, error } = await supabase
            .from('tenders')
            .select('id', { count: 'exact' })
            .ilike(field, 'null');

        if (error) {
            console.error(`Error checking ${field}:`, error.message);
            continue;
        }

        if (count && count > 0) {
            console.log(`Found ${count} rows with 'null' string in ${field}. Updating to NULL...`);
            
            // We can update in batches or all at once if count is small. 
            // Better to use an update with .ilike() filter.
            const { error: updateErr } = await supabase
                .from('tenders')
                .update({ [field]: null })
                .ilike(field, 'null');

            if (updateErr) {
                console.error(`Error updating ${field}:`, updateErr.message);
            } else {
                console.log(`Successfully cleared ${count} rows in ${field}.`);
                totalFixed += count;
            }
        } else {
            console.log(`No literal 'null' strings found in ${field}.`);
        }
    }

    console.log(`Cleanup complete. Total string-to-null conversions: ${totalFixed}`);
}

cleanNullStrings();
