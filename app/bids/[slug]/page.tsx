import {
  ArrowLeft, Search, Calendar, MapPin, Building2, Package,
  FileText, ShieldCheck, AlertCircle, Clock, 
  Download, FileDigit, Landmark, FileSpreadsheet, Shield, Zap, Info,
  CheckCircle2, Building, Layers, Activity, FileCheck, ExternalLink as LinkIcon,
  ChevronRight, Home
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DownloadButtons from "./DownloadButtons";
import RevealBidNumber from "./RevealBidNumber";

export const revalidate = 3600; // Cache for 1 hour

export async function generateStaticParams() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=slug&order=start_date.desc&limit=50`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    }
  });
  if (!res.ok) return [];
  const tenders = await res.json();
  return tenders.map((t: any) => ({ slug: t.slug }));
}

const siteUrl = "https://gemtenders.org";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?slug=eq.${slug}&select=title,ai_summary,ministry_name,department_name,end_date,slug&limit=1`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    next: { revalidate: 3600 }
  });
  const data = await res.json();
  const tender = data && data.length > 0 ? data[0] : null;

  if (!tender) {
    return {
      title: "Tender Not Found",
      description: "This tender could not be found on GeMTenders.org.",
    };
  }

  const title = tender.title || "GeM Tender Details";
  const description = tender.ai_summary
    ? tender.ai_summary.substring(0, 155) + (tender.ai_summary.length > 155 ? "..." : "")
    : `View details for GeM tender: ${tender.title}. Check eligibility, EMD, and bid dates on GeMTenders.org.`;
  const dept = tender.ministry_name || tender.department_name || "Government of India";
  const canonicalUrl = `${siteUrl}/bids/${slug}`;

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
      images: [{ url: `${siteUrl}/logo.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | GeMTenders.org`,
      description,
      images: [`${siteUrl}/logo.png`],
      site: "@GeMTenders",
      creator: "@GeMTenders",
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
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?slug=eq.${slug}&select=*&limit=1`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    next: { revalidate: 3600 }
  });
  const data = await res.json();
  const tender = data && data.length > 0 ? data[0] : null;

  if (!tender) {
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    "name": tender.title,
    "description": tender.ai_summary || tender.title,
    "provider": {
      "@type": "GovernmentOrganization",
      "name": combinedDisplay || "Government of India"
    },
    "serviceType": "Public Procurement / Tender",
    "areaServed": {
      "@type": "Country",
      "name": "India"
    },
    "url": `https://gemtenders.org/bids/${slug}`,
    "identifier": tender.bid_number,
    "termsOfService": tender.pdf_url || undefined,
  };

  const breadcrumbItems = [
    { name: "Home", url: "https://gemtenders.org/" },
    { name: "Tenders", url: "https://gemtenders.org/" }
  ];

  if (departments.length > 0) {
    breadcrumbItems.push({
      name: departments[0],
      url: `https://gemtenders.org/?q=${encodeURIComponent(departments[0])}`
    });
  }

  breadcrumbItems.push({
    name: tender.bid_number,
    url: `https://gemtenders.org/bids/${slug}`
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans pb-12 selection:bg-indigo-100 selection:text-indigo-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Dynamic Header Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-linear-to-b from-slate-200/50 via-slate-100/30 to-transparent -z-10 pointer-events-none" />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">

        {/* Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 lg:mb-8">
          <ol className="flex flex-wrap items-center text-sm text-slate-500 dark:text-slate-400 font-medium">
            <li className="flex items-center">
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center group">
                <div className="p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-md border border-slate-200/60 dark:border-slate-700 shadow-sm group-hover:bg-white dark:group-hover:bg-slate-700 transition-all mr-1.5">
                  <Home className="w-3.5 h-3.5" />
                </div>
                <span className="sr-only">Home</span>
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-1 shrink-0" />
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1">
                Tenders
              </Link>
            </li>
            {departments.length > 0 && (
              <li className="flex items-center">
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-1 shrink-0" />
                <Link href={`/?q=${encodeURIComponent(departments[0])}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 truncate max-w-[150px] sm:max-w-[200px]">
                  {departments[0]}
                </Link>
              </li>
            )}
            <li className="flex items-center">
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-1 shrink-0" />
              <span className="text-slate-700 dark:text-slate-200 font-semibold px-1" aria-current="page">
                Tender Details
              </span>
            </li>
          </ol>
        </nav>

        {/* Hero Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 dark:border-slate-700 relative overflow-hidden mb-8 lg:mb-10 group">
          {/* Subtle decoration */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 group-hover:bg-indigo-100 transition-colors duration-700" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <RevealBidNumber bidNumber={tender.bid_number} />
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
                <MapPin className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-400" />
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
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
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
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${tender.eligibility_msme ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5">MSE Preference</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{tender.eligibility_msme ? 'Applicable' : 'Not Applicable'}</p>
                    </div>
                  </div>

                  <div className={`flex items-center p-4 rounded-2xl border ${tender.eligibility_mii ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${tender.eligibility_mii ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
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

            {/* Bottom Actions Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] p-6 sm:p-8">
               <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center">
                 <Download className="w-5 h-5 mr-2 text-indigo-500" />
                 Ready to Proceed?
               </h3>
               <div className="flex flex-col sm:flex-row gap-5 items-center bg-slate-50/50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                 <div className="flex-1 w-full flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block text-center sm:text-left">GeM Bid Document ID</span>
                    <RevealBidNumber bidNumber={tender.bid_number} asButton={true} />
                 </div>
                 <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                 <div className="flex-1 w-full flex flex-col justify-center pt-4 sm:pt-0 border-t border-slate-200 dark:border-slate-700 sm:border-t-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block text-center sm:text-left">Tender Document</span>
                    <DownloadButtons 
                        pdfUrl={tender.pdf_url} 
                        detailsUrl={tender.details_url} 
                        slug={slug} 
                        isMobile={false} 
                    />
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
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">EMD Amount</span>
                      <span className="text-lg font-black text-slate-800 dark:text-slate-200 wrap-break-word">{formattedEMD}</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${isClosingSoon ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Ends On</span>
                      <span className={`text-base font-bold ${isClosingSoon ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'} block wrap-break-word`}>
                        {new Date(tender.end_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                      </span>
                      {isClosingSoon && (
                        <span className="text-xs uppercase font-bold text-red-500 tracking-wide mt-1 block">Act Fast</span>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-100 dark:bg-slate-700 hidden lg:block" />

                  {/* Actions */}
                  <div className="hidden lg:block">
                     <DownloadButtons 
                        pdfUrl={tender.pdf_url} 
                        detailsUrl={tender.details_url} 
                        slug={slug} 
                        isMobile={false} 
                     />
                  </div>
                </div>
              </div>

              {/* Disclaimer Card */}
              <div className="bg-slate-100/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 flex items-start space-x-3">
                <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  Summary information is processed by AI. Always refer to the official tender document for accurate dates, requirements, and legal specifics before bidding.
                </p>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
