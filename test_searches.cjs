const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: searches, error } = await supabase.from('saved_searches').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Error:", error);
  console.log("Searches:", JSON.stringify(searches, null, 2));
}

run();
