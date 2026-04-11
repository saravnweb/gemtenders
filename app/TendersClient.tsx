"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Clock, Zap, RefreshCw,
  X, ChevronDown, Bell, CheckCircle, Loader2, SlidersHorizontal
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// ─── Constants ────────────────────────────────────────────────────────────────
import { normalizeState, normalizeCity, normalizeMinistry, isIndianState } from "@/lib/locations-client";
import { fetchTendersByRelevance } from "@/lib/tenders-relevance-query";
import { requirePublicListingReady } from "@/lib/tender-public-listing";
const PAGE_SIZE = 21;
const COLUMNS =
  "id,title,bid_number,ra_number,state,city,department,ministry_name,department_name,organisation_name,office_name,emd_amount,start_date,end_date,ai_summary,eligibility_msme,eligibility_mii,created_at,slug,category";

import { CATEGORIES } from "@/lib/categories";
import TenderCard from "@/components/tenders/TenderCard";
import { FilterTag } from "@/components/tenders/FilterTag";
import { FilterSidebar } from "@/components/tenders/FilterSidebar";
import { toTitleCase, getCategory } from "@/components/tenders/utils";


// ─── Word-boundary OR clause builder ─────────────────────────────────────────
// Uses PostgreSQL imatch (\y word boundaries) for text fields so "cab" never
// matches "cable". bid_number/ra_number/state/city keep ilike for code/geo lookups.
function buildTextSearchOrClause(term: string): string {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const p = `\\y${escaped}\\y`;
  return [
    `title.imatch.${p}`,
    `bid_number.ilike.%${term}%`,
    `ra_number.ilike.%${term}%`,
    `department.imatch.${p}`,
    `ministry_name.imatch.${p}`,
    `organisation_name.imatch.${p}`,
    `state.ilike.%${term}%`,
    `city.ilike.%${term}%`,
    `ai_summary.imatch.${p}`,
  ].join(",");
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
  categories: string[];
  descriptionQuery: string;
  tab: "all" | "foryou" | "archived";
  sortOrder: "newest" | "ending_soon" | "relevance";
}

async function queryTendersCount(filters: Filters): Promise<number> {
  let q = (supabase.from("tenders") as any).select("*", { count: "exact", head: true });

  const isDirectBidSearch = filters.q.trim().toUpperCase().includes("GEM/");
  
  if (!isDirectBidSearch) {
    if (filters.tab === "archived") {
      q = q.lt("end_date", new Date().toISOString());
    } else {
      q = requirePublicListingReady(
        q.gte("end_date", new Date().toISOString()).not("ai_summary", "is", null)
      );
    }
  }

  if (filters.q.trim()) {
    const searchTerms = filters.q.split(',').map(s => s.trim()).filter(Boolean);
    const orClauses = searchTerms.map(term => buildTextSearchOrClause(term));
    q = q.or(orClauses.join(','));
  }

  if (filters.states.length > 0) {
    const stateClauses = filters.states.map(s => s === "Unknown State" ? `state.is.null` : `state.ilike."${s}"`);
    q = q.or(stateClauses.join(','));
  }
  if (filters.cities.length > 0) {
    const cityClauses = filters.cities.map(c => c === "Other Cities" ? `city.is.null` : `city.ilike."${c}"`);
    q = q.or(cityClauses.join(','));
  }
  if (filters.ministries.length > 0) {
    const minClauses = filters.ministries.map(m => m === "Not Specified" ? `ministry_name.is.null` : `ministry_name.ilike."${m}"`);
    q = q.or(minClauses.join(','));
  }
  if (filters.orgs.length > 0) {
    const orgClauses = filters.orgs.map(o => o === "Not Specified" ? `organisation_name.is.null` : `organisation_name.ilike."${o}"`);
    q = q.or(orgClauses.join(','));
  }

  if (filters.msmeOnly) q = q.eq("eligibility_msme", true);
  if (filters.miiOnly)  q = q.eq("eligibility_mii",  true);

  if      (filters.emdFilter === "free") q = q.eq("emd_amount", 0);
  else if (filters.emdFilter === "<1L")  q = q.gt("emd_amount", 0).lt("emd_amount", 100000);
  else if (filters.emdFilter === "1-5L") q = q.gte("emd_amount", 100000).lte("emd_amount", 500000);
  else if (filters.emdFilter === ">5L")  q = q.gt("emd_amount", 500000);

  if (filters.categories.length > 0) {
    q = q.in("category", filters.categories);
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

  // Use the same multi-field word-boundary search as the main query so For You
  // finds tenders where keywords appear in department/ministry/organisation names,
  // not just title and ai_summary.
  const orString = uniqueKeywords.map(kw => buildTextSearchOrClause(kw)).join(",");

  const { data, error } = await requirePublicListingReady(
    supabase
      .from("tenders")
      .select(COLUMNS)
      .gte("end_date", new Date().toISOString())
      .not("ai_summary", "is", null)
  )
    .or(orString)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) console.error("[ForYou] query error:", error);
  return data || [];
}

