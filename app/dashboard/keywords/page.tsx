import { createClient } from '@/lib/supabase-server';
import { Zap, Search } from 'lucide-react';
import Link from 'next/link';
import MonitorCard from './MonitorCard';
import AddMonitorForm from './AddMonitorForm';

export default async function KeywordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch saved searches (Monitors)
  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fresh-sky-950 tracking-tight">Saved Keywords</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Automatic tracking for matching bids.</p>
        </div>
        <AddMonitorForm userId={user!.id} />
      </div>

      {!savedSearches || savedSearches.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-950 rounded-xl flex items-center justify-center mb-6">
             <Zap className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-fresh-sky-950 mb-2">No active keywords</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8 font-medium">Click "Add Keyword" above to add keywords, or save a search on the home page to track complex filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {savedSearches.map((search: any) => (
            <MonitorCard key={search.id} search={search} />
          ))}
        </div>
      )}
    </div>
  );
}
