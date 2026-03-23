"use client";

import { useState, useMemo, useEffect } from "react";
import { CATEGORIES } from "@/lib/categories";
import { supabase } from "@/lib/supabase";
import {
  Building2, MapPin, Search, Tags, Shapes, Rocket, FileText,
  Map, GraduationCap, PackageOpen, Award, Shield, FileCheck, Info,
  LineChart, CheckCircle2, Factory, Zap, ShieldCheck, Tag, X,
  Bell, BellRing
} from "lucide-react";

type TabId = "category" | "ministry" | "state" | "org" | "keyword" | "type" | "mse";

// Predefined trending keywords
const TRENDING_KEYWORDS = [
  "Solar", "CCTV", "Laptop", "Generator", "Housekeeping", 
  "Air Conditioner", "Furniture", "Ambulance", "Server", "UPS",
  "Manpower", "Drone", "Printing", "Security Guard", "Water Purifier",
  "LED Light", "Transformer", "ERP Software", "Tractor", "Catering",
  "Biometric", "AMC", "Fire Extinguisher", "Tablet", "Uniform", 
  "HDPE Pipe", "Scanner", "Projector", "Submersible Pump", "Paint"
];

export default function ExploreClient({
  topMinistries,
  stateList,
  orgList,
  stats
}: {
  topMinistries: { ministry: string; count: number }[];
  stateList: { state: string; count: number }[];
  orgList: { org: string; count: number }[];
  stats: {
    totalActive: number;
    msePreferred: number;
    startupRelaxation: number;
    miiPreference: number;
    zeroEmd: number;
    closingToday: number;
    addedToday: number;
    openBid: number;
    reverseAuction: number;
    customBid: number;
  }
}) {
  const [activeTab, setActiveTab] = useState<TabId>("category");
  const [searchQuery, setSearchQuery] = useState("");
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    async function loadFollows() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);
      const { data } = await supabase
        .from('topic_follows')
        .select('follow_type, follow_value')
        .eq('user_id', user.id);
      if (data) {
        setFollows(new Set(data.map((f: any) => `${f.follow_type}:${f.follow_value}`)));
      }
    }
    loadFollows();
  }, []);

  async function handleFollow(type: string, value: string) {
    if (!currentUser) {
      window.location.href = '/login?next=/explore';
      return;
    }
    const key = `${type}:${value}`;
    setFollowLoading(key);
    const isFollowing = follows.has(key);
    if (isFollowing) {
      await supabase
        .from('topic_follows')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('follow_type', type)
        .eq('follow_value', value);
      setFollows(prev => { const n = new Set(prev); n.delete(key); return n; });
    } else {
      await supabase
        .from('topic_follows')
        .upsert({ user_id: currentUser.id, follow_type: type, follow_value: value });
      setFollows(prev => new Set(prev).add(key));
    }
    setFollowLoading(null);
  }

  // Reset search when switching tabs
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSearchQuery("");
  };

  const filteredMinistries = useMemo(() =>
    searchQuery.trim()
      ? topMinistries.filter(m => m.ministry.toLowerCase().includes(searchQuery.toLowerCase()))
      : topMinistries,
    [topMinistries, searchQuery]
  );

  const filteredStates = useMemo(() =>
    searchQuery.trim()
      ? stateList.filter(s => s.state.toLowerCase().includes(searchQuery.toLowerCase()))
      : stateList,
    [stateList, searchQuery]
  );

  const filteredOrgs = useMemo(() =>
    searchQuery.trim()
      ? orgList.filter(o => o.org.toLowerCase().includes(searchQuery.toLowerCase()))
      : orgList,
    [orgList, searchQuery]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header Section */}
        <div className="mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-bricolage">
            Explore GeM Tenders
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold text-blue-600 dark:text-blue-400">{stats.totalActive.toLocaleString()} active bids</span> — browse by category, ministry, state, keyword or type.
          </p>
        </div>

        {/* Dynamic Tabs Navigation */}
        <div role="tablist" aria-label="Browse tenders by" className="flex flex-wrap pb-4 mb-4 items-center gap-2 sm:gap-3 border-b border-slate-200 dark:border-slate-800 animate-in fade-in duration-700">
          <TabButton id="category" label="By Category" active={activeTab === "category"} onClick={handleTabChange} />
          <TabButton id="ministry" label="By Ministry" active={activeTab === "ministry"} onClick={handleTabChange} />
          <TabButton id="state" label="By State" active={activeTab === "state"} onClick={handleTabChange} badge="new" />
          <TabButton id="org" label="By Organisation" active={activeTab === "org"} onClick={handleTabChange} badge="new" />
          <TabButton id="keyword" label="By Keyword" active={activeTab === "keyword"} onClick={handleTabChange} />
          <TabButton id="type" label="By Type" active={activeTab === "type"} onClick={handleTabChange} />
          <TabButton id="mse" label="MSE / Startup" active={activeTab === "mse"} onClick={handleTabChange} badge="new" />
        </div>

        {/* Inline search for filterable tabs */}
        {(activeTab === "ministry" || activeTab === "state" || activeTab === "org") && (
          <div className="relative mb-5 animate-in fade-in duration-300">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === "ministry" ? "Search ministries…"
                : activeTab === "state" ? "Search states…"
                : "Search organisations…"
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm pl-9 pr-9 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Tab Content Areas */}
        <div className="min-h-[500px]">
          {/* 1. BY CATEGORY */}
          {activeTab === "category" && (
            <div id="tabpanel-category" role="tabpanel" aria-labelledby="tab-category" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
                  ALL 20 CATEGORIES
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {CATEGORIES.map((cat) => (
                  <a 
                    key={cat.id} 
                    href={`/?category=${cat.id}`}
                    className="group flex flex-col p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl group-hover:scale-110 transition-transform origin-bottom-left" aria-hidden="true">{cat.icon}</span>
                      <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Search className="w-4 h-4 text-blue-500" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {cat.description}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 2. BY MINISTRY */}
          {activeTab === "ministry" && (
            <div id="tabpanel-ministry" role="tabpanel" aria-labelledby="tab-ministry" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
                  {filteredMinistries.length} {searchQuery ? "MATCHING" : "TOP"} MINISTRIES
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMinistries.map((Item, i) => (
                  <div
                    key={i}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  >
                    <a href={`/?q=${encodeURIComponent(Item.ministry)}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {Item.ministry}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center">
                          <LineChart className="w-3 h-3 mr-1" />
                          {Item.count.toLocaleString()} active tenders
                        </p>
                      </div>
                    </a>
                    <FollowButton type="ministry" value={Item.ministry} follows={follows} onFollow={handleFollow} loadingKey={followLoading} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. BY STATE */}
          {activeTab === "state" && (
            <div id="tabpanel-state" role="tabpanel" aria-labelledby="tab-state" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
                  {filteredStates.length} {searchQuery ? "MATCHING" : "INDIAN"} STATES & UTS
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-0 text-sm border-t border-l border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                {filteredStates.map((st, i) => (
                  <div
                    key={i}
                    className="flex flex-row items-center justify-between py-3 px-4 border-b border-r border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <a href={`/?state=${encodeURIComponent(st.state)}`} className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex-1 pr-2">
                      {st.state}
                    </a>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {st.count}
                      </span>
                      <FollowButton type="state" value={st.state} follows={follows} onFollow={handleFollow} loadingKey={followLoading} compact />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. BY ORGANISATION */}
          {activeTab === "org" && (
            <div id="tabpanel-org" role="tabpanel" aria-labelledby="tab-org" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
                  {filteredOrgs.length} {searchQuery ? "MATCHING" : "TOP"} ORGANISATIONS
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrgs.map((item, i) => (
                  <div
                    key={i}
                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3 hover:border-blue-500 dark:hover:border-blue-500 transition-all shadow-sm hover:shadow-md"
                  >
                    <a href={`/?q=${encodeURIComponent(item.org)}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                        <Shapes className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.org}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center">
                          <LineChart className="w-3 h-3 mr-1" />
                          {item.count.toLocaleString()} active tenders
                        </p>
                      </div>
                    </a>
                    <FollowButton type="org" value={item.org} follows={follows} onFollow={handleFollow} loadingKey={followLoading} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. BY KEYWORD */}
          {activeTab === "keyword" && (
            <div id="tabpanel-keyword" role="tabpanel" aria-labelledby="tab-keyword" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500">
                  TRENDING KEYWORDS TODAY
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {TRENDING_KEYWORDS.map((kw, i) => (
                  <a 
                    key={i} 
                    href={`/?q=${encodeURIComponent(kw)}`}
                    className="group inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full pl-4 pr-1.5 py-1.5 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all shadow-sm"
                  >
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 mr-2">
                      {kw}
                    </span>
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                      <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 5. BY TYPE */}
          {activeTab === "type" && (
            <div id="tabpanel-type" role="tabpanel" aria-labelledby="tab-type" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              <div>
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-6">
                  PROCUREMENT TYPE
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <TypeCard 
                    title="Goods" 
                    icon={<PackageOpen className="w-8 h-8 text-amber-500" />} 
                    desc="Physical products, equipment, and materials." 
                    count={null}
                    href="/?q=Goods"
                    colorClass="hover:border-amber-500 hover:shadow-amber-500/10 hover:ring-1 hover:ring-amber-500"
                  />
                  <TypeCard 
                    title="Works" 
                    icon={<Shapes className="w-8 h-8 text-purple-500" />} 
                    desc="Construction, civil works, and installation."
                    count={null}
                    href="/?q=Works"
                    colorClass="hover:border-purple-500 hover:shadow-purple-500/10 hover:ring-1 hover:ring-purple-500"
                  />
                  <TypeCard 
                    title="Services" 
                    icon={<Tag className="w-8 h-8 text-rose-500" />} 
                    desc="Manpower, consulting, AMC, and managed services." 
                    count={null}
                    href="/?q=Services"
                    colorClass="hover:border-rose-500 hover:shadow-rose-500/10 hover:ring-1 hover:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-6">
                  BID METHOD
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <TypeCard 
                    title="Open Bid (GeM)" 
                    icon={<FileText className="w-8 h-8 text-blue-500" />} 
                    desc="Standard competitive bidding across all categories."
                    count={stats.openBid} 
                    href="/?q="
                    colorClass="hover:border-blue-500 hover:shadow-blue-500/10 hover:ring-1 hover:ring-blue-500"
                  />
                  <TypeCard 
                    title="Reverse Auction (RA)" 
                    icon={<LineChart className="w-8 h-8 text-emerald-500" />} 
                    desc="Dynamic bidding where the lowest price wins."
                    count={stats.reverseAuction} 
                    href="/?q=Reverse Auction"
                    colorClass="hover:border-emerald-500 hover:shadow-emerald-500/10 hover:ring-1 hover:ring-emerald-500"
                  />
                  <TypeCard 
                    title="Custom Bid" 
                    icon={<Shapes className="w-8 h-8 text-indigo-500" />} 
                    desc="Buyer-defined specifications and unlisted products."
                    count={stats.customBid} 
                    href="/?q=Custom Bid"
                    colorClass="hover:border-indigo-500 hover:shadow-indigo-500/10 hover:ring-1 hover:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. MSE / STARTUP */}
          {activeTab === "mse" && (
            <div id="tabpanel-mse" role="tabpanel" aria-labelledby="tab-mse" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
              <div>
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-6">
                  POLICY PREFERENCES
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <a href="/?msmeOnly=true" className="group relative overflow-hidden bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-3xl p-6 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all text-center flex flex-col items-center shadow-sm">
                    <Factory className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-4" />
                    <h3 className="text-lg font-black text-emerald-900 dark:text-emerald-100 mb-2">MSE Preferred</h3>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300/70 mb-4">Tenders with Micro & Small Enterprise purchase preference applicable.</p>
                    <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 rounded-full text-sm">
                      {stats.msePreferred.toLocaleString()} active
                    </div>
                  </a>

                  <a href="/?q=" className="group relative overflow-hidden bg-fuchsia-50/50 dark:bg-fuchsia-950/20 border-2 border-fuchsia-100 dark:border-fuchsia-900/50 rounded-3xl p-6 hover:border-fuchsia-500 dark:hover:border-fuchsia-500 transition-all text-center flex flex-col items-center shadow-sm">
                    <Rocket className="w-10 h-10 text-fuchsia-600 dark:text-fuchsia-400 mb-4" />
                    <h3 className="text-lg font-black text-fuchsia-900 dark:text-fuchsia-100 mb-2">Startup Relaxation</h3>
                    <p className="text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300/70 mb-4">Tenders offering past experience and turnover criteria relaxation.</p>
                    <div className="font-mono text-fuchsia-600 dark:text-fuchsia-400 font-bold bg-fuchsia-100 dark:bg-fuchsia-900/40 px-3 py-1 rounded-full text-sm">
                      {stats.startupRelaxation.toLocaleString()} active
                    </div>
                  </a>

                  <a href="/?miiOnly=true" className="group relative overflow-hidden bg-amber-50/50 dark:bg-amber-950/20 border-2 border-amber-100 dark:border-amber-900/50 rounded-3xl p-6 hover:border-amber-500 dark:hover:border-amber-500 transition-all text-center flex flex-col items-center shadow-sm">
                    <ShieldCheck className="w-10 h-10 text-amber-600 dark:text-amber-400 mb-4" />
                    <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 mb-2">MII Preference</h3>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300/70 mb-4">Make in India (Class 1 / Class 2 Local Supplier) preference applicable.</p>
                    <div className="font-mono text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-full text-sm">
                      {stats.miiPreference.toLocaleString()} active
                    </div>
                  </a>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-black tracking-[0.2em] uppercase text-slate-400 dark:text-slate-500 mb-6">
                  NEW & FREE TO BID
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <a href="/?emdFilter=free" className="group bg-slate-900 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-slate-600 transition-colors shadow-2xl">
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white mb-2">Zero EMD Tenders</h3>
                    <p className="text-xs text-slate-400 mb-3">No earnest money deposit needed — lower barrier to bid.</p>
                    <div className="text-green-400 font-mono text-sm font-bold">{stats.zeroEmd.toLocaleString()} active</div>
                  </a>
                  <a href="/?dateFilter=today" className="group bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:border-red-500/50 transition-colors">
                    <Zap className="w-8 h-8 text-red-500 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Closing Today</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Urgent bids closing within the next 24 hours.</p>
                    <div className="text-red-500 dark:text-red-400 font-mono text-sm font-bold">{stats.closingToday.toLocaleString()} active</div>
                  </a>
                  <a href="/?sortOrder=newest" className="group bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6 text-center hover:border-blue-500 transition-colors">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs mx-auto mb-3 shadow-lg shadow-blue-500/30">NEW</div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Added Today</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Fresh tenders posted to the platform in the last 24 hours.</p>
                    <div className="text-blue-600 dark:text-blue-400 font-mono text-sm font-bold">{stats.addedToday.toLocaleString()} active</div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Helper Components
function TabButton({ id, label, active, onClick, badge }: { id: TabId, label: string, active: boolean, onClick: (id: TabId) => void, badge?: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${id}`}
      id={`tab-${id}`}
      onClick={() => onClick(id)}
      className={`relative px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${
        active
          ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white shadow-md scale-105 underline-offset-4"
          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
      }`}
    >
      {label}
      {badge && (
        <span className={`ml-2 text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded-sm ${
          active
            ? "bg-white/20 text-white dark:bg-black/10 dark:text-black"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function FollowButton({
  type, value, follows, onFollow, loadingKey, compact
}: {
  type: string;
  value: string;
  follows: Set<string>;
  onFollow: (type: string, value: string) => Promise<void>;
  loadingKey: string | null;
  compact?: boolean;
}) {
  const key = `${type}:${value}`;
  const isFollowing = follows.has(key);
  const isLoading = loadingKey === key;

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFollow(type, value); }}
      disabled={isLoading}
      title={isFollowing ? `Unfollow ${value}` : `Follow ${value} — get notified when new tenders are added`}
      className={`shrink-0 flex items-center gap-1 rounded-full border font-bold transition-all ${
        compact ? 'p-1.5' : 'px-2.5 py-1 text-xs'
      } ${
        isFollowing
          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
          : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
      }`}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
      ) : isFollowing ? (
        <BellRing className="w-3.5 h-3.5" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
      {!compact && <span>{isFollowing ? 'Following' : 'Follow'}</span>}
    </button>
  );
}

function TypeCard({ title, icon, desc, count, href, colorClass }: { title: string, icon: React.ReactNode, desc: string, count: number | null, href: string, colorClass: string }) {
  return (
    <a href={href} className={`flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl transition-all duration-300 ${colorClass}`}>
      <div className="mb-4 transform transition-transform group-hover:scale-110">{icon}</div>
      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4 leading-relaxed max-w-[200px]">{desc}</p>
      {count !== null && (
        <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
          {count.toLocaleString()} active
        </span>
      )}
    </a>
  );
}
