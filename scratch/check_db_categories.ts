
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAllCategories() {
  const { data, error } = await supabase
    .from('tenders')
    .select('category');

  if (error) {
    console.error(error);
    return;
  }

  const counts: Record<string, number> = {};
  data.forEach(r => {
    const cat = r.category || 'null';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log('All categories in DB:', sorted);
}

getAllCategories();
