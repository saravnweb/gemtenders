import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bookmark, MapPin, Download, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';

export default async function SavedBidsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?callback=/dashboard/saved');
  }

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
        <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium">Opportunities you've bookmarked for review.</p>
      </div>

      {!savedTenders || savedTenders.length === 0 ? (
        <div className="bg-white dark:bg-card border-2 border-dashed border-slate-200 dark:border-border rounded-xl p-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-background rounded-full flex items-center justify-center mb-6">
             <Bookmark className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-fresh-sky-950 mb-2">Watchlist is empty</h2>
          <p className="text-sm text-slate-500 dark:text-muted-foreground max-w-sm mb-8 font-medium">Bookmark interesting bids on the search page to see them here.</p>
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
            const formattedEMD = tender.emd_amount === 0 ? "No EMD" : tender.emd_amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount) : "Not Specified";

            return (
              <tr role="row" key={item.id} className="group bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all flex flex-col md:flex-row gap-6 relative overflow-hidden shadow-sm">
                 {/* Date Badge Left */}
                 <td role="cell" className="flex-none md:w-24 flex flex-col items-center justify-center bg-slate-50 dark:bg-background rounded-xl border border-slate-100 dark:border-border p-4 w-full">
                    <span className="text-[9px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest mb-1">Closes</span>
                    <span className={`text-lg font-bold ${isClosingSoon ? 'text-red-600' : 'text-slate-900 dark:text-foreground'}`}>
                       {new Date(tender.end_date).getDate()}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest">
                       {new Date(tender.end_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                 </td>

                 {/* Main Content */}
                 <td role="cell" className="flex-1 space-y-3 w-full">
                    <div>
                      <div className="flex items-center space-x-1.5 mb-2">
                        <span className="text-xs font-medium bg-slate-50 dark:bg-background text-slate-500 dark:text-muted-foreground px-2 py-0.5 rounded border border-slate-100 dark:border-border font-mono tracking-tighter">
                          {tender.bid_number}
                        </span>
                        {tender.eligibility_msme && (
                          <span className="text-xs font-medium bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-600 dark:text-fresh-sky-400 px-2 py-0.5 rounded border border-fresh-sky-100 dark:border-fresh-sky-800">MSE</span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-foreground group-hover:text-fresh-sky-600 dark:group-hover:text-fresh-sky-400 transition-colors leading-snug">
                        {tender.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground font-medium mt-1 flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                        {tender.city}, {tender.state}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-50 dark:border-border">
                      <div>
                        <span className="text-[9px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest block mb-0.5">Budget / EMD</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-muted-foreground">{formattedEMD}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest block mb-0.5">Quantity</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-muted-foreground">{tender.quantity} Units</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest block mb-0.5">Start Date</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-muted-foreground">
                          {tender.start_date ? new Date(tender.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-widest block mb-0.5">Opening Date</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-muted-foreground">
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
                        href={`/api/download/${tender.slug}`}
                        target="_blank"
                        className="flex-1 md:flex-none py-2 bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground rounded-lg text-xs font-bold text-center hover:bg-slate-50 dark:hover:bg-muted transition-all flex items-center justify-center space-x-2"
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
