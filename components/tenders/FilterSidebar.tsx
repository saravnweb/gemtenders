"use client";

import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
import { MapPin, Building2, Tag, Banknote, CalendarClock, Clock, Zap, SlidersHorizontal } from "lucide-react";
import { FilterSection } from "./FilterSection";
import { FilterDropdown } from "./FilterDropdown";
import { TogglePill } from "./TogglePill";
import { CATEGORIES } from "@/lib/categories";
import { normalizeMinistry, normalizeState, normalizeCity } from "@/lib/locations-client";

type FilterItem = { label: string; value: string; count: number };
type SetStrings = Dispatch<SetStateAction<string[]>>;
type SetString = Dispatch<SetStateAction<string>>;
type SetBool = Dispatch<SetStateAction<boolean>>;
type SetStringOrNull = Dispatch<SetStateAction<string | null>>;

const SIDEBAR_DEFAULT_CLASS =
  "flex flex-col w-64 shrink-0 sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm";

interface FilterSidebarProps {
  /** Override the outer <aside> className (e.g. for mobile drawer rendering) */
  className?: string;
  // View tab (Active / Archived / For You)
  activeTab: "all" | "foryou" | "archived";
  setActiveTab: (tab: "all" | "foryou" | "archived") => void;
  activeCount: number | null;
  archivedCount: number | null;
  forYouCount: number;
  forYouLoading: boolean;
  user: any;
  savedSearches: any[];

  // Location
  states: FilterItem[];
  cities: FilterItem[];
  selectedStates: string[];
  selectedCities: string[];
  setSelectedStates: SetStrings;
  setSelectedCities: SetStrings;
  statesLoaded: boolean;
  loadStates: () => void;
  contextualStates: FilterItem[];
  contextualCities: FilterItem[];
  contextualLoading: boolean;
  searchQuery: string;
  contextualTenders: any[];

  // Ministry / Organisation
  ministries: FilterItem[];
  orgs: FilterItem[];
  selectedMinistries: string[];
  selectedOrgs: string[];
  setSelectedMinistries: SetStrings;
  setSelectedOrgs: SetStrings;
  ministriesLoaded: boolean;
  loadMinistries: () => void;
  contextualMinistries: FilterItem[];
  contextualOrgs: FilterItem[];

  // Category
  selectedCategories: string[];
  setSelectedCategories: SetStrings;
  contextualCategories?: FilterItem[];

  // Financial
  emdFilter: string;
  setEmdFilter: SetString;
  msmeOnly: boolean;
  setMsmeOnly: SetBool;
  miiOnly: boolean;
  setMiiOnly: SetBool;
  isPremium: boolean;

  // Timeline
  dateFilter: string;
  setDateFilter: SetString;
}

