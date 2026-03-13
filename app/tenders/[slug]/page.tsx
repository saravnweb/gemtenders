import { supabase } from "@/lib/supabase";
import { Search, Download, Clock, Zap, ArrowLeft, FileText, Shield, ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// Utility: convert to Title Case
function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Utility: split concatenated Ministry/Department strings properly and format as requested
function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = org || "";

  const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"];

  // If ministry is empty but dept contains a concatenated string
  if (!ministryStr && deptStr) {
    // 1. Try splitting by keywords
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) {
      ministryStr = match[1].trim();
      deptStr = match[2].trim();
    } else {
      // 2. Try splitting by repetition e.g. "Ministry Of CoalCoal India"
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) {
         ministryStr = repeatMatch[1].trim();
         deptStr = deptStr.substring(ministryStr.length).trim();
      }
    }
  }

  // Handle State names at the end of department string - move to front if ministry is missing
  states.forEach(state => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, 'i');
    if (stateRegex.test(deptStr)) {
       if (!ministryStr) ministryStr = state;
       deptStr = deptStr.replace(stateRegex, '$1').trim();
    }
  });

  // Final check: if dept starts with ministry, remove it to avoid duplicates
  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
     deptStr = deptStr.substring(ministryStr.length).trim();
  }
  
  // Specific fix for "Ministry Of Coalneyveli" -> "Ministry Of Coal, Neyveli"
  if (ministryStr.toLowerCase() === "ministry of coal" && deptStr.toLowerCase().startsWith("neyveli")) {
     // Already matches ministry, just ensure Neyveli is clean
  } else if (deptStr.toLowerCase().includes("ministry of coalneyveli")) {
     ministryStr = "Ministry Of Coal";
     deptStr = deptStr.replace(/ministry of coalneyveli/i, "Neyveli").trim();
  }

  // Clean up cases where keywords are stuck to previous words
  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, '$1, $2');

  // Filter out duplicates if org is already mentioned
  if (orgStr && (deptStr.toLowerCase().includes(orgStr.toLowerCase()) || ministryStr.toLowerCase().includes(orgStr.toLowerCase()))) {
    orgStr = "";
  }

  const parts = [ministryStr, cleanDept, orgStr].filter(Boolean).map(s => toTitleCase(s));
  const result = parts.join(", ").replace(/, ,/g, ",");
  
  // Final cleanup for stuck words like "CoalCoal" or "SteelSteel"
  return result.replace(/([A-Z][a-z]+)\1/g, "$1");
}

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
    ? "No EMD"
    : tender.emd_amount
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "N/A";

  const combinedDisplay = formatDepartmentInfo(
    tender.ministry_name, 
    tender.department_name || tender.department,
    tender.organisation_name
  );
  const officeDisplay = toTitleCase(tender.office_name || "");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <Link href="/tenders" className="flex items-center space-x-2 group mb-6 w-fit">
          <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center group-hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-sm font-medium text-slate-500 group-hover:text-slate-700 transition-colors">Back to Tenders</span>
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">

          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Title Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
              {/* Breadcrumb-style hierarchy */}
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium text-blue-600 bg-blue-50 inline-block px-2.5 py-1 rounded-md">
                  {combinedDisplay}
                </p>
                {officeDisplay && (
                  <p className="text-xs text-slate-500 mt-1">Office: {officeDisplay}</p>
                )}
              </div>

              <div className="mb-3">
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
                  {tender.bid_number}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 leading-snug">
                {tender.title}
              </h2>
            </div>

            {/* AI Summary */}
            {tender.ai_summary && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 sm:p-6">
                <div className="flex items-center space-x-2 mb-3 text-blue-700">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-semibold">AI Summary</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {tender.ai_summary}
                </p>
              </div>
            )}

            {/* Bidding Requirements */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-base font-semibold text-slate-800">Bidding Requirements</h3>
                <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">GeM Official</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">Bid Opening Date</span>
                  <div className="flex items-center text-sm text-slate-700">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-400 shrink-0" />
                    {tender.opening_date
                      ? new Date(tender.opening_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : "As per bid schedule"}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">Quantity Required</span>
                  <div className="text-sm text-slate-700">{tender.quantity || 1} Unit(s)</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-blue-500 font-medium block mb-1">MSE Relaxation</span>
                  <span className="text-xs text-slate-600 leading-relaxed">{tender.mse_relaxation || "Standard terms apply"}</span>
                  {tender.mse_turnover_relaxation && (
                    <p className="text-[10px] text-slate-400 mt-1">Turnover: {tender.mse_turnover_relaxation}</p>
                  )}
                </div>

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-amber-500 font-medium block mb-1">Startup Relaxation</span>
                  <span className="text-xs text-slate-600 leading-relaxed">{tender.startup_relaxation || "Standard terms apply"}</span>
                  {tender.startup_turnover_relaxation && (
                    <p className="text-[10px] text-slate-400 mt-1">Turnover: {tender.startup_turnover_relaxation}</p>
                  )}
                </div>

                {tender.documents_required && tender.documents_required.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-[10px] text-slate-400 font-medium block mb-2">Required Documents</span>
                    <div className="flex flex-wrap gap-2">
                      {tender.documents_required.map((doc: string, idx: number) => (
                        <span key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600">
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Eligibility Tags */}
            <div className="flex flex-wrap items-center gap-4 py-2">
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tender.eligibility_msme ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-300'}`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">MSE Preference</p>
                  <p className="text-[11px] text-slate-400">{tender.eligibility_msme ? 'Applicable' : 'Not applicable'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tender.eligibility_mii ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-300'}`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">MII Preference</p>
                  <p className="text-[11px] text-slate-400">{tender.eligibility_mii ? 'Applicable' : 'Not applicable'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block mb-1">EMD Amount</span>
                    <span className="text-lg font-semibold text-slate-800">{formattedEMD}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block mb-1">Closes On</span>
                    <div className={`flex items-center text-sm font-medium ${isClosingSoon ? 'text-red-500' : 'text-slate-700'}`}>
                      <Clock className="w-4 h-4 mr-1.5 shrink-0" />
                      {new Date(tender.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    {isClosingSoon && (
                      <p className="text-[11px] text-red-400 mt-1">Closing today – act promptly.</p>
                    )}
                  </div>

                  <div className="pt-3 space-y-2.5 border-t border-slate-100">
                    {tender.pdf_url && (
                      <a
                        href={tender.pdf_url}
                        target="_blank"
                        className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-blue-700 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download PDF</span>
                      </a>
                    )}
                    <a
                      href={tender.details_url}
                      target="_blank"
                      className="w-full py-2.5 bg-slate-50 text-slate-600 text-sm rounded-lg font-medium flex items-center justify-center space-x-2 hover:bg-slate-100 transition-all border border-slate-200"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View on GeM Portal</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                <Info className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  This summary is generated by AI. Always verify details from the original PDF for legal accuracy.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
