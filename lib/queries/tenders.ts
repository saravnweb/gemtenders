import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export const getCachedTenders = unstable_cache(
  async (page = 1, limit = 20) => {
    const supabase = await createClient();
    const from = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('tenders')
      .select('*', { count: 'exact' })
      .order('bid_end_date', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw error;
    return { tenders: data ?? [], total: count ?? 0 };
  },
  ['tenders-list'],
  { revalidate: 3600, tags: ['tenders'] }
);
