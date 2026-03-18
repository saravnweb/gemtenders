"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, FileText, Bookmark, Info, RefreshCw, MapPin, Filter, X, ChevronDown, Shield, Bell, CheckCircle, Loader2, Share2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Utility: convert a string to Title Case
function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const KEYWORD_CATEGORIES = [
  { id: "civil", name: "Civil Works", icon: "🏗️", keywords: ["civil", "construction", "concrete", "building", "repair", "road", "flooring"] },
  { id: "electric", name: "Electrical", icon: "⚡", keywords: ["elec", "wiring", "transformer", "cable", "ups", "battery", "light"] },
  { id: "it", name: "IT & Tech", icon: "💻", keywords: ["software", "hardware", "computer", "server", "it", "networking", "cctv"] },
  { id: "service", name: "Services", icon: "🛠️", keywords: ["service", "manpower", "maintenance", "consultancy", "security", "cleaning"] },
  { id: "medical", name: "Medical", icon: "🏥", keywords: ["medical", "hospital", "medicine", "surgical", "health", "lab"] },
  { id: "furn", name: "Furniture", icon: "🪑", keywords: ["furniture", "chair", "table", "almirah", "cupboard", "modular"] },
  { id: "auto", name: "Vehicles", icon: "🚗", keywords: ["vehicle", "car", "truck", "transport", "driver", "taxi"] },
  { id: "supply", name: "Supplies", icon: "📦", keywords: ["supply", "stationery", "paper", "consumables", "item"] },
];

function getCategory(title: string, summary: string) {
  const text = `${title} ${summary || ""}`.toLowerCase();
  return KEYWORD_CATEGORIES.find(cat => 
    cat.keywords.some(k => text.includes(k))
  );
}

// Utility: split concatenated Ministry/Department strings properly and format as requested
function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = org || "";

  const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"];

  // If ministry is empty but dept contains a concatenated string
  if (!ministryStr && deptStr) {
    // 1. Try splitting by keywords
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) {
      ministryStr = match[1].trim();
      deptStr = match[2].trim();
    } else {
      // 2. Try splitting by repetition e.g. "Ministry Of CoalCoal India"
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) {
         ministryStr = repeatMatch[1].trim();
         deptStr = deptStr.substring(ministryStr.length).trim();
      }
    }
  }

  // Handle State names at the end of department string - move to front if ministry is missing
  states.forEach(state => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, 'i');
    if (stateRegex.test(deptStr)) {
       if (!ministryStr) ministryStr = state;
       deptStr = deptStr.replace(stateRegex, '$1').trim();
    }
  });

  // Final check: if dept starts with ministry, remove it to avoid duplicates
  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
     deptStr = deptStr.substring(ministryStr.length).trim();
  }
  
  // Specific fix for "Ministry Of Coalneyveli" -> "Ministry Of Coal, Neyveli"
  if (ministryStr.toLowerCase() === "ministry of coal" && deptStr.toLowerCase().startsWith("neyveli")) {
     // Already matches ministry, just ensure Neyveli is clean
  } else if (deptStr.toLowerCase().includes("ministry of coalneyveli")) {
     ministryStr = "Ministry Of Coal";
     deptStr = deptStr.replace(/ministry of coalneyveli/i, "Neyveli").trim();
  }

  // Clean up cases where keywords are stuck to previous words
  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, '$1, $2');

  // Filter out duplicates if org is already mentioned
  if (orgStr && (deptStr.toLowerCase().includes(orgStr.toLowerCase()) || ministryStr.toLowerCase().includes(orgStr.toLowerCase()))) {
    orgStr = "";
  }

  const parts = [ministryStr, cleanDept, orgStr].filter(Boolean).map(s => toTitleCase(s));
  const result = parts.join(", ").replace(/, ,/g, ",");
  
  // Final cleanup for stuck words like "CoalCoal" or "SteelSteel"
  return result.replace(/([A-Z][a-z]+)\1/g, "$1");
}

export default function TendersPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-fresh-sky-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <TendersPage />
    </Suspense>
  );
}

