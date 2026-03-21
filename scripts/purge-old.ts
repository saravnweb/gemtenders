import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeOldTenders() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const now = today.toISOString();
  console.log(`Looking for old closed tenders to purge (expiring before: ${now})...`);

  let totalDeletedGlobally = 0;

  while (true) {
    // Find tenders where end_date is in the past
    const { data, error } = await supabase
      .from('tenders')
      .select('id, bid_number, end_date')
      .lt('end_date', now)
      .limit(1000);

    if (error) {
        console.error("Error fetching old tenders:", error);
        break;
    }
    
    if (!data || data.length === 0) {
        if (totalDeletedGlobally === 0) {
            console.log("No closed tenders found to purge. Your database is clean!");
        } else {
            console.log(`\nPurge complete! Successfully removed ${totalDeletedGlobally} old bids to avoid confusion.`);
        }
        break;
    }

    if (totalDeletedGlobally === 0) {
        console.log(`Found an initial batch of ${data.length} closed tenders. Purging them from the database now...`);
    }
    
    // Delete them in chunks
    const chunks = [];
    let i = 0;
    while (i < data.length) {
        chunks.push(data.slice(i, i + 500));
        i += 500;
    }

    let totalDeleted = 0;
    for (const chunk of chunks) {
        const ids = chunk.map((c: any) => c.id);
        const { error: deleteErr } = await supabase.from('tenders').delete().in('id', ids);
        if (deleteErr) {
            console.error("Error deleting a chunk:", deleteErr.message);
        } else {
            totalDeleted += ids.length;
            totalDeletedGlobally += ids.length;
            console.log(`Deleted chunk of ${ids.length} records. Total deleted iteratively: ${totalDeletedGlobally}`);
        }
    }
  }
}

purgeOldTenders();
