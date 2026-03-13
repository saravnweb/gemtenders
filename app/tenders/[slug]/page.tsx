import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, ArrowLeft, FileText, Shield, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function TenderDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: tender, error } = await supabase
    .from("tenders")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !tender) {
    notFound();
  }

  const isClosingSoon = new Date(tender.end_date).getTime() - Date.now() < 86400000;
  const formattedEMD = tender.emd_amount === 0
    ? "No"
    : tender.emd_amount 
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "N/A";

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/tenders" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 group-hover:text-emerald-600 transition-colors">Back to Tenders</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">GeM Watch</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Title Section */}
            <div>
              <div className="mb-6">
                {tender.ministry_name && (
                  <span className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em] mb-1 block">
                    {tender.ministry_name}
                  </span>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block mb-2">
                  {tender.organisation_name || tender.department_name || tender.department}
                </span>
                {tender.office_name && (
                  <span className="text-[10px] text-gray-500 font-bold block ml-1">
                    Office: {tender.office_name}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2 mb-4">
                 <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                  {tender.bid_number}
                </span>
              </div>

              <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
                {tender.title}
              </h2>
            </div>

            {/* AI Summary Section */}
            {tender.ai_summary && (
              <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-[2.5rem] p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/20 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="flex items-center space-x-2 mb-4 text-emerald-700">
                  <Zap className="w-5 h-5 fill-emerald-500" />
                  <span className="text-sm font-black uppercase tracking-widest">AI Deep Summary</span>
                </div>
                <p className="text-lg text-gray-700 leading-relaxed font-medium italic">
                  "{tender.ai_summary}"
                </p>
              </div>
            )}

            {/* Bidding Requirements / Relaxations */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-[2.5rem] p-8 space-y-8">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold text-gray-900">Bidding Requirements</h3>
                <div className="flex items-center text-xs font-bold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
                   GeM Official
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                 <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest block mb-2">Bid Opening Date</span>
                    <div className="flex items-center text-base font-bold text-gray-700">
                      <Clock className="w-4 h-4 mr-2 text-emerald-500" />
                      {tender.opening_date ? new Date(tender.opening_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "As per bid schedule"}
                    </div>
                 </div>

                 <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest block mb-2">Quantity Required</span>
                    <div className="text-base font-bold text-gray-700">
                       {tender.quantity || 1} Unit(s)
                    </div>
                 </div>

                 <div className="p-4 bg-white rounded-2xl border border-gray-100">
                    <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest block mb-1">MSE Relaxation</span>
                    <span className="text-xs font-bold text-gray-700 leading-relaxed">{tender.mse_relaxation || "Standard terms apply"}</span>
                    {tender.mse_turnover_relaxation && <p className="text-[10px] font-medium text-gray-400 mt-1">Turnover: {tender.mse_turnover_relaxation}</p>}
                 </div>

                 <div className="p-4 bg-white rounded-2xl border border-gray-100">
                    <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest block mb-1">Startup Relaxation</span>
                    <span className="text-xs font-bold text-gray-700 leading-relaxed">{tender.startup_relaxation || "Standard terms apply"}</span>
                    {tender.startup_turnover_relaxation && <p className="text-[10px] font-medium text-gray-400 mt-1">Turnover: {tender.startup_turnover_relaxation}</p>}
                 </div>

                 {tender.documents_required && tender.documents_required.length > 0 && (
                   <div className="md:col-span-2">
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest block mb-3">Required Documents from Seller</span>
                      <div className="flex flex-wrap gap-2">
                        {tender.documents_required.map((doc: string, idx: number) => (
                           <span key={idx} className="bg-white border border-gray-100 px-3 py-2 rounded-xl text-[11px] font-bold text-gray-600 shadow-sm">
                              {doc}
                           </span>
                        ))}
                      </div>
                   </div>
                 )}
              </div>
            </div>

            {/* Tags / Eligibility Summary */}
            <div className="flex flex-wrap items-center gap-6 py-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tender.eligibility_msme ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-300'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">MSE Pref.</p>
                  <p className="text-[10px] font-medium text-gray-400">{tender.eligibility_msme ? 'Applicable' : 'No'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tender.eligibility_mii ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-300'}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">MII Pref.</p>
                  <p className="text-[10px] font-medium text-gray-400">{tender.eligibility_mii ? 'Applicable' : 'No'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Quick Actions */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              <div className="bg-white border border-gray-100 rounded-4xl p-8 shadow-2xl shadow-gray-200/50">
                <div className="flex flex-col space-y-6">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest block mb-2">Closes on</span>
                    <div className={`text-xl font-black flex items-center ${isClosingSoon ? 'text-red-600' : 'text-gray-900'}`}>
                      <Clock className="w-6 h-6 mr-2" />
                      {new Date(tender.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
                    {tender.pdf_url && (
                      <a 
                        href={tender.pdf_url} 
                        target="_blank"
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        <Download className="w-5 h-5" />
                        <span>Download PDF</span>
                      </a>
                    )}
                    <a 
                      href={tender.details_url} 
                      target="_blank"
                      className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-gray-100 transition-all border border-gray-100"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span>Original GeM Link</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-4xl p-6 text-center">
                <Info className="w-6 h-6 text-gray-400 mx-auto mb-3" />
                <p className="text-xs text-gray-500 font-medium leading-relaxed px-4">
                  This summary was generated by AI analysis of the technical bid document. Always refer to the original PDF for legal verification.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
