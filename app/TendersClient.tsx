"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Download, Clock, Zap, FileText, Bookmark, Info, RefreshCw,
  MapPin, Filter, X, ChevronDown, Shield, Bell, CheckCircle, Loader2,
  Share2, Archive
} from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 21;
const COLUMNS =
  "id,title,bid_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug";

import { CATEGORIES, getCategoryById } from "@/lib/categories";


// ─── Utilities ────────────────────────────────────────────────────────────────
function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getCategory(title: string, summary: string) {
  const text = `${title} ${summary || ""}`.toLowerCase();
  return CATEGORIES.find((cat) => cat.keywords.some((k) => {
    try {
      const regex = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, "i");
      return regex.test(text);
    } catch {
      return text.includes(k);
    }
  }));
}

const isNAValue = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim());

function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = isNAValue(org) ? (dept || "") : (org || "");

  const states = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry","Chandigarh","Ladakh","Jammu And Kashmir"];

  if (!ministryStr && deptStr) {
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) { ministryStr = match[1].trim(); deptStr = match[2].trim(); }
    else {
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) { ministryStr = repeatMatch[1].trim(); deptStr = deptStr.substring(ministryStr.length).trim(); }
    }
  }

  states.forEach((state) => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, "i");
    if (stateRegex.test(deptStr)) {
      if (!ministryStr) ministryStr = state;
      deptStr = deptStr.replace(stateRegex, "$1").trim();
    }
  });

  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
    deptStr = deptStr.substring(ministryStr.length).trim();
  }

  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, "$1, $2");

  if (orgStr && (deptStr.toLowerCase().includes(orgStr.toLowerCase()) || ministryStr.toLowerCase().includes(orgStr.toLowerCase()))) {
    orgStr = "";
  }

  const parts = [ministryStr, cleanDept, orgStr].filter(Boolean).map((s) => toTitleCase(s));
  return parts.join(", ").replace(/, ,/g, ",").replace(/([A-Z][a-z]+)\1/g, "$1");
}

