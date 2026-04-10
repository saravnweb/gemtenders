"use client";

import { Dispatch, SetStateAction } from "react";
import { MapPin, Building2, Tag, Banknote, CalendarClock, Clock, Zap, SlidersHorizontal } from "lucide-react";
import { FilterSection } from "./FilterSection";
import { FilterDropdown } from "./FilterDropdown";
import { TogglePill } from "./TogglePill";
import { CATEGORIES } from "@/lib/categories";

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
  const matchesFilters = (t: any, excludeFacet?: string) => {
    // We normalize to ensure comparisons match what the user selected
    if (excludeFacet !== 'state' && selectedStates.length > 0) {
      const norm = normalizeState(t.state);
      if (!norm || !selectedStates.includes(norm)) return false;
    }
    if (excludeFacet !== 'city' && selectedCities.length > 0) {
      if (!t.city || !selectedCities.includes(t.city)) return false;
    }
    if (excludeFacet !== 'ministry' && selectedMinistries.length > 0) {
      if (!t.ministry_name || !selectedMinistries.includes(t.ministry_name)) return false;
    }
    if (excludeFacet !== 'org' && selectedOrgs.length > 0) {
      if (!t.organisation_name || !selectedOrgs.includes(t.organisation_name)) return false;
    }
    if (excludeFacet !== 'category' && selectedCategories.length > 0) {
      if (!t.category || !selectedCategories.includes(t.category)) return false;
    }
    return true;
  };

  const stateItems = (() => {
    const base = (searchQuery.trim() || contextualTenders.length > 0) ? (contextualStates.length > 0 ? contextualStates : states) : states;
    
    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'state')) {
        const key = normalizeState(t.state) || "Unknown State";
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
    return merged.sort((a, b) => b.count - a.count);
  })();

  const cityItems = (() => {
    const base = (searchQuery.trim() || contextualTenders.length > 0) ? (contextualCities.length > 0 ? contextualCities : cities) : cities;
    
    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'city')) {
        counts[t.city] = (counts[t.city] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedCities.forEach((c) => {
      if (!merged.find((i) => i.value === c)) merged.push({ label: c, value: c, count: counts[c] || 0 });
    });
    return merged.sort((a, b) => b.count - a.count);
  })();

  const ministryItems = (() => {
    const base = (searchQuery.trim() || contextualTenders.length > 0) ? (contextualMinistries.length > 0 ? contextualMinistries : ministries) : ministries;
    
    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'ministry')) {
        counts[t.ministry_name] = (counts[t.ministry_name] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedMinistries.forEach((s) => {
      if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: counts[s] || 0 });
    });
    return merged.sort((a, b) => b.count - a.count);
  })();

  const orgItems = (() => {
    const base = (searchQuery.trim() || contextualTenders.length > 0) ? (contextualOrgs.length > 0 ? contextualOrgs : orgs) : orgs;
    
    const counts: Record<string, number> = {};
    contextualTenders.forEach(t => {
      if (matchesFilters(t, 'org')) {
        counts[t.organisation_name] = (counts[t.organisation_name] || 0) + 1;
      }
    });

    const merged = base.map(item => ({
      ...item,
      count: counts[item.value] || 0
    }));

    selectedOrgs.forEach((s) => {
      if (!merged.find((i) => i.value === s)) merged.push({ label: s, value: s, count: counts[s] || 0 });
    });
    return merged.sort((a, b) => b.count - a.count);
  })();

  const categoryItems = (() => {
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
  })();

  // Helper to normalize state names for matching
  function normalizeState(s: string | null) {
    if (!s) return null;
    return s.trim();
  }

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
