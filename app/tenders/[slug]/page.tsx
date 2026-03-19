import {
  ArrowLeft, Search, Calendar, MapPin, Building2, Package,
  FileText, ShieldCheck, AlertCircle, Clock, 
  Download, FileDigit, Landmark, FileSpreadsheet, Shield, Zap, Info,
  CheckCircle2, Building, Layers, Activity, FileCheck, ExternalLink as LinkIcon
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Metadata } from "next";

const siteUrl = "https://gemtenders.org";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabaseServer = await createClient();
  const { data: tender } = await supabaseServer
    .from("tenders")
    .select("title, ai_summary, ministry_name, department_name, end_date, slug")
    .eq("slug", slug)
    .single();

  if (!tender) {
    return {
      title: "Tender Not Found",
      description: "This tender could not be found on GeMTenders.org.",
    };
  }

  const title = tender.title
    ? `${tender.title.substring(0, 60)}${tender.title.length > 60 ? "..." : ""}`
    : "GeM Tender Details";
  const description = tender.ai_summary
    ? tender.ai_summary.substring(0, 155) + (tender.ai_summary.length > 155 ? "..." : "")
    : `View details for GeM tender: ${tender.title}. Check eligibility, EMD, and bid dates on GeMTenders.org.`;
  const dept = tender.ministry_name || tender.department_name || "Government of India";
  const canonicalUrl = `${siteUrl}/tenders/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${title} | GeMTenders.org`,
      description,
      siteName: "GeMTenders.org",
      images: [{ url: "/logo.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | GeMTenders.org`,
      description,
      images: ["/logo.png"],
    },
    keywords: ["GeM tender", dept, "government bid", "GeM portal", "tender India"],
  };
}

// Utility: convert to Title Case
function toTitleCase(str: string): string {
  if (!str) return "";
  const acronyms = ["MSE", "MII", "GEM", "BOQ", "ATC", "INR", "EMD", "CPSE", "PSU", "N/A"];
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const upperWord = word.toUpperCase();
      if (acronyms.includes(upperWord)) return upperWord;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// Utility: split concatenated Ministry/Department strings properly and format as requested
function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = org || "";

  const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"];

  if (!ministryStr && deptStr) {
    const splitRegex = /(Ministry Of .+?)(Department Of.*|Office Of.*|Organisation Of.*|Division Of.*|Central Public Sector Enterprise.*)/i;
    const match = deptStr.match(splitRegex);
    if (match) {
      ministryStr = match[1].trim();
      deptStr = match[2].trim();
    } else {
      const repeatMatch = deptStr.match(/(Ministry Of ([A-Z][a-z]+))\2/i);
      if (repeatMatch) {
         ministryStr = repeatMatch[1].trim();
         deptStr = deptStr.substring(ministryStr.length).trim();
      }
    }
  }

  states.forEach(state => {
    const stateRegex = new RegExp(`([^\\s,])\\s*(${state})$`, 'i');
    if (stateRegex.test(deptStr)) {
       if (!ministryStr) ministryStr = state;
       deptStr = deptStr.replace(stateRegex, '$1').trim();
    }
  });

  if (ministryStr && deptStr.toLowerCase().startsWith(ministryStr.toLowerCase())) {
     deptStr = deptStr.substring(ministryStr.length).trim();
  }

  if (ministryStr.toLowerCase() === "ministry of coal" && deptStr.toLowerCase().startsWith("neyveli")) {
  } else if (deptStr.toLowerCase().includes("ministry of coalneyveli")) {
     ministryStr = "Ministry Of Coal";
     deptStr = deptStr.replace(/ministry of coalneyveli/i, "Neyveli").trim();
  }

  let cleanDept = deptStr.replace(/([^\s,])(Department Of|Office Of|Organisation Of|Division Of)/gi, '$1, $2');

  if (orgStr && (deptStr.toLowerCase().includes(orgStr.toLowerCase()) || ministryStr.toLowerCase().includes(orgStr.toLowerCase()))) {
    orgStr = "";
  }

  const parts = [ministryStr, cleanDept, orgStr].filter(Boolean).map(s => toTitleCase(s));
  const result = parts.join(", ").replace(/, ,/g, ",");
  return result.replace(/([A-Z][a-z]+)\1/g, "$1");
}

