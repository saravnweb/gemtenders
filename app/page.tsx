import TendersClient from './TendersClient';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { fetchTendersByRelevance } from '@/lib/tenders-relevance-query';
import { requirePublicListingReady } from '@/lib/tender-public-listing';
import { Suspense } from 'react';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: 'Live GeM Tenders — AI-Powered Bid Tracking | GeMTenders.org'
  },
  description: 'Discover 10,000+ live GeM portal tenders with our advanced search tool. Find the best government bids by category, ministry, and state, updated daily.',
  openGraph: {
    title: 'Live GeM Tenders — AI-Powered Bid Tracking | GeMTenders.org',
    description: 'Discover 10,000+ live GeM portal tenders with our advanced search tool. Find the best government bids by category, ministry, and state, updated daily.',
    url: 'https://gemtenders.org',
    siteName: 'GeMTenders.org',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'GeMTenders — AI-Powered GeM Tender Tracking',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live GeM Tenders — AI-Powered Bid Tracking | GeMTenders.org',
    description: 'Discover 10,000+ live GeM portal tenders with our advanced search tool. Find the best government bids by category, ministry, and state, updated daily.',
    images: ['/logo.png'],
    site: '@GeMTenders',
  },
};

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<TendersSkeleton />}>
      <TendersResult searchParams={searchParams} />
    </Suspense>
  );
}

const TendersSkeleton = () => (
  <div className="min-h-screen bg-fresh-sky-50 dark:bg-background">
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-8">
        <div className="h-4 w-32 bg-slate-200 dark:bg-muted rounded animate-pulse mb-3" />
        <div className="h-10 w-64 bg-slate-200 dark:bg-muted rounded animate-pulse mb-4" />
        <div className="h-12 w-full max-w-3xl bg-slate-200 dark:bg-muted rounded-2xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-72 bg-white dark:bg-card rounded-xl animate-pulse border border-slate-100 dark:border-border" />
        ))}
      </div>
    </main>
  </div>
);

async function TendersResult({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const qStr = (params.q as string) || "";
  const stateStr = params.state;
  const initialStates = Array.isArray(stateStr) ? stateStr : stateStr ? [stateStr] : [];
  const categoryStr = params.category as string | undefined;
  const sortParam = (params.sort as string) || 'newest';
  const initialSortOrderRaw =
    sortParam === 'newest' || sortParam === 'ending_soon' || sortParam === 'relevance'
      ? sortParam
      : 'newest';
  const initialSortOrder =
    initialSortOrderRaw === 'relevance' && !qStr.trim() ? 'newest' : initialSortOrderRaw;

  const supabase = await createClient();
  const isDirectGemLookup = qStr.trim().toUpperCase().includes("GEM/");

  let tendersPromise;
  if (initialSortOrder === 'relevance' && qStr.trim()) {
    tendersPromise = fetchTendersByRelevance(supabase, {
      q: qStr,
      tab: 'all',
      states: initialStates,
      cities: [],
      ministries: [],
      orgs: [],
      emdFilter: 'all',
      dateFilter: 'all',
      msmeOnly: false,
      miiOnly: false,
      category: categoryStr || null,
      descriptionQuery: '',
    }, 0, 21).then(({ data, error }) => (error || !Array.isArray(data)) ? [] : data);
  } else {
    let query = supabase
      .from('tenders')
      .select('id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug');

    if (!isDirectGemLookup) {
      query = requirePublicListingReady(
        query.gte('end_date', new Date().toISOString()).not('ai_summary', 'is', null)
      );
    }

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

    tendersPromise = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(21)
      .then(({ data }) => data || []);
  }

  // For total count
  let countQuery = supabase
    .from('tenders')
    .select('*', { count: 'exact', head: true });

  if (!isDirectGemLookup) {
    countQuery = requirePublicListingReady(
      countQuery.gte('end_date', new Date().toISOString()).not('ai_summary', 'is', null)
    );
  }

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

  const [tendersData, countData] = await Promise.all([
    tendersPromise,
    countQuery
  ]);

  const initialTenders = (tendersData as any[]) || [];
  const count = countData.count ?? 0;

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
        initialQ={qStr}
        initialStates={initialStates}
        initialCategory={categoryStr}
        initialTotalCount={count ?? 0}
        initialSortOrder={initialSortOrder}
      />
    </>
  );
}
