"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, FileText, Bookmark, Info, RefreshCw, MapPin, Filter, X, ChevronDown } from "lucide-react";
import Link from "next/link";

// Utility: convert a string to Title Case
function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

export default function TendersPage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTenders, setFilteredTenders] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState("");
  const [emdFilter, setEmdFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [states, setStates] = useState<string[]>([]);

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (tenders.length > 0) {
      const uniqueStates = Array.from(new Set(tenders.map(t => t.state).filter(Boolean))) as string[];
      setStates(uniqueStates.sort());
    }
  }, [tenders]);

  useEffect(() => {
    let filtered = tenders;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
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
      );
    }

    if (selectedState) {
      filtered = filtered.filter(t => t.state === selectedState);
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

    setFilteredTenders(filtered);
  }, [searchQuery, tenders, selectedState, emdFilter, dateFilter]);

  async function fetchTenders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTenders(data);
      setFilteredTenders(data);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-fresh-sky-50 text-slate-800 font-sans">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Page Title — desktop */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Live Updates</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-fresh-sky-950 tracking-tight">Active Bids</h2>
            <p className="mt-1 text-slate-500 text-sm">Real-time GeM data enhanced with Gemini AI summaries.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchTenders}
              className="p-2.5 bg-white rounded-xl text-slate-400 hover:text-fresh-sky-600 hover:bg-fresh-sky-50 transition-all border border-slate-200 shadow-sm"
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-400 mr-2 font-medium">Sort:</span>
              <select className="text-xs bg-transparent border-none outline-none cursor-pointer text-slate-600 font-semibold">
                <option>Newest First</option>
                <option>Ending Soon</option>
              </select>
            </div>
          </div>
        </div>

        {/* Universal Search Bar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bid number, title, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-atomic-tangerine-200 focus:border-atomic-tangerine-300 transition-all outline-none shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3.5 rounded-2xl border transition-all flex items-center space-x-2 ${showFilters ? 'bg-atomic-tangerine-500 text-white border-atomic-tangerine-600 shadow-lg shadow-atomic-tangerine-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'}`}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-bold uppercase tracking-wider">Filters</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm transition-all whitespace-nowrap ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {(selectedState || emdFilter !== "all" || dateFilter !== "all") && (
            <div className="flex items-center space-x-2">
              {selectedState && (
                <button onClick={() => setSelectedState("")} className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 whitespace-nowrap">
                  <span>State: {selectedState}</span>
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
                onClick={() => { setSelectedState(""); setEmdFilter("all"); setDateFilter("all"); }}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* State Filter */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-3 flex items-center uppercase tracking-wide">
                  <MapPin className="w-3 h-3 mr-1" /> State / Location
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  <button
                    onClick={() => setSelectedState("")}
                    className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${!selectedState ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                  >
                    All States
                  </button>
                  {states.map(state => (
                    <button
                      key={state}
                      onClick={() => setSelectedState(state)}
                      className={`px-3 py-2 rounded-lg text-xs text-left transition-all truncate ${selectedState === state ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {state}
                    </button>
                  ))}
                </div>
              </div>

              {/* EMD Filter */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-3 flex items-center uppercase tracking-wide">
                  <Zap className="w-3 h-3 mr-1" /> EMD Amount
                </label>
                <div className="flex flex-col space-y-1.5">
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
                      className={`px-3 py-2.5 rounded-lg text-sm text-left transition-all ${emdFilter === option.value ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-3 flex items-center uppercase tracking-wide">
                  <Clock className="w-3 h-3 mr-1" /> Closing Date
                </label>
                <div className="flex flex-col space-y-1.5">
                  {[
                    { label: "Anytime", value: "all" },
                    { label: "Ending Today", value: "today" },
                    { label: "Ending This Week", value: "week" }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setDateFilter(option.value)}
                      className={`px-3 py-2.5 rounded-lg text-sm text-left transition-all ${dateFilter === option.value ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{filteredTenders.length}</span> tenders match your criteria
              </span>
              <button
                onClick={() => setShowFilters(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-all"
              >
                Apply Filters
              </button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenders.map((tender) => (
              <TenderCard key={tender.id} tender={tender} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TenderCard({ tender }: { tender: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isClosingSoon = new Date(tender.end_date).getTime() - Date.now() < 86400000;
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

  return (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md flex flex-col h-full relative overflow-hidden">

      {/* 1: Title */}
      <div className="mb-2">
        <Link
          href={`/tenders/${tender.slug}`}
          className="hover:no-underline group/title focus:outline-none"
        >
          <h3 className={`text-sm sm:text-[15px] font-medium text-slate-800 leading-snug transition-colors group-hover/title:text-blue-700 after:absolute after:inset-0 after:z-0 ${isExpanded ? '' : 'line-clamp-2'}`}>
            {tender.title}
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
      <div className="mb-3 relative z-10 pointer-events-none">
        <span className="text-xs text-slate-500 leading-tight block">
          {departmentDisplay}
        </span>
      </div>

      {/* 3: Location & Bid ID */}
      <div className="flex items-center justify-between mb-3 relative z-10 pointer-events-none">
        <div className="flex items-center text-xs text-slate-400 space-x-1.5">
          <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
          <span className="truncate max-w-[140px]">
            {tender.city && tender.state ? `${tender.city}, ${tender.state}` : (tender.city || tender.state || tender.location || "N/A")}
          </span>
          <span className="text-slate-200">|</span>
          <span className="font-mono text-[11px] text-slate-400">{bidId}</span>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">GeM</span>
      </div>

      {/* 4: EMD & Closing Date */}
      <div className="flex items-center justify-between py-2.5 border-y border-slate-100 mb-4 bg-slate-50 -mx-4 px-4 relative z-10 pointer-events-none">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 mb-0.5">EMD Amount</span>
          <span className="text-sm font-medium text-slate-700">{formattedEMD}</span>
        </div>
        <div className="flex flex-col text-right">
          <div className="flex items-center justify-end space-x-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-slate-400" />
            <span className="text-[10px] text-slate-400">Closing Date</span>
          </div>
          <span className={`text-sm font-medium ${isClosingSoon ? 'text-red-500' : 'text-slate-700'}`}>
            {new Date(tender.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* 5: Actions */}
      <div className="flex gap-2 mt-auto relative z-20">
        {tender.pdf_url && (
          <a
            href={tender.pdf_url}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-xs font-medium flex items-center justify-center space-x-1.5 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        )}
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-9 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 flex items-center justify-center space-x-1.5 bg-white hover:bg-slate-50 transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}

function Option({ children, value }: { children: React.ReactNode, value: string }) {
  return <option value={value}>{children}</option>;
}
