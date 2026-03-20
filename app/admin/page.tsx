import { Zap, Play, CheckCircle, Database, Shield, LayoutDashboard, Globe, Cpu, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ScrapeButton, EnrichButton } from "./client-buttons";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();
  
  // Fetch detailed stats on server
  const { count: totalCount } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true });

  const { count: enrichedCount } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true })
    .not("pdf_url", "is", null);

  const pendingEnrichment = (totalCount || 0) - (enrichedCount || 0);

  async function startScrapeAction() {
    "use server";
    try {
      await execAsync("npm run scrape --prefix scraper");
      revalidatePath("/admin");
      revalidatePath("/");
    } catch (e) {
      console.error(e);
    }
  }

  async function startEnrichAction() {
    "use server";
    try {
      await execAsync("npm run enrich --prefix scraper");
      revalidatePath("/admin");
      revalidatePath("/");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Area */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
              <LayoutDashboard className="mr-3 text-blue-600 w-8 h-8" />
              Command Center
            </h1>
            <p className="text-slate-500 font-medium mt-1">Manage tender ingestion and AI enrichment</p>
          </div>
          <Link href="/" className="flex items-center space-x-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span>View Live Site</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">Total Indexed</p>
            <p className="text-3xl font-black text-slate-800">{totalCount || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">AI Enriched</p>
            <p className="text-3xl font-black text-slate-800">{enrichedCount || 0}</p>
          </div>

          <div className="bg-blue-600 p-6 rounded-3xl shadow-xl shadow-blue-200 text-white relative overflow-hidden">
            <Zap className="absolute -right-4 -top-4 w-24 h-24 text-white/10 rotate-12" />
            <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Queue Pending</p>
            <p className="text-3xl font-black">{pendingEnrichment}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Action: Full Pipeline */}
          <div className="bg-slate-900 rounded-4xl p-8 border border-slate-800 shadow-xl relative overflow-hidden text-white">
            <Zap className="absolute -right-4 -top-4 w-32 h-32 text-white/5 rotate-12" />
            <div className="flex items-center space-x-3 mb-6 relative">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/50">1</div>
              <h2 className="text-xl font-bold">Run Full Pipeline (Crawl + AI)</h2>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-8 relative">
              This completely unified process launches a stealth browser, scans GeM BidPlus, downloads latest PDFs, runs them through Gemini AI for deep extraction, and saves fully enriched tenders. No partial data is saved.
            </p>
            <form action={startScrapeAction} className="relative">
              <ScrapeButton />
            </form>
          </div>

          {/* Secondary Action: Backlog */}
          <div className="bg-white rounded-4xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            {pendingEnrichment > 0 && (
              <div className="absolute top-4 right-4 animate-bounce">
                <div className="bg-amber-100 text-amber-600 p-1.5 rounded-full">
                  <Database className="w-4 h-4 fill-current" />
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-bold text-sm">2</div>
              <h2 className="text-xl font-bold text-slate-800">Process Backlog Queue</h2>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              This tool processes <strong>15 items per click</strong> to prevent server timeouts. Since you have a large backlog, it is highly recommended to run <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono text-xs">npm run enrich -- --limit=1000</code> in your terminal instead of clicking this button manually!
            </p>
            <form action={startEnrichAction}>
              <EnrichButton pendingEnrichment={pendingEnrichment} />
            </form>
          </div>
        </div>

        <div className="mt-12 p-6 bg-slate-100 rounded-3xl flex items-center justify-center space-x-8">
           <div className="flex items-center space-x-2">
             <CheckCircle className="w-4 h-4 text-emerald-500" />
             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Supabase Connected</span>
           </div>
           <div className="flex items-center space-x-2">
             <CheckCircle className="w-4 h-4 text-emerald-500" />
             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Gemini-2.0 Ready</span>
           </div>
        </div>
      </div>
    </div>
  );
}
