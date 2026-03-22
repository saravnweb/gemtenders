import TendersClient from './TendersClient';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'GeM Tender Tracker — Live Government Bids | GeMTenders.org',
  description: 'Discover 10,000+ live GeM portal tenders with our advanced search tool. Find the best government bids by category, ministry, and state, updated daily.',
};

export default async function Page() {
  const supabase = await createClient();
  const { data: tenders } = await supabase
    .from('tenders')
    .select('id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug')
    .gte('end_date', new Date().toISOString())
    .order('start_date', { ascending: false })
    .order('id', { ascending: true })
    .limit(21);

  const { count } = await supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true })
    .gte('end_date', new Date().toISOString());

  const initialTenders = tenders ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": initialTenders.map((tender: any, index: number) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://gemtenders.org/bids/${tender.slug}`
    }))
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TendersClient
        initialTenders={initialTenders}
        initialQ=""
        initialStates={[]}
        initialTotalCount={count ?? 0}
      />
    </>
  );
}
