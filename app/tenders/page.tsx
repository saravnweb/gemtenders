"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, FileText, Bookmark, Info, RefreshCw, MapPin } from "lucide-react";
import Link from "next/link";

export default function TendersPage() {
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTenders, setFilteredTenders] = useState<any[]>([]);

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTenders(tenders);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tenders.filter(t => 
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
    setFilteredTenders(filtered);
  }, [searchQuery, tenders]);

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
    <div className="min-h-screen bg-fresh-sky-50 text-fresh-sky-900 font-sans dark:bg-fresh-sky-950 dark:text-white">
      {/* Header */}
      <header className="border-b border-fresh-sky-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 dark:bg-fresh-sky-900/80 dark:border-fresh-sky-800">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-atomic-tangerine-500 rounded-lg flex items-center justify-center shadow-lg shadow-atomic-tangerine-200 dark:shadow-none">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-fresh-sky-900 dark:text-white hidden sm:block">
                <span className="text-atomic-tangerine-600">GeM</span> Watch
              </h1>
            </Link>
          </div>
          
          <div className="relative max-w-md w-full ml-8 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fresh-sky-400" />
            <input 
              type="text" 
              placeholder="Search by bid, title, or department..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-fresh-sky-100 dark:bg-fresh-sky-800 border-none rounded-full py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-atomic-tangerine-500/20 transition-all outline-none"
            />
          </div>

          <div className="flex items-center space-x-4">
             <Link href="/admin" className="text-sm font-bold text-atomic-tangerine-600 px-4 py-2 rounded-full border border-atomic-tangerine-100 hover:bg-atomic-tangerine-50 transition-all dark:border-atomic-tangerine-900 dark:hover:bg-atomic-tangerine-900/20">
                Admin
             </Link>
            <button className="bg-atomic-tangerine-600 text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-atomic-tangerine-700 transition-all shadow-lg shadow-atomic-tangerine-200 active:scale-95 dark:shadow-none">
              Get Alerts
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-10">
        <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between mb-12 space-y-4 md:space-y-0">
          <div>
            <div className="inline-flex items-center space-x-2 bg-muted-olive-50 text-muted-olive-700 dark:bg-muted-olive-900/30 dark:text-muted-olive-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-olive-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-olive-500"></span>
              </span>
              <span>Live Updates</span>
            </div>
            <h2 className="text-4xl font-black tracking-tight text-fresh-sky-900 dark:text-white">Explore Active Tenders</h2>
            <p className="mt-2 text-fresh-sky-600 dark:text-fresh-sky-300 text-lg">Real-time data from GeM portal, enhanced with AI summaries.</p>
          </div>
          
          <div className="hidden sm:flex items-center space-x-4">
            <button 
              onClick={fetchTenders}
              className="p-3 bg-white dark:bg-fresh-sky-900 rounded-2xl text-fresh-sky-400 hover:text-atomic-tangerine-600 hover:bg-atomic-tangerine-50 transition-all border border-fresh-sky-100 dark:border-fresh-sky-800"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center bg-white dark:bg-fresh-sky-900 px-4 py-2 rounded-2xl border border-fresh-sky-100 dark:border-fresh-sky-800 shadow-sm">
                <span className="text-xs text-fresh-sky-400 mr-2 font-bold uppercase">Sort:</span>
                <select className="text-xs font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer text-fresh-sky-700 dark:text-fresh-sky-200">
                    <option>Newest First</option>
                    <option>Ending Soon</option>
                </select>
            </div>
          </div>
        </div>

        {/* Search for mobile */}
        <div className="relative w-full mb-4 sm:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fresh-sky-400" />
            <input 
              type="text" 
              placeholder="Search tenders..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-fresh-sky-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-atomic-tangerine-500/20 transition-all outline-none"
            />
        </div>

        {/* Tender Grid */}
        {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="h-80 bg-white/50 dark:bg-fresh-sky-900/50 rounded-3xl animate-pulse" />
                ))}
             </div>
        ) : filteredTenders.length === 0 ? (
          <div className="text-center py-24 border-4 border-dotted border-fresh-sky-100 dark:border-fresh-sky-800 rounded-[3rem] flex flex-col items-center">
            <div className="w-20 h-20 bg-white dark:bg-fresh-sky-900 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Search className="w-10 h-10 text-fresh-sky-200" />
            </div>
            <h3 className="text-2xl font-bold text-fresh-sky-400">No matching tenders found.</h3>
            <p className="text-fresh-sky-400 mt-2">Try adjusting your search or trigger a new scrape in the admin.</p>
            <Link href="/admin" className="mt-8 bg-atomic-tangerine-600 text-white font-bold px-8 py-3 rounded-2xl shadow-xl shadow-atomic-tangerine-200 hover:scale-105 transition-all">
                Go to Admin
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ms:gap-8">
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
    ? "No"
    : tender.emd_amount 
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "N/A";

  const bidId = tender.bid_number?.replace(/\//g, "/");

  return (
    <div className="group bg-white dark:bg-fresh-sky-900/20 border border-fresh-sky-100 dark:border-fresh-sky-800 rounded-2xl p-4 transition-all duration-300 hover:border-atomic-tangerine-200 dark:hover:border-atomic-tangerine-800 hover:shadow-xl hover:shadow-fresh-sky-200/20 dark:hover:shadow-none flex flex-col h-full relative overflow-hidden">
      
      {/* 1st Row: Title as a Stretched Link */}
      <div className="mb-2">
        <Link 
          href={`/tenders/${tender.slug}`}
          className="hover:no-underline group/title focus:outline-none"
        >
          <h3 className={`text-[14px] sm:text-[15px] font-bold text-fresh-sky-900 dark:text-white leading-snug transition-all group-hover/title:text-atomic-tangerine-600 after:absolute after:inset-0 after:z-0 ${isExpanded ? '' : 'line-clamp-2'}`}>
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
            className="text-[11px] font-bold text-atomic-tangerine-600 mt-1 hover:text-atomic-tangerine-700 flex items-center relative z-10"
          >
            {isExpanded ? "... Less" : "... More"}
          </button>
        )}
      </div>

      {/* Authority & Meta Info */}
      <div className="relative z-10 pointer-events-none">
        {/* 2nd Row: Dept Name */}
        <div className="mb-3">
            <span className="text-[11px] sm:text-[12px] font-black text-fresh-sky-700 dark:text-fresh-sky-300 uppercase tracking-tight leading-tight block">
            {tender.department}
            </span>
        </div>

        {/* 3rd Row: Meta Info (Location & Bid ID) */}
        <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap items-center text-[10px] sm:text-[11px] text-fresh-sky-500 dark:text-fresh-sky-400 font-medium space-x-2 gap-y-1">
            <div className="flex items-center">
            <MapPin className="w-3 h-3 mr-1 text-fresh-sky-300" />
            <span className="truncate max-w-[150px]">
              {tender.city && tender.state ? `${tender.city}, ${tender.state}` : (tender.city || tender.state || tender.location || "N/A")}
            </span>
          </div>
            <span className="text-fresh-sky-100 dark:text-fresh-sky-800">|</span>
            <span className="font-mono text-[10px] text-fresh-sky-300">{bidId}</span>
            </div>
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-atomic-tangerine-50 text-atomic-tangerine-600 dark:bg-atomic-tangerine-900 dark:text-atomic-tangerine-300 rounded uppercase tracking-widest">GeM</span>
        </div>
      </div>

      {/* 4th Row: Value Row */}
      <div className="flex items-center justify-between py-2 border-y border-fresh-sky-50 dark:border-fresh-sky-800 mb-4 bg-fresh-sky-50/50 dark:bg-fresh-sky-900/40 -mx-4 px-4 overflow-x-hidden relative z-10 pointer-events-none text-nowrap">
        <div className="flex flex-col">
          <div className="flex items-center space-x-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-fresh-sky-400" />
            <span className="text-[8px] text-fresh-sky-400 uppercase font-black tracking-widest">Closing Date</span>
          </div>
          <span className={`text-[12px] font-black ${isClosingSoon ? 'text-atomic-tangerine-500' : 'text-fresh-sky-900 dark:text-white'}`}>
            {new Date(tender.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="flex flex-col text-right">
          <div className="flex items-center justify-end space-x-1 mb-0.5">
            <span className="text-[8px] text-fresh-sky-400 uppercase font-black tracking-widest">EMD Amount</span>
          </div>
          <span className="text-[12px] font-black text-fresh-sky-900 dark:text-white uppercase">{formattedEMD}</span>
        </div>
      </div>

      {/* 5th Row: Action Row */}
      <div className="flex gap-2.5 mt-auto relative z-20">
        {tender.pdf_url && (
          <a 
            href={tender.pdf_url} 
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 h-9 sm:h-10 rounded-xl bg-atomic-tangerine-600 text-white text-[11px] sm:text-[12px] font-bold flex items-center justify-center space-x-2 shadow-sm shadow-atomic-tangerine-100 dark:shadow-none hover:bg-atomic-tangerine-700 active:scale-[0.98] transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </a>
        )}
        <button 
          onClick={(e) => e.stopPropagation()}
          className="flex-1 h-9 sm:h-10 rounded-xl border border-fresh-sky-200 dark:border-fresh-sky-700 text-[11px] sm:text-[12px] font-bold text-fresh-sky-600 dark:text-fresh-sky-300 flex items-center justify-center space-x-2 bg-white dark:bg-fresh-sky-800 active:bg-fresh-sky-100 transition-colors"
        >
           <Bookmark className="w-4 h-4" />
           <span>Save</span>
        </button>
      </div>
    </div>
  );
}

function Option({ children, value }: { children: React.ReactNode, value: string }) {
  return <option value={value}>{children}</option>;
}
