import { createClient } from '@supabase/supabase-js';
import TendersClient from './TendersClient';

export const revalidate = 60; // Cache for 60s — tenders change frequently but not every second

const COLUMNS = 'id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug';

export default async function Page() {
  // Use a public (anon) client — no cookies needed for public tender data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase
    .from('tenders')
    .select(COLUMNS)
    .gte('end_date', new Date().toISOString())
    .order('start_date', { ascending: false })
    .range(0, 20);

  const { data: initialTenders } = await query;

  return (
    <TendersClient
      initialTenders={initialTenders || []}
      initialQ=""
      initialStates={[]}
    />
  );
}
