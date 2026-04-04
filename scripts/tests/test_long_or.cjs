const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const qStr = "garden,landscape,potted plants,horticulture,tree cutting,jcb,cab";
  const orParts = [];
  qStr.split(',').map(k => k.trim()).filter(Boolean).forEach(kw => {
    orParts.push(`title.ilike.%${kw}%`, `department.ilike.%${kw}%`, `ai_summary.ilike.%${kw}%`);
  });
  
  let q = supabase.from('tenders').select('id,title,state,city,department,ai_summary').gte('end_date', new Date().toISOString());
  q = q.or([...new Set(orParts)].join(','));
  const { data } = await q;
  console.log(JSON.stringify(data[0], null, 2));
}

run();
