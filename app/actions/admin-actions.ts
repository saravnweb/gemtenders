"use server";

import axios from 'axios';
import https from 'https';
import { createClient } from '@/lib/supabase/server';

const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

export async function getOfficialGemCount() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = (process.env.ADMIN_EMAIL || 'saravn.ent@gmail.com').trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();
  
  if (!user || userEmail !== adminEmail) {
    console.log(`[Admin Actions Denial] User: ${userEmail}, Expected: ${adminEmail}`);
    return { success: false, error: 'Unauthorized. You do not have permission to perform this scan.' };
  }

  try {
    // 1. Get Session/CSRF
    const sessionRes = await axios.get('https://bidplus.gem.gov.in/all-bids', {
      httpsAgent: HTTPS_AGENT,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
      timeout: 10000,
    });
    
    const cookies = sessionRes.headers['set-cookie']?.map((c: string) => c.split(';')[0]).join('; ') || '';
    const csrf = (sessionRes.data as string).match(/csrf_bd_gem_nk.*?['"]([0-9a-f]{32})['"]/)?.[1] || '';

    if (!cookies || !csrf) {
      return { success: false, error: 'Could not initialize GeM session. Portal might be down or CSRF pattern changed.' };
    }

    // 2. Query SOLR for total count
    const form = new URLSearchParams();
    form.append('payload', JSON.stringify({
      page: 1,
      param: { searchBid: '', searchType: 'fullText' },
      filter: { bidStatusType: 'ongoing_bids', byType: 'all', sort: 'Bid-End-Date-Oldest' },
    }));
    form.append('csrf_bd_gem_nk', csrf);

    const r = await axios.post('https://bidplus.gem.gov.in/all-bids-data', form.toString(), {
      httpsAgent: HTTPS_AGENT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://bidplus.gem.gov.in/all-bids',
        'Cookie': cookies,
      },
      timeout: 15000,
    });

    const totalCount = r.data?.response?.response?.numFound;
    
    if (typeof totalCount !== 'number') {
      return { success: false, error: 'Received invalid data structure from GeM API.' };
    }

    return { success: true, count: totalCount, timestamp: new Date().toISOString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function getRegionalConsistency(supabase: any, now: string) {
  const { data } = await supabase
    .from("tenders")
    .select("state, city")
    .gte("end_date", now);

  if (!data) return [];

  const stats: Record<string, { state: string; total: number; withCity: number }> = {};
  
  data.forEach((d: any) => {
    const sName = d.state || 'Unknown';
    if (!stats[sName]) {
      stats[sName] = { state: sName, total: 0, withCity: 0 };
    }
    stats[sName].total++;
    if (d.city) stats[sName].withCity++;
  });

  return Object.values(stats).sort((a, b) => b.total - a.total);
}

export async function getIntegrityStats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = (process.env.ADMIN_EMAIL || 'saravn.ent@gmail.com').trim().toLowerCase();
  const userEmail = user?.email?.trim().toLowerCase();
  
  if (!user || userEmail !== adminEmail) {
    return { success: false, error: 'Unauthorized' };
  }

  const now = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  try {
    const [
      { count: totalActive },
      { count: hasState },
      { count: hasCity },
      { count: hasMinistry },
      { count: hasOrg },
      { count: hasCategory },
      { count: isGoods },
      { count: isServices },
      { count: isWorks },
      { count: isOpenBid },
      { count: isRA },
      { count: isCustomBid },
      { count: isMsme },
      { count: isMii },
      { count: isStartup },
      { count: isZeroEmd },
      { count: closingToday },
      { count: addedToday }
    ] = await Promise.all([
      // Total Active
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now),
      
      // Core Facet Gaps
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).not("state", "is", null),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).not("city", "is", null),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).not("ministry_name", "is", null),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).not("organisation_name", "is", null),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).not("category", "is", null),

      // Procurement Type Breakdown
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("procurement_type", "Goods"),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("procurement_type", "Services"),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("procurement_type", "Works"),

      // Bid Method Breakdown
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("bid_type", "Open Bid"),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("bid_type", "Reverse Auction"),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("bid_type", "Custom Bid"),

      // Policy Preferences
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("eligibility_msme", true),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("eligibility_mii", true),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("startup_relaxation", true),

      // Special Groups
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).eq("emd_amount", 0),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).gte("end_date", todayStr).lt("end_date", new Date(today.getTime() + 86400000).toISOString()),
      supabase.from("tenders").select("*", { count: "exact", head: true }).gte("end_date", now).gte("created_at", todayStr)
    ]);

    const regionalConsistency = await getRegionalConsistency(supabase, now);

    return {
      success: true,
      stats: {
        totalActive: totalActive || 0,
        facets: [
          { name: "States", count: hasState || 0 },
          { name: "Cities", count: hasCity || 0 },
          { name: "Ministries", count: hasMinistry || 0 },
          { name: "Organisations", count: hasOrg || 0 },
          { name: "Categories", count: hasCategory || 0 }
        ],
        regionalConsistency,
        procurementTypes: [
          { name: "Goods", count: isGoods || 0 },
          { name: "Services", count: isServices || 0 },
          { name: "Works", count: isWorks || 0 }
        ],
        bidMethods: [
          { name: "Open Bid", count: isOpenBid || 0 },
          { name: "Reverse Auction", count: isRA || 0 },
          { name: "Custom Bid", count: isCustomBid || 0 }
        ],
        policies: [
          { name: "MSE Preferred", count: isMsme || 0 },
          { name: "MII Preference", count: isMii || 0 },
          { name: "Startup Relaxation", count: isStartup || 0 }
        ],
        insights: [
          { name: "Zero EMD Tenders", count: isZeroEmd || 0 },
          { name: "Closing Today", count: closingToday || 0 },
          { name: "Added Today", count: addedToday || 0 }
        ]
      },
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
