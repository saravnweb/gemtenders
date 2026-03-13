import { Zap, Play, CheckCircle, AlertTriangle, List } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { scrapeGeMBids } from "@/lib/scraper/gem-scraper";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export default async function AdminPage() {
  // Fetch stats on server
  const { count: tenderCount } = await supabase
    .from("tenders")
    .select("*", { count: "exact", head: true });

  async function startScrapeAction() {
    "use server";
    try {
      console.log("Server Action: Starting Scrape...");
      await scrapeGeMBids();
      revalidatePath("/tenders");
      revalidatePath("/admin");
    } catch (e) {
      console.error("Server Action Scrape Failed:", e);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-gray-900 border-t-4 border-emerald-600">
      <div className="max-w-md w-full bg-white rounded-4xl p-10 shadow-2xl shadow-emerald-500/5 border border-gray-100 italic-gradient-fix">
        
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">GeM Admin</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Automation Dashboard</p>
            </div>
          </div>
          <Link href="/tenders" className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:text-emerald-600 transition-colors">
            <List className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-10">
          <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-tighter mb-1">Indexed Tenders</p>
            <p className="text-4xl font-black text-emerald-600">{tenderCount || 0}</p>
          </div>
        </div>

        <div className="space-y-6">
          <form action={startScrapeAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-3 py-5 bg-emerald-600 text-white rounded-3xl font-bold text-lg hover:bg-emerald-700 active:scale-[0.97] transition-all shadow-xl shadow-emerald-200 group"
            >
              <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
              <span>Perform Deep Scan</span>
            </button>
          </form>

          <p className="text-center text-[11px] text-gray-400 leading-relaxed px-4">
            Clicking will launch a background browser to scan GeM BidPlus and perform AI extraction from newest PDFs.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-50 flex items-center justify-center space-x-6">
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Database Linked</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">AI Agent Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
