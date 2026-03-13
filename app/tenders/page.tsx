"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, Bookmark, Info } from "lucide-react";
import Link from "next/link";

const EXEC_ID = Math.random().toString(36).substring(7);

export default function TendersPage() {
  console.log(`>>> [CRITICAL DEBUG] TendersPage EXEC_ID: ${EXEC_ID} | URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}`);
  const [tenders, setTenders] = useState<any[]>([]);
  const [filteredTenders, setFilteredTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenders() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("tenders")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase Error:", error);
          setError(error.message);
        } else if (data) {
          setTenders(data);
          setFilteredTenders(data);
        }
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError(err.message);
      }
      setLoading(false);
    }
    fetchTenders();
  }, []);

  useEffect(() => {
    let result = tenders.filter((t) => {
      const searchStr = `${t.title} ${t.bid_number} ${t.department} ${t.ai_summary || ""}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });

    if (sortBy === "closing") {
      result.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredTenders(result);
  }, [searchTerm, tenders, sortBy]);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">GeM Watch <span className="text-[8px] text-emerald-400">V2.1</span></h1>
          </div>
          
          <div className="relative max-w-md w-full ml-8 hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by bid number, work name, or department..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
            />
          </div>

          <div className="flex items-center space-x-4">
            <button className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition-colors">Sign In</button>
            <button className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200">
              Get Alerts
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0 text-center md:text-left">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Explore Active Tenders</h2>
            <p className="mt-2 text-gray-500">Real-time data from Indian Government e-Marketplace, summarized by AI.</p>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm text-gray-400">Sort by:</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm font-medium bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="closing">Closing Soonest</option>
              <option value="newest">Recently Published</option>
            </select>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mb-4 text-[10px] text-gray-300 font-mono">
           Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING"} | 
           Mode: Client | 
           Tenders Count: {tenders.length} |
           Filtered: {filteredTenders.length}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-3xl text-red-600 flex items-center space-x-3">
             <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-red-600 rotate-180" />
             </div>
             <div>
                <p className="text-sm font-bold">Database Connection Error</p>
                <p className="text-xs opacity-80">{error}</p>
             </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredTenders.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl">
            <h3 className="text-lg font-medium text-gray-400">
              {searchTerm ? `No results found for "${searchTerm}"` : "No tenders indexed yet. Try triggering the scraper from the Admin dashboard."}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  const isClosingSoon = new Date(tender.end_date).getTime() - Date.now() < 86400000;
  const formattedEMD = tender.emd_amount 
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
    : "N/A";

  return (
    <div className="group bg-white border border-gray-100 rounded-3xl p-6 transition-all duration-300 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-500/5 flex flex-col h-full relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-100/40 transition-colors duration-500" />
      
      {/* Top Section: Organization & Meta */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md mb-1 w-fit">
            {tender.department}
          </span>
          <span className="text-[10px] font-mono text-gray-400">{tender.bid_number}</span>
        </div>
        <button className="p-2 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Save Tender">
          <Bookmark className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Section: Title & Summary */}
      <Link href={`/tenders/${tender.slug}`} className="grow group-hover:no-underline relative">
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-3 group-hover:text-emerald-700 transition-colors">
          {tender.title}
        </h3>
        
        {tender.ai_summary && (
          <div className="text-sm text-gray-600 line-clamp-2 mb-4 bg-gray-50/50 p-3 rounded-2xl border border-gray-50 text-balance italic font-medium">
            "{tender.ai_summary}"
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-1">EMD Amount</span>
            <span className="text-sm font-bold text-gray-800">{formattedEMD}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-1">Status</span>
            <div className="flex items-center">
               <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
               <span className="text-xs font-semibold text-emerald-700">Active</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Tags Section */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-[9px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">GeM</span>
        {tender.eligibility_msme && <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">MSME</span>}
        {tender.eligibility_mii && <span className="text-[9px] font-bold px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">MII</span>}
      </div>

      {/* Footer: Date & Actions */}
      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight mb-1">Closes on</span>
          <div className={`flex items-center text-xs font-semibold ${isClosingSoon ? 'text-red-600' : 'text-gray-700'}`}>
            <Clock className="w-3 h-3 mr-1" />
            {new Date(tender.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {tender.pdf_url && (
            <a 
              href={tender.pdf_url} 
              target="_blank" 
              className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all border border-transparent hover:border-emerald-100"
              title="Download PDF"
            >
              <Download className="w-5 h-5" />
            </a>
          )}
          <Link 
            href={`/tenders/${tender.slug}`}
            className="flex items-center space-x-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-5 py-2.5 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm shadow-emerald-100 hover:shadow-emerald-200"
          >
            <Info className="w-4 h-4" />
            <span>View Bid</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
