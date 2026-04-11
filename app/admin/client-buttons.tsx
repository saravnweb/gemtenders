"use client";

import { 
  Globe, 
  Cpu, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  BarChart3, 
  Database, 
  ShieldCheck, 
  MapPin 
} from "lucide-react";
import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { getOfficialGemCount, getIntegrityStats } from "../actions/admin-actions";

export function ScrapeButton() {
  const { pending } = useFormStatus();

  return (
    <button 
      disabled={pending}
      className={`w-full py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 group shadow-lg shadow-blue-500/20 ${pending ? 'opacity-80 cursor-not-allowed' : 'hover:bg-blue-500'}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Running... (Check terminal for live logs)</span>
        </>
      ) : (
        <>
          <Globe className="w-5 h-5 group-hover:animate-spin" />
          <span>Start Full Ingestion Engine</span>
        </>
      )}
    </button>
  );
}

export function EnrichButton({ pendingEnrichment }: { pendingEnrichment: number }) {
  const { pending } = useFormStatus();

  return (
    <button 
      disabled={pendingEnrichment === 0 || pending}
      className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 group ${
        pendingEnrichment > 0 
        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300' 
        : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
      } ${pending ? 'opacity-80 cursor-not-allowed' : ''}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing... (Check terminal for live logs)</span>
        </>
      ) : (
        <>
          <Cpu className="w-5 h-5" />
          <span>{pendingEnrichment > 0 ? `Fix ${pendingEnrichment} Backlogged Items` : 'Backlog Clear'}</span>
        </>
      )}
    </button>
  );
}

export function IntegrityCrossCheck({ activeCount }: { activeCount: number }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      const res = await getIntegrityStats();
      if (res.success && res.stats) {
        setData(res.stats);
      } else {
        setError(res.error || 'Failed to fetch integrity data');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    handleVerify();
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 p-6 rounded-3xl mb-10 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="text-red-500 w-6 h-6" />
          <div>
            <p className="font-bold text-red-800">Integrity Check Failed</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
        <button onClick={handleVerify} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-full hover:bg-red-700 transition-all">
          Retry Check
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-10">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="text-lg font-black text-slate-800 flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-emerald-500" />
            Database Integrity Cross-Check
          </h3>
          <p className="text-xs text-slate-500 font-medium">Internal verification of faceted counts and data population</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right mr-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Active</p>
            <p className="text-sm font-black text-slate-800">{activeCount.toLocaleString()}</p>
          </div>
          <button 
            onClick={handleVerify}
            disabled={loading}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* EQUALITY FACETS */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
              <Database className="w-3 h-3 mr-2" />
              Categorization Gaps
            </h4>
            <div className="space-y-4">
              {data?.facets.map((f: any) => {
                const diff = activeCount - f.count;
                const status = diff === 0 ? 'perfect' : (diff < 50 ? 'warning' : 'danger');
                return (
                  <div key={f.name} className="flex items-center group">
                    <div className="w-24 text-xs font-bold text-slate-600">{f.name}</div>
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden mx-4 relative">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          status === 'perfect' ? 'bg-emerald-500' : (status === 'warning' ? 'bg-amber-500' : 'bg-rose-500')
                        }`} 
                        style={{ width: `${(f.count / activeCount) * 100}%` }} 
                      />
                    </div>
                    <div className="w-20 text-right">
                      <p className={`text-xs font-black ${diff === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {f.count.toLocaleString()}
                      </p>
                      {diff > 0 && <p className="text-[9px] text-rose-500 font-bold">-{diff.toLocaleString()} NULL</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center pt-4">
              <BarChart3 className="w-3 h-3 mr-2" />
              Types & Methods
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-2">Procurement Type</p>
                {data?.procurementTypes.map((t: any) => (
                  <div key={t.name} className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-600 font-medium">{t.name}</span>
                    <span className="text-[10px] font-black text-slate-800">{t.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-2">Bid Method</p>
                {data?.bidMethods.map((m: any) => (
                  <div key={m.name} className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-600 font-medium">{m.name}</span>
                    <span className="text-[10px] font-black text-slate-800">{m.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* POLICY & INSIGHTS */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
              <ShieldCheck className="w-3 h-3 mr-2" />
              Policy Preferences (Non-Exclusive)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {data?.policies.map((p: any) => (
                <div key={p.name} className="bg-sky-50 dark:bg-slate-900 p-3 rounded-2xl border border-sky-100 text-center">
                  <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight h-5 flex items-center justify-center">{p.name}</p>
                  <p className="text-lg font-black text-blue-600 mt-1">{p.count.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center pt-4">
              <RefreshCw className="w-3 h-3 mr-2" />
              Real-Time Snapshot
            </h4>
            <div className="space-y-3">
              {data?.insights.map((ins: any) => (
                <div key={ins.name} className="flex items-center justify-between bg-emerald-50/30 p-3 rounded-2xl border border-emerald-100/50">
                  <span className="text-xs font-bold text-slate-700">{ins.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-emerald-600">{ins.count.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold">Tenders</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                Cross-Check Algorithm: Total Active = Sum(Category) + Missing. 
                <br />If gaps exist, run <span className="font-bold">npm run enrich</span> to resolve.
              </p>
            </div>
          </div>
        </div>

        {/* REGIONAL CONSISTENCY (STATE VS CITY) */}
        <div className="mt-12 pt-8 border-t border-slate-100">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center mb-6 px-1">
              <MapPin className="w-3 h-3 mr-2 text-rose-500" />
              State vs Cities Internal Sum
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.regionalConsistency.map((state: any) => {
                const diff = state.total - state.withCity;
                const isSynced = diff === 0;
                return (
                  <div key={state.state} className={`p-4 rounded-2xl border transition-all ${
                    isSynced ? 'bg-white border-slate-100' : 'bg-rose-50/30 border-rose-100'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-xs font-black text-slate-800 truncate pr-2">{state.state}</span>
                       {isSynced ? (
                         <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                       ) : (
                         <div className="px-1.5 py-0.5 bg-rose-500 text-[8px] font-black text-white rounded-md uppercase">
                           Gap: {diff}
                         </div>
                       )}
                    </div>
                    <div className="flex items-end justify-between">
                       <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Cities Sum</p>
                          <p className="text-sm font-black text-slate-700">{state.withCity} / {state.total}</p>
                       </div>
                       <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${isSynced ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                            style={{ width: `${(state.withCity / state.total) * 100}%` }}
                          />
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </div>
    </div>
  );
}
