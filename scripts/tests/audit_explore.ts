import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Mock INDIAN_STATES from lib/locations
const INDIAN_STATES = new Set([
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman And Nicobar', 'Chandigarh', 'Dadra And Nagar Haveli And Daman And Diu',
  'Delhi', 'Jammu And Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fullAudit() {
  console.log(">>> Starting Global Explore Audit...");
  const now = new Date().toISOString();

  // 1. Total Count Check
  const { count: totalActiveCount, error: countErr } = await supabase
    .from("tenders")
    .select("id", { count: "exact", head: true })
    .gte("end_date", now);
  
  if (countErr) console.error("Count Error:", countErr);
  console.log(`- Total Active Bids: ${totalActiveCount}`);

  // 2. Multi-Sample Strategy Audit
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

  const tenderMap = new Map();
  latestRes.data?.forEach(t => tenderMap.set(t.id, t));
  enrichedRes.data?.forEach(t => tenderMap.set(t.id, t));
  const tenders = Array.from(tenderMap.values()) as any[];

  if (!tenders || tenders.length === 0) return;

  console.log(`- Sampled Tenders: ${tenders.length}`);

  // 3. Aggregations Replicated
  const isInvalid = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim()) || v === 'null';
  
  const stateCounts: Record<string, number> = {};
  const ministryCounts: Record<string, number> = {};
  const orgCounts: Record<string, number> = {};
  
  let mseCount = 0, startupCount = 0, miiCount = 0, zeroEmdCount = 0;
  let raCount = 0, customCount = 0, openCount = 0;

  tenders.forEach(t => {
    // State/Ministry Overflow
    if (t.state && INDIAN_STATES.has(t.state)) {
        stateCounts[t.state] = (stateCounts[t.state] || 0) + 1;
    } else if (t.state && !isInvalid(t.state)) {
        ministryCounts[t.state] = (ministryCounts[t.state] || 0) + 1;
    }

    // Ministry
    if (!isInvalid(t.ministry_name)) {
        ministryCounts[t.ministry_name!] = (ministryCounts[t.ministry_name!] || 0) + 1;
    }

    // Org
    if (!isInvalid(t.organisation_name)) {
        orgCounts[t.organisation_name!] = (orgCounts[t.organisation_name!] || 0) + 1;
    }

    // Stats
    if (t.eligibility_msme) mseCount++;
    if (t.startup_relaxation) startupCount++;
    if (t.eligibility_mii) miiCount++;
    if (t.emd_amount === 0) zeroEmdCount++;

    const titleUpper = (t.title || "").toUpperCase();
    if (titleUpper.includes("REVERSE AUCTION") || titleUpper.includes(" RA ")) raCount++;
    else if (titleUpper.includes("CUSTOM BID")) customCount++;
    else openCount++;
  });

  console.log("\n>>> TAB AUDIT RESULTS:");
  
  const topMinistries = Object.entries(ministryCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  console.log(`- Ministries Found: ${Object.keys(ministryCounts).length}`);
  topMinistries.forEach(([m, c]) => console.log(`  * ${m}: ${c}`));

  console.log(`- States Found: ${Object.keys(stateCounts).length}`);
  
  const topOrgs = Object.entries(orgCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  console.log(`- Organisations Found: ${Object.keys(orgCounts).length}`);
  topOrgs.forEach(([o, c]) => console.log(`  * ${o}: ${c}`));

  console.log("\n>>> STATS AUDIT:");
  console.log(`- MSE Preferred: ${mseCount}`);
  console.log(`- Startup Relaxation: ${startupCount}`);
  console.log(`- MII Preference: ${miiCount}`);
  console.log(`- Zero EMD: ${zeroEmdCount}`);
  console.log(`- Open Bids: ${openCount}`);
  console.log(`- Reverse Auctions: ${raCount}`);
  console.log(`- Custom Bids: ${customCount}`);

  console.log("\n>>> SUMMARY:");
  if (Object.keys(ministryCounts).length === 0) console.error("!!! FAIL: Ministry list is still empty in the audit!");
  else console.log("OK: Ministry list is populated.");

  if (Object.keys(orgCounts).length === 0) console.error("!!! FAIL: Organisation list is still empty in the audit!");
  else console.log("OK: Organisation list is populated.");

  if (totalActiveCount! < 100000) console.error("!!! WARNING: Active bid count seems low (likely limit issue persisted)");
  else console.log("OK: Total active bid count is high (>100k).");
}

fullAudit();