function isTenderArchived(tender: any) {
  if (tender.is_archived) return true;
  if (!tender.end_date) return false;
  let ms = new Date(tender.end_date).getTime();
  if (isNaN(ms) && typeof tender.end_date === "string") {
    const parts = tender.end_date.split("-");
    if (parts.length === 3 && parts[0].length <= 2) {
      ms = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T23:59:59Z`).getTime();
    }
  }
  return !isNaN(ms) && ms < Date.now();
}

// ─── Supabase query builder ────────────────────────────────────────────────────
interface Filters {
  q: string;
  states: string[];
  cities: string[];
  ministries: string[];
  orgs: string[];
  emdFilter: string;
  dateFilter: string;
  msmeOnly: boolean;
  miiOnly: boolean;
  category: string | null;
  descriptionQuery: string;
  tab: "all" | "foryou" | "archived";
  sortOrder: "newest" | "ending_soon";
}

async function queryTendersCount(filters: Filters): Promise<number> {
  let q = (supabase.from("tenders") as any).select("*", { count: "exact", head: true });

  const isDirectBidSearch = filters.q.trim().toUpperCase().includes("GEM/");
  
  if (!isDirectBidSearch) {
    if (filters.tab === "archived") {
      q = q.lt("end_date", new Date().toISOString());
    } else {
      q = q.gte("end_date", new Date().toISOString());
    }
  }

  if (filters.q.trim()) {
    const searchTerms = filters.q.split(',').map(s => s.trim()).filter(Boolean);
    const orClauses = searchTerms.map(term => 
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
    );
    q = q.or(orClauses.join(','));
  }

  if (filters.states.length > 0)     q = q.in("state", filters.states);
  if (filters.cities.length > 0)     q = q.in("city", filters.cities);
  if (filters.ministries.length > 0) q = q.in("ministry_name", filters.ministries);
  if (filters.orgs.length > 0)       q = q.in("organisation_name", filters.orgs);
  if (filters.msmeOnly) q = q.eq("eligibility_msme", true);
  if (filters.miiOnly)  q = q.eq("eligibility_mii",  true);

  if      (filters.emdFilter === "free") q = q.eq("emd_amount", 0);
  else if (filters.emdFilter === "<1L")  q = q.gt("emd_amount", 0).lt("emd_amount", 100000);
  else if (filters.emdFilter === "1-5L") q = q.gte("emd_amount", 100000).lte("emd_amount", 500000);
  else if (filters.emdFilter === ">5L")  q = q.gt("emd_amount", 500000);

  if (filters.category) {
    q = q.eq("category", filters.category);
  }

  if (filters.descriptionQuery.trim()) {
    q = q.ilike("ai_summary", `%${filters.descriptionQuery.trim()}%`);
  }

  if (filters.dateFilter === "today") {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    q = q.gte("end_date", today.toISOString()).lt("end_date", tomorrow.toISOString());
  } else if (filters.dateFilter === "week") {
    const today = new Date();
    const week = new Date(today); week.setDate(week.getDate() + 7);
    q = q.gte("end_date", today.toISOString()).lte("end_date", week.toISOString());
  }

  const { count } = await q;
  return count ?? 0;
}

async function queryForYouTenders(searches: any[]): Promise<any[]> {
  if (!searches.length) return [];

  // Build OR parts from all saved search keywords + category keywords
  const orParts: string[] = [];
  const allStates: string[] = [];
  const allCities: string[] = [];

  searches.forEach(search => {
    const p = search.query_params;
    if (!p) return;

    if (p.states) allStates.push(...p.states);
    if (p.state) allStates.push(p.state);
    if (p.cities) allCities.push(...p.cities);

    if (p.q) {
      p.q.split(",").map((k: string) => k.trim()).filter(Boolean).forEach((kw: string) => {
        orParts.push(`title.ilike.%${kw}%`, `department.ilike.%${kw}%`, `ai_summary.ilike.%${kw}%`);
      });
    }
    if (p.category) {
      orParts.push(`category.eq.${p.category}`); // Since we are combining with .or(), wait actually .or("category.eq.it,title.ilike...") works in Supabase string syntax
    }
  });

  let q = supabase
    .from("tenders")
    .select(COLUMNS)
    .gte("end_date", new Date().toISOString())
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(3000);

  if (orParts.length > 0) {
    const unique = [...new Set(orParts)];
    q = q.or(unique.join(","));
  }

  const uniqueStates = [...new Set(allStates)];
  if (uniqueStates.length > 0) {
    const hasSearchWithoutStates = searches.some(s => {
      const p = s.query_params || {};
      return !(p.states?.length > 0 || p.state);
    });
    if (!hasSearchWithoutStates) {
      q = q.in("state", uniqueStates);
    }
  }

  const uniqueCities = [...new Set(allCities)];
  if (uniqueCities.length > 0) {
    const hasSearchWithoutCities = searches.some(s => {
      const p = s.query_params || {};
      return !(p.cities?.length > 0);
    });
    if (!hasSearchWithoutCities) {
      q = q.in("city", uniqueCities);
    }
  }

  const { data } = await q;
  return data || [];
}

async function queryTenders(filters: Filters, page: number): Promise<any[]> {
  let q = supabase
    .from("tenders")
    .select(COLUMNS)
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const isDirectBidSearch = filters.q.trim().toUpperCase().includes("GEM/");

  // Tab / archive
  if (!isDirectBidSearch) {
    if (filters.tab === "archived") {
      q = q.lt("end_date", new Date().toISOString());
    } else {
      q = q.gte("end_date", new Date().toISOString());
    }
  }

  // Sort
  if (filters.sortOrder === "newest") {
    q = q.order("created_at", { ascending: false }).order("id", { ascending: true });
  } else {
    q = q.order("end_date", { ascending: true }).order("id", { ascending: true });
  }

  // Text search
  if (filters.q.trim()) {
    const searchTerms = filters.q.split(',').map(s => s.trim()).filter(Boolean);
    const orClauses = searchTerms.map(term => 
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
    );
    q = q.or(orClauses.join(','));
  }

  // Location
  if (filters.states.length > 0)     q = q.in("state", filters.states);
  if (filters.cities.length > 0)     q = q.in("city", filters.cities);
  if (filters.ministries.length > 0) q = q.in("ministry_name", filters.ministries);
  if (filters.orgs.length > 0)       q = q.in("organisation_name", filters.orgs);

  // Eligibility
  if (filters.msmeOnly) q = q.eq("eligibility_msme", true);
  if (filters.miiOnly)  q = q.eq("eligibility_mii",  true);

  // EMD
  if      (filters.emdFilter === "free") q = q.eq("emd_amount", 0);
  else if (filters.emdFilter === "<1L")  q = q.gt("emd_amount", 0).lt("emd_amount", 100000);
  else if (filters.emdFilter === "1-5L") q = q.gte("emd_amount", 100000).lte("emd_amount", 500000);
  else if (filters.emdFilter === ">5L")  q = q.gt("emd_amount", 500000);

  // Category (exact match with the new DB column)
  if (filters.category) {
    q = q.eq("category", filters.category);
  }

  // AI summary / description search
  if (filters.descriptionQuery.trim()) {
    q = q.ilike("ai_summary", `%${filters.descriptionQuery.trim()}%`);
  }

  // Date window
  if (filters.dateFilter === "today") {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    q = q.gte("end_date", today.toISOString()).lt("end_date", tomorrow.toISOString());
  } else if (filters.dateFilter === "week") {
    const today = new Date();
    const week = new Date(today); week.setDate(week.getDate() + 7);
    q = q.gte("end_date", today.toISOString()).lte("end_date", week.toISOString());
  }

  const { data } = await q;
  return data || [];
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function TendersClientWrapper(props: {
  initialTenders: any[];
  initialQ: string;
  initialStates: string[];
  initialCategory?: string;
  initialTotalCount?: number;
}) {
  return (
    <Suspense fallback={<TendersSkeleton />}>
      <TendersClient {...props} />
    </Suspense>
  );
}

function TendersSkeleton() {
  return (
    <div className="min-h-screen bg-fresh-sky-50 dark:bg-slate-950">
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-8">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
          <div className="h-12 w-full max-w-3xl bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-slate-100 dark:border-slate-700" />
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Interactive client component ─────────────────────────────────────────────
function TendersClient({
  initialTenders,
  initialQ,
  initialStates,
  initialCategory,
  initialTotalCount,
}: {
  initialTenders: any[];
  initialQ: string;
  initialStates: string[];
  initialCategory?: string;
  initialTotalCount?: number;
}) {
  const searchParams = useSearchParams();

  // ── Tender data state ──
  const [tenders, setTenders]                   = useState<any[]>(initialTenders);
  const [loading, setLoading]                   = useState(false);
  const [loadingMore, setLoadingMore]           = useState(false);
  const [page, setPage]                         = useState(0);
  const [hasMore, setHasMore]                   = useState(initialTenders.length === PAGE_SIZE);
  const [totalCount, setTotalCount]             = useState<number | null>(initialTotalCount ?? null);
  const [forYouAllTenders, setForYouAllTenders] = useState<any[]>([]);
  const [forYouLoading, setForYouLoading]       = useState(false);

  // ── Filter state ──
  const [searchQuery, setSearchQuery]           = useState(initialQ);
  const [selectedStates, setSelectedStates]     = useState<string[]>(initialStates);
  const [selectedCities, setSelectedCities]     = useState<string[]>([]);
  const [emdFilter, setEmdFilter]               = useState("all");
  const [dateFilter, setDateFilter]             = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [descriptionQuery, setDescriptionQuery] = useState("");
  const [msmeOnly, setMsmeOnly]                 = useState(false);
  const [miiOnly, setMiiOnly]                   = useState(false);
  const [activeTab, setActiveTab]               = useState<"all" | "foryou" | "archived">("all");
  const [sortOrder, setSortOrder]               = useState<"newest" | "ending_soon">("newest");
  const [showFilters, setShowFilters]           = useState(false);

  // ── User / auth state ──
  const [user, setUser]                     = useState<any>(null);
  const [isPremium, setIsPremium]           = useState(false);
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches]   = useState<any[]>([]);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSuccess, setSaveSuccess]       = useState(false);

  // ── Filter panel state ──
  const [states, setStates]             = useState<string[]>([]);
  const [cities, setCities]             = useState<string[]>([]);
  const [statesLoaded, setStatesLoaded] = useState(false);

  // ── Ministry / Organisation filter state ──
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs]             = useState<string[]>([]);
  const [ministries, setMinistries]                 = useState<string[]>([]);
  const [orgs, setOrgs]                             = useState<string[]>([]);
  const [ministriesLoaded, setMinistriesLoaded]     = useState(false);
  const [orgsLoaded, setOrgsLoaded]                 = useState(false);

  // ── Refs ──
  const isFirstRender  = useRef(true);
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeq       = useRef(0); // to discard stale responses

  // ── Sync URL search params on mount ──
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !initialQ) setSearchQuery(q);

    const cat = searchParams.get("category");
    if (cat && !initialCategory) setSelectedCategory(cat);

    const s = searchParams.getAll("state");
    if (s.length > 0 && initialStates.length === 0) setSelectedStates(s);
    else {
      try {
        const pref = JSON.parse(localStorage.getItem("preferredStates") || "[]");
        if (s.length === 0 && initialStates.length === 0 && pref.length > 0) setSelectedStates(pref);
      } catch {}
    }

    try {
      const prefCities = JSON.parse(localStorage.getItem("preferredCities") || "[]");
      const c = searchParams.getAll("city");
      if (c.length > 0) setSelectedCities(c);
      else if (prefCities.length > 0) setSelectedCities(prefCities);
    } catch {}

    // Instantly remove any tenders that have precisely expired but were kept around by SSR cache
    const now = Date.now();
    setTenders(prev => {
      const active = prev.filter(t => {
        if (!t.end_date) return true;
        return new Date(t.end_date).getTime() > now;
      });
      return active.length !== prev.length ? active : prev;
    });

  }, []);

  // ── Persist location preferences ──
  useEffect(() => {
    if (selectedStates.length > 0) localStorage.setItem("preferredStates", JSON.stringify(selectedStates));
    else localStorage.removeItem("preferredStates");
  }, [selectedStates]);

  useEffect(() => {
    if (selectedCities.length > 0) localStorage.setItem("preferredCities", JSON.stringify(selectedCities));
    else localStorage.removeItem("preferredCities");
  }, [selectedCities]);

  // ── Body scroll lock when filters open ──
  useEffect(() => {
    document.body.style.overflow = showFilters ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [showFilters]);

  // ── Auth + saved data ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchSavedTenders(user.id);
        fetchSavedSearches(user.id);
        const { data: profile } = await supabase
          .from("profiles").select("membership_plan").eq("id", user.id).maybeSingle();
        if (profile && profile.membership_plan !== "free") setIsPremium(true);
      }
    });
  }, []);

  async function fetchSavedTenders(userId: string) {
    const { data } = await supabase.from("saved_tenders").select("tender_id").eq("user_id", userId);
    if (data) setSavedTenderIds(new Set(data.map((t) => t.tender_id)));
  }

  async function fetchSavedSearches(userId: string) {
    const { data } = await supabase.from("saved_searches").select("*").eq("user_id", userId);
    if (data) setSavedSearches(data);
  }

  // ── "For You" DB fetch: re-runs whenever saved searches change ──
  useEffect(() => {
    if (!savedSearches.length) { setForYouAllTenders([]); return; }
    setForYouLoading(true);
    queryForYouTenders(savedSearches).then((data) => {
      setForYouAllTenders(data);
      setForYouLoading(false);
    });
  }, [savedSearches]);

  // ── Lazy-load states for filter panel ──
  async function loadStates() {
    if (statesLoaded) return;
    const { data } = await supabase.from("tenders").select("state").not("state", "is", null).limit(5000);
    if (data) {
      const unique = [...new Set(data.map((t: any) => t.state).filter(Boolean))].sort() as string[];
      setStates(unique);
      setStatesLoaded(true);
    }
  }

  // ── Lazy-load ministries ──
  async function loadMinistries() {
    if (ministriesLoaded) return;
    const { data } = await supabase
      .from("tenders")
      .select("ministry_name")
      .gte("end_date", new Date().toISOString())
      .not("ministry_name", "is", null)
      .limit(2000);
    if (data) {
      const unique = [...new Set(data.map((t: any) => t.ministry_name).filter(Boolean))].sort() as string[];
      setMinistries(unique);
      setMinistriesLoaded(true);
    }
  }

  // ── Lazy-load organisations ──
  async function loadOrgs() {
    if (orgsLoaded) return;
    const { data } = await supabase
      .from("tenders")
      .select("organisation_name")
      .gte("end_date", new Date().toISOString())
      .not("organisation_name", "is", null)
      .limit(2000);
    if (data) {
      const unique = [...new Set(data.map((t: any) => t.organisation_name).filter(Boolean))].sort() as string[];
      setOrgs(unique);
      setOrgsLoaded(true);
    }
  }

  // ── Load cities when states selected ──
  useEffect(() => {
    if (!statesLoaded) return;
    if (selectedStates.length === 0) {
      setCities([]);
      return;
    }
    supabase.from("tenders").select("city")
      .in("state", selectedStates).not("city", "is", null).limit(2000)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((t: any) => t.city).filter(Boolean))].sort() as string[];
          setCities(unique);
        }
      });
  }, [selectedStates, statesLoaded]);

  // ── Core: re-fetch when filters change (debounced, skip first render) ──
  const currentFilters = useCallback((): Filters => ({
    q: searchQuery,
    states: selectedStates,
    cities: selectedCities,
    ministries: selectedMinistries,
    orgs: selectedOrgs,
    emdFilter,
    dateFilter,
    msmeOnly,
    miiOnly,
    category: selectedCategory,
    descriptionQuery,
    tab: activeTab,
    sortOrder,
  }), [searchQuery, selectedStates, selectedCities, selectedMinistries, selectedOrgs, emdFilter, dateFilter, msmeOnly, miiOnly, selectedCategory, descriptionQuery, activeTab, sortOrder]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Only skip client fetch if SSR already gave us data
      if (initialTenders.length > 0) return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const delay = searchQuery ? 350 : 0; // Debounce text search; instant for toggles

    debounceTimer.current = setTimeout(async () => {
      const seq = ++fetchSeq.current;
      setLoading(true);
      setPage(0);

      const [results, count] = await Promise.all([
        queryTenders(currentFilters(), 0),
        queryTendersCount(currentFilters()),
      ]);

      if (seq !== fetchSeq.current) return; // Discard stale response
      setTenders(results);
      setTotalCount(count);
      setHasMore(results.length === PAGE_SIZE);
      setLoading(false);
    }, delay);

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery, selectedStates, selectedCities, selectedMinistries, selectedOrgs, emdFilter, dateFilter, msmeOnly, miiOnly, selectedCategory, descriptionQuery, activeTab, sortOrder]);

  // ── Load more ──
  async function handleLoadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const results = await queryTenders(currentFilters(), nextPage);
    setTenders((prev) => {
      const existingIds = new Set(prev.map((t: any) => t.id));
      const uniqueResults = results.filter((t: any) => !existingIds.has(t.id));
      return [...prev, ...uniqueResults];
    });
    setPage(nextPage);
    setHasMore(results.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  // ── "For You" matching (precise client-side filter on DB-fetched forYouAllTenders) ──
  const forYouTenders = useMemo(() => {
    if (!savedSearches.length) return [];
    const filtered = forYouAllTenders.filter((tender) =>
      savedSearches.some((search) => {
        const p = search.query_params;
        if (!p) return false;
        let match = true;

        if (p.q) {
           const kws = p.q.split(",").map((k: string) => k.trim()).filter(Boolean);
           if (kws.length && !kws.some((kw: string) => {
             try {
               const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
               return regex.test(tender.title || "") ||
                      regex.test(tender.bid_number || "") ||
                      regex.test(tender.department || "") ||
                      regex.test(tender.ai_summary || "");
             } catch (e) {
               const lowerKw = kw.toLowerCase();
               return tender.title?.toLowerCase().includes(lowerKw) ||
                      tender.bid_number?.toLowerCase().includes(lowerKw) ||
                      tender.department?.toLowerCase().includes(lowerKw) ||
                      tender.ai_summary?.toLowerCase().includes(lowerKw);
             }
           })) match = false;
        }

        const alertStates = p.states || (p.state ? [p.state] : []);
        if (alertStates.length && !alertStates.includes(tender.state)) match = false;

        const alertCities = p.cities || [];
        if (alertCities.length && !alertCities.includes(tender.city)) match = false;

        if (p.category) {
          if (tender.category !== p.category) match = false;
        }

        if (p.msme && !tender.eligibility_msme) match = false;
        if (p.mii  && !tender.eligibility_mii)  match = false;
        return match;
      })
    );
    
    const sorted = [...filtered].sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.created_at || b.start_date || 0).getTime() - new Date(a.created_at || a.start_date || 0).getTime();
      } else {
        return new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime();
      }
    });

    return sorted;
  }, [forYouAllTenders, savedSearches, sortOrder]);

  // ── Display list (For You tab filtering is client-side on current page) ──
  const displayTenders = activeTab === "foryou" ? forYouTenders : tenders;

  // ── Save search ──
  async function handleSaveSearch() {
    if (!user) {
      window.location.href = "/login?callback=" + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    setIsSavingSearch(true);
    const searchName = searchQuery || descriptionQuery
      || (selectedCategory ? CATEGORIES.find((c) => c.id === selectedCategory)?.label : "")
      || "My Tender Alert";

    const { error } = await supabase.from("saved_searches").insert({
      user_id: user.id,
      name: `${searchName} Alert`,
      query_params: { q: searchQuery, states: selectedStates, cities: selectedCities, emd: emdFilter, date: dateFilter, category: selectedCategory, description: descriptionQuery, msme: msmeOnly, mii: miiOnly },
      is_alert_enabled: true,
    });

    if (!error) { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }
    setIsSavingSearch(false);
  }

  // ── Save / unsave tender ──
  async function handleToggleSaveTender(tenderId: string) {
    if (!user) {
      window.location.href = "/login?callback=" + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
    const isSaved = savedTenderIds.has(tenderId);
    if (isSaved) {
      const { error } = await supabase.from("saved_tenders").delete().eq("user_id", user.id).eq("tender_id", tenderId);
      if (!error) { const s = new Set(savedTenderIds); s.delete(tenderId); setSavedTenderIds(s); }
    } else {
      const { error } = await supabase.from("saved_tenders").insert({ user_id: user.id, tender_id: tenderId });
      if (!error) setSavedTenderIds(new Set([...savedTenderIds, tenderId]));
    }
  }

  const hasActiveFilters = selectedStates.length > 0 || selectedCities.length > 0 ||
    selectedMinistries.length > 0 || selectedOrgs.length > 0 ||
    emdFilter !== "all" || dateFilter !== "all" || msmeOnly || miiOnly || selectedCategory || descriptionQuery;

  const activeKeywords = useMemo(() => {
    const set = new Set<string>();
    if (searchQuery.trim()) searchQuery.split(",").forEach((k) => k.trim() && set.add(k.trim()));
    if (descriptionQuery.trim()) descriptionQuery.split(",").forEach((k) => k.trim() && set.add(k.trim()));
    if (activeTab === "foryou") {
      savedSearches.forEach((s) => s.query_params?.q?.split(",").forEach((k: string) => k.trim() && set.add(k.trim())));
    }
    return Array.from(set);
  }, [searchQuery, descriptionQuery, activeTab, savedSearches]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-fresh-sky-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans">
      <main id="main-content" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* ── Hero / Search ── */}
        <div className="mb-4 sm:mb-8 relative z-10 w-full">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:items-end justify-between">
            <div className="flex-1 w-full">
              <div className="flex items-center space-x-2 mb-1.5 sm:mb-3">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500" />
                </span>
                <span className="text-xs sm:text-xs text-blue-600 dark:text-blue-400 font-bold tracking-wide uppercase">Live Updates</span>
              </div>
              <h2 className="font-bricolage text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-1 sm:mb-2">
                Find Your Next Tender
              </h2>

              <div className="mt-2 sm:mt-4 flex flex-row gap-2 sm:gap-3 max-w-3xl w-full">
                <div className="relative flex-1 min-w-0">
                  <label htmlFor="tender-search" className="sr-only">Search tenders by keywords or bid number</label>
                  <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                  <input
                    id="tender-search"
                    type="text"
                    placeholder="Search by keywords, bid number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 pl-9 sm:pl-12 pr-[80px] sm:pr-[120px] text-xs sm:text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-600 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none leading-normal"
                  />
                  <div className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                    {searchQuery && (
                      <button aria-label="Clear Search" onClick={() => setSearchQuery("")} className="text-slate-600 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 p-1 sm:p-1.5 rounded-full transition-colors mr-1 sm:mr-1.5">
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                    <button aria-label="Search" className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center">
                      <span className="hidden sm:inline">Search</span>
                      <Search className="w-3.5 h-3.5 sm:hidden" />
                    </button>
                  </div>
                </div>
                <button
                  aria-label="Toggle Filters"
                  aria-expanded={showFilters}
                  aria-controls="filters-drawer"
                  onClick={() => { setShowFilters(!showFilters); if (!showFilters) loadStates(); }}
                  className={`shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 font-bold text-xs sm:text-sm ${showFilters ? "bg-slate-800 text-white border-slate-800 shadow-md" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"}`}
                >
                  <Filter className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${showFilters ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                  <span className="hidden sm:inline">Filters</span>
                  {!showFilters && hasActiveFilters && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 sm:ml-1" />}
                </button>
              </div>

              {/* ── Row 1: Category chips ── */}
              <div className="mt-3 sm:mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-3xl">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                    !selectedCategory
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span aria-hidden="true">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* ── Row 2: Dimension dropdowns ── */}
              <div className="mt-2 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-3xl">
                <FilterDropdown
                  label="State"
                  items={states}
                  selected={selectedStates}
                  onToggle={(s) => setSelectedStates((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                  onClear={() => { setSelectedStates([]); setSelectedCities([]); }}
                  onOpen={() => { loadStates(); }}
                  loading={!statesLoaded && states.length === 0}
                  searchPlaceholder="Search states…"
                />
                <FilterDropdown
                  label="City"
                  items={cities}
                  selected={selectedCities}
                  onToggle={(c) => setSelectedCities((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}
                  onClear={() => setSelectedCities([])}
                  onOpen={() => { if (selectedStates.length > 0 && !statesLoaded) loadStates(); }}
                  disabled={selectedStates.length === 0}
                  searchPlaceholder="Search cities…"
                />
                <FilterDropdown
                  label="Ministry"
                  items={ministries}
                  selected={selectedMinistries}
                  onToggle={(m) => setSelectedMinistries((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m])}
                  onClear={() => setSelectedMinistries([])}
                  onOpen={loadMinistries}
                  loading={!ministriesLoaded && ministries.length === 0}
                  searchPlaceholder="Search ministries…"
                />
                <FilterDropdown
                  label="Organisation"
                  items={orgs}
                  selected={selectedOrgs}
                  onToggle={(o) => setSelectedOrgs((p) => p.includes(o) ? p.filter((x) => x !== o) : [...p, o])}
                  onClear={() => setSelectedOrgs([])}
                  onOpen={loadOrgs}
                  loading={!orgsLoaded && orgs.length === 0}
                  searchPlaceholder="Search organisations…"
                />
              </div>

              {/* ── Row 3: Quick toggles ── */}
              <div className="mt-2 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-3xl">
                {([
                  { label: "Zero EMD",     active: emdFilter === "free",    onClick: () => setEmdFilter(emdFilter === "free" ? "all" : "free") },
                  { label: "Ending Today", active: dateFilter === "today",   onClick: () => setDateFilter(dateFilter === "today" ? "all" : "today") },
                  { label: "This Week",    active: dateFilter === "week",    onClick: () => setDateFilter(dateFilter === "week" ? "all" : "week") },
                  {
                    label: "MSME",
                    active: msmeOnly,
                    onClick: () => { if (isPremium) setMsmeOnly(!msmeOnly); else window.location.href = user ? "/dashboard/subscriptions" : "/login"; },
                  },
                  {
                    label: "MII",
                    active: miiOnly,
                    onClick: () => { if (isPremium) setMiiOnly(!miiOnly); else window.location.href = user ? "/dashboard/subscriptions" : "/login"; },
                  },
                ] as { label: string; active: boolean; onClick: () => void }[]).map(({ label, active, onClick }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
                      active
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(searchQuery.trim() || hasActiveFilters) && (
                <div className="mt-3 sm:mt-4 flex items-center space-x-3 animate-in fade-in duration-300">
                  <button
                    onClick={handleSaveSearch}
                    disabled={isSavingSearch || saveSuccess}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${saveSuccess ? "bg-green-500 text-white shadow-green-100" : "bg-slate-900 text-white hover:bg-black active:scale-[0.98]"}`}
                  >
                    {isSavingSearch ? <Loader2 className="w-3 h-3 animate-spin" /> : saveSuccess ? <CheckCircle className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                    <span>{saveSuccess ? "Saved!" : "Add to Keywords"}</span>
                  </button>
                  <p className="text-xs sm:text-xs text-slate-600 dark:text-slate-400 hidden sm:block">
                    Get notified when new tenders match these filters.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-slate-200 dark:border-slate-700 w-full">
          <div className="flex flex-nowrap items-center gap-x-4 sm:gap-x-6 overflow-x-auto no-scrollbar pt-1 pb-0 sm:flex-1 sm:pr-2" role="tablist" aria-label="Tender Views">
            <TabButton label="All Active Bids" active={activeTab === "all"} onClick={() => setActiveTab("all")} />

            {user && savedSearches.length > 0 ? (
              <button
                role="tab"
                aria-selected={activeTab === "foryou"}
                onClick={() => setActiveTab("foryou")}
                className={`pb-2 sm:pb-3 text-xs sm:text-sm font-bold flex items-center space-x-1.5 sm:space-x-2 transition-all relative whitespace-nowrap ${activeTab === "foryou" ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === "foryou" ? "text-blue-600" : "text-slate-500 dark:text-slate-400"}`} />
                <span>For You</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-black tracking-widest uppercase ${activeTab === "foryou" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                  {forYouLoading ? "…" : forYouTenders.length}
                </span>
                {activeTab === "foryou" && <div className="absolute bottom-[-8px] sm:bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
              </button>
            ) : (
              <button
                role="tab"
                aria-selected={activeTab === "foryou"}
                onClick={() => { if (!user) window.location.href = "/login"; else window.location.href = "/dashboard/keywords"; }}
                className="group pb-2 sm:pb-3 text-xs sm:text-sm font-bold flex items-center space-x-1.5 sm:space-x-2 transition-all relative text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                <span>For You</span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-black tracking-widest uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors hidden sm:inline-block">
                  + Add Keywords
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 pb-2 pt-1 sm:pl-2 sm:pb-3 sm:pt-1">
            <div className="hidden md:block text-xs font-bold text-slate-500 dark:text-slate-400">
              {loading ? "…" : activeTab === "foryou"
                ? `${forYouTenders.length} results`
                : totalCount !== null
                  ? `${totalCount.toLocaleString()} results`
                  : `${displayTenders.length}${hasMore ? "+" : ""} results`}
            </div>
            <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded font-medium">
              <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Sort by :</span>
              <select
                aria-label="Sort order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "newest" | "ending_soon")}
                className="text-xs sm:text-sm bg-transparent border-none outline-none cursor-pointer text-slate-900 dark:text-slate-100 font-bold p-0"
              >
                <option value="newest">Newest First</option>
                <option value="ending_soon">Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active filter tags ── */}
        {hasActiveFilters && (
          <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1 no-scrollbar min-h-[32px]">
            <div className="flex items-center space-x-2">
              {selectedCategory && (
                <FilterTag label={`Category: ${CATEGORIES.find((c) => c.id === selectedCategory)?.label}`} onRemove={() => setSelectedCategory(null)} />
              )}
              {descriptionQuery && <FilterTag label={`Details: ${descriptionQuery}`} onRemove={() => setDescriptionQuery("")} />}
              {selectedStates.map((st) => (
                <FilterTag key={st} label={st} onRemove={() => { setSelectedStates((p) => p.filter((s) => s !== st)); setSelectedCities([]); }} />
              ))}
              {selectedCities.map((ct) => (
                <FilterTag key={ct} label={ct} onRemove={() => setSelectedCities((p) => p.filter((c) => c !== ct))} />
              ))}
              {selectedMinistries.map((m) => (
                <FilterTag key={m} label={m} onRemove={() => setSelectedMinistries((p) => p.filter((x) => x !== m))} />
              ))}
              {selectedOrgs.map((o) => (
                <FilterTag key={o} label={o} onRemove={() => setSelectedOrgs((p) => p.filter((x) => x !== o))} />
              ))}
              {msmeOnly && <FilterTag label="MSE" onRemove={() => setMsmeOnly(false)} color="indigo" />}
              {miiOnly  && <FilterTag label="MII" onRemove={() => setMiiOnly(false)}  color="indigo" />}
              {emdFilter !== "all" && <FilterTag label={`EMD: ${emdFilter}`} onRemove={() => setEmdFilter("all")} />}
              {dateFilter !== "all" && <FilterTag label={`Date: ${dateFilter}`} onRemove={() => setDateFilter("all")} />}
              <button
                onClick={() => { setSelectedStates([]); setSelectedCities([]); setSelectedMinistries([]); setSelectedOrgs([]); setEmdFilter("all"); setDateFilter("all"); setMsmeOnly(false); setMiiOnly(false); setDescriptionQuery(""); setSelectedCategory(null); }}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-600 transition-colors ml-1 px-2 py-1"
              >
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* ── Filter Drawer ── */}
        {showFilters && (
          <div className="fixed inset-0 z-100 flex justify-end">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer" onClick={() => setShowFilters(false)} aria-hidden="true" />
            <div id="filters-drawer" role="dialog" aria-modal="true" aria-label="Filters" className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Filters</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Refine your tender search</p>
                </div>
                <button aria-label="Close filters" onClick={() => setShowFilters(false)} className="p-2 text-slate-600 hover:text-slate-900 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 transition-all active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* Advanced Search */}
                <div className="space-y-3 relative">
                  <label htmlFor="advanced-search-input" className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">
                    <Zap className="w-3.5 h-3.5 mr-2 text-blue-500" aria-hidden="true" /> Advanced Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                    <input
                      id="advanced-search-input"
                      type="text"
                      disabled={!isPremium}
                      placeholder={isPremium ? "Keywords in AI summary..." : "Premium feature..."}
                      value={descriptionQuery}
                      onChange={(e) => setDescriptionQuery(e.target.value)}
                      className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-100 transition-all outline-none ${!isPremium ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    {!isPremium && (
                      <Link href={user ? "/dashboard/subscriptions" : "/login"} className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded flex items-center hover:bg-amber-200 transition-colors">
                        <Zap className="w-3 h-3 mr-1" /> Unlock
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">Searches deep within technical specifications extracted from PDFs.</p>
                </div>

                {/* State Filter */}
                <fieldset className="space-y-4">
                  <legend className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> State / Location
                  </legend>
                  {!statesLoaded ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button aria-pressed={selectedStates.length === 0} onClick={() => { setSelectedStates([]); setSelectedCities([]); }} className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedStates.length === 0 ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-200"}`}>
                        All States
                      </button>
                      {states.map((state) => (
                        <button
                          key={state}
                          aria-pressed={selectedStates.includes(state)}
                          onClick={() => setSelectedStates((p) => p.includes(state) ? p.filter((s) => s !== state) : [...p, state])}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all truncate text-left ${selectedStates.includes(state) ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-200"}`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>

                {/* City Filter */}
                {cities.length > 0 && (
                  <fieldset className="space-y-4">
                    <legend className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> City
                    </legend>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
                      <button aria-pressed={selectedCities.length === 0} onClick={() => setSelectedCities([])} className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedCities.length === 0 ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-blue-200"}`}>
                        All Cities
                      </button>
                      {cities.map((city) => (
                        <button key={city} aria-pressed={selectedCities.includes(city)} onClick={() => setSelectedCities((p) => p.includes(city) ? p.filter((c) => c !== city) : [...p, city])} className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all truncate text-left ${selectedCities.includes(city) ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-blue-200"}`}>
                          {city}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {/* EMD Filter */}
                <fieldset className="space-y-4">
                  <legend className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">
                    <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" aria-hidden="true" /> EMD Amount
                  </legend>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "All Amounts", value: "all" }, { label: "EMD Free", value: "free" },
                      { label: "Below ₹1 Lakh", value: "<1L" }, { label: "₹1 Lakh – ₹5 Lakh", value: "1-5L" },
                      { label: "Above ₹5 Lakh", value: ">5L" },
                    ].map((o) => (
                      <button key={o.value} aria-pressed={emdFilter === o.value} onClick={() => setEmdFilter(o.value)} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-all border ${emdFilter === o.value ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-blue-200"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Date Filter */}
                <fieldset className="space-y-4">
                  <legend className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Closing Date
                  </legend>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "Anytime", value: "all" }, { label: "Ending Today", value: "today" },
                      { label: "Ending This Week", value: "week" },
                    ].map((o) => (
                      <button key={o.value} aria-pressed={dateFilter === o.value} onClick={() => setDateFilter(o.value)} className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-all border ${dateFilter === o.value ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:border-blue-200"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* Preferences */}
                <fieldset className="space-y-4 pb-10">
                  <legend className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center justify-between w-full">
                    <span className="flex items-center"><Shield className="w-3.5 h-3.5 mr-2" aria-hidden="true" /> Preferences</span>
                    {!isPremium && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold">PREMIUM</span>}
                  </legend>
                  <div className="space-y-3 relative">
                    {!isPremium && (
                      <div className="absolute inset-0 z-10 bg-white/40 dark:bg-slate-900/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                        <Link href={user ? "/dashboard/subscriptions" : "/login"} className="bg-amber-500 text-white shadow-lg text-xs font-bold px-4 py-2 rounded-lg flex items-center hover:bg-amber-600 transition-colors">
                          <Zap className="w-3.5 h-3.5 mr-1.5" /> Unlock Advanced Filters
                        </Link>
                      </div>
                    )}
                    <ToggleButton label="MSME Eligibility Only" checked={msmeOnly} onChange={(v) => isPremium && setMsmeOnly(v)} color="blue" />
                    <ToggleButton label="MII Preference Only"   checked={miiOnly}  onChange={(v) => isPremium && setMiiOnly(v)}  color="amber" />
                  </div>
                </fieldset>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-slate-500 font-medium">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{loading ? "…" : displayTenders.length}</span> results found
                  </span>
                  <button onClick={() => { setSelectedStates([]); setSelectedCities([]); setSelectedMinistries([]); setSelectedOrgs([]); setEmdFilter("all"); setDateFilter("all"); setMsmeOnly(false); setMiiOnly(false); setDescriptionQuery(""); setSelectedCategory(null); }} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700">
                    Reset All
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => setShowFilters(false)} className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-bold text-sm shadow-xl active:scale-[0.98] transition-all">
                    Show {loading ? "…" : displayTenders.length} Bids
                  </button>
                  <button onClick={handleSaveSearch} disabled={isSavingSearch || saveSuccess} className={`w-full py-4 flex items-center justify-center space-x-2 rounded-2xl font-bold text-sm transition-all border-2 ${saveSuccess ? "bg-green-500 border-green-500 text-white" : "bg-white dark:bg-slate-800 border-blue-600 dark:border-blue-500 text-blue-600 hover:bg-blue-50 active:scale-[0.98]"}`}>
                    {isSavingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    <span>{saveSuccess ? "Saved!" : "Add to Keywords"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tender Grid ── */}
        {loading ? (
          <div role="table" aria-label="Loading Tenders" className="w-full">
            <div role="rowgroup" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div role="row" aria-busy="true" key={i} className="h-72 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-slate-100 dark:border-slate-700">
                  <div role="cell" className="sr-only">Loading...</div>
                </div>
              ))}
            </div>
          </div>
        ) : displayTenders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400">No matching tenders found.</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            <table role="table" className="w-full block" aria-label="Tenders List">
              <thead className="sr-only block">
                <tr className="block">
                  <th scope="col" className="block">Title & Summary</th>
                  <th scope="col" className="block">Department</th>
                  <th scope="col" className="block">Location & ID</th>
                  <th scope="col" className="block">Dates & EMD</th>
                  <th scope="col" className="block">Actions</th>
                </tr>
              </thead>
              <tbody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                {displayTenders.map((tender) => (
                  <TenderCard
                    key={tender.id}
                    tender={tender}
                    setSearchQuery={setSearchQuery}
                    setSelectedStates={setSelectedStates}
                    isSaved={savedTenderIds.has(tender.id)}
                    onToggleSave={() => handleToggleSaveTender(tender.id)}
                    highlightTerms={activeKeywords}
                  />
                ))}
              </tbody>
            </table>

            {hasMore && activeTab !== "foryou" && (
              <div className="mt-8 mb-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 px-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none flex items-center space-x-2 disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <RefreshCw className="w-4 h-4 text-slate-600" />}
                  <span>
                    {loadingMore
                      ? "Loading…"
                      : totalCount !== null && totalCount > displayTenders.length
                        ? `Load More Tenders (${(totalCount - displayTenders.length).toLocaleString()} remaining)`
                        : "Load More Tenders"}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────
function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={`pb-2 sm:pb-3 text-xs sm:text-sm font-bold transition-all relative whitespace-nowrap ${active ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}>
      {label}
      {active && <div className="absolute bottom-[-8px] sm:bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />}
    </button>
  );
}

function FilterTag({ label, onRemove, color = "blue" }: { label: string; onRemove: () => void; color?: "blue" | "indigo" }) {
  const cls = color === "indigo"
    ? "bg-indigo-50 text-indigo-600 border-indigo-100"
    : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800";
  return (
    <button aria-label={`Remove filter ${label}`} onClick={onRemove} className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap ${cls}`}>
      <span>{label}</span>
      <X className="w-3 h-3" />
    </button>
  );
}

function ToggleButton({ label, checked, onChange, color }: { label: string; checked: boolean; onChange: (v: boolean) => void; color: "blue" | "amber" }) {
  const trackOn = color === "amber" ? "bg-amber-500" : "bg-blue-600";
  const bgOn    = color === "amber" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800" : "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700";
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${checked ? bgOn : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200"}`}>
      <span id={`toggle-label-${label.replace(/\s+/g, '-').toLowerCase()}`} className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
      <div className={`w-10 h-6 rounded-full p-1 transition-all ${checked ? trackOn : "bg-slate-200 dark:bg-slate-700"}`}>
        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </button>
  );
}

// ─── Highlighted text ─────────────────────────────────────────────────────────
function HighlightedText({ text, highlightTerms }: { text: string; highlightTerms: string[] }) {
  if (!text || !highlightTerms.length) return <>{text}</>;
  const valid = highlightTerms.filter((t) => t.trim().length > 0);
  if (!valid.length) return <>{text}</>;

  const regex = new RegExp(
    `(${valid.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})`,
    "gi"
  );
  return (
    <>
      {text.split(regex).map((part, i) =>
        valid.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-slate-900 dark:text-slate-100 rounded-[2px] px-[2px] font-bold shadow-[0_0_2px_rgba(0,0,0,0.1)]">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Tender Card ──────────────────────────────────────────────────────────────
function TenderCard({
  tender, setSearchQuery, setSelectedStates, isSaved, onToggleSave, highlightTerms = [],
}: {
  tender: any;
  setSearchQuery: (q: string) => void;
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>;
  isSaved: boolean;
  onToggleSave: () => void;
  highlightTerms?: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosingSoon, setIsClosingSoon] = useState(false);
  const isFallbackDate = tender.start_date === tender.end_date;

  useEffect(() => {
    setIsClosingSoon(!isFallbackDate && (new Date(tender.end_date).getTime() - Date.now() < 86400000));
  }, [isFallbackDate, tender.end_date]);
  const formattedEMD   = tender.emd_amount === 0
    ? "No EMD"
    : tender.emd_amount
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "Not Specified";

  const bidId = tender.bid_number?.replace(/\//g, "/");
  const departmentDisplay = formatDepartmentInfo(tender.ministry_name, tender.department_name || tender.department, tender.organisation_name);
  const category = (tender.category ? getCategoryById(tender.category) : null) ?? getCategory(tender.title, tender.ai_summary);

  let displayInsight = tender.ai_summary;
  let hasValidInsight = !!tender.ai_summary;
  try {
    if (tender.ai_summary && tender.ai_summary.startsWith('{')) {
      const parsed = JSON.parse(tender.ai_summary);
      if (parsed.ai_insight) {
        displayInsight = parsed.ai_insight;
      } else {
        hasValidInsight = false; // Hide the insight box if it's JSON but no insight generated yet
      }
    }
  } catch(e) { /* fallback to old raw string */ }
  // Suppress insight if empty, too long, or contains Devanagari/Hindi script
  if (!displayInsight || displayInsight.trim().length === 0 || displayInsight.length > 400 || /[\u0900-\u097F]/.test(displayInsight)) {
    hasValidInsight = false;
  }

  const formatDate = (d: string) => {
    if (!d) return "N/A";
    let date = new Date(d);
    if (isNaN(date.getTime()) && typeof d === "string") {
      const parts = d.split("-");
      if (parts.length === 3 && parts[0].length <= 2) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      }
    }
    return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <tr role="row" className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md flex flex-col h-full relative overflow-hidden">

      {/* Title */}
      <td role="cell" className="mb-2 w-full">
        <Link href={`/bids/${encodeURIComponent(tender.slug || "")}`} className="hover:no-underline group/title focus:outline-none">
          <h3 className={`text-sm sm:text-[15px] font-medium text-slate-800 dark:text-slate-200 leading-snug transition-colors group-hover/title:text-blue-700 dark:group-hover/title:text-blue-300 after:absolute after:inset-0 after:z-0 ${isExpanded ? "" : "line-clamp-2"}`}>
            <HighlightedText text={tender.title} highlightTerms={highlightTerms} />
          </h3>
        </Link>
        {tender.title && tender.title.length > 60 && (
          <div className="flex items-center space-x-2 mt-1 relative z-10">
            <button aria-expanded={isExpanded} aria-label={isExpanded ? "Show less title" : "Show more title"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              {isExpanded ? "Show less" : "Show more"}
            </button>
            {category && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>{category.icon}</span><span>{category.label}</span>
              </span>
            )}
          </div>
        )}
        {tender.title && tender.title.length <= 60 && category && (
          <div className="flex items-center space-x-2 mt-1 relative z-10">
            <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>{category.icon}</span><span>{category.label}</span>
            </span>
          </div>
        )}
      </td>

      {/* Department */}
      <td role="cell" className="mb-3 relative z-20 w-full">
        <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 leading-tight">
          {departmentDisplay.split(", ").filter(Boolean).map((part, idx, arr) => (
            <span key={idx} className="flex items-center">
              <button aria-label={`Search for ${part}`} onClick={(e) => { e.stopPropagation(); setSearchQuery(part); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-blue-600 hover:underline transition-colors text-left py-1">
                {part}
              </button>
              {idx < arr.length - 1 && <span className="ml-1 text-slate-300 dark:text-slate-600">,</span>}
            </span>
          ))}
        </div>
      </td>

      {/* AI Insight */}
      {hasValidInsight && (
        <td role="cell" className="mb-3 p-2 sm:p-2.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-50 dark:border-blue-900 relative z-10 w-full">
          <div className="flex items-center space-x-1 mb-1 opacity-60">
            <Zap className="w-2.5 h-2.5 text-blue-500" />
            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">AI Insight</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed italic">
            "<HighlightedText text={displayInsight} highlightTerms={highlightTerms} />"
          </p>
        </td>
      )}

      {/* Location & Bid ID */}
      <td role="cell" className="flex items-center justify-between mb-3 relative z-20 w-full">
        <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 space-x-1.5 min-w-0">
          <MapPin className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
          <div className="flex items-center truncate">
            {tender.city && (
              <>
                <button aria-label={`Search for city ${tender.city}`} onClick={(e) => { e.stopPropagation(); setSearchQuery(tender.city); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-blue-600 hover:underline transition-colors truncate">
                  {tender.city}
                </button>
                {tender.state && <span className="mx-1">,</span>}
              </>
            )}
            {tender.state && (
              <button aria-label={`Filter by state ${tender.state}`} onClick={(e) => { e.stopPropagation(); setSelectedStates([tender.state]); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-blue-600 hover:underline transition-colors truncate">
                {tender.state}
              </button>
            )}
            {!tender.city && !tender.state && <span className="truncate">{tender.location || "N/A"}</span>}
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {tender.eligibility_msme && <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800" title="MSE Preferred">MSE</span>}
          {tender.eligibility_mii  && <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded border border-amber-100 dark:border-amber-800" title="MII Preferred">MII</span>}
          <span className="text-xs font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">GeM</span>
        </div>
      </td>

      {/* 4: EMD & Dates */}
      <td role="cell" className="grid grid-cols-3 gap-2 py-2 sm:py-2.5 border-y border-slate-100 dark:border-slate-700 mb-4 bg-slate-50 dark:bg-slate-800 -mx-4 px-4 relative z-10 pointer-events-none mt-auto w-full">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">EMD Amount</span>
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{formattedEMD}</span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Start Date</span>
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
            {isFallbackDate ? "Pending" : (tender.start_date ? formatDate(tender.start_date) : "N/A")}
          </span>
        </div>
        <div className="flex flex-col items-end border-l border-slate-200 dark:border-slate-700 pl-1">
          <div className="flex items-center space-x-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Close Date</span>
          </div>
          <span className={`text-[13px] font-medium ${isClosingSoon ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {isFallbackDate ? "Pending" : formatDate(tender.end_date)}
          </span>
        </div>
      </td>

      {/* 5: Actions */}
      <td role="cell" className="flex gap-2 items-center relative z-20 mt-auto w-full">
        <Link
          href={`/bids/${encodeURIComponent(tender.slug || '')}`}
          className="flex-1 h-10 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold flex items-center justify-center transition-all hover:bg-blue-100 dark:hover:bg-blue-800/30 active:scale-[0.98]"
        >
          View Full Details
        </Link>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({
                title: tender.title,
                url: `${window.location.origin}/bids/${encodeURIComponent(tender.slug || '')}`
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(`${window.location.origin}/bids/${encodeURIComponent(tender.slug || '')}`);
              alert("Link copied to clipboard!");
            }
          }}
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all active:scale-[0.98]"
          title="Share"
          aria-label={`Share ${tender.title}`}
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center transition-all active:scale-[0.98] ${isSaved ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300'}`}
          title={isSaved ? "Saved" : "Save tender"}
          aria-label={isSaved ? `Unsave ${tender.title}` : `Save ${tender.title}`}
          aria-pressed={isSaved}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current text-blue-600 dark:text-blue-400" : ""}`} />
        </button>
      </td>
    </tr>
  );
}

// ─── FilterDropdown ────────────────────────────────────────────────────────────
function FilterDropdown({
  label,
  items,
  selected,
  onToggle,
  onClear,
  onOpen,
  loading = false,
  disabled = false,
  searchPlaceholder = "Search…",
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onClear: () => void;
  onOpen?: () => void;
  loading?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    if (!open) onOpen?.();
    setOpen((v) => !v);
    setQuery("");
  }

  const filtered = query.trim()
    ? items.filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  const isActive = selected.length > 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={handleOpen}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
            : isActive
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800"
        }`}
      >
        <span>{isActive ? `${label} (${selected.length})` : label}</span>
        {isActive
          ? <X className="w-3 h-3" onClick={(e) => { e.stopPropagation(); onClear(); }} />
          : <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        }
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No results</div>
            ) : (
              filtered.map((item) => {
                const checked = selected.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => onToggle(item)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      checked ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold" : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${
                      checked ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600"
                    }`}>
                      {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    <span className="truncate">{item}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {selected.length > 0 && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => { onClear(); setOpen(false); }}
                className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Clear {label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
