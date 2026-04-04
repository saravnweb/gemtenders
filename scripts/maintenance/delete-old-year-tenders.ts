import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteOldYearTenders() {
  const years = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
  let totalDeletedGlobally = 0;

  for (const year of years) {
    console.log(`Searching for old tenders from ${year}...`);
    while (true) {
      const { data, error } = await supabase
        .from('tenders')
        .select('id')
        .like('bid_number', `%${year}%`)
        .limit(1000);

      if (error) {
        console.error(`Error fetching ${year} tenders:`, error);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      const ids = data.map((c: any) => c.id);
      const { error: deleteErr } = await supabase.from('tenders').delete().in('id', ids);
      if (deleteErr) {
        console.error(`Error deleting chunk for ${year}:`, deleteErr.message);
        break;
      } else {
        totalDeletedGlobally += ids.length;
        console.log(`Deleted chunk of ${ids.length} records for ${year}.`);
      }
    }
  }
  
  console.log(`Completed. Total deleted: ${totalDeletedGlobally}`);
}

deleteOldYearTenders();
