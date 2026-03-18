import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('tenders')
    .select('*')
    .eq('gem_bid_no', 'GEM/2025/B/7026714')
    .single();

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Got Tender:', JSON.stringify(data, null, 2));
  }
}

main();
