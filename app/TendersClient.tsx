"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Download, Clock, Zap, FileText, Bookmark, Info, RefreshCw,
  X, ChevronDown, Bell, CheckCircle, Loader2, Share2, MapPin
} from "lucide-react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 21;
const COLUMNS =
  "id,title,bid_number,ra_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug";

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

// Build OR clause — identical to queryTenders so contextual counts match main results
function buildSearchOrClause(q: string): string {
  const terms = q.split(",").map((s) => s.trim()).filter(Boolean);
  return terms.map((term) =>
    `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
  ).join(",");
}

function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = isNAValue(org) ? "" : (org || "");

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

  if (orgStr) {
    const orgNorm = orgStr.toLowerCase().replace(/\s+/g, " ").trim();
    const mNorm = ministryStr.toLowerCase();
    const dNorm = deptStr.toLowerCase();
    if (
      dNorm.includes(orgNorm) ||
      mNorm.includes(orgNorm) ||
      orgNorm.includes(mNorm) ||
      (mNorm && dNorm && orgNorm.includes(mNorm) && orgNorm.includes(dNorm))
    ) {
      orgStr = "";
    }
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
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
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

  // Collect all unique keywords across all saved searches
  const allKeywords: string[] = [];
  searches.forEach(search => {
    const q = search.query_params?.q;
    if (q) {
      q.split(",").map((k: string) => k.trim()).filter(Boolean)
        .forEach((kw: string) => allKeywords.push(kw));
    }
  });
  const uniqueKeywords = [...new Set(allKeywords)];

  if (!uniqueKeywords.length) return [];

  // Use ONLY title in the DB query to keep the OR clause short (avoids URL length limits).
  // All field matching (org, ministry, ai_summary, etc.) is done client-side in forYouTenders.
  const orString = uniqueKeywords.map(kw => `title.ilike.%${kw}%`).join(",");

  const { data, error } = await supabase
    .from("tenders")
    .select(COLUMNS)
    .gte("end_date", new Date().toISOString())
    .or(orString)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) console.error("[ForYou] query error:", error);
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
      `title.ilike.%${term}%,bid_number.ilike.%${term}%,ra_number.ilike.%${term}%,department.ilike.%${term}%,ministry_name.ilike.%${term}%,organisation_name.ilike.%${term}%,state.ilike.%${term}%,city.ilike.%${term}%,ai_summary.ilike.%${term}%`
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
  const [activeCount, setActiveCount]           = useState<number | null>(initialTotalCount ?? null);
  const [archivedCount, setArchivedCount]       = useState<number | null>(null);
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

  // ── User / auth state ──
  const [user, setUser]                     = useState<any>(null);
  const [isPremium, setIsPremium]           = useState(false);
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches]   = useState<any[]>([]);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSuccess, setSaveSuccess]       = useState(false);

  // ── Filter panel state ──
  const [states, setStates]             = useState<Array<{label:string;value:string;count:number}>>([]);
  const [cities, setCities]             = useState<Array<{label:string;value:string;count:number}>>([]);
  const [statesLoaded, setStatesLoaded] = useState(false);

  // ── Ministry / Organisation filter state ──
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [selectedOrgs, setSelectedOrgs]             = useState<string[]>([]);
  const [ministries, setMinistries]                 = useState<Array<{label:string;value:string;count:number}>>([]);
  const [orgs, setOrgs]                             = useState<Array<{label:string;value:string;count:number}>>([]);
  const [ministriesLoaded, setMinistriesLoaded]     = useState(false);
  const [orgsLoaded, setOrgsLoaded]                 = useState(false);

  // ── Contextual filter options (filtered by active search query) ──
  const [contextualStates, setContextualStates]         = useState<Array<{label:string;value:string;count:number}>>([]);
  const [contextualMinistries, setContextualMinistries] = useState<Array<{label:string;value:string;count:number}>>([]);
  const [contextualOrgs, setContextualOrgs]             = useState<Array<{label:string;value:string;count:number}>>([]);
  const [contextualLoading, setContextualLoading]       = useState(false);

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

    const tab = searchParams.get("tab");
    if (tab === "foryou" || tab === "all" || tab === "archived") setActiveTab(tab);

    const sort = searchParams.get("sort");
    if (sort === "newest" || sort === "ending_soon") setSortOrder(sort);

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

  // ── Helper: row array → sorted counted items ──
  function toCounted(rows: any[], key: string) {
    const map: Record<string, number> = {};
    rows.forEach((r) => { const v = r[key]; if (v) map[v] = (map[v] || 0) + 1; });
    return Object.entries(map)
      .map(([v, c]) => ({ label: v, value: v, count: c }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // ── Lazy-load states for filter panel ──
  async function loadStates() {
    if (statesLoaded) return;
    const { data } = await supabase.from("tenders").select("state")
      .gte("end_date", new Date().toISOString()).not("state", "is", null).limit(10000);
    if (data) { setStates(toCounted(data, "state")); setStatesLoaded(true); }
  }

  // ── Lazy-load ministries ──
  async function loadMinistries() {
    if (ministriesLoaded) return;
    const { data } = await supabase.from("tenders").select("ministry_name")
      .gte("end_date", new Date().toISOString()).not("ministry_name", "is", null).limit(10000);
    if (data) { setMinistries(toCounted(data, "ministry_name")); setMinistriesLoaded(true); }
  }

  // ── Lazy-load organisations ──
  async function loadOrgs() {
    if (orgsLoaded) return;
    const { data } = await supabase.from("tenders").select("organisation_name")
      .gte("end_date", new Date().toISOString()).not("organisation_name", "is", null).limit(10000);
    if (data) { setOrgs(toCounted(data, "organisation_name")); setOrgsLoaded(true); }
  }

  // ── Contextual filter options cache ──
  const contextualQueryCache = useRef("");

  // ── Load cities when states selected ──
  useEffect(() => {
    // Auto-load states list if states were pre-selected (URL / localStorage)
    if (selectedStates.length > 0 && !statesLoaded) { loadStates(); return; }
    if (!statesLoaded) return;
    if (selectedStates.length === 0) {
      setCities([]);
      return;
    }
    supabase.from("tenders").select("city")
      .gte("end_date", new Date().toISOString())
      .in("state", selectedStates).not("city", "is", null).limit(10000)
      .then(({ data }) => {
        if (data) setCities(toCounted(data, "city"));
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

    // Clear contextual data immediately when search query changes
    const q = searchQuery.trim();
    if (q !== contextualQueryCache.current) {
      contextualQueryCache.current = "";
      setContextualStates([]);
      setContextualMinistries([]);
      setContextualOrgs([]);
      setContextualLoading(!!q);
    }

    debounceTimer.current = setTimeout(async () => {
      const seq = ++fetchSeq.current;
      setLoading(true);
      setPage(0);

      // Fetch contextual filter options in parallel with main results
      const needContextual = !!q && contextualQueryCache.current !== q;
      const ctxPromise = needContextual
        ? supabase.from("tenders")
            .select("state, ministry_name, organisation_name")
            .gte("end_date", new Date().toISOString())
            .or(buildSearchOrClause(q))
            .order("created_at", { ascending: false })
            .limit(1000)
        : Promise.resolve(null);

      const f = currentFilters();
      const [results, count, countArchived, ctxResult] = await Promise.all([
        queryTenders(f, 0),
        queryTendersCount({ ...f, tab: "all" }),
        queryTendersCount({ ...f, tab: "archived" }),
        ctxPromise,
      ]);

      if (seq !== fetchSeq.current) return; // Discard stale response
      setTenders(results);
      setTotalCount(count);
      setActiveCount(count);
      setArchivedCount(countArchived);
      setHasMore(results.length === PAGE_SIZE);
      setLoading(false);

      if (needContextual && ctxResult) {
        const { data } = ctxResult as any;
        if (data) {
          contextualQueryCache.current = q;
          setContextualStates(toCounted(data, "state"));
          setContextualMinistries(toCounted(data, "ministry_name"));
          setContextualOrgs(toCounted(data, "organisation_name"));
        }
        setContextualLoading(false);
      }
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
             const kwLower = kw.toLowerCase();
             return (tender.title || "").toLowerCase().includes(kwLower) ||
                    (tender.bid_number || "").toLowerCase().includes(kwLower) ||
                    (tender.department || "").toLowerCase().includes(kwLower) ||
                    (tender.organisation_name || "").toLowerCase().includes(kwLower) ||
                    (tender.ministry_name || "").toLowerCase().includes(kwLower) ||
                    (tender.ai_summary || "").toLowerCase().includes(kwLower);
           })) match = false;
        }

        // Strict location filter — must match saved state/city exactly.
        // Tenders without state/city won't show until enriched by the backfill script.
        const alertStates = p.states || (p.state ? [p.state] : []);
        if (alertStates.length && tender.state) {
          // If state is known, it MUST match one of the alert states.
          // If state is unknown, we include it as a potential match (don't set match to false).
          if (!alertStates.some((s: string) => s.toLowerCase() === tender.state.toLowerCase())) match = false;
        }

        const alertCities = p.cities || [];
        if (alertCities.length && tender.city) {
          // If city is known, it MUST match one of the alert cities.
          if (!alertCities.some((c: string) => c.toLowerCase() === tender.city.toLowerCase())) match = false;
        }

        if (p.category) {
          if (getCategory(tender.title, tender.ai_summary)?.id !== p.category) match = false;
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

        {/* ── Hero ── */}
        <div className="mb-4 sm:mb-6">
          {/* Live indicator + heading */}
          <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500" />
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-bold tracking-wide uppercase">Live Updates</span>
          </div>
          <h2 className="font-bricolage text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-3 sm:mb-4">
            Find Your Next Tender
          </h2>

          {/* Search bar */}
          <div className="relative max-w-3xl">
            <label htmlFor="tender-search" className="sr-only">Search tenders by keywords or bid number</label>
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 pointer-events-none" aria-hidden="true" />
            <input
              id="tender-search"
              type="text"
              placeholder="Search by keywords, bid number, ministry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  setSearchQuery((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 sm:py-3.5 pl-9 sm:pl-12 pr-10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Inline filter bar */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-3xl">
            <FilterDropdown
              label="State"
              items={(() => {
                if (!searchQuery.trim()) return states;
                if (contextualLoading) return [];
                // Use contextual results when available; fall back to global list
                const base = contextualStates.length > 0 ? contextualStates : states;
                const merged = [...base];
                selectedStates.forEach((s) => { if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: 0 }); });
                return merged;
              })()}
              selected={selectedStates}
              mode="multi"
              onToggle={(v) => setSelectedStates((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
              onClear={() => { setSelectedStates([]); setSelectedCities([]); }}
              onOpen={() => { loadStates(); }}
              loading={searchQuery.trim() ? contextualLoading : (!statesLoaded && states.length === 0)}
              searchPlaceholder="Search states…"
            />
            <FilterDropdown
              label="City"
              items={cities}
              selected={selectedCities}
              mode="multi"
              onToggle={(v) => setSelectedCities((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
              onClear={() => setSelectedCities([])}
              disabled={selectedStates.length === 0}
              searchPlaceholder="Search cities…"
            />
            <FilterDropdown
              label="Ministry"
              items={(() => {
                if (!searchQuery.trim()) return ministries;
                if (contextualLoading) return [];
                const base = contextualMinistries.length > 0 ? contextualMinistries : ministries;
                const merged = [...base];
                selectedMinistries.forEach((s) => { if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: 0 }); });
                return merged;
              })()}
              selected={selectedMinistries}
              mode="multi"
              onToggle={(v) => setSelectedMinistries((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
              onClear={() => setSelectedMinistries([])}
              onOpen={() => { loadMinistries(); }}
              loading={searchQuery.trim() ? contextualLoading : (!ministriesLoaded && ministries.length === 0)}
              searchPlaceholder="Search ministries…"
            />
            <FilterDropdown
              label="Organisation"
              items={(() => {
                if (!searchQuery.trim()) return orgs;
                if (contextualLoading) return [];
                const base = contextualOrgs.length > 0 ? contextualOrgs : orgs;
                const merged = [...base];
                selectedOrgs.forEach((s) => { if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: 0 }); });
                return merged;
              })()}
              selected={selectedOrgs}
              mode="multi"
              onToggle={(v) => setSelectedOrgs((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v])}
              onClear={() => setSelectedOrgs([])}
              onOpen={() => { loadOrgs(); }}
              loading={searchQuery.trim() ? contextualLoading : (!orgsLoaded && orgs.length === 0)}
              searchPlaceholder="Search organisations…"
            />
            <FilterDropdown
              label="Category"
              items={CATEGORIES.map((c) => ({ label: `${c.icon} ${c.label}`, value: c.id }))}
              selected={selectedCategory ? [selectedCategory] : []}
              mode="single"
              onSelect={(v) => setSelectedCategory(selectedCategory === v ? null : v)}
              onClear={() => setSelectedCategory(null)}
              searchable={false}
            />
            <FilterDropdown
              label="EMD"
              items={[
                { label: "EMD Free",        value: "free" },
                { label: "Below ₹1 Lakh",   value: "<1L"  },
                { label: "₹1 Lakh – ₹5 Lakh", value: "1-5L" },
                { label: "Above ₹5 Lakh",   value: ">5L"  },
              ]}
              selected={emdFilter !== "all" ? [emdFilter] : []}
              mode="single"
              onSelect={(v) => setEmdFilter(emdFilter === v ? "all" : v)}
              onClear={() => setEmdFilter("all")}
              searchable={false}
            />
            <FilterDropdown
              label="Closing"
              items={[
                { label: "Ending Today", value: "today" },
                { label: "This Week",    value: "week"  },
              ]}
              selected={dateFilter !== "all" ? [dateFilter] : []}
              mode="single"
              onSelect={(v) => setDateFilter(dateFilter === v ? "all" : v)}
              onClear={() => setDateFilter("all")}
              searchable={false}
            />
            {/* MSME / MII toggles */}
            <TogglePill
              label="MSME"
              active={msmeOnly}
              onClick={() => { if (isPremium) setMsmeOnly(!msmeOnly); else window.location.href = user ? "/dashboard/subscriptions" : "/login"; }}
            />
            <TogglePill
              label="MII"
              active={miiOnly}
              onClick={() => { if (isPremium) setMiiOnly(!miiOnly); else window.location.href = user ? "/dashboard/subscriptions" : "/login"; }}
            />
          </div>

          {/* Save search — shown when query or filters are active */}
          {(searchQuery.trim() || hasActiveFilters) && (
            <div className="mt-3 flex items-center gap-3 animate-in fade-in duration-200">
              <button
                onClick={handleSaveSearch}
                disabled={isSavingSearch || saveSuccess}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${saveSuccess ? "bg-green-500 text-white" : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-black dark:hover:bg-white active:scale-[0.98]"}`}
              >
                {isSavingSearch ? <Loader2 className="w-3 h-3 animate-spin" /> : saveSuccess ? <CheckCircle className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                <span>{saveSuccess ? "Saved!" : "Add to Keywords"}</span>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">Get notified when new tenders match.</span>
            </div>
          )}
        </div>

        {/* ── Main layout: sidebar + content ── */}
        <div className="flex gap-6 items-start">

          {/* ── Left sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-1 w-40 shrink-0 sticky top-20">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-1">View</p>
            {(["all", "archived"] as const).map((tab) => {
              const cnt = tab === "all" ? activeCount : archivedCount;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left w-full ${
                    activeTab === tab
                      ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {tab === "all"      && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                    {tab === "archived" && <Clock className="w-3.5 h-3.5 shrink-0" />}
                    {tab === "all" ? "Active Bids" : "Archived Bids"}
                  </span>
                  {loading ? (
                    <span className="text-[10px] opacity-60">…</span>
                  ) : (cnt !== null || tab === 'all') ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                      {(cnt ?? (tab === 'all' ? tenders.length : 0)).toLocaleString()}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </aside>

          {/* ── Right: tabs + grid ── */}
          <div className="flex-1 min-w-0">

        {/* ── Tabs ── */}
        <div className="mb-4 border-b border-slate-200 dark:border-slate-700 w-full">
          {/* Row 1: Active/Archived toggle */}
          <div className="flex items-center pt-1 pb-2 lg:hidden">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-0.5 text-xs font-bold" role="tablist" aria-label="Tender Views">
              <button
                role="tab"
                aria-selected={activeTab === "all" || activeTab === "foryou"}
                onClick={() => setActiveTab("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${activeTab !== "archived" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                Active Bids
                {activeCount !== null && !loading && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                    {activeCount.toLocaleString()}
                  </span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "archived"}
                onClick={() => setActiveTab("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${activeTab === "archived" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                Archived Bids
                {archivedCount !== null && !loading && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {archivedCount.toLocaleString()}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: For You + Sort by */}
          <div className="flex flex-row items-center justify-between pt-1 pb-2">
            {user && savedSearches.length > 0 ? (
              <button
                role="tab"
                aria-selected={activeTab === "foryou"}
                onClick={() => setActiveTab("foryou")}
                className={`text-xs sm:text-sm font-bold flex items-center space-x-1.5 sm:space-x-2 transition-all relative whitespace-nowrap ${activeTab === "foryou" ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === "foryou" ? "text-blue-600" : "text-slate-500 dark:text-slate-400"}`} />
                <span>For You</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-black tracking-widest uppercase ${activeTab === "foryou" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                  {forYouLoading ? "…" : forYouTenders.length}
                </span>
              </button>
            ) : (
              <button
                role="tab"
                aria-selected={false}
                onClick={() => { if (!user) window.location.href = "/login"; else window.location.href = "/dashboard/keywords"; }}
                className="group text-xs sm:text-sm font-bold flex items-center space-x-1.5 sm:space-x-2 transition-all relative text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
                <span>For You</span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-black tracking-widest uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors hidden sm:inline-block">
                  + Add Keywords
                </span>
              </button>
            )}

            <div className="flex items-center space-x-3 shrink-0">
              <div className="hidden md:block text-xs font-bold text-slate-500 dark:text-slate-400">
                {loading ? "…" : activeTab === "foryou"
                  ? `${forYouTenders.length} results`
                  : activeTab === "archived"
                    ? `${(archivedCount ?? displayTenders.length).toLocaleString()}${hasMore ? "+" : ""} results`
                    : `${(activeCount ?? displayTenders.length).toLocaleString()}${hasMore ? "+" : ""} results`}
              </div>
              <div className="flex items-center space-x-2 font-medium">
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


        {/* ── Tender Grid ── */}
        {loading || (activeTab === "foryou" && forYouLoading) ? (
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
              {activeTab === "foryou" ? <Zap className="w-7 h-7 text-slate-300 dark:text-slate-600" /> : <Search className="w-7 h-7 text-slate-300 dark:text-slate-600" />}
            </div>
            {activeTab === "foryou" ? (
              <>
                <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400">No matching tenders yet.</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">New tenders matching your keywords will appear here automatically.</p>
                <Link href="/dashboard/keywords" className="mt-4 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Update Keywords →</Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400">No matching tenders found.</h3>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Try adjusting your filters or search terms.</p>
              </>
            )}
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
          </div>{/* end right column */}
        </div>{/* end sidebar+content flex */}
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
          {tender.ra_number && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-800 cursor-help"
              title={`This bid moved to Reverse Auction\nRA No: ${tender.ra_number}\nClick to search by RA number`}
              onClick={(e) => { e.stopPropagation(); setSearchQuery(tender.ra_number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Reverse Auction ↗
            </span>
          )}
          <span className="text-xs font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">GeM</span>
        </div>
      </td>

      {/* 4: EMD & Dates */}
      <td role="cell" className="grid grid-cols-3 gap-2 py-2 sm:py-2.5 border-y border-slate-100 dark:border-slate-700 mb-4 bg-slate-50 dark:bg-slate-800 -mx-4 px-4 relative z-10 pointer-events-none mt-auto w-full">
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">EMD Amount</span>
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 truncate">{formattedEMD}</span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Start Date</span>
          <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
            {isFallbackDate ? "Pending" : (tender.start_date ? formatDate(tender.start_date) : "N/A")}
          </span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200 dark:border-slate-700">
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
type FDItem = string | { label: string; value: string; count?: number };

function fdValue(item: FDItem) { return typeof item === "string" ? item : item.value; }
function fdLabel(item: FDItem) { return typeof item === "string" ? item : item.label; }
function fdCount(item: FDItem) { return typeof item === "string" ? undefined : item.count; }

function FilterDropdown({
  label,
  items,
  selected,
  mode = "multi",
  onToggle,
  onSelect,
  onClear,
  onOpen,
  loading = false,
  disabled = false,
  searchable = true,
  searchPlaceholder = "Search…",
}: {
  label: string;
  items: FDItem[];
  selected: string[];
  mode?: "multi" | "single";
  onToggle?: (v: string) => void;
  onSelect?: (v: string) => void;
  onClear: () => void;
  onOpen?: () => void;
  loading?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const prevOnOpen = useRef(onOpen);

  // Reset the "already opened" guard when the onOpen callback changes
  useEffect(() => {
    if (prevOnOpen.current !== onOpen) {
      prevOnOpen.current = onOpen;
      opened.current = false;
    }
  }, [onOpen]);

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click — must check both trigger button and panel
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) setOpen(false);
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

  // Close on scroll/resize (panel is fixed, won't track the button)
  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function handleToggle() {
    if (disabled) return;
    if (!open && !opened.current) { opened.current = true; onOpen?.(); }
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const panelW = 240;
      const vw = window.innerWidth;
      let left = rect.left;
      if (left + panelW > vw - 8) left = Math.max(8, vw - panelW - 8);
      setPanelStyle({ position: "fixed", top: rect.bottom + 6, left, width: panelW, zIndex: 9999 });
    }
    setOpen((v) => !v);
    setQuery("");
  }

  const filtered = query.trim()
    ? items.filter((i) => fdLabel(i).toLowerCase().includes(query.toLowerCase()))
    : items;

  const isActive = selected.length > 0;
  const buttonLabel = isActive
    ? selected.length === 1
      ? (items.find((i) => fdValue(i) === selected[0]) ? fdLabel(items.find((i) => fdValue(i) === selected[0])!) : selected[0])
      : `${label} (${selected.length})`
    : label;

  const panel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden"
    >
      {searchable && (
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
      )}

      <div className="max-h-60 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No results</div>
        ) : filtered.map((item) => {
          const val = fdValue(item);
          const lbl = fdLabel(item);
          const checked = selected.includes(val);
          const cnt = fdCount(item);
          return (
            <button
              key={val}
              onClick={() => {
                if (mode === "single") { onSelect?.(val); setOpen(false); }
                else { onToggle?.(val); }
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                checked ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-bold" : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {mode === "multi" ? (
                <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-slate-600"}`}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
              ) : (
                <span className={`w-3.5 h-3.5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${checked ? "border-blue-600" : "border-slate-300 dark:border-slate-600"}`}>
                  {checked && <span className="w-2 h-2 rounded-full bg-blue-600 block" />}
                </span>
              )}
              <span className="truncate flex-1">{lbl}</span>
              {cnt !== undefined && cnt > 0 && (
                <span className={`shrink-0 tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  checked ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {cnt.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="p-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => { onClear(); setOpen(false); }}
            className="w-full py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Clear {label}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative shrink-0">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400"
            : isActive
              ? "bg-blue-600 text-white border-blue-600 shadow-sm pr-1.5"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
        }`}
      >
        <span className="max-w-[120px] truncate">{buttonLabel}</span>
        {isActive ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label}`}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); } }}
            className="ml-0.5 p-0.5 rounded-full hover:bg-blue-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Dropdown panel — rendered via portal to escape overflow-x-auto clipping */}
      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}

// ─── TogglePill ────────────────────────────────────────────────────────────────
function TogglePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
        active
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