export default async function TenderDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabaseServer = await createClient();

  const { data: tender, error } = await supabaseServer
    .from("tenders")
    .select("*")
    .eq("slug", slug)
    .single();

  const { data: { user } } = await supabaseServer.auth.getUser();

  let isPremium = false;
  if (user) {
    const { data: profile } = await supabaseServer.from("profiles").select("membership_plan").eq("id", user.id).single();
    if (profile && (profile.membership_plan === 'starter' || profile.membership_plan === 'pro')) {
      isPremium = true;
    }
  }

  if (error || !tender) {
    notFound();
  }

  const isClosingSoon = new Date(tender.end_date).getTime() - Date.now() < 86400000;
  const isClosed = new Date(tender.end_date).getTime() < Date.now();

  const formattedEMD = tender.emd_amount === 0
    ? "No EMD"
    : tender.emd_amount
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(tender.emd_amount)
      : "Not Specified";

  const combinedDisplay = formatDepartmentInfo(
    tender.ministry_name,
    tender.department_name || tender.department,
    tender.organisation_name
  );

  const departments = combinedDisplay.split(", ").filter(Boolean);
  const officeDisplay = toTitleCase(tender.office_name || "");

  const getStatusBadge = () => {
    if (isClosed) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Closed
        </span>
      );
    }
    if (isClosingSoon) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 shadow-sm shadow-red-100">
          <Clock className="w-3.5 h-3.5 mr-1 animate-pulse" />
          Closing Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm shadow-emerald-100">
        <Activity className="w-3.5 h-3.5 mr-1" />
        Active
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans pb-28 lg:pb-12 selection:bg-indigo-100 selection:text-indigo-900">

      {/* Dynamic Header Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-slate-200/50 via-slate-100/30 to-transparent -z-10 pointer-events-none" />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">

        {/* Navigation */}
        <Link
          href="/"
          className="inline-flex items-center space-x-2 group mb-8 w-fit bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 hover:shadow-sm transition-all duration-300"
        >
          <div className="w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          </div>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">Back to Tenders</span>
        </Link>

        {/* Hero Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 dark:border-slate-700 relative overflow-hidden mb-8 lg:mb-10 group">
          {/* Subtle decoration */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 group-hover:bg-indigo-100 transition-colors duration-700" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md tracking-wide">
                {tender.bid_number}
              </span>
              {getStatusBadge()}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight mb-6 tracking-tight">
              {tender.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              {departments.map((part, idx) => (
                <div key={idx} className="flex items-center">
                  <Link
                    href={`/?q=${encodeURIComponent(part)}`}
                    className="flex items-center space-x-1.5 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 border border-indigo-100"
                  >
                    {idx === 0 && <Landmark className="w-3.5 h-3.5" />}
                    {idx === 1 && <Building2 className="w-3.5 h-3.5" />}
                    {idx === 2 && <Building className="w-3.5 h-3.5" />}
                    <span>{part}</span>
                  </Link>
                  {idx < departments.length - 1 && (
                    <span className="text-slate-300 dark:text-slate-600 mx-1">{'>'}</span>
                  )}
                </div>
              ))}
            </div>

            {officeDisplay && (
              <div className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-900 w-fit px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
                <MapPin className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />
                Office: {officeDisplay}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">

            {/* AI Summary Highlight */}
            {tender.ai_summary && (
              <div className="relative p-px rounded-3xl bg-linear-to-br from-blue-300 via-indigo-300 to-purple-300">
                <div className="bg-white dark:bg-slate-900 rounded-[23px] p-6 lg:p-8 h-full">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-1.5 rounded-lg text-white shadow-md">
                      <Zap className="w-4 h-4 fill-white shrink-0" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">Smart Summary</h3>
                  </div>
                  <p className="text-[15px] sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {tender.ai_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Comprehensive Detail Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Bid Parameters
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-700">
                {[
                  { icon: Clock, label: "Bid Start Date/Time", val: tender.start_date ? new Date(tender.start_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : "N/A" },
                  { icon: Clock, label: "Bid End Date/Time", val: tender.end_date ? new Date(tender.end_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : "N/A" },
                  { icon: Clock, label: "Bid Opening Date/Time", val: tender.opening_date ? new Date(tender.opening_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : "N/A" },
                  { icon: FileCheck, label: "Bid Offer Validity", val: "120 Days" },
                  { icon: Package, label: "Total Quantity", val: tender.quantity || "N/A" },
                  { icon: Layers, label: "Item Category", val: tender.title ? tender.title.substring(0, 100) + (tender.title.length > 100 ? '...' : '') : "N/A" },
                  { icon: Search, label: "GeMARPTS Result", val: tender.gemarpts_result || "N/A", highlighted: true },
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-colors ${i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-slate-700' : ''} ${i > 1 ? 'md:border-t md:border-slate-100 dark:md:border-slate-700' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        {row.label}
                      </p>
                      <p className={`text-sm font-medium leading-snug ${row.highlighted ? 'text-indigo-700' : 'text-slate-800 dark:text-slate-200'}`}>
                        {row.val}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Eligibility & Requirements */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] p-6 sm:p-8">
               <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center">
                 <ShieldCheck className="w-5 h-5 mr-2 text-indigo-500" />
                 Eligibility & Requirements
               </h3>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className={`flex items-center p-4 rounded-2xl border ${tender.eligibility_msme ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${tender.eligibility_msme ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">MSE Preference</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{tender.eligibility_msme ? 'Applicable' : 'Not Applicable'}</p>
                    </div>
                  </div>

                  <div className={`flex items-center p-4 rounded-2xl border ${tender.eligibility_mii ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${tender.eligibility_mii ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">MII Preference</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{tender.eligibility_mii ? 'Applicable' : 'Not Applicable'}</p>
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Relaxations</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-indigo-500" />
                      Startup Relaxation: <span className="text-indigo-700 ml-1">Yes (Exp/Turnover)</span>
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center mt-2">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-indigo-500" />
                      MSE Turnover/Exp: <span className="text-indigo-700 ml-1">{tender.mse_turnover_relaxation || 'N/A'}</span>
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Documents Required</h4>
                    <ul className="text-sm text-slate-700 dark:text-slate-300 font-medium space-y-2">
                      {(tender.documents_required || ["Experience Criteria", "Past Performance", "Bidder Turnover", "ATC Certificate"]).map((doc: string, idx: number) => (
                        <li key={idx} className="flex flex-start">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5 mr-2.5 shrink-0" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  </div>
               </div>
            </div>

          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="sticky top-6 space-y-6">

              {/* Action Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/80 dark:border-slate-700">
                <div className="space-y-6">

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">EMD Amount</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-200 wrap-break-word">{formattedEMD}</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${isClosingSoon ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Ends On</span>
                      <span className={`text-base font-bold ${isClosingSoon ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'} block wrap-break-word`}>
                        {new Date(tender.end_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                      </span>
                      {isClosingSoon && (
                        <span className="text-[10px] uppercase font-bold text-red-500 tracking-wide mt-1 block">Act Fast</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-100 dark:bg-slate-700 hidden lg:block" />

                  {/* Actions */}
                  <div className="space-y-3">
                    {tender.pdf_url ? (
                      isPremium ? (
                        <a
                          href={tender.pdf_url}
                          target="_blank"
                          className="hidden lg:flex w-full relative group overflow-hidden py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-[0_4px_15px_-3px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_-3px_rgba(0,0,0,0.3)]"
                        >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                          <Download className="w-5 h-5 relative z-10" />
                        </a>
                      ) : (
                        <Link
                          href={user ? "/dashboard/subscriptions" : `/login?callback=${encodeURIComponent('/tenders/' + slug)}`}
                          className="hidden lg:flex w-full relative py-3.5 bg-linear-to-r from-amber-500 to-amber-600 text-white text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:from-amber-600 hover:to-amber-700 transition-all shadow-[0_4px_15px_-3px_rgba(245,158,11,0.3)] hover:shadow-[0_6px_20px_-3px_rgba(245,158,11,0.4)]"
                        >
                          <Zap className="w-4 h-4 fill-white relative z-10" />
                          <span className="relative z-10">Unlock PDF Download</span>
                        </Link>
                      )
                    ) : (
                      <div className="hidden lg:flex w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 cursor-not-allowed border border-slate-200/60 dark:border-slate-700">
                        <Download className="w-4 h-4" />
                        <span>Document Unavailable</span>
                      </div>
                    )}

                    <a
                      href={tender.details_url}
                      target="_blank"
                      className="hidden lg:flex w-full py-3.5 bg-white dark:bg-slate-900 text-indigo-600 text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:bg-indigo-50 dark:hover:bg-blue-900/30 transition-all border-2 border-indigo-100 dark:border-blue-800 hover:border-indigo-200 dark:hover:border-blue-700"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span>View on GeM Portal</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Disclaimer Card */}
              <div className="bg-slate-100/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 flex items-start space-x-3">
                <Info className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Summary information is processed by AI. Always refer to the official tender document for accurate dates, requirements, and legal specifics before bidding.
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Floating Action Bar (Mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-700 lg:hidden z-50 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {tender.pdf_url ? (
          <>
            {isPremium ? (
              <a
                href={tender.pdf_url}
                target="_blank"
                className="flex-1 py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md"
              >
                <Download className="w-5 h-5" />
              </a>
            ) : (
              <Link
                href={user ? "/dashboard/subscriptions" : `/login?callback=${encodeURIComponent('/tenders/' + slug)}`}
                className="flex-1 py-3.5 bg-linear-to-r from-amber-500 to-amber-600 text-white text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 hover:from-amber-600 hover:to-amber-700 transition-all shadow-md shadow-amber-500/20"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Unlock PDF</span>
              </Link>
            )}
            <a
              href={tender.details_url}
              target="_blank"
              className="px-4 py-3.5 bg-indigo-50 text-indigo-600 text-sm rounded-xl font-semibold flex items-center justify-center border border-indigo-100 hover:bg-indigo-100 transition-all"
              title="View on GeM Portal"
            >
              <LinkIcon className="w-4 h-4" />
            </a>
          </>
        ) : (
          <a
            href={tender.details_url}
            target="_blank"
            className="flex-1 py-3.5 bg-indigo-600 text-white text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </a>
        )}
      </div>
    </div>
  );
}
