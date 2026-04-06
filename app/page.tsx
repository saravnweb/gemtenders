import TendersClient from './TendersClient';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: 'Live GeM Tenders — AI-Powered Bid Tracking | GeMTenders.org'
  },
  description: 'Discover 10,000+ live GeM portal tenders with our advanced search tool. Find the best government bids by category, ministry, and state, updated daily.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const qStr = (params.q as string) || "";
  const stateStr = params.state;
  const initialStates = Array.isArray(stateStr) ? stateStr : stateStr ? [stateStr] : [];
  const categoryStr = params.category as string | undefined;

  const supabase = await createClient();
  let query = supabase
    .from('tenders')
    .select('id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug')
    .gte('end_date', new Date().toISOString())
    .not('ai_summary', 'is', null);

  if (qStr) {
    const terms = qStr.split(",").map(t => t.trim()).filter(Boolean);
    const orClauses = terms.map(term =>
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
    );
    query = query.or(orClauses.join(','));
  }

  if (initialStates.length > 0) {
    query = query.or(initialStates.map(s => `state.ilike."${s}"`).join(','));
  }

  if (categoryStr) {
    query = query.eq('category', categoryStr);
  }

  const { data: tenders } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(21);

  // For total count, we need a separate query without limit
  let countQuery = supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true })
    .gte('end_date', new Date().toISOString())
    .not('ai_summary', 'is', null);

  if (qStr) {
    const terms = qStr.split(",").map(t => t.trim()).filter(Boolean);
    const orClauses = terms.map(term =>
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
    );
    countQuery = countQuery.or(orClauses.join(','));
  }
  if (initialStates.length > 0) {
    countQuery = countQuery.or(initialStates.map(s => `state.ilike."${s}"`).join(','));
  }
  if (categoryStr) {
    countQuery = countQuery.eq('category', categoryStr);
  }

  const { count } = await countQuery;

  const initialTenders = tenders ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": initialTenders.map((tender: any, index: number) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://www.gemtenders.org/bids/${tender.slug}`
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
        initialQ={qStr}
        initialStates={initialStates}
        initialCategory={categoryStr}
        initialTotalCount={count ?? 0}
      />
    </>
  );
}