async function queryTenders(filters: Filters, page: number): Promise<any[]> {
  const qTrim = filters.q.trim();
  if (filters.sortOrder === "relevance" && qTrim) {
    const { data, error } = await fetchTendersByRelevance(supabase, filters, page, PAGE_SIZE);
    if (!error && data) return data as any[];
    if (error) console.error("[fetchTendersByRelevance]", error);
  }

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
      q = requirePublicListingReady(
        q.gte("end_date", new Date().toISOString()).not("ai_summary", "is", null)
      );
    }
  }

  // Sort (relevance without usable RPC, or user chose date sorts)
  if (filters.sortOrder === "ending_soon") {
    q = q.order("end_date", { ascending: true }).order("id", { ascending: true });
  } else {
    q = q.order("created_at", { ascending: false }).order("id", { ascending: true });
  }

  // Text search
  if (filters.q.trim()) {
    const searchTerms = filters.q.split(',').map(s => s.trim()).filter(Boolean);
    const orClauses = searchTerms.map(term => buildTextSearchOrClause(term));
    q = q.or(orClauses.join(','));
  }

  // Location
  if (filters.states.length > 0) {
    const stateClauses = filters.states.map(s => s === "Unknown State" ? `state.is.null` : `state.ilike."${s}"`);
    q = q.or(stateClauses.join(','));
  }
  if (filters.cities.length > 0) {
    const cityClauses = filters.cities.map(c => c === "Other Cities" ? `city.is.null` : `city.ilike."${c}"`);
    q = q.or(cityClauses.join(','));
  }
  if (filters.ministries.length > 0) {
    const minClauses = filters.ministries.map(m => m === "Not Specified" ? `ministry_name.is.null` : `ministry_name.ilike."${m}"`);
    q = q.or(minClauses.join(','));
  }
  if (filters.orgs.length > 0) {
    const orgClauses = filters.orgs.map(o => o === "Not Specified" ? `organisation_name.is.null` : `organisation_name.ilike."${o}"`);
    q = q.or(orgClauses.join(','));
  }

  // Eligibility
  if (filters.msmeOnly) q = q.eq("eligibility_msme", true);
  if (filters.miiOnly)  q = q.eq("eligibility_mii",  true);

  // EMD
  if      (filters.emdFilter === "free") q = q.eq("emd_amount", 0);
  else if (filters.emdFilter === "<1L")  q = q.gt("emd_amount", 0).lt("emd_amount", 100000);
  else if (filters.emdFilter === "1-5L") q = q.gte("emd_amount", 100000).lte("emd_amount", 500000);
  else if (filters.emdFilter === ">5L")  q = q.gt("emd_amount", 500000);

  // Categories (using IN clause for multi-select)
  if (filters.categories.length > 0) {
    q = q.in("category", filters.categories);
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
  initialCategories: string[];
  initialTotalCount?: number;
  initialSortOrder?: "newest" | "ending_soon" | "relevance";
}) {
  return (
    <Suspense fallback={<TendersSkeleton />}>
      <TendersClient {...props} />
    </Suspense>
  );
}