function TendersPage() {
  const searchParams = useSearchParams();
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTenders, setFilteredTenders] = useState<any[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [emdFilter, setEmdFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [descriptionQuery, setDescriptionQuery] = useState("");
  const [msmeOnly, setMsmeOnly] = useState(false);
  const [miiOnly, setMiiOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedTenderIds, setSavedTenderIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "foryou">("all");
  const [visibleCount, setVisibleCount] = useState(21);
  const [sortOrder, setSortOrder] = useState<"newest" | "ending_soon">("newest");

  useEffect(() => {
    if (showFilters) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showFilters]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchSavedTenders(user.id);
        fetchSavedSearches(user.id);
      }
    });
  }, []);

  async function fetchSavedTenders(userId: string) {
    const { data } = await supabase
      .from("saved_tenders")
      .select("tender_id")
      .eq("user_id", userId);
    if (data) {
      setSavedTenderIds(new Set(data.map(t => t.tender_id)));
    }
  }

  async function fetchSavedSearches(userId: string) {
    const { data } = await supabase
      .from("saved_searches")
      .select("*")
      .eq("user_id", userId);
    if (data) {
      setSavedSearches(data);
    }
  }

  const forYouTenders = useMemo(() => {
    if (!savedSearches || savedSearches.length === 0) return [];
    return tenders.filter((tender) => {
      return savedSearches.some((search) => {
        const params = search.query_params;
        if (!params) return false;
        
        let matchesSearch = true;
        
        if (params.q) {
          const keywords = params.q.toLowerCase().split(',').map((k: string) => k.trim()).filter(Boolean);
          if (keywords.length > 0) {
            const textMatch = keywords.some((query: string) => 
              tender.title?.toLowerCase().includes(query) ||
              tender.bid_number?.toLowerCase().includes(query) ||
              tender.department?.toLowerCase().includes(query) ||
              tender.ai_summary?.toLowerCase().includes(query)
            );
            if (!textMatch) matchesSearch = false;
          }
        }
        
        const alertStates = params.states || (params.state ? [params.state] : []);
        const globalStates = user?.user_metadata?.preferred_states || [];
        const finalStates = alertStates.length > 0 ? alertStates : globalStates;
        
        if (finalStates.length > 0 && !finalStates.includes(tender.state)) {
           matchesSearch = false;
        }

        const alertCities = params.cities || (params.city ? [params.city] : []);
        const globalCities = user?.user_metadata?.preferred_cities || [];
        const finalCities = alertCities.length > 0 ? alertCities : globalCities;

        if (finalCities.length > 0 && !finalCities.includes(tender.city)) {
           matchesSearch = false;
        }
        
        if (params.category) {
          const cat = KEYWORD_CATEGORIES.find(c => c.id === params.category);
          if (cat) {
            const text = `${tender.title} ${tender.ai_summary || ""}`.toLowerCase();
            if (!cat.keywords.some(k => text.includes(k))) matchesSearch = false;
          }
        }

        if (params.description) {
          const dq = params.description.toLowerCase();
          if (!tender.ai_summary?.toLowerCase().includes(dq)) matchesSearch = false;
        }

        // MSE / MII check (only check if params specifically requested true, to not exclude bids)
        if (params.msme && !tender.eligibility_msme) matchesSearch = false;
        if (params.mii && !tender.eligibility_mii) matchesSearch = false;

        return matchesSearch;
      });
    });
  }, [tenders, savedSearches, user]);

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearchQuery(q);
    const s = searchParams.getAll("state");
    try {
      const prefStates = JSON.parse(localStorage.getItem("preferredStates") || "[]");
      if (s.length > 0) {
        setSelectedStates(s);
      } else if (prefStates.length > 0) {
        setSelectedStates(prefStates);
      }
    } catch {
      setSelectedStates([]);
    }

    const c = searchParams.getAll("city");
    try {
      const prefCities = JSON.parse(localStorage.getItem("preferredCities") || "[]");
      if (c.length > 0) {
        setSelectedCities(c);
      } else if (prefCities.length > 0) {
        setSelectedCities(prefCities);
      }
    } catch {
      setSelectedCities([]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (tenders.length > 0) {
      const uniqueStates = Array.from(new Set(tenders.map(t => t.state).filter(Boolean))) as string[];
      setStates(uniqueStates.sort());
    }
  }, [tenders]);

  useEffect(() => {
    if (tenders.length > 0 && selectedStates.length > 0) {
      const stateTenders = tenders.filter(t => selectedStates.includes(t.state));
      const uniqueCities = Array.from(new Set(stateTenders.map(t => t.city).filter(Boolean))) as string[];
      setCities(uniqueCities.sort());
    } else if (tenders.length > 0) {
      const uniqueCities = Array.from(new Set(tenders.map(t => t.city).filter(Boolean))) as string[];
      setCities(uniqueCities.sort());
    } else {
      setCities([]);
    }
  }, [tenders, selectedStates]);

  useEffect(() => {
    if (selectedStates.length > 0) {
      localStorage.setItem("preferredStates", JSON.stringify(selectedStates));
    } else {
      localStorage.removeItem("preferredStates");
    }
  }, [selectedStates]);

  useEffect(() => {
    if (selectedCities.length > 0) {
      localStorage.setItem("preferredCities", JSON.stringify(selectedCities));
    } else {
      localStorage.removeItem("preferredCities");
    }
  }, [selectedCities]);

  useEffect(() => {
    let filtered = tenders;

    if (searchQuery.trim()) {
      const keywords = searchQuery.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      if (keywords.length > 0) {
        filtered = filtered.filter(t =>
          keywords.some(query => 
            t.title?.toLowerCase().includes(query) ||
            t.bid_number?.toLowerCase().includes(query) ||
            t.department?.toLowerCase().includes(query) ||
            t.ministry_name?.toLowerCase().includes(query) ||
            t.department_name?.toLowerCase().includes(query) ||
            t.organisation_name?.toLowerCase().includes(query) ||
            t.office_name?.toLowerCase().includes(query) ||
            t.state?.toLowerCase().includes(query) ||
            t.city?.toLowerCase().includes(query) ||
            t.ai_summary?.toLowerCase().includes(query)
          )
        );
      }
    }

    if (selectedStates.length > 0) {
      filtered = filtered.filter(t => selectedStates.includes(t.state));
    }

    if (selectedCities.length > 0) {
      filtered = filtered.filter(t => selectedCities.includes(t.city));
    }

    if (descriptionQuery.trim()) {
      const dKeywords = descriptionQuery.toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
      if (dKeywords.length > 0) {
        filtered = filtered.filter(t => 
          dKeywords.some(q => t.ai_summary?.toLowerCase().includes(q))
        );
      }
    }

    if (msmeOnly) {
      filtered = filtered.filter(t => t.eligibility_msme);
    }

    if (miiOnly) {
      filtered = filtered.filter(t => t.eligibility_mii);
    }

    if (selectedCategory) {
      const cat = KEYWORD_CATEGORIES.find(c => c.id === selectedCategory);
      if (cat) {
        filtered = filtered.filter(t => {
          const text = `${t.title} ${t.ai_summary || ""}`.toLowerCase();
          return cat.keywords.some(k => text.includes(k));
        });
      }
    }

    if (emdFilter !== "all") {
      filtered = filtered.filter(t => {
        const emd = t.emd_amount || 0;
        if (emdFilter === "free") return emd === 0;
        if (emdFilter === "<1L") return emd > 0 && emd < 100000;
        if (emdFilter === "1-5L") return emd >= 100000 && emd <= 500000;
        if (emdFilter === ">5L") return emd > 500000;
        return true;
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      filtered = filtered.filter(t => {
        const endDate = new Date(t.end_date);
        endDate.setHours(0, 0, 0, 0);
        if (dateFilter === "today") return endDate.getTime() === now.getTime();
        if (dateFilter === "week") {
          const weekLater = new Date();
          weekLater.setDate(now.getDate() + 7);
          return endDate >= now && endDate <= weekLater;
        }
        return true;
      });
    }

    if (activeTab === "foryou" && savedSearches.length > 0) {
      filtered = filtered.filter(tender => forYouTenders.includes(tender));
    }

    if (sortOrder === "newest") {
      filtered = [...filtered].sort((a, b) => {
        // Handle possible date string inconsistencies
        const parseDate = (dString: any) => {
          if (!dString) return 0;
          let ms = new Date(dString).getTime();
          if (isNaN(ms) && typeof dString === 'string') {
            const parts = dString.split('-');
            if (parts.length === 3 && parts[0].length <= 2) {
              // try DD-MM-YYYY parsing
              ms = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime();
            }
          }
          return isNaN(ms) ? 0 : ms;
        };
        const dateA = parseDate(a.start_date);
        const dateB = parseDate(b.start_date);
        if (dateA !== dateB) return dateB - dateA; // Descending
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
    } else if (sortOrder === "ending_soon") {
      filtered = [...filtered].sort((a, b) => {
        const parseDate = (dString: any) => {
          if (!dString) return 8640000000000000;
          let ms = new Date(dString).getTime();
          if (isNaN(ms) && typeof dString === 'string') {
            const parts = dString.split('-');
            if (parts.length === 3 && parts[0].length <= 2) {
              ms = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T23:59:59Z`).getTime();
            }
          }
          return isNaN(ms) ? 8640000000000000 : ms;
        };
        const dateA = parseDate(a.end_date);
        const dateB = parseDate(b.end_date);
        if (dateA !== dateB) return dateA - dateB; // Ascending
        return (a.created_at || "").localeCompare(b.created_at || "");
      });
    }

    setFilteredTenders(filtered);
    setVisibleCount(21);
  }, [searchQuery, tenders, selectedStates, selectedCities, emdFilter, dateFilter, msmeOnly, miiOnly, selectedCategory, descriptionQuery, activeTab, savedSearches, sortOrder]);

  async function fetchTenders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3000);

    if (!error && data) {
      setTenders(data);
      setFilteredTenders(data);
    }
    setLoading(false);
  }

  async function handleSaveSearch() {
    if (!user) {
      window.location.href = "/login?callback=" + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }

    setIsSavingSearch(true);
    const searchName = searchQuery || descriptionQuery || (selectedCategory ? KEYWORD_CATEGORIES.find(c => c.id === selectedCategory)?.name : "") || "My Tender Alert";

    const { error } = await supabase.from("saved_searches").insert({
      user_id: user.id,
      name: `${searchName} Alert`,
      query_params: {
        q: searchQuery,
        states: selectedStates,
        cities: selectedCities,
        emd: emdFilter,
        date: dateFilter,
        category: selectedCategory,
        description: descriptionQuery,
        msme: msmeOnly,
        mii: miiOnly
      },
      is_alert_enabled: true
    });

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    setIsSavingSearch(false);
  }

  async function handleToggleSaveTender(tenderId: string) {
    if (!user) {
      window.location.href = "/login?callback=" + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }

    const isSaved = savedTenderIds.has(tenderId);
    
    if (isSaved) {
      const { error } = await supabase
        .from("saved_tenders")
        .delete()
        .eq("user_id", user.id)
        .eq("tender_id", tenderId);
        
      if (!error) {
        const newSet = new Set(savedTenderIds);
        newSet.delete(tenderId);
        setSavedTenderIds(newSet);
      }
    } else {
      const { error } = await supabase
        .from("saved_tenders")
        .insert({ user_id: user.id, tender_id: tenderId });
        
      if (!error) {
        setSavedTenderIds(new Set([...savedTenderIds, tenderId]));
      }
    }
  }

  return (
    <div className="min-h-screen bg-fresh-sky-50 text-slate-800 font-sans">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">

        {/* Hero Command Center */}
        <div className="mb-6 sm:mb-8 relative z-10 w-full">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:items-end justify-between">
            <div className="flex-1 w-full">
              {/* Title Section */}
              <div className="flex items-center space-x-2 mb-1.5 sm:mb-3">
                <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs text-blue-600 font-bold tracking-wide uppercase">Live Updates</span>
              </div>
              <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-1 sm:mb-2">Find Your Next Tender</h2>
              
              {/* Universal Search Bar embedded in Hero */}
              <div className="mt-3 sm:mt-4 flex flex-row gap-2 sm:gap-3 max-w-3xl w-full">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by keywords, bid number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 pl-9 sm:pl-12 pr-[80px] sm:pr-[120px] text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none leading-normal"
                  />
                  <div className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 flex items-center">
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 sm:p-1.5 rounded-full transition-colors mr-1 sm:mr-1.5"
                      >
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center justify-center">
                      <span className="hidden sm:inline">Search</span>
                      <Search className="w-3.5 h-3.5 sm:hidden" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`shrink-0 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 font-bold text-xs sm:text-sm ${showFilters ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm'}`}
                >
                  <Filter className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${showFilters ? 'text-white' : 'text-slate-500'}`} />
                  <span className="hidden sm:inline">Filters</span>
                  {(!showFilters && (selectedStates.length > 0 || selectedCities.length > 0 || emdFilter !== "all" || dateFilter !== "all" || msmeOnly || miiOnly || selectedCategory || descriptionQuery)) && (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 sm:ml-1"></span>
                  )}
                </button>
              </div>

              {/* Save Keyword Quick Action */}
              {(searchQuery.trim() || selectedStates.length > 0 || selectedCities.length > 0 || emdFilter !== "all" || dateFilter !== "all" || msmeOnly || miiOnly || selectedCategory || descriptionQuery) && (
                <div className="mt-3 sm:mt-4 flex items-center space-x-3 animate-in fade-in duration-300">
                  <button
                    onClick={handleSaveSearch}
                    disabled={isSavingSearch || saveSuccess}
                    className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all shadow-sm ${saveSuccess ? 'bg-green-500 text-white shadow-green-100' : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'}`}
                  >
                    {isSavingSearch ? (
                      <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    ) : (
                      <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    )}
                    <span>{saveSuccess ? "Saved!" : "Save Alert"}</span>
                  </button>
                  <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">Get notified when new tenders match these filters.</p>
                </div>
              )}
            </div>

            {/* Removed right side controls to embed in tab section */}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-200">
          <div className="flex space-x-4 sm:space-x-6 overflow-x-auto no-scrollbar flex-1 pt-1">
            <button 
              onClick={() => setActiveTab("all")}
              className={`pb-3 text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All Active Bids
              {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
            </button>
            {user && savedSearches.length > 0 ? (
              <button 
                onClick={() => setActiveTab("foryou")}
                className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-all relative whitespace-nowrap ${activeTab === 'foryou' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Zap className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTab === 'foryou' ? 'text-blue-500' : 'text-slate-400'}`} />
                <span>For You</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${activeTab === 'foryou' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{forYouTenders.length} <span className="hidden sm:inline">{forYouTenders.length === 1 ? 'Bid' : 'Bids'}</span></span>
                {activeTab === 'foryou' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!user) {
                    window.location.href = "/login?callback=" + encodeURIComponent(window.location.pathname + window.location.search);
                  } else {
                    window.location.href = "/dashboard/keywords";
                  }
                }}
                className="group pb-3 text-sm font-bold flex items-center space-x-2 transition-all relative text-slate-500 hover:text-blue-600 whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span>For You</span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors hidden sm:inline-block">+ Add Keywords</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 pl-2 pb-3">
            <div className="hidden md:block text-xs font-bold text-slate-400">
              {filteredTenders.length} results
            </div>
            <div className="flex items-center bg-slate-50 sm:bg-transparent px-2 sm:px-0 py-1 sm:py-0 rounded font-medium">
              <span className="text-[10px] sm:text-xs text-slate-500 mr-1 sm:mr-1.5 hidden sm:inline">Sort:</span>
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value as "newest" | "ending_soon")}
                className="text-xs sm:text-sm bg-transparent border-none outline-none cursor-pointer text-slate-900 font-bold min-w-max p-0 pr-1"
              >
                <option value="newest">Newest First</option>
                <option value="ending_soon">Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Bar (Tags only now) */}
        <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1 no-scrollbar min-h-[32px]">
          {(selectedStates.length > 0 || selectedCities.length > 0 || emdFilter !== "all" || dateFilter !== "all" || msmeOnly || miiOnly || selectedCategory || descriptionQuery) && (
            <div className="flex items-center space-x-2">
              {selectedCategory && (
                <button onClick={() => setSelectedCategory(null)} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs border border-blue-700 whitespace-nowrap">
                   <span>Category: {KEYWORD_CATEGORIES.find(c => c.id === selectedCategory)?.name}</span>
                   <X className="w-3 h-3" />
                </button>
              )}
              {descriptionQuery && (
                <button onClick={() => setDescriptionQuery("")} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                   <span>Details: {descriptionQuery}</span>
                   <X className="w-3 h-3" />
                </button>
              )}
              {selectedStates.map(st => (
                <button key={`tag-${st}`} onClick={() => { setSelectedStates(prev => prev.filter(s => s !== st)); setSelectedCities([]); }} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                  <span>{st}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              {selectedCities.map(ct => (
                <button key={`tag-${ct}`} onClick={() => setSelectedCities(prev => prev.filter(c => c !== ct))} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                  <span>{ct}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              {msmeOnly && (
                <button onClick={() => setMsmeOnly(false)} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs border border-indigo-100 whitespace-nowrap">
                   <span>MSE</span>
                   <X className="w-3 h-3" />
                </button>
              )}
              {miiOnly && (
                <button onClick={() => setMiiOnly(false)} className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs border border-indigo-100 whitespace-nowrap">
                   <span>MII</span>
                   <X className="w-3 h-3" />
                </button>
              )}
              {emdFilter !== "all" && (
                <button onClick={() => setEmdFilter("all")} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                  <span>EMD: {emdFilter}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              {dateFilter !== "all" && (
                <button onClick={() => setDateFilter("all")} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                  <span>Date: {dateFilter}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => { 
                  setSelectedStates([]); 
                  setSelectedCities([]);
                  setEmdFilter("all"); 
                  setDateFilter("all"); 
                  setMsmeOnly(false); 
                  setMiiOnly(false); 
                  setDescriptionQuery("");
                  setSelectedCategory(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1 px-2 py-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Expanded Filters Drawer */}
        {showFilters && (
          <div className="fixed inset-0 z-100 flex justify-end">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity cursor-pointer"
              onClick={() => setShowFilters(false)}
            />
            
            {/* Drawer Content */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ease-out">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Filters</h3>
                  <p className="text-xs text-slate-500">Refine your tender search</p>
                </div>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="p-2 text-slate-400 hover:text-slate-900 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* Direct Work Search */}
                <div className="space-y-3">
                   <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <Zap className="w-3.5 h-3.5 mr-2 text-blue-500" /> Advanced Search
                    </label>
                   <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                     <input 
                      type="text" 
                      placeholder="Keywords in AI summary..." 
                      value={descriptionQuery}
                      onChange={(e) => setDescriptionQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                     />
                   </div>
                   <p className="text-[10px] text-slate-400 leading-relaxed italic">Searches deep within technical specifications extracted from PDFs.</p>
                </div>

                {/* State Filter */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-2" /> State / Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setSelectedStates([]); setSelectedCities([]); }}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedStates.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                    >
                      All States
                    </button>
                    {states.map(state => (
                      <button
                        key={state}
                        onClick={() => { 
                          setSelectedStates(prev => prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]); 
                          // Optional: clear cities when states change to avoid conflicting states-cities? Or keep them. 
                        }}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all truncate text-left ${selectedStates.includes(state) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                      >
                        {state}
                      </button>
                    ))}
                  </div>
                </div>

                {/* City Filter */}
                {cities.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-2" /> City
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto no-scrollbar">
                      <button
                        onClick={() => setSelectedCities([])}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedCities.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                      >
                        All Cities
                      </button>
                      {cities.map(city => (
                        <button
                          key={city}
                          onClick={() => setSelectedCities(prev => prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city])}
                          className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all truncate text-left ${selectedCities.includes(city) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* EMD Filter */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" /> EMD Amount
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "All Amounts", value: "all" },
                      { label: "EMD Free", value: "free" },
                      { label: "Below ₹1 Lakh", value: "<1L" },
                      { label: "₹1 Lakh – ₹5 Lakh", value: "1-5L" },
                      { label: "Above ₹5 Lakh", value: ">5L" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setEmdFilter(option.value)}
                        className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-all border ${emdFilter === option.value ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Filter */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2" /> Closing Date
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { label: "Anytime", value: "all" },
                      { label: "Ending Today", value: "today" },
                      { label: "Ending This Week", value: "week" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setDateFilter(option.value)}
                        className={`px-4 py-3 rounded-xl text-sm font-bold text-left transition-all border ${dateFilter === option.value ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preferences */}
                <div className="space-y-4 pb-10">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Shield className="w-3.5 h-3.5 mr-2" /> Preferences
                  </label>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setMsmeOnly(!msmeOnly)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${msmeOnly ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <span className="text-sm font-bold text-slate-700">MSME Eligibility Only</span>
                      <div className={`w-10 h-6 rounded-full p-1 transition-all ${msmeOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${msmeOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => setMiiOnly(!miiOnly)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${miiOnly ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                    >
                      <span className="text-sm font-bold text-slate-700">MII Preference Only</span>
                      <div className={`w-10 h-6 rounded-full p-1 transition-all ${miiOnly ? 'bg-amber-500' : 'bg-slate-200'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${miiOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm shrink-0 mt-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-slate-500 font-medium">
                    <span className="font-bold text-slate-900">{filteredTenders.length}</span> results found
                  </span>
                  <button 
                    onClick={() => {
                      setSelectedStates([]);
                      setSelectedCities([]);
                      setEmdFilter("all");
                      setDateFilter("all");
                      setMsmeOnly(false);
                      setMiiOnly(false);
                      setDescriptionQuery("");
                      setSelectedCategory(null);
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Reset All
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 active:scale-[0.98] transition-all"
                  >
                    Show {filteredTenders.length} Bids
                  </button>

                  <button
                    onClick={handleSaveSearch}
                    disabled={isSavingSearch || saveSuccess}
                    className={`w-full py-4 flex items-center justify-center space-x-2 rounded-2xl font-bold text-sm transition-all border-2 ${saveSuccess ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50 active:scale-[0.98]'}`}
                  >
                    {isSavingSearch ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveSuccess ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                    <span>{saveSuccess ? "Keyword Alert Saved!" : "Save as Keyword Alert"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tender Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-72 bg-white rounded-xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : filteredTenders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-slate-300" />
            </div>
            <h3 className="text-lg font-medium text-slate-500">No matching tenders found.</h3>
            <p className="text-slate-400 mt-1 text-sm">Try adjusting your search or trigger a new scrape in the admin.</p>
            <Link href="/admin" className="mt-6 bg-blue-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-all text-sm">
              Go to Admin
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const activeKeywords = new Set<string>();
                if (searchQuery.trim()) {
                  searchQuery.split(',').forEach(k => { if (k.trim()) activeKeywords.add(k.trim()); });
                }
                if (descriptionQuery.trim()) {
                  descriptionQuery.split(',').forEach(k => { if (k.trim()) activeKeywords.add(k.trim()); });
                }
                if (activeTab === "foryou") {
                   savedSearches.forEach(s => {
                     if (s.query_params?.q) {
                       s.query_params.q.split(',').forEach((k: string) => {
                         if (k.trim()) activeKeywords.add(k.trim());
                       });
                     }
                   });
                }
                const highlightTerms = Array.from(activeKeywords);

                return filteredTenders.slice(0, visibleCount).map((tender) => (
                  <TenderCard 
                    key={tender.id} 
                    tender={tender} 
                    setSearchQuery={setSearchQuery}
                    setSelectedStates={setSelectedStates}
                    isSaved={savedTenderIds.has(tender.id)}
                    onToggleSave={() => handleToggleSaveTender(tender.id)}
                    highlightTerms={highlightTerms}
                  />
                ));
              })()}
            </div>
            
            {visibleCount < filteredTenders.length && (
              <div className="mt-8 mb-4 flex justify-center">
                <button
                  onClick={() => setVisibleCount(v => v + 21)}
                  className="bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-8 rounded-xl border border-slate-200 shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:outline-none flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span>Load More Tenders</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function HighlightedText({ text, highlightTerms }: { text: string; highlightTerms: string[] }) {
  if (!text) return null;
  if (!highlightTerms || highlightTerms.length === 0) return <>{text}</>;

  const validTerms = highlightTerms.filter(t => t.trim().length > 0);
  if (validTerms.length === 0) return <>{text}</>;

  const regexString = validTerms
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
    .join('|');
    
  if (!regexString) return <>{text}</>;

  const regex = new RegExp(`(${regexString})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        validTerms.some(term => term.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 text-slate-900 rounded-[2px] px-[2px] font-bold shadow-[0_0_2px_rgba(0,0,0,0.1)]">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function TenderCard({ 
  tender, 
  setSearchQuery, 
  setSelectedStates,
  isSaved,
  onToggleSave,
  highlightTerms = []
}: { 
  tender: any, 
  setSearchQuery: (q: string) => void,
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>,
  isSaved: boolean,
  onToggleSave: () => void,
  highlightTerms?: string[]
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isFallbackDate = tender.start_date === tender.end_date;
  const isClosingSoon = !isFallbackDate && (new Date(tender.end_date).getTime() - Date.now() < 86400000);
  const formattedEMD = tender.emd_amount === 0
    ? "No EMD"
    : tender.emd_amount
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "N/A";

  const bidId = tender.bid_number?.replace(/\//g, "/");
  const departmentDisplay = formatDepartmentInfo(
    tender.ministry_name, 
    tender.department_name || tender.department,
    tender.organisation_name
  );
  
  const category = getCategory(tender.title, tender.ai_summary);

  return (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md flex flex-col h-full relative overflow-hidden">
      
      {/* Category Tag (Top Right) */}
      {category && (
        <div className="absolute top-4 right-4 z-10">
          <span className="flex items-center space-x-1 px-2 py-1 bg-white/80 backdrop-blur-sm border border-slate-100 rounded-md text-[10px] font-bold text-slate-500 shadow-sm transition-all group-hover:bg-blue-50 group-hover:border-blue-100 group-hover:text-blue-600">
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </span>
        </div>
      )}

      {/* 1: Title */}
      <div className="mb-2">
        <Link
          href={`/tenders/${tender.slug}`}
          className="hover:no-underline group/title focus:outline-none"
        >
          <h3 className={`text-sm sm:text-[15px] font-medium text-slate-800 leading-snug transition-colors group-hover/title:text-blue-700 after:absolute after:inset-0 after:z-0 ${isExpanded ? '' : 'line-clamp-2'}`}>
            <HighlightedText text={tender.title} highlightTerms={highlightTerms} />
          </h3>
        </Link>
        {tender.title && tender.title.length > 60 && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-[11px] text-blue-500 mt-1 hover:text-blue-700 flex items-center relative z-10"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* 2: Department */}
      <div className="mb-3 relative z-20">
        <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-slate-500 leading-tight">
          {departmentDisplay.split(", ").filter(Boolean).map((part, idx, arr) => (
            <span key={idx} className="flex items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery(part);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-blue-600 hover:underline transition-colors text-left"
              >
                {part}
              </button>
              {idx < arr.length - 1 && <span className="ml-1 text-slate-300">,</span>}
            </span>
          ))}
        </div>
      </div>

      {/* AI Insight Snippet */}
      {tender.ai_summary && (
        <div className="mb-3 p-2.5 bg-blue-50/50 rounded-lg border border-blue-50 relative z-10">
          <div className="flex items-center space-x-1 mb-1 opacity-60">
             <Zap className="w-2.5 h-2.5 text-blue-500" />
             <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">AI Insight</span>
          </div>
          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed italic">
            "<HighlightedText text={tender.ai_summary} highlightTerms={highlightTerms} />"
          </p>
        </div>
      )}

      {/* 3: Location & Bid ID */}
      <div className="flex items-center justify-between mb-3 relative z-20">
        <div className="flex items-center text-xs text-slate-400 space-x-1.5 min-w-0">
          <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
          <div className="flex items-center truncate">
            {tender.city && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery(tender.city);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="hover:text-blue-600 hover:underline transition-colors truncate"
                >
                  {tender.city}
                </button>
                {tender.state && <span className="mx-1">,</span>}
              </>
            )}
            {tender.state && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStates([tender.state]);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hover:text-blue-600 hover:underline transition-colors truncate"
              >
                {tender.state}
              </button>
            )}
            {!tender.city && !tender.state && (
               <span className="truncate">{tender.location || "N/A"}</span>
            )}
          </div>
          <span className="text-slate-200 shrink-0">|</span>
          <span className="font-mono text-[11px] text-slate-400 truncate">{bidId}</span>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {tender.eligibility_msme && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 cursor-help" title="MSE Preferred">MSE</span>
          )}
          {tender.eligibility_mii && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100 cursor-help" title="MII Preferred">MII</span>
          )}
          <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">GeM</span>
        </div>
      </div>

      {/* 4: EMD & Dates */}
      <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 mb-4 bg-slate-50 -mx-4 px-4 relative z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 mb-0.5">EMD Amount</span>
          <span className="text-[13px] font-medium text-slate-700 truncate">{formattedEMD}</span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200">
          <span className="text-[10px] text-slate-400 mb-0.5">Start Date</span>
          <span className="text-[13px] font-medium text-slate-700">
            {isFallbackDate ? "Pending" : (tender.start_date ? new Date(tender.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : "N/A")}
          </span>
        </div>
        <div className="flex flex-col items-end border-l border-slate-200 pl-1">
          <div className="flex items-center space-x-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-slate-400" />
            <span className="text-[10px] text-slate-400">Close Date</span>
          </div>
          <span className={`text-[13px] font-medium ${isClosingSoon ? 'text-red-500' : 'text-slate-700'}`}>
            {isFallbackDate ? "Pending" : new Date(tender.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          </span>
        </div>
      </div>

      {/* 5: Actions */}
      <div className="flex gap-2 mt-auto relative z-20">
        <Link
          href={`/tenders/${tender.slug}`}
          className="flex-1 h-9 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[11px] sm:text-xs font-bold flex items-center justify-center transition-all hover:bg-blue-100 active:scale-[0.98]"
        >
          View Full Details
        </Link>
        {tender.pdf_url && (
          <a
            href={tender.pdf_url}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-all active:scale-[0.98]"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({
                title: tender.title,
                url: `${window.location.origin}/tenders/${tender.slug}`
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(`${window.location.origin}/tenders/${tender.slug}`);
              alert("Link copied to clipboard!");
            }
          }}
          className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-all active:scale-[0.98]"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center transition-all active:scale-[0.98] ${isSaved ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          title={isSaved ? "Saved" : "Save"}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function Option({ children, value }: { children: React.ReactNode, value: string }) {
  return <option value={value}>{children}</option>;
}
