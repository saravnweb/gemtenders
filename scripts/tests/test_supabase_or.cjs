const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const orParts = [];
  const keyword = "garden";
  orParts.push(`title.ilike.%${keyword}%`, `department.ilike.%${keyword}%`);
  
  let q = supabase.from('tenders').select('id,title').limit(5);
  q = q.or(orParts.join(','));
  
  const { data, error } = await q;
  console.log("Error:", error);
  console.log("Data count:", data?.length);
  if (data?.length > 0) console.log(data[0]);
}

run();
