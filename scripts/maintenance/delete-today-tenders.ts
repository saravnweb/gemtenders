import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTendersLoop() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Deleting all tenders closing between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);
  
  let totalDeleted = 0;
  
  while (true) {
    const { data, error, count } = await supabase
      .from('tenders')
      .select('id, bid_number')
      .gte('end_date', startOfDay.toISOString())
      .lte('end_date', endOfDay.toISOString())
      .limit(500);

    if (error) {
      console.error('Error fetching tenders:', error);
      break;
    }

    if (!data || data.length === 0) {
      console.log('No more tenders found for today.');
      break;
    }

    const ids = data.map(t => t.id);
    const { error: deleteError } = await supabase
      .from('tenders')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`Error deleting batch:`, deleteError);
      break;
    }
    
    totalDeleted += ids.length;
    console.log(`Deleted a batch of ${ids.length}. Total so far: ${totalDeleted}`);
  }

  console.log(`Successfully deleted total of ${totalDeleted} tenders.`);
}

deleteTendersLoop();
