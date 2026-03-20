import { createClient } from '@/lib/supabase-server';
import { Bookmark, MapPin, Download, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';

export default async function SavedBidsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch saved tenders with their full data joined
  const { data: savedTenders } = await supabase
    .from("saved_tenders")
    .select(`
      id,
      created_at,
      tenders (*)
    `)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const isPremium = false; // Added isPremium variable as per instruction

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-fresh-sky-950 tracking-tight">Saved Bids</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Opportunities you've bookmarked for review.</p>
      </div>

      {!savedTenders || savedTenders.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mb-6">
             <Bookmark className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-fresh-sky-950 mb-2">Watchlist is empty</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-8 font-medium">Bookmark interesting bids on the search page to see them here.</p>
          <Link href="/" className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95 flex items-center space-x-2">
             <Search className="w-4 h-4" />
             <span>Browse Tenders</span>
          </Link>
        </div>
      ) : (
        <table role="table" className="w-full block" aria-label="Saved Bids List">
          <thead className="sr-only block">
            <tr className="block">
              <th scope="col" className="block">Closing Date</th>
              <th scope="col" className="block">Tender Details</th>
              <th scope="col" className="block">Actions</th>
            </tr>
          </thead>
          <tbody className="grid grid-cols-1 gap-4 w-full">
            {savedTenders.map((item: any) => {
            const tender = item.tenders;
            const isClosingSoon = new Date(tender.end_date).getTime() - Date.now() < 86400000;
            const formattedEMD = tender.emd_amount === 0 ? "No EMD" : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount);

            return (
              <tr role="row" key={item.id} className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col md:flex-row gap-6 relative overflow-hidden shadow-sm">
                 {/* Date Badge Left */}
                 <td role="cell" className="flex-none md:w-24 flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800 p-4 w-full">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Closes</span>
                    <span className={`text-lg font-bold ${isClosingSoon ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                       {new Date(tender.end_date).getDate()}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                       {new Date(tender.end_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                 </td>

                 {/* Main Content */}
                 <td role="cell" className="flex-1 space-y-3 w-full">
                    <div>
                      <div className="flex items-center space-x-1.5 mb-2">
                        <span className="text-[10px] font-medium bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-100 dark:border-zinc-800 font-mono tracking-tighter">
                          {tender.bid_number}
                        </span>
                        {tender.eligibility_msme && (
                          <span className="text-[10px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">MSE</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                        {tender.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        {tender.city}, {tender.state}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-50 dark:border-zinc-800">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Budget / EMD</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formattedEMD}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Quantity</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{tender.quantity} Units</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Start Date</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tender.start_date ? new Date(tender.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Opening Date</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tender.opening_date ? new Date(tender.opening_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : "N/A"}
                        </span>
                      </div>
                    </div>
                 </td>

                 {/* Actions Right */}
                 <td role="cell" className="flex md:flex-col md:w-36 gap-2 w-full">
                    <Link
                      href={`/bids/${tender.slug}`}
                      className="flex-1 md:flex-none py-2 bg-blue-600 text-white rounded-lg text-xs font-bold text-center hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
                    >
                       <ExternalLink className="w-3.5 h-3.5" />
                       <span>Open</span>
                    </Link>
                    {tender.pdf_url && (
                      <a
                        href={tender.pdf_url}
                        target="_blank"
                        className="flex-1 md:flex-none py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold text-center hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all flex items-center justify-center space-x-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </a>
                    )}
                 </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      )}
    </div>
  );
}
