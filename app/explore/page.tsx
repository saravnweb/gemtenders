import { INDIAN_STATES, normalizeState } from "@/lib/locations";
import ExploreClient from "./ExploreClient";

export const revalidate = 1800; // cache for 30 minutes

export default async function ExplorePage() {
  // We can select only active tenders to reduce payload and process counts in JS.
  // We need to query twice to handle different dates/fields or fetch universally.
  // Note: we'll use `lib/supabase.ts` or `lib/supabase-server.ts`. 
  // Wait, let's use the local supabase client as usually done in the app.
  // To avoid timeouts, let's fetch exactly what's needed.
  
  // Dynamic aggregations are best done via PostgREST RPC, but JS aggregation works well for <5000 rows.
  // Actually, we'll import `getExploreData` from an internal helper or do it right here.

  return <ExploreDataFetcher />;
}

// Separate component to handle the async DB call inside it cleanly.
async function ExploreDataFetcher() {
  // Use anonymous supabase client to fetch public active active tenders
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.time('explore-fetch');
  const now = new Date().toISOString();

  // Get real total count (separate from row fetch, bypasses Supabase 1000-row default cap)
  const { count: totalCount } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .gte("end_date", now);

  // Multi-Sample Strategy to bypass 1000-row limit and ensure data richness:
  // 1. Latest 1000 (for real-time counts like closing/added today)
  // 2. 2000 Enriched (specifically seeking those with organisations/states populated)
  const [latestRes, enrichedRes] = await Promise.all([
    supabase
      .from("tenders")
      .select("id, title, state, ministry_name, organisation_name, emd_amount, eligibility_msme, eligibility_mii, startup_relaxation, created_at, end_date")
      .gte("end_date", now)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("tenders")
      .select("id, title, state, ministry_name, organisation_name, emd_amount, eligibility_msme, eligibility_mii, startup_relaxation, created_at, end_date")
      .gte("end_date", now)
      .not("organisation_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000)
  ]);

  // Combine unique tenders
  const tenderMap = new Map();
  latestRes.data?.forEach(t => tenderMap.set(t.id, t));
  enrichedRes.data?.forEach(t => tenderMap.set(t.id, t));
  const tenders = Array.from(tenderMap.values());

  console.timeEnd('explore-fetch');

  if (tenders.length === 0) {
    return <div>Error loading data or no active tenders found.</div>;
  }

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
  const stateList = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([state, count]) => ({ state, count }));

  // 2. Calculate By Ministry Counts (ministry_name field + overflow from state field)
  const isInvalid = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim()) || v === 'null';
  const ministryCounts: Record<string, number> = {};
  tenders.forEach(t => {
    if (!isInvalid(t.ministry_name)) {
      ministryCounts[t.ministry_name!] = (ministryCounts[t.ministry_name!] || 0) + 1;
    }
  });
  // Merge ministry names that were stored in the state field
  for (const [name, count] of Object.entries(stateFieldMinistries)) {
    if (!isInvalid(name)) {
      ministryCounts[name] = (ministryCounts[name] || 0) + count;
    }
  }
  const topMinistries = Object.entries(ministryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([ministry, count]) => ({ ministry, count }));

  // 3. By Organisation Counts
  const orgCounts: Record<string, number> = {};
  tenders.forEach(t => {
    if (!isInvalid(t.organisation_name)) {
      orgCounts[t.organisation_name!] = (orgCounts[t.organisation_name!] || 0) + 1;
    }
  });
  const orgList = Object.entries(orgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([org, count]) => ({ org, count }));

  // 4. Overall stats for Types & MSE
  // "Closing Today": end_date is today
  // "Added Today": created_at is today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  let activeCount = totalCount ?? tenders.length;
  let msePreferredCount = 0;
  let startupRelaxationCount = 0;
  let miiPreferenceCount = 0;
  let zeroEmdCount = 0;
  let closingTodayCount = 0;
  let addedTodayCount = 0;
  
  let openBidCount = 0;
  let reverseAuctionCount = 0;
  let customBidCount = 0;

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