export function FilterSidebar({
  className = SIDEBAR_DEFAULT_CLASS,
  activeTab, setActiveTab, activeCount, archivedCount,
  forYouCount, forYouLoading, user, savedSearches,
  states, cities, selectedStates, selectedCities,
  setSelectedStates, setSelectedCities,
  statesLoaded, loadStates,
  contextualStates, contextualCities, contextualLoading, searchQuery, contextualTenders,
  ministries, orgs, selectedMinistries, selectedOrgs,
  setSelectedMinistries, setSelectedOrgs,
  ministriesLoaded, loadMinistries,
  contextualMinistries, contextualOrgs,
  selectedCategories, setSelectedCategories, contextualCategories = [],
  emdFilter, setEmdFilter,
  msmeOnly, setMsmeOnly, miiOnly, setMiiOnly, isPremium,
  dateFilter, setDateFilter,
}: FilterSidebarProps) {

  /** 
   * Local helper for cross-facet counting using contextualTenders
   */
  const matchesFilters = useCallback((t: any, excludeFacet?: string) => {
    // Use pre-normalized fields if available, fallback to on-the-fly normalization
    if (excludeFacet !== 'state' && selectedStates.length > 0) {
      const val = t._nState !== undefined ? t._nState : normalizeState(t.state);
      if (!val || !selectedStates.includes(val)) return false;
    }
    if (excludeFacet !== 'city' && selectedCities.length > 0) {
      const val = t._nCity !== undefined ? t._nCity : normalizeCity(t.city);
      if (!val || !selectedCities.includes(val)) return false;
    }
    if (excludeFacet !== 'ministry' && selectedMinistries.length > 0) {
      const val = t._nMinistry !== undefined ? t._nMinistry : normalizeMinistry(t.ministry_name);
      if (!val || !selectedMinistries.includes(val)) return false;
    }
    if (excludeFacet !== 'org' && selectedOrgs.length > 0) {
      const val = t._nOrg !== undefined ? t._nOrg : normalizeMinistry(t.organisation_name);
      if (!val || !selectedOrgs.includes(val)) return false;
    }
    if (excludeFacet !== 'category' && selectedCategories.length > 0) {
      if (!t.category || !selectedCategories.includes(t.category)) return false;
    }
    return true;
  }, [selectedStates, selectedCities, selectedMinistries, selectedOrgs, selectedCategories]);

  const stateItems = useMemo(() => {
    const isSearching = searchQuery.trim() || contextualTenders.length > 0;
    const base = isSearching ? (contextualStates.length > 0 ? contextualStates : states) : states;
    
    if (!isSearching) return base;

    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'state')) {
        const key = t._nState !== undefined ? t._nState : (normalizeState(t.state) || "Unknown State");
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedStates.forEach((s) => {
      if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: counts[s] || 0 });
    });
    return merged.sort((a, b) => {
      if (a.label.includes("Unknown")) return 1;
      if (b.label.includes("Unknown")) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [searchQuery, contextualTenders, contextualStates, states, selectedStates, matchesFilters]);

  const cityItems = useMemo(() => {
    const isSearching = searchQuery.trim() || contextualTenders.length > 0;
    const base = isSearching ? (contextualCities.length > 0 ? contextualCities : cities) : cities;
    
    if (!isSearching) return base;

    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'city')) {
        const key = t._nCity !== undefined ? t._nCity : (t.city || "Other Cities");
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedCities.forEach((c) => {
      if (!merged.find((i) => i.value === c)) merged.push({ label: c, value: c, count: counts[c] || 0 });
    });
    
    return merged.sort((a, b) => {
      if (a.label.includes("Unknown")) return 1;
      if (b.label.includes("Unknown")) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [searchQuery, contextualTenders, contextualCities, cities, selectedCities, matchesFilters]);

  const ministryItems = useMemo(() => {
    const isSearching = searchQuery.trim() || contextualTenders.length > 0;
    const base = isSearching ? (contextualMinistries.length > 0 ? contextualMinistries : ministries) : ministries;
    
    if (!isSearching) return base;

    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'ministry')) {
        const mk = t._nMinistry !== undefined ? t._nMinistry : (normalizeMinistry(t.ministry_name) || t.ministry_name);
        counts[mk] = (counts[mk] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedMinistries.forEach((s) => {
      if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: counts[s] || 0 });
    });
    
    return merged.sort((a, b) => {
      if (a.label.includes("Unknown")) return 1;
      if (b.label.includes("Unknown")) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [searchQuery, contextualTenders, contextualMinistries, ministries, selectedMinistries, matchesFilters]);

  const orgItems = useMemo(() => {
    const isSearching = searchQuery.trim() || contextualTenders.length > 0;
    const base = isSearching ? (contextualOrgs.length > 0 ? contextualOrgs : orgs) : orgs;
    
    if (!isSearching) return base;

    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'org')) {
        const ok = t._nOrg !== undefined ? t._nOrg : (normalizeMinistry(t.organisation_name) || t.organisation_name);
        counts[ok] = (counts[ok] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedOrgs.forEach((s) => {
      if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: counts[s] || 0 });
    });
    
    return merged.sort((a, b) => {
      if (a.label.includes("Unknown")) return 1;
      if (b.label.includes("Unknown")) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [searchQuery, contextualTenders, contextualOrgs, orgs, selectedOrgs, matchesFilters]);

  const categoryItems = useMemo(() => {
    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'category')) {
        counts[t.category] = (counts[t.category] || 0) + 1;
      }
    });

    return CATEGORIES.map((c) => ({ 
      label: `${c.icon} ${c.label}`, 
      value: c.id, 
      count: counts[c.id] || 0 
    })).sort((a, b) => b.count - a.count);
  }, [contextualTenders, matchesFilters]);



  const hierarchyCount = 
    selectedStates.length + selectedCities.length + 
    selectedMinistries.length + selectedOrgs.length + selectedCategories.length;

  const financialCount =
    (emdFilter !== "all" ? 1 : 0) + (msmeOnly ? 1 : 0) + (miiOnly ? 1 : 0);

  return (
    <aside className={className}>

      {/* ── View Toggle ── */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-100 dark:border-border">
        <p className="text-[10px] font-bold text-slate-400 dark:text-muted-tertiary uppercase tracking-widest mb-1.5 px-1">
          View
        </p>
        <div className="flex flex-col gap-1">
          {(["all", "foryou", "archived"] as const).map((tab) => {
            const cnt =
              tab === "all"
                ? activeCount
                : tab === "archived"
                ? archivedCount
                : forYouLoading ? null : (savedSearches.length > 0 ? forYouCount : 0);
            return (
              <button
                key={tab}
                onClick={() => {
                  if (tab === "foryou") {
                    if (user && savedSearches.length > 0) setActiveTab("foryou");
                    else window.location.href = user ? "/dashboard/keywords" : "/login";
                  } else {
                    setActiveTab(tab);
                  }
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left w-full ${
                  activeTab === tab
                    ? "bg-slate-900 dark:bg-muted text-white shadow-sm"
                    : "text-slate-600 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-900 dark:hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab === "all" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                  {tab === "foryou" && <Zap className="w-3 h-3 shrink-0 text-fresh-sky-400" />}
                  {tab === "archived" && <Clock className="w-3.5 h-3.5 shrink-0" />}
                  {tab === "all" ? "Active" : tab === "foryou" ? "For You" : "Archived"}
                </span>
                {cnt !== null && (
                  <span
                    suppressHydrationWarning
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === tab
                        ? "bg-white/25 text-white"
                        : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-100"
                    }`}
                  >
                    {forYouLoading && tab === "foryou" ? "…" : (cnt ?? 0).toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search Hierarchy ── */}
      <FilterSection
        title="Search Hierarchy"
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
        count={hierarchyCount}
        onClear={() => {
          setSelectedStates([]);
          setSelectedCities([]);
          setSelectedMinistries([]);
          setSelectedOrgs([]);
          setSelectedCategories([]);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <FilterDropdown
            label="State"
            fullWidth
            items={stateItems}
            selected={selectedStates}
            mode="multi"
            onToggle={(v) =>
              setSelectedStates((p) =>
                p.includes(v) ? p.filter((x) => x !== v) : [...p, v]
              )
            }
            onClear={() => {
              setSelectedStates([]);
              setSelectedCities([]);
            }}
            onOpen={loadStates}
            loading={searchQuery.trim() ? contextualLoading : !statesLoaded && states.length === 0}
            searchPlaceholder="Search states…"
          />
          <FilterDropdown
            label="City"
            fullWidth
            items={cityItems}
            selected={selectedCities}
            mode="multi"
            onToggle={(v) =>
              setSelectedCities((p) =>
                p.includes(v) ? p.filter((x) => x !== v) : [...p, v]
              )
            }
            onClear={() => setSelectedCities([])}
            loading={searchQuery.trim() ? contextualLoading : false}
            searchPlaceholder="Search cities…"
          />
          <FilterDropdown
            label="Ministry"
            fullWidth
            items={ministryItems}
            selected={selectedMinistries}
            mode="multi"
            onToggle={(v) =>
              setSelectedMinistries((p) =>
                p.includes(v) ? p.filter((x) => x !== v) : [...p, v]
              )
            }
            onClear={() => setSelectedMinistries([])}
            onOpen={loadMinistries}
            loading={searchQuery.trim() ? contextualLoading : !ministriesLoaded && ministries.length === 0}
            searchPlaceholder="Search ministries…"
          />
          <FilterDropdown
            label="Organisation"
            fullWidth
            items={orgItems}
            selected={selectedOrgs}
            mode="multi"
            onToggle={(v) =>
              setSelectedOrgs((p) =>
                p.includes(v) ? p.filter((x) => x !== v) : [...p, v]
              )
            }
            onClear={() => setSelectedOrgs([])}
            loading={searchQuery.trim() ? contextualLoading : false}
            searchPlaceholder="Search organisations…"
          />
          <FilterDropdown
            label="Category"
            fullWidth
            items={categoryItems}
            selected={selectedCategories}
            mode="multi"
            onToggle={(v) =>
              setSelectedCategories((p) =>
                p.includes(v) ? p.filter((x) => x !== v) : [...p, v]
              )
            }
            onClear={() => setSelectedCategories([])}
            searchable={categoryItems.length > 15}
            searchPlaceholder="Search categories…"
          />
        </div>
      </FilterSection>

      {/* ── Financial ── */}
      <FilterSection
        title="Financial"
        icon={<Banknote className="w-3.5 h-3.5" />}
        count={financialCount}
        onClear={() => {
          setEmdFilter("all");
          setMsmeOnly(false);
          setMiiOnly(false);
        }}
      >
        <FilterDropdown
          label="EMD Amount"
          fullWidth
          items={[
            { label: "EMD Free",           value: "free", count: 0 },
            { label: "Below ₹1 Lakh",      value: "<1L",  count: 0 },
            { label: "₹1 Lakh – ₹5 Lakh",  value: "1-5L", count: 0 },
            { label: "Above ₹5 Lakh",      value: ">5L",  count: 0 },
          ]}
          selected={emdFilter !== "all" ? [emdFilter] : []}
          mode="single"
          onSelect={(v) => setEmdFilter(emdFilter === v ? "all" : v)}
          onClear={() => setEmdFilter("all")}
          searchable={false}
        />
        <div className="flex gap-2 mt-1 px-1">
          <TogglePill
            label="MSME"
            active={msmeOnly}
            onClick={() => {
              if (isPremium) setMsmeOnly(!msmeOnly);
              else window.location.href = user ? "/dashboard/subscriptions" : "/login";
            }}
          />
          <TogglePill
            label="MII"
            active={miiOnly}
            onClick={() => {
              if (isPremium) setMiiOnly(!miiOnly);
              else window.location.href = user ? "/dashboard/subscriptions" : "/login";
            }}
          />
        </div>
      </FilterSection>

      {/* ── Timeline ── */}
      <FilterSection
        title="Timeline"
        icon={<CalendarClock className="w-3.5 h-3.5" />}
        count={dateFilter !== "all" ? 1 : 0}
        onClear={() => setDateFilter("all")}
      >
        <FilterDropdown
          label="Closing Date"
          fullWidth
          items={[
            { label: "Ending Today", value: "today", count: 0 },
            { label: "This Week",    value: "week",  count: 0 },
          ]}
          selected={dateFilter !== "all" ? [dateFilter] : []}
          mode="single"
          onSelect={(v) => setDateFilter(dateFilter === v ? "all" : v)}
          onClear={() => setDateFilter("all")}
          searchable={false}
        />
      </FilterSection>

    </aside>
  );
}