function TendersSkeleton() {
  return (
    <div className="min-h-screen bg-fresh-sky-50 dark:bg-background">
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-8">
          <div className="h-4 w-32 bg-slate-200 dark:bg-muted rounded animate-pulse mb-3" />
          <div className="h-10 w-64 bg-slate-200 dark:bg-muted rounded animate-pulse mb-4" />
          <div className="h-12 w-full max-w-3xl bg-slate-200 dark:bg-muted rounded-2xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-white dark:bg-card rounded-xl animate-pulse border border-slate-100 dark:border-border" />
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
  initialCategories,
  initialTotalCount,
  initialSortOrder,
}: {
  initialTenders: any[];
  initialQ: string;
  initialStates: string[];
  initialCategories: string[];
  initialTotalCount?: number;
  initialSortOrder?: "newest" | "ending_soon" | "relevance";
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
  const [selectedStates, setSelectedStates]         = useState<string[]>(initialStates);
  const [selectedCities, setSelectedCities]         = useState<string[]>([]);
  const [emdFilter, setEmdFilter]                   = useState("all");
  const [dateFilter, setDateFilter]                 = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [descriptionQuery, setDescriptionQuery]     = useState("");
  const [msmeOnly, setMsmeOnly]                 = useState(false);
  const [miiOnly, setMiiOnly]                   = useState(false);
  const [activeTab, setActiveTab]               = useState<"all" | "foryou" | "archived">("all");
  const [sortOrder, setSortOrder]               = useState<"newest" | "ending_soon" | "relevance">(
    initialSortOrder ?? "newest"
  );

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
  const [allOrgs, setAllOrgs]                       = useState<Array<{label:string;value:string;count:number}>>([]);
  const [allActiveTendersMetadata, setAllActiveTendersMetadata] = useState<any[]>([]);

  // ── Mobile filter drawer ──
  const [mobileFiltersOpen, setMobileFiltersOpen]   = useState(false);

  // ── Contextual filter options (filtered by active search query) ──
  const [contextualTenders, setContextualTenders] = useState<any[]>([]);
  const [contextualLoading, setContextualLoading] = useState(false);

  /** 
   * Helper to check if a tender matches the current active filters, 
   * optionally excluding one specific facet type to calculate cross-facet counts.
   */
  const matchesFilters = (t: any, excludeFacet?: string) => {
    if (excludeFacet !== 'state' && selectedStates.length > 0 && !selectedStates.includes(t.state)) return false;
    if (excludeFacet !== 'city' && selectedCities.length > 0 && !selectedCities.includes(t.city)) return false;
    if (excludeFacet !== 'ministry' && selectedMinistries.length > 0 && !selectedMinistries.includes(t.ministry_name)) return false;
    if (excludeFacet !== 'org' && selectedOrgs.length > 0 && !selectedOrgs.includes(t.organisation_name)) return false;
    if (excludeFacet !== 'category' && selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false;
    return true;
  };

  // ── Helper: row array → sorted counted items ──
  const normalizationCache = useRef<Record<string, string>>({});

  const toCounted = useCallback((rows: any[], key: string, fallbackLabel?: string) => {
    const map: Record<string, number> = {};
    const cache = normalizationCache.current;

    rows.forEach((r) => {
      let v = r[key];
      if (!v) {
        const label = fallbackLabel || "";
        map[label] = (map[label] || 0) + 1;
        return;
      }

      const cacheKey = `${key}:${v}`;
      let normalized = cache[cacheKey];

      if (normalized === undefined) {
        v = v.trim();
        if (key === 'state') {
          normalized = normalizeState(v) || "";
        } else if (key === 'city') {
          normalized = normalizeCity(v) || "";
        } else {
          v = v.replace(/\s+/g, ' ');
          v = v.replace(/\.+$/, '');
          v = v.replace(/[\*\_\#]+$/, '');
          
          if (key === 'ministry_name' || key === 'organisation_name') {
            if (isIndianState(v)) {
              normalized = "__SKIP__"; 
            } else {
              normalized = normalizeMinistry(v) || "";
            }
          } else {
            normalized = toTitleCase(v);
          }
        }
        cache[cacheKey] = normalized;
      }
      
      if (normalized === "__SKIP__") return;

      const targetLabel = normalized || fallbackLabel;
      if (targetLabel) {
        map[targetLabel] = (map[targetLabel] || 0) + 1;
      }
    });

    return Object.entries(map)
      .map(([v, c]) => ({ label: v, value: v, count: c }))
      .sort((a, b) => {
        if (fallbackLabel) {
          if (a.label === fallbackLabel) return 1;
          if (b.label === fallbackLabel) return -1;
        }
        return a.label.localeCompare(b.label);
      });
  }, []);

  const contextualStates = useMemo(() => 
    toCounted(contextualTenders, "state", "Unknown State"), 
    [contextualTenders]
  );

  const contextualCities = useMemo(() => {
    if (selectedStates.length === 0) return [];
    const filtered = contextualTenders.filter(t => {
      if (!t.state) return false;
      const norm = normalizeState(t.state);
      return selectedStates.some(s => s === norm || s === t.state);
    });
    return toCounted(filtered, "city", "Other Cities");
  }, [contextualTenders, selectedStates]);

  const contextualMinistries = useMemo(() => {
    let base = contextualTenders;
    if (selectedStates.length > 0) {
      base = base.filter(t => t.state && selectedStates.includes(normalizeState(t.state) || ""));
    }
    if (selectedCities.length > 0) {
      base = base.filter(t => t.city && selectedCities.includes(normalizeCity(t.city) || ""));
    }
    return toCounted(base, "ministry_name", "Not Specified");
  }, [contextualTenders, selectedStates, selectedCities]);

  const contextualOrgs = useMemo(() => {
    let base = contextualTenders;
    if (selectedStates.length > 0) {
      base = base.filter(t => t.state && selectedStates.includes(normalizeState(t.state) || ""));
    }
    if (selectedCities.length > 0) {
      base = base.filter(t => t.city && selectedCities.includes(normalizeCity(t.city) || ""));
    }
    if (selectedMinistries.length > 0) {
      base = base.filter((t) => selectedMinistries.includes(t.ministry_name));
    }
    return toCounted(base, "organisation_name", "Not Specified");
  }, [contextualTenders, selectedStates, selectedCities, selectedMinistries]);

  const contextualCategories = useMemo(() => {
    let base = contextualTenders;
    if (selectedStates.length > 0) {
      base = base.filter(t => t.state && selectedStates.includes(normalizeState(t.state) || ""));
    }
    if (selectedCities.length > 0) {
      base = base.filter(t => t.city && selectedCities.includes(normalizeCity(t.city) || ""));
    }
    if (selectedMinistries.length > 0) {
      base = base.filter((t) => selectedMinistries.includes(t.ministry_name));
    }
    if (selectedOrgs.length > 0) {
      base = base.filter((t) => selectedOrgs.includes(t.organisation_name));
    }
    return toCounted(base, "category", "Uncategorized");
  }, [contextualTenders, selectedStates, selectedCities, selectedMinistries, selectedOrgs]);

  // ── Refs ──
  const isFirstRender  = useRef(true);
  const debounceTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeq       = useRef(0); // to discard stale responses

  // ── Sync URL search params on mount & changes ──
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null && q !== searchQuery) setSearchQuery(q);

    const cats = searchParams.getAll("category");
    if (cats.length > 0) {
      if (JSON.stringify(cats) !== JSON.stringify(selectedCategories)) setSelectedCategories(cats);
    }

    const s = searchParams.getAll("state");
    if (s.length > 0) {
      if (JSON.stringify(s) !== JSON.stringify(selectedStates)) setSelectedStates(s);
    } else if (isFirstRender.current) {
      // Only load from localStorage if no URL params AND it's strictly the first mount
      try {
        const pref = JSON.parse(localStorage.getItem("preferredStates") || "[]");
        if (pref.length > 0) setSelectedStates(pref);
      } catch {}
    }

    const c = searchParams.getAll("city");
    if (c.length > 0) {
      if (JSON.stringify(c) !== JSON.stringify(selectedCities)) setSelectedCities(c);
    } else if (isFirstRender.current) {
      try {
        const prefCities = JSON.parse(localStorage.getItem("preferredCities") || "[]");
        if (prefCities.length > 0) setSelectedCities(prefCities);
      } catch {}
    }

    const tab = searchParams.get("tab");
    if ((tab === "foryou" || tab === "all" || tab === "archived") && tab !== activeTab) setActiveTab(tab);

    const sort = searchParams.get("sort") || searchParams.get("sortOrder");
    if (
      (sort === "newest" || sort === "ending_soon" || sort === "relevance") &&
      sort !== sortOrder
    ) {
      setSortOrder(sort);
    }

    const msme = searchParams.get("msmeOnly");
    if (msme !== null) setMsmeOnly(msme === "true");

    const mii = searchParams.get("miiOnly");
    if (mii !== null) setMiiOnly(mii === "true");

    const emd = searchParams.get("emdFilter");
    if (emd && ["free", "<1L", "1-5L", ">5L"].includes(emd)) setEmdFilter(emd);

    const dateP = searchParams.get("dateFilter");
    if (dateP && ["today", "week"].includes(dateP)) setDateFilter(dateP);

    // Instantly remove any tenders that have precisely expired but were kept around by SSR cache
    if (isFirstRender.current) {
      const now = Date.now();
      setTenders(prev => {
        const active = prev.filter(t => {
          if (!t.end_date) return true;
          return new Date(t.end_date).getTime() > now;
        });
        return active.length !== prev.length ? active : prev;
      });
    }
  }, [searchParams]);

  const prevSearchRef = useRef("");
  // Relevance only applies when there is search text; switch automatically when starting search from empty
  useEffect(() => {
    const qTrim = searchQuery.trim();
    const prevTrim = prevSearchRef.current.trim();
    
    // Switch to newest if empty
    if (!qTrim && sortOrder === "relevance") {
      setSortOrder("newest");
    } 
    // Auto-switch to relevance ONLY if we just started searching from an empty state and are on default newest
    else if (qTrim && !prevTrim && sortOrder === "newest") {
      setSortOrder("relevance");
    }
    
    prevSearchRef.current = searchQuery;
  }, [searchQuery, sortOrder]);

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

  // ── Unified lazy-load for metadata (States, Ministries, Orgs) ──
  const [metadataLoading, setMetadataLoading] = useState(false);

  async function loadMetadata() {
    if ((statesLoaded && ministriesLoaded && orgsLoaded) || metadataLoading) return;
    setMetadataLoading(true);

    const CHUNK_SIZE = 1000;
    const CONCURRENCY = 10; // Fetch 10 pages at a time (10,000 items)
    const MAX_PAGES = 60;   // Up to 60,000 tenders
    const now = new Date().toISOString();

    let all: any[] = [];
    let pageOffset = 0;

    try {
      while (pageOffset < MAX_PAGES) {
        const promises = [];
        for (let i = 0; i < CONCURRENCY && (pageOffset + i) < MAX_PAGES; i++) {
          const page = pageOffset + i;
          promises.push(
            requirePublicListingReady(
              supabase
                .from("tenders")
                .select("state, city, ministry_name, organisation_name, category")
                .gte("end_date", now)
            ).range(page * CHUNK_SIZE, (page + 1) * CHUNK_SIZE - 1)
          );
        }

        const results = await Promise.all(promises);
        let finished = false;
        
        for (const { data, error } of results) {
          if (error || !data || data.length === 0) {
            finished = true;
            break;
          }
          all = all.concat(data);
          if (data.length < CHUNK_SIZE) {
            finished = true;
            break;
          }
        }

        if (finished) break;
        pageOffset += CONCURRENCY;
      }

      if (all.length > 0) {
        // Pre-normalize common fields to speed up filtering/counting in the sidebar
        const normalizedAll = all.map(row => ({
          ...row,
          _nState: normalizeState(row.state) || "Unknown State",
          _nCity: normalizeCity(row.city) || "Other Cities",
          _nMinistry: normalizeMinistry(row.ministry_name) || "Not Specified",
          _nOrg: normalizeMinistry(row.organisation_name) || "Not Specified"
        }));
        
        setAllActiveTendersMetadata(normalizedAll);
        setStates(toCounted(normalizedAll, "_nState"));
        setStatesLoaded(true);
        setMinistries(toCounted(normalizedAll, "_nMinistry"));
        setMinistriesLoaded(true);
        const orgsList = toCounted(normalizedAll, "_nOrg");
        setOrgs(orgsList);
        setAllOrgs(orgsList);
        setOrgsLoaded(true);
      }

    } catch (err) {
      console.error("[loadMetadata] Error:", err);
    } finally {
      setMetadataLoading(false);
    }
  }


  // Backwards compatibility for the dropdown components
  const loadStates = loadMetadata;
  const loadMinistries = loadMetadata;
  const loadOrgs = loadMetadata;

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
    requirePublicListingReady(
      supabase.from("tenders").select("city").gte("end_date", new Date().toISOString())
    )
      .or(selectedStates.map((s: string) => `state.ilike."${s}"`).join(','))
      .limit(100000)
      .then((res: { data: { city: string | null }[] | null }) => {
        if (res.data) setCities(toCounted(res.data, "city", "Other Cities"));
      });
  }, [selectedStates, statesLoaded]);

  // ── Ministry → Organisation cascade ──
  useEffect(() => {
    if (selectedMinistries.length === 0) {
      if (allOrgs.length > 0) setOrgs(allOrgs);
      return;
    }
    requirePublicListingReady(
      supabase.from("tenders").select("organisation_name").gte("end_date", new Date().toISOString())
    )
      .in("ministry_name", selectedMinistries)
      .not("organisation_name", "is", null)
      .limit(100000)
      .then(({ data }: { data: { organisation_name: string | null }[] | null }) => {
        if (data) setOrgs(toCounted(data, "organisation_name", "Not Specified"));
      });
  }, [selectedMinistries, allOrgs]);

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
    categories: selectedCategories,
    descriptionQuery,
    tab: activeTab,
    sortOrder,
  }), [searchQuery, selectedStates, selectedCities, selectedMinistries, selectedOrgs, emdFilter, dateFilter, msmeOnly, miiOnly, selectedCategories, descriptionQuery, activeTab, sortOrder]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Only skip client fetch if SSR already gave us data
      if (initialTenders.length > 0) {
        // Still fetch counts in background so sidebar shows real total
        const f = currentFilters();
        Promise.all([
          queryTendersCount({ ...f, tab: "all" }),
          queryTendersCount({ ...f, tab: "archived" }),
        ]).then(([count, countArchived]) => {
          setTotalCount(count);
          setActiveCount(count);
          setArchivedCount(countArchived);
        }).catch(() => {});
        return;
      }
    }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const delay = searchQuery ? 500 : 0; // Increased debounce for text search to 500ms

    // Clear contextual data immediately when search query changes
    const q = searchQuery.trim();
    if (q !== contextualQueryCache.current) {
      contextualQueryCache.current = "";
      setContextualTenders([]);
      setContextualLoading(!!q);
    }

    debounceTimer.current = setTimeout(async () => {
      const seq = ++fetchSeq.current;
      setLoading(true);
      setPage(0);

      const f = currentFilters();
      const q = searchQuery.trim();
      
      // 1. Fetch main results first (FAST path)
      const resultsPromise = queryTenders(f, 0);
      
      const results = await resultsPromise;
      if (seq !== fetchSeq.current) return;
      
      setTenders(results);
      setHasMore(results.length === PAGE_SIZE);
      setLoading(false);

      // 2. Fetch counts and contextual filters in background (SLOW path)
      const hasHierarchyFilters = !!(f.states.length || f.cities.length || f.ministries.length || f.orgs.length || f.categories.length);
      const cacheKey = `${q}:${f.states.join(",")}`; 
      const needContextual = (q.length > 0 || hasHierarchyFilters) && contextualQueryCache.current !== cacheKey;
      
      if (needContextual) {
        if (!q && allActiveTendersMetadata.length > 0) {
          // Optimization: If NOT searching (only filtering), use the full metadata set we already have in memory.
          // This is 100% accurate and faster than a DB call.
          setContextualTenders(allActiveTendersMetadata);
          setContextualLoading(false);
          contextualQueryCache.current = cacheKey;
        } else if (q) {
          // If searching, we MUST fetch matching metadata from DB because our local set doesn't have titles/summaries.
          let ctxQ = requirePublicListingReady(
            supabase.from("tenders")
              .select("state, city, ministry_name, organisation_name, category")
              .gte("end_date", new Date().toISOString())
          );
          const ctxOrClause = q.split(',').map((s: string) => s.trim()).filter(Boolean)
            .map((t: string) => buildTextSearchOrClause(t)).join(',');
          ctxQ = ctxQ.or(ctxOrClause);
          
          ctxQ.order("created_at", { ascending: false }).limit(2000).then(({ data }: { data: any[] | null }) => {
            if (seq !== fetchSeq.current) return;
            if (data) {
              const normalizedData = data.map(t => ({
                ...t,
                _nState: normalizeState(t.state) || "Unknown State",
                _nCity: normalizeCity(t.city) || "Other Cities",
                _nMinistry: normalizeMinistry(t.ministry_name) || "Not Specified",
                _nOrg: normalizeMinistry(t.organisation_name) || "Not Specified"
              }));
              setContextualTenders(normalizedData);
              contextualQueryCache.current = cacheKey;
            }
            setContextualLoading(false);
          });

        }
      }

      Promise.all([
        queryTendersCount({ ...f, tab: "all" }),
        queryTendersCount({ ...f, tab: "archived" }),
      ]).then(([count, countArchived]) => {
        if (seq !== fetchSeq.current) return;
        setTotalCount(count);
        setActiveCount(count);
        setArchivedCount(countArchived);
      }).catch(err => {
        console.error("[Background Fetch Error]", err);
        if (seq === fetchSeq.current) setContextualLoading(false);
      });
    }, delay);

    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery, selectedStates, selectedCities, selectedMinistries, selectedOrgs, emdFilter, dateFilter, msmeOnly, miiOnly, selectedCategories, descriptionQuery, activeTab, sortOrder]);

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
             const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
             const regex = new RegExp(`\\b${escaped}\\b`, "i");
             return regex.test(tender.title || "") ||
                    regex.test(tender.bid_number || "") ||
                    regex.test(tender.department || "") ||
                    regex.test(tender.organisation_name || "") ||
                    regex.test(tender.ministry_name || "") ||
                    regex.test(tender.ai_summary || "");
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

        const alertCategories = p.categories || (p.category ? [p.category] : []);
        if (alertCategories.length) {
          const tCat = getCategory(tender.title, tender.ai_summary)?.id;
          if (!tCat || !alertCategories.includes(tCat)) match = false;
        }

        if (p.msme && !tender.eligibility_msme) match = false;
        if (p.mii  && !tender.eligibility_mii)  match = false;
        return match;
      })
    );
    
    const forYouSort =
      sortOrder === "relevance" ? "newest" : sortOrder;

    const sorted = [...filtered].sort((a, b) => {
      if (forYouSort === "newest") {
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
      || (selectedCategories.length > 0 ? (CATEGORIES.find((c) => c.id === selectedCategories[0])?.label || "Category") : "")
      || "My Tender Alert";

    const { error } = await supabase.from("saved_searches").insert({
      user_id: user.id,
      name: `${searchName} Alert`,
      query_params: { 
        q: searchQuery, 
        states: selectedStates, 
        cities: selectedCities, 
        emd: emdFilter, 
        date: dateFilter, 
        categories: selectedCategories, 
        description: descriptionQuery, 
        msme: msmeOnly, 
        mii: miiOnly 
      },
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
    emdFilter !== "all" || dateFilter !== "all" || msmeOnly || miiOnly || selectedCategories.length > 0 || descriptionQuery;

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
    <div className="min-h-screen bg-fresh-sky-50 dark:bg-background text-slate-800 dark:text-foreground font-sans">
      <main id="main-content" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* ── Hero ── */}
        <div className="mb-4 sm:mb-6">
          {/* Live indicator + heading */}
          <div className="flex items-center space-x-2 mb-1.5 sm:mb-2">
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500" />
            </span>
            <span className="text-xs text-fresh-sky-600 dark:text-fresh-sky-400 font-bold tracking-wide uppercase">Live Updates</span>
          </div>
          <h2 className="font-bricolage text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-foreground tracking-tight mb-2 sm:mb-3">
            Find Your Next Tender
          </h2>

          {/* Search bar */}
          <div className="relative max-w-3xl">
            <label htmlFor="tender-search" className="sr-only">Search tenders by keywords or bid number</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
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
              className="w-full bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl py-2 sm:py-2.5 pl-8 sm:pl-10 pr-8 text-sm text-slate-800 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-tertiary focus:outline-none focus:ring-2 focus:ring-fresh-sky-500 focus:border-fresh-sky-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile filter button — sidebar handles filters on desktop */}
          <div className="mt-3 lg:hidden">
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:border-slate-300 dark:hover:border-muted-foreground/35 transition-all shadow-sm"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters
                {(selectedStates.length + selectedCities.length + selectedMinistries.length + selectedOrgs.length +
                  selectedCategories.length + (emdFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0) +
                  (msmeOnly ? 1 : 0) + (miiOnly ? 1 : 0)) > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                    {selectedStates.length + selectedCities.length + selectedMinistries.length + selectedOrgs.length +
                      selectedCategories.length + (emdFilter !== "all" ? 1 : 0) + (dateFilter !== "all" ? 1 : 0) +
                      (msmeOnly ? 1 : 0) + (miiOnly ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* ── Active filter tags ── */}
            {hasActiveFilters && (
              <div className="mt-2 mb-3 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCategories.map((catId) => (
                    <FilterTag 
                      key={catId} 
                      label={`Category: ${CATEGORIES.find((c) => c.id === catId)?.label}`} 
                      onRemove={() => setSelectedCategories((p) => p.filter((id) => id !== catId))} 
                    />
                  ))}
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
                    onClick={() => { 
                      setSelectedStates([]); 
                      setSelectedCities([]); 
                      setSelectedMinistries([]); 
                      setSelectedOrgs([]); 
                      setEmdFilter("all"); 
                      setDateFilter("all"); 
                      setMsmeOnly(false); 
                      setMiiOnly(false); 
                      setDescriptionQuery(""); 
                      setSelectedCategories([]); 
                    }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition-colors whitespace-nowrap"
                >
                  <X className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            </div>
          )}

          {/* Save search — shown only when a text query is present (not just filters) */}
          {(searchQuery.trim().length > 0 || descriptionQuery.trim().length > 0) && (
            <div className="mt-3 flex items-center gap-3 animate-in fade-in duration-200">
              <button
                onClick={handleSaveSearch}
                disabled={isSavingSearch || saveSuccess}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${saveSuccess ? "bg-green-500 text-white" : "bg-slate-900 dark:bg-foreground text-white dark:text-background hover:bg-black dark:hover:bg-foreground/90 active:scale-[0.98]"}`}
              >
                {isSavingSearch ? <Loader2 className="w-3 h-3 animate-spin" /> : saveSuccess ? <CheckCircle className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                <span>{saveSuccess ? "Saved!" : "Add to Keywords"}</span>
              </button>
              <span className="text-xs text-slate-500 dark:text-muted-foreground hidden sm:inline">Get notified when new tenders match.</span>
            </div>
          )}
        </div>

        {/* ── Mobile filter drawer ── */}
        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="relative z-10 flex flex-col w-80 max-w-full h-full bg-white dark:bg-card shadow-2xl overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-border shrink-0">
                <span className="text-sm font-bold text-slate-800 dark:text-foreground">Filters</span>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <FilterSidebar
                className="flex flex-col flex-1"
                activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setMobileFiltersOpen(false); }}
                activeCount={activeCount} archivedCount={archivedCount}
                forYouCount={savedSearches.length > 0 ? forYouTenders.length : 0}
                forYouLoading={forYouLoading} user={user} savedSearches={savedSearches}
                states={states} cities={cities}
                selectedStates={selectedStates} selectedCities={selectedCities}
                setSelectedStates={setSelectedStates} setSelectedCities={setSelectedCities}
                statesLoaded={statesLoaded} loadStates={loadStates}
                contextualStates={contextualStates} contextualCities={contextualCities}
                contextualLoading={contextualLoading} searchQuery={searchQuery}
                contextualTenders={contextualTenders}
                ministries={ministries} orgs={orgs}
                selectedMinistries={selectedMinistries} selectedOrgs={selectedOrgs}
                setSelectedMinistries={setSelectedMinistries} setSelectedOrgs={setSelectedOrgs}
                ministriesLoaded={ministriesLoaded} loadMinistries={loadMinistries}
                contextualMinistries={contextualMinistries} contextualOrgs={contextualOrgs}
                selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
                contextualCategories={contextualCategories}
                emdFilter={emdFilter} setEmdFilter={setEmdFilter}
                msmeOnly={msmeOnly} setMsmeOnly={setMsmeOnly}
                miiOnly={miiOnly} setMiiOnly={setMiiOnly} isPremium={isPremium}
                dateFilter={dateFilter} setDateFilter={setDateFilter}
              />
            </div>
          </div>
        )}

        {/* ── Main layout: sidebar + content ── */}
        <div className="flex gap-6 items-start">

          {/* ── Left filter sidebar (desktop only) ── */}
          <div className="hidden lg:block">
            <FilterSidebar
              activeTab={activeTab} setActiveTab={setActiveTab}
              activeCount={activeCount} archivedCount={archivedCount}
              forYouCount={savedSearches.length > 0 ? forYouTenders.length : 0}
              forYouLoading={forYouLoading} user={user} savedSearches={savedSearches}
              states={states} cities={cities}
              selectedStates={selectedStates} selectedCities={selectedCities}
              setSelectedStates={setSelectedStates} setSelectedCities={setSelectedCities}
              statesLoaded={statesLoaded} loadStates={loadStates}
              contextualStates={contextualStates} contextualCities={contextualCities}
              contextualLoading={contextualLoading} searchQuery={searchQuery}
              contextualTenders={contextualTenders}
              ministries={ministries} orgs={orgs}
              selectedMinistries={selectedMinistries} selectedOrgs={selectedOrgs}
              setSelectedMinistries={setSelectedMinistries} setSelectedOrgs={setSelectedOrgs}
              ministriesLoaded={ministriesLoaded} loadMinistries={loadMinistries}
              contextualMinistries={contextualMinistries} contextualOrgs={contextualOrgs}
              selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
              contextualCategories={contextualCategories}
              emdFilter={emdFilter} setEmdFilter={setEmdFilter}
              msmeOnly={msmeOnly} setMsmeOnly={setMsmeOnly}
              miiOnly={miiOnly} setMiiOnly={setMiiOnly} isPremium={isPremium}
              dateFilter={dateFilter} setDateFilter={setDateFilter}
            />
          </div>

          {/* ── Right: tabs + grid ── */}
          <div className="flex-1 min-w-0">

        {/* ── Tabs ── */}
        <div className="mb-4 border-b border-slate-200 dark:border-border w-full">
          {/* Row 1: All tabs toggle (mobile only) */}
          <div className="flex items-center pt-1 pb-2 lg:hidden">
            <div className="flex items-center bg-slate-100 dark:bg-card rounded-full p-0.5 text-xs font-bold w-full" role="tablist" aria-label="Tender Views">
              <button
                role="tab"
                aria-selected={activeTab === "all"}
                onClick={() => setActiveTab("all")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex-1 justify-center ${activeTab === "all" ? "bg-white dark:bg-muted text-slate-900 dark:text-foreground shadow-sm" : "text-slate-500 dark:text-muted-foreground"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                Active
                {activeCount !== null && !loading && (
                  <span suppressHydrationWarning className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                    {activeCount.toLocaleString()}
                  </span>
                )}
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "foryou"}
                onClick={() => {
                  if (user && savedSearches.length > 0) setActiveTab("foryou");
                  else window.location.href = user ? "/dashboard/keywords" : "/login";
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex-1 justify-center ${activeTab === "foryou" ? "bg-white dark:bg-muted text-slate-900 dark:text-foreground shadow-sm" : "text-slate-500 dark:text-muted-foreground"}`}
              >
                <Zap className={`w-3 h-3 shrink-0 ${activeTab === "foryou" ? "text-fresh-sky-600 dark:text-fresh-sky-400" : "text-slate-400"}`} />
                For You
                <span suppressHydrationWarning className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === "foryou" ? "bg-fresh-sky-100 dark:bg-fresh-sky-900/40 text-fresh-sky-700 dark:text-fresh-sky-300" : "bg-slate-200 dark:bg-muted text-slate-500 dark:text-muted-foreground"}`}>
                  {forYouLoading ? "…" : (savedSearches.length > 0 ? forYouTenders.length : 0)}
                </span>
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "archived"}
                onClick={() => setActiveTab("archived")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex-1 justify-center ${activeTab === "archived" ? "bg-white dark:bg-muted text-slate-900 dark:text-foreground shadow-sm" : "text-slate-500 dark:text-muted-foreground"}`}
              >
                <Clock className="w-3 h-3 shrink-0" />
                Archived
              </button>
            </div>
          </div>

          <div className="flex w-full flex-row gap-2 pt-1 pb-1.5 items-center justify-between">
            <div className="flex min-w-0 shrink flex-row items-center gap-2 justify-start">
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === "foryou"}
                onClick={() => {
                  if (user && savedSearches.length > 0) setActiveTab("foryou");
                  else window.location.href = user ? "/dashboard/keywords" : "/login";
                }}
                className={`hidden lg:inline-flex text-sm sm:text-base font-bold items-center gap-1.5 transition-all shrink-0 leading-none ${
                  activeTab === "foryou"
                    ? "text-fresh-sky-600"
                    : "text-slate-500 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground"
                }`}
              >
                <Zap className={`w-4 h-4 shrink-0 -mt-px ${activeTab === "foryou" ? "text-fresh-sky-600 dark:text-fresh-sky-400" : "text-slate-400"}`} />
                <span className="truncate leading-none">For You</span>
                <span suppressHydrationWarning className={`flex h-5 items-center justify-center px-1.5 rounded-full text-[10px] font-bold leading-none ${activeTab === "foryou" ? "bg-fresh-sky-100 dark:bg-fresh-sky-900/40 text-fresh-sky-700 dark:text-fresh-sky-300" : "bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground"}`}>
                  {forYouLoading ? "…" : (savedSearches.length > 0 ? forYouTenders.length : 0)}
                </span>
                {activeTab === "foryou" && <div className="hidden sm:block absolute -bottom-1.5 left-0 w-full h-0.5 bg-fresh-sky-500 rounded-full" />}
              </button>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 ml-auto">
              <div suppressHydrationWarning className="hidden lg:block text-xs font-bold text-slate-500 dark:text-muted-foreground whitespace-nowrap">
                {loading ? "…" : activeTab === "foryou"
                  ? `${forYouTenders.length} results`
                  : activeTab === "archived"
                    ? `${(archivedCount ?? displayTenders.length).toLocaleString()}${hasMore ? "+" : ""} results`
                    : `${(activeCount ?? displayTenders.length).toLocaleString()}${hasMore ? "+" : ""} results`}
              </div>
              <div className="flex flex-row items-center gap-1 shrink-0">
                <span className="text-xs font-semibold text-slate-600 dark:text-muted-foreground shrink-0">
                  Sort by
                </span>
                <div className="relative shrink-0">
                  <select
                    aria-label="Sort order"
                    value={sortOrder === "relevance" && !searchQuery.trim() ? "newest" : sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as "newest" | "ending_soon" | "relevance")
                    }
                    className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-sm font-bold border transition-all whitespace-nowrap bg-white dark:bg-card border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:border-slate-300 dark:hover:border-muted-foreground/35 cursor-pointer appearance-none pr-6 sm:pr-8"
                  >
                    <option value="newest">Newest</option>
                    <option value="ending_soon">Ending Soon</option>
                    <option value="relevance" disabled={!searchQuery.trim()}>
                      Relevance
                    </option>
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-1 sm:right-2 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-slate-600 dark:text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* ── Tender Grid ── */}
        {loading || (activeTab === "foryou" && forYouLoading) ? (
          <div role="table" aria-label="Loading Tenders" className="w-full">
            <div role="rowgroup" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div role="row" aria-busy="true" key={i} className="h-72 bg-white dark:bg-card rounded-xl animate-pulse border border-slate-100 dark:border-border">
                  <div role="cell" className="sr-only">Loading...</div>
                </div>
              ))}
            </div>
          </div>
        ) : displayTenders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-border rounded-2xl flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-100 dark:bg-card rounded-full flex items-center justify-center mb-4">
              {activeTab === "foryou" ? <Zap className="w-7 h-7 text-slate-300 dark:text-muted-tertiary" /> : <Search className="w-7 h-7 text-slate-300 dark:text-muted-tertiary" />}
            </div>
            {activeTab === "foryou" ? (
              <>
                <h3 className="text-lg font-medium text-slate-500 dark:text-muted-foreground">No matching tenders yet.</h3>
                <p className="text-slate-600 dark:text-muted-foreground mt-1 text-sm">New tenders matching your keywords will appear here automatically.</p>
                <Link href="/dashboard/keywords" className="mt-4 text-xs font-bold text-fresh-sky-600 dark:text-fresh-sky-400 hover:underline">Update Keywords →</Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-500 dark:text-muted-foreground">No matching tenders found.</h3>
                <p className="text-slate-600 dark:text-muted-foreground mt-1 text-sm">Try adjusting your filters or search terms.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div role="table" className="w-full block" aria-label="Tenders List">
              <div role="rowgroup" className="sr-only">
                <div role="row">
                  <div role="columnheader">Title & Summary</div>
                  <div role="columnheader">Department</div>
                  <div role="columnheader">Location & ID</div>
                  <div role="columnheader">Dates & EMD</div>
                  <div role="columnheader">Actions</div>
                </div>
              </div>
              <Suspense fallback={
                <div role="rowgroup" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-72 bg-white dark:bg-card rounded-xl animate-pulse border border-slate-100 dark:border-border" />
                  ))}
                </div>
              }>
                <div role="rowgroup" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
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
                </div>
              </Suspense>
            </div>

            {hasMore && activeTab !== "foryou" && (
              <div className="mt-8 mb-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-white dark:bg-card hover:bg-slate-50 dark:hover:bg-muted text-slate-700 dark:text-muted-foreground font-bold py-3 px-8 rounded-xl border border-slate-200 dark:border-border shadow-sm transition-all focus:ring-2 focus:ring-fresh-sky-500 focus:outline-none flex items-center space-x-2 disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <RefreshCw className="w-4 h-4 text-slate-600" />}
                  <span suppressHydrationWarning>
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

