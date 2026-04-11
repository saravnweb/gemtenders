import TendersClient from './TendersClient';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { fetchTendersByRelevance } from '@/lib/tenders-relevance-query';
import { requirePublicListingReady } from '@/lib/tender-public-listing';
import { Suspense } from 'react';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: 'Searchable GeM Tender Tracking & AI Summaries | GeMTenders.org'
  },
  description: "Find government work easily with searchable GeM tender tracking by keyword. Get simple AI summaries and automated alerts—features the official site doesn't offer.",
  openGraph: {
    title: 'Searchable GeM Tender Tracking & AI Summaries | GeMTenders.org',
    description: "Find government work easily with searchable GeM tender tracking by keyword. Get simple AI summaries and automated alerts—features the official site doesn't offer.",
    url: 'https://gemtenders.org',
    siteName: 'GeMTenders.org',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'GeMTenders — Searchable GeM Tender Tracking',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Searchable GeM Tender Tracking & AI Summaries | GeMTenders.org',
    description: "Find government work easily with searchable GeM tender tracking by keyword. Get simple AI summaries and automated alerts—features the official site doesn't offer.",
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
  <div className="min-h-screen bg-fresh-sky-50 dark:bg-background text-slate-800 dark:text-foreground">
    <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
          <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-500" />
          <span className="text-xs text-fresh-sky-600 dark:text-fresh-sky-400 font-bold tracking-wide uppercase">Live Updates</span>
        </div>
        <h1 className="font-bricolage text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-foreground tracking-tight mb-2 sm:mb-4">
          Searchable GeM Tenders with AI Summaries
        </h1>
        <div className="relative max-w-3xl">
          <div className="w-full h-[38px] sm:h-[42px] bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl animate-pulse" />
        </div>
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
  const catParam = params.category;
  const initialCategories = Array.isArray(catParam) ? catParam : catParam ? [catParam] : [];
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
  const now = new Date().toISOString();

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
      category: initialCategories[0] || null,
      categories: initialCategories,
      descriptionQuery: '',
    }, 0, 21).then(({ data, error }) => (error || !Array.isArray(data)) ? [] : data);
  } else {
    // Select ALL required columns for TenderCard to avoid hydration issues/missing data
    const COLUMNS = "id,title,bid_number,ra_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug,category,gem_category,gemarpts_result";
    let query = supabase.from('tenders').select(COLUMNS);

    if (!isDirectGemLookup) {
      query = requirePublicListingReady(
        query.gte('end_date', now).not('ai_summary', 'is', null)
      );
    }

    if (qStr) {
      const terms = qStr.split(",").map(t => t.trim()).filter(Boolean);
      const orClauses = terms.map(term =>
        `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%`
      );
      query = query.or(orClauses.join(','));
    }

    if (initialStates.length > 0) {
      query = query.or(initialStates.map(s => `state.ilike."${s}"`).join(','));
    }

    if (initialCategories.length > 0) {
      query = query.in('category', initialCategories);
    }

    tendersPromise = query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(21)
      .then(({ data }) => data || []);
  }

  const userPromise = supabase.auth.getUser();
  const profilePromise = userPromise.then(async ({ data: { user } }) => {
    if (!user) return { user: null, plan: 'free' };
    const { data: profile } = await supabase.from('profiles').select('membership_plan').eq('id', user.id).maybeSingle();
    return { user, plan: profile?.membership_plan ?? 'free' };
  });

  // We no longer block on totalCount fetch here to improve LCP.
  const [initialTenders, { user, plan: userPlan }] = await Promise.all([
    tendersPromise.then(d => (d as any[]) || []),
    profilePromise
  ]);

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
        initialCategories={initialCategories}
        initialSortOrder={initialSortOrder}
        userPlan={userPlan}
      />
    </>
  );
}
