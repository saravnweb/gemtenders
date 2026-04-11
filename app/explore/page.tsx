import { INDIAN_STATES, normalizeState, normalizeCity, cityToState, isIndianState, normalizeMinistry } from "@/lib/locations";
import { requirePublicListingReady } from "@/lib/tender-public-listing";
import ExploreClient from "./ExploreClient";
import { Suspense } from "react";

export const revalidate = 1800; // cache for 30 minutes

export default async function ExplorePage() {
  return (
    <Suspense fallback={<ExplorePageSkeleton />}>
      <ExploreDataFetcher />
    </Suspense>
  );
}

// Lightweight skeleton while data loads
function ExplorePageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-5 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
        </div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full mb-4"></div>
      </main>
    </div>
  );
}

// Separate component to handle the async DB call inside it cleanly.
async function ExploreDataFetcher() {
  // Use anonymous supabase client to fetch public active active tenders
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const now = new Date().toISOString();
  console.time('explore-fetch');

  // 1. Fetch ALL tender metadata for counts using pagination 
  // (We need: state, ministry_name, organisation_name, eligibility_msme, eligibility_mii, startup_relaxation, emd_amount, created_at, end_date, title)
  let allTenders: any[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  
  while (true) {
    const { data: pageData, error: pageError } = await requirePublicListingReady(
      supabase
        .from("tenders")
        .select("id, title, state, ministry_name, organisation_name, emd_amount, eligibility_msme, eligibility_mii, startup_relaxation, created_at, end_date")
        .gte("end_date", now)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    );
    
    if (pageError || !pageData || pageData.length === 0) break;
    allTenders = allTenders.concat(pageData);
    if (pageData.length < PAGE_SIZE) break;
    page++;
    if (page > 30) break; // Safety cap at 30k rows
  }

  const tenders = allTenders;
  console.timeEnd('explore-fetch');

  if (tenders.length === 0) {
    return <div>Error loading data or no active tenders found.</div>;
  }

  // 4. Overall stats for Types & MSE
  // "Closing Today": end_date is today
  // "Added Today": created_at is today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let activeCount = tenders.length;
  let msePreferredCount = 0;
  let startupRelaxationCount = 0;
  let miiPreferenceCount = 0;
  let zeroEmdCount = 0;
  let closingTodayCount = 0;
  let addedTodayCount = 0;
  
  let openBidCount = 0;
  let reverseAuctionCount = 0;
  let customBidCount = 0;

  // 1. Calculate By State Counts — only real Indian states/UTs
  const stateCounts: Record<string, number> = {};
  const stateFieldMinistries: Record<string, number> = {}; 
  tenders.forEach(t => {
    if (!t.state) return;
    const canonical = normalizeState(t.state);
    if (canonical && INDIAN_STATES.has(canonical)) {
      stateCounts[canonical] = (stateCounts[canonical] || 0) + 1;
    } else {
      stateFieldMinistries[t.state] = (stateFieldMinistries[t.state] || 0) + 1;
    }
  });

  // 2. Calculate By Ministry Counts (ministry_name field + overflow from state field)
  const isInvalid = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim()) || v.trim().toLowerCase() === 'null';
  const ministryCounts: Record<string, number> = {};
  tenders.forEach(t => {
    if (!isInvalid(t.ministry_name)) {
      if (isIndianState(t.ministry_name)) {
        const canonical = normalizeState(t.ministry_name)!;
        stateCounts[canonical] = (stateCounts[canonical] || 0) + 1;
      } else {
        const key = normalizeMinistry(t.ministry_name) ?? t.ministry_name!;
        ministryCounts[key] = (ministryCounts[key] || 0) + 1;
      }
    }
  });
  // Merge ministry names that were stored in the state field
  for (const [name, count] of Object.entries(stateFieldMinistries)) {
    if (!isInvalid(name)) {
      if (isIndianState(name)) {
        const canonical = normalizeState(name)!;
        stateCounts[canonical] = (stateCounts[canonical] || 0) + count;
      } else if (normalizeCity(name)) {
        // City/district stored in state column — resolve to its state and count there
        const resolvedState = cityToState(name);
        if (resolvedState && INDIAN_STATES.has(resolvedState)) {
          stateCounts[resolvedState] = (stateCounts[resolvedState] || 0) + count;
        }
      } else {
        const key = normalizeMinistry(name) ?? name;
        ministryCounts[key] = (ministryCounts[key] || 0) + count;
      }
    }
  }

  // Ensure stateCounts contains only entries in INDIAN_STATES and sort/map
  const stateList = Array.from(INDIAN_STATES)
    .map(state => ({ state, count: stateCounts[state] || 0 }))
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const sumOfMinistries = Object.values(ministryCounts).reduce((a, b) => a + b, 0);
  const othersCount = activeCount - sumOfMinistries;
  if (othersCount > 0) {
    ministryCounts["Others / State Tenders"] = othersCount;
  }

  const topMinistries = Object.entries(ministryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([ministry, count]) => ({ ministry, count }));

  // 3. By Organisation Counts
  const orgCounts: Record<string, number> = {};
  tenders.forEach(t => {
    if (!isInvalid(t.organisation_name)) {
      if (isIndianState(t.organisation_name)) {
        const canonical = normalizeState(t.organisation_name)!;
        // Don't count again if we already counted it from state/ministry, 
        // but here we are just building the org list, so we just skip it.
      } else {
        const key = normalizeMinistry(t.organisation_name) ?? t.organisation_name!;
        orgCounts[key] = (orgCounts[key] || 0) + 1;
      }
    }
  });
  const sumOfOrgs = Object.values(orgCounts).reduce((a, b) => a + b, 0);
  const otherOrgsCount = activeCount - sumOfOrgs;
  if (otherOrgsCount > 0) {
    orgCounts["Others / Unlisted Organizations"] = otherOrgsCount;
  }

  const orgList = Object.entries(orgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 150)
    .map(([org, count]) => ({ org, count }));


  tenders.forEach(t => {
    if (t.eligibility_msme) msePreferredCount++;
    if (t.startup_relaxation) startupRelaxationCount++;
    if (t.eligibility_mii) miiPreferenceCount++;
    if (t.emd_amount === 0) zeroEmdCount++;

    const endDateTs = new Date(t.end_date).getTime();
    if (endDateTs >= todayStart.getTime() && endDateTs < todayEnd.getTime()) closingTodayCount++;

    const createdAtTs = new Date(t.created_at).getTime();
    if (createdAtTs >= todayStart.getTime() && createdAtTs < todayEnd.getTime()) addedTodayCount++;

    // Bid Methods heuristical matching
    const titleUpper = (t.title || "").toUpperCase();
    if (titleUpper.includes("REVERSE AUCTION") || titleUpper.includes(" RA ")) {
      reverseAuctionCount++;
    } else if (titleUpper.includes("CUSTOM BID")) {
      customBidCount++;
    } else {
      openBidCount++;
    }
  });

  const stats = {
    totalActive: activeCount,
    msePreferred: msePreferredCount,
    startupRelaxation: startupRelaxationCount,
    miiPreference: miiPreferenceCount,
    zeroEmd: zeroEmdCount,
    closingToday: closingTodayCount,
    addedToday: addedTodayCount,
    openBid: openBidCount,
    reverseAuction: reverseAuctionCount,
    customBid: customBidCount
  };

  return (
    <ExploreClient
      topMinistries={topMinistries}
      stateList={stateList}
      orgList={orgList}
      stats={stats}
    />
  );
}
