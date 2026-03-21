import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenders() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  console.log(`Checking tenders closing between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

  const { data, error, count } = await supabase
    .from('tenders')
    .select('id, bid_number, end_date', { count: 'exact' })
    .gte('end_date', startOfDay.toISOString())
    .lte('end_date', endOfDay.toISOString());

  if (error) {
    console.error('Error fetching tenders:', error);
    return;
  }

  console.log(`Found ${count} tenders closing today.`);
  if (data) {
      console.log(data.slice(0, 5));
  }
}

checkTenders();
