import {
  ArrowLeft, Search, Calendar, MapPin, Building2, Package,
  FileText, ShieldCheck, AlertCircle, Clock, Briefcase, BookOpen, Users, DollarSign, ClipboardList, IndianRupee,
  Download, FileDigit, Landmark, FileSpreadsheet, Shield, Zap, Info,
  CheckCircle2, Building, Layers, Activity, FileCheck, ExternalLink as LinkIcon,
  ChevronRight, Home
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DownloadButtons from "./DownloadButtons";
import RevealBidNumber from "./RevealBidNumber";
import ProAnalysis from "./ProAnalysis";
import { createClient } from "@/lib/supabase-server";
export const revalidate = 3600; // Revalidate hourly
export const dynamicParams = true;
export async function generateStaticParams() {
  const now = new Date().toISOString();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenders?select=slug&end_date=gte.${now}&order=created_at.desc&limit=500`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      }
    }
  );
  if (!res.ok) return [];
  const tenders = await res.json();
  return tenders.map((t: any) => ({ slug: t.slug }));
}

const siteUrl = "https://gemtenders.org";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tender, error } = await supabase
    .from('tenders')
    .select('title,ai_summary,ministry_name,department_name,end_date,slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!tender) {
    return {
      title: "Tender Not Found",
      description: "This tender could not be found on GeMTenders.org.",
    };
  }

  const title = tender.title || "GeM Tender Details";
  const isClosed = new Date(tender.end_date).getTime() < Date.now();
  const description = tender.ai_summary
    ? tender.ai_summary.substring(0, 155) + (tender.ai_summary.length > 155 ? "..." : "")
    : `View details for GeM tender: ${tender.title}. Check eligibility, EMD, and bid dates on GeMTenders.org.`;
  const dept = tender.ministry_name || tender.department_name || "Government of India";
  const canonicalUrl = `${siteUrl}/bids/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: isClosed ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${title} | GeMTenders.org`,
      description,
      siteName: "GeMTenders.org",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | GeMTenders.org`,
      description,
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
const isNAValue = (v?: string | null) => !v || /^n\/?a$/i.test(v.trim());

function formatDepartmentInfo(ministry?: string, dept?: string, org?: string): string {
  let ministryStr = ministry || "";
  let deptStr = dept || "";
  let orgStr = isNAValue(org) ? (dept || "") : (org || "");

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
  const supabase = await createClient();
  const userPromise = supabase.auth.getUser();
  const profilePromise = userPromise.then(async ({ data: { user } }) => {
    if (!user) return { user: null, plan: 'free' };
    const { data: profile } = await supabase.from('profiles').select('membership_plan').eq('id', user.id).maybeSingle();
    return { user, plan: profile?.membership_plan || 'free' };
  });

  const [{ data: tender }, { user, plan: membershipPlan }] = await Promise.all([
    supabase.from('tenders').select('*').eq('slug', slug).maybeSingle(),
    profilePromise,
  ]);

  if (!tender) {
    notFound();
  }

  let parsedAiSummary: any = null;
  let aiInsight: string | null = null;

  if (tender.ai_summary && typeof tender.ai_summary === 'string') {
    if (tender.ai_summary.startsWith('{')) {
      try {
        const rawParsed = JSON.parse(tender.ai_summary);
        parsedAiSummary = {};
        for (const [k, v] of Object.entries(rawParsed)) {
          if (!v || typeof v !== 'string') continue;
          const normalizedKey = k.replace(/\n/g, ' ').toUpperCase().trim();
          parsedAiSummary[normalizedKey] = v.trim();
        }
        if (parsedAiSummary.AI_INSIGHT) {
          aiInsight = parsedAiSummary.AI_INSIGHT;
          delete parsedAiSummary.AI_INSIGHT;
        }
      } catch (e) {}
    } else {
      // Plain-text summary — show directly as insight
      aiInsight = tender.ai_summary;
    }
  }

  // Formatted DB-column values used across cards
  const fmtCurrency = (n: number | null | undefined) =>
    n == null ? null : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const fmtLakhs = (n: number | null | undefined) =>
    n == null ? null : `₹${n.toLocaleString('en-IN')} Lakhs`;
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : null;

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
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-card text-slate-600 dark:text-muted-foreground border border-slate-200 dark:border-border">
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
    "serviceType": "Government Tender",
    "provider": {
      "@type": "GovernmentOrganization",
      "name": tender.organisation_name || tender.department_name || tender.ministry_name,
    },
    "areaServed": {
      "@type": "State",
      "name": tender.state || "India",
    },
    "availableChannel": {
      "@type": "ServiceChannel",
      "serviceUrl": `https://gemtenders.org/bids/${tender.slug}`,
    },
    "identifier": tender.bid_number,
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-background text-slate-800 dark:text-foreground font-sans pb-12 selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900/40 dark:selection:text-foreground">
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

      <main id="main-content" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">

        {/* Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 lg:mb-8">
          <ol className="flex flex-wrap items-center text-sm text-slate-500 dark:text-muted-foreground font-medium">
            <li className="flex items-center">
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center group">
                <div className="p-1.5 bg-white/60 dark:bg-card/60 rounded-md border border-slate-200/60 dark:border-border shadow-sm group-hover:bg-white dark:group-hover:bg-muted transition-all mr-1.5">
                  <Home className="w-3.5 h-3.5" />
                </div>
                <span className="sr-only">Home</span>
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-muted-tertiary mx-1 shrink-0" />
              <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1">
                Tenders
              </Link>
            </li>
            {departments.length > 0 && (
              <li className="flex items-center">
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-muted-tertiary mx-1 shrink-0" />
                <Link href={`/?q=${encodeURIComponent(departments[0])}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1 truncate max-w-[150px] sm:max-w-[200px]">
                  {departments[0]}
                </Link>
              </li>
            )}
            <li className="flex items-center">
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-muted-tertiary mx-1 shrink-0" />
              <span className="text-slate-700 dark:text-foreground font-semibold px-1" aria-current="page">
                Tender Details
              </span>
            </li>
          </ol>
        </nav>

        {/* Hero Section */}
        <div className="bg-white dark:bg-card rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 dark:border-border relative overflow-hidden mb-8 lg:mb-10 group">
          {/* Subtle decoration */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 group-hover:bg-indigo-100 transition-colors duration-700" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {getStatusBadge()}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-foreground leading-tight mb-6 tracking-tight">
              {tender.title}
            </h1>

            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {departments.map((part, idx) => (
                <div key={idx} className="flex items-center">
                  <Link
                    href={`/?q=${encodeURIComponent(part)}`}
                    className="flex items-center gap-1 bg-indigo-50/50 hover:bg-indigo-100/80 text-indigo-700 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 border border-indigo-100"
                  >
                    {idx === 0 && <Landmark className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />}
                    {idx === 1 && <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />}
                    {idx === 2 && <Building className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />}
                    <span>{part}</span>
                  </Link>
                  {idx < departments.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-muted-tertiary mx-0.5 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {officeDisplay && (
              <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-muted-foreground mt-2 bg-slate-50 dark:bg-card px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-slate-100 dark:border-border">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-muted-foreground" />
                Office: {officeDisplay}
              </div>
            )}
          </div>
        </div>

        {/* RA Alert Banner */}
        {tender.ra_number && (() => {
          const raActive = tender.ra_end_date && new Date(tender.ra_end_date) > new Date();
          if (!raActive && !tender.ra_number) return null;
          return (
            <div className={`mb-8 rounded-2xl border px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4 ${raActive ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700' : 'bg-slate-100 border-slate-200 dark:bg-card dark:border-border'}`}>
              <div className="flex items-center gap-3 flex-1">
                <div className={`p-2.5 rounded-xl shrink-0 ${raActive ? 'bg-amber-100 dark:bg-amber-900/60' : 'bg-slate-200 dark:bg-muted'}`}>
                  <Zap className={`w-5 h-5 ${raActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${raActive ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-muted-foreground'}`}>
                    {raActive ? '⚡ Reverse Auction in Progress' : 'Reverse Auction Closed'}
                  </p>
                  <p className={`text-xs mt-0.5 ${raActive ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                    RA No: <span className="font-semibold">{tender.ra_number}</span>
                    {tender.ra_end_date && (
                      <> &mdash; Bid closes: <span className="font-semibold">{new Date(tender.ra_end_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</span></>
                    )}
                  </p>
                </div>
              </div>
              {raActive && (
                <a
                  href={tender.details_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-amber-200 dark:shadow-amber-900"
                >
                  <Zap className="w-4 h-4" />
                  Apply Now
                </a>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8 order-2 lg:order-1">

            {/* AI Executive Summary Block */}
            {aiInsight && (
              <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
               <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Zap className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">AI Executive Summary</h3>
                  </div>
                </div>
                <div className="p-6 sm:p-8">
                  <p className="text-[14px] sm:text-[15px] font-medium text-slate-700 dark:text-muted-foreground leading-relaxed">
                    {aiInsight}
                  </p>
                </div>
              </div>
            )}

            {/* 1. Key Dates & Quantities */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center">
                <Clock className="w-5 h-5 text-indigo-500 mr-2.5" />
                <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">Key Dates & Quantities</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-border">
                {[
                  { icon: Clock, label: "Bid Start Date/Time", val: fmtDate(tender.start_date) ?? "Not Specified" },
                  { icon: Clock, label: "Bid End Date/Time", val: fmtDate(tender.end_date) ?? "Not Specified" },
                  { icon: Clock, label: "Bid Opening Date/Time", val: fmtDate(tender.opening_date) ?? parsedAiSummary?.["BID OPENING DATE/TIME"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: FileCheck, label: "Bid Offer Validity / Contract Period", val: tender.delivery_days ? `${tender.delivery_days} Days` : parsedAiSummary?.["CONTRACT PERIOD"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: Package, label: "Total Quantity", val: tender.quantity != null ? String(tender.quantity) : parsedAiSummary?.["QUANTITY"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: Calendar, label: "Pre-Bid Meeting Date", val: fmtDate(tender.pre_bid_date) ?? "Not Applicable" }
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-muted transition-colors ${i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-border' : ''} ${i > 1 && i !== 2 ? 'md:border-t md:border-slate-100 dark:md:border-border' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 text-slate-600 dark:text-muted-foreground">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className="text-sm font-medium leading-snug whitespace-pre-wrap text-slate-800 dark:text-foreground">{row.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Tender Details */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center">
                <FileText className="w-5 h-5 text-indigo-500 mr-2.5" />
                <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">Tender Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-border">
                {[
                  { icon: Layers, label: "Item Category", val: tender.gem_category || parsedAiSummary?.["ITEM CATEGORY"]?.replace(/\n/g, ' ') || tender.title || "Not Specified" },
                  { icon: IndianRupee, label: "Estimated Bid Value", val: fmtCurrency(tender.estimated_value) ?? parsedAiSummary?.["ESTIMATED BID VALUE"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: ShieldCheck, label: "ePBG Detail", val: tender.epbg_percentage != null ? `${tender.epbg_percentage}%` : parsedAiSummary?.["EPBG DETAIL"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: Info, label: "Bid Type", val: tender.bid_type || tender.procurement_type || "Open Bid" },
                  { icon: Package, label: "Is High Value", val: tender.is_high_value ? "Yes" : "No" }
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-muted transition-colors ${i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-border' : ''} ${i > 1 ? 'md:border-t md:border-slate-100 dark:md:border-border' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 text-slate-600 dark:text-muted-foreground">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className="text-sm font-medium leading-snug whitespace-pre-wrap text-slate-800 dark:text-foreground">{row.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Qualifications & Experience */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center">
                <Briefcase className="w-5 h-5 text-indigo-500 mr-2.5" />
                <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">Qualifications & Experience</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-border">
                {[
                  { icon: Briefcase, label: "Years of Past Experience (with Govt.)", val: tender.experience_years != null ? `${tender.experience_years} Year(s)` : parsedAiSummary?.["YEARS OF PAST EXPERIENCE REQUIRED FOR SAME/SIMILAR SERVICE"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: BookOpen, label: "Project / Similar Work Experience Required", val: tender.past_experience_required ?? parsedAiSummary?.["PAST EXPERIENCE OF SIMILAR SERVICES REQUIRED"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: FileSpreadsheet, label: "Minimum Average Annual Turnover", val: fmtLakhs(tender.min_turnover_lakhs) ?? parsedAiSummary?.["MINIMUM AVERAGE ANNUAL TURNOVER OF THE BIDDER"]?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: ClipboardList, label: "Additional Terms & Conditions", val: "Refer to Tender Document (ATC section in PDF)" }
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-muted transition-colors ${i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-border' : ''} ${i > 1 ? 'md:border-t md:border-slate-100 dark:md:border-border' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 text-slate-600 dark:text-muted-foreground">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className="text-sm font-medium leading-snug whitespace-pre-wrap text-slate-800 dark:text-foreground">{row.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Preferences & Relaxations */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center">
                <ShieldCheck className="w-5 h-5 text-indigo-500 mr-2.5" />
                <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">Preferences & Relaxations</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-border">
                {[
                  { icon: Building, label: "MSE Preference", val: tender.eligibility_msme ? 'Applicable' : (parsedAiSummary?.["MSE PURCHASE PREFERENCE"]?.replace(/\n/g, ' ') || 'Not Applicable') },
                  { icon: Shield, label: "MII Preference", val: tender.eligibility_mii ? 'Applicable' : (parsedAiSummary?.["MII COMPLIANCE"]?.replace(/\n/g, ' ') || 'Not Applicable') },
                  { icon: CheckCircle2, label: "Startup Relaxation", val: (tender.startup_relaxation || tender.startup_turnover_relaxation) ? [tender.startup_relaxation, tender.startup_turnover_relaxation].filter(Boolean).join(" / ") : (parsedAiSummary?.["STARTUP RELAXATION FOR YEARS OF EXPERIENCE AND TURNOVER"]?.replace(/\n/g, ' ') || "No (Exp/Turnover)") },
                  { icon: CheckCircle2, label: "MSE Turnover/Exp", val: (tender.mse_relaxation || tender.mse_turnover_relaxation) ? [tender.mse_relaxation, tender.mse_turnover_relaxation].filter(Boolean).join(" / ") : (parsedAiSummary?.["MSE RELAXATION FOR YEARS OF EXPERIENCE AND TURNOVER"]?.replace(/\n/g, ' ') || tender.mse_turnover_relaxation || 'Not Specified') },
                  { icon: ClipboardList, label: "Documents Required from Seller", colSpan2: true, val: (() => {
                      let docsArray = Array.isArray(tender.documents_required) && tender.documents_required.length > 0
                          ? tender.documents_required
                          : ["Experience Criteria", "Past Performance", "Bidder Turnover", "ATC Certificate"];
                      
                      // Fallback to parsed AI summary parameter if not present in native DB array
                      if ((!Array.isArray(tender.documents_required) || tender.documents_required.length === 0) && parsedAiSummary?.["DOCUMENT REQUIRED FROM SELLER"]) {
                         let docStr = parsedAiSummary["DOCUMENT REQUIRED FROM SELLER"].replace(/In case any bidder is seeking exemption.*/i, '').trim();
                         if (docStr.includes(',')) docsArray = docStr.split(',');
                         else if (docStr.includes('\n')) docsArray = docStr.split('\n');
                         else docsArray = [docStr];
                      }
                      
                      return docsArray.map((doc: string) => `• ${doc.trim()}`).join('\n');
                    })() 
                  }
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-muted transition-colors ${!row.colSpan2 && i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-border' : ''} ${i > 1 ? 'md:border-t md:border-slate-100 dark:md:border-border' : ''} ${row.colSpan2 ? 'md:col-span-2' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 text-slate-600 dark:text-muted-foreground">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className="text-sm font-medium leading-snug whitespace-pre-wrap text-slate-800 dark:text-foreground">{row.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Other */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
              <div className="bg-slate-50/80 dark:bg-card border-b border-slate-100 dark:border-border px-6 py-4 flex items-center">
                <FileCheck className="w-5 h-5 text-indigo-500 mr-2.5" />
                <h3 className="text-base font-bold text-slate-800 dark:text-foreground tracking-tight">Other Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-slate-100 dark:divide-border">
                {[
                  { icon: Users, label: "Consignees / Delivery Locations", val: tender.num_consignees != null ? `${tender.num_consignees} Location(s)` : (parsedAiSummary?.["CONSIGNEES/REPORTING OFFICER AND QUANTITY"] || parsedAiSummary?.["CONSIGNEES/REPORTING OFFICER"])?.replace(/\n/g, ' ') ?? "Not Specified" },
                  { icon: MapPin, label: "Delivery State / City", val: [tender.state, tender.city].filter(Boolean).join(', ') || "Not Specified" },
                  { icon: Search, label: "GeMARPTS Result", val: tender.gemarpts_result || "Not Specified", highlighted: true }
                ].map((row, i) => (
                  <div key={i} className={`p-5 flex items-start space-x-4 hover:bg-slate-50/50 dark:hover:bg-muted transition-colors ${i % 2 !== 0 ? 'md:border-l md:border-slate-100 dark:md:border-border' : ''} ${i > 1 ? 'md:border-t md:border-slate-100 dark:md:border-border' : ''}`}>
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-100 dark:bg-card flex items-center justify-center shrink-0 text-slate-600 dark:text-muted-foreground">
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">{row.label}</p>
                      <p className={`text-sm font-medium leading-snug whitespace-pre-wrap ${row.highlighted ? 'text-indigo-700' : 'text-slate-800 dark:text-foreground'}`}>{row.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions Section */}
            <div className="bg-white dark:bg-card border border-slate-200/80 dark:border-border rounded-3xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] p-6 sm:p-8">
               <h3 className="text-lg font-bold text-slate-900 dark:text-foreground mb-6 flex items-center">
                 <Download className="w-5 h-5 mr-2 text-indigo-500" />
                 Ready to Proceed?
               </h3>
               <div className="flex flex-col sm:flex-row gap-5 items-center bg-slate-50/50 dark:bg-card/50 p-5 rounded-2xl border border-slate-100 dark:border-border">
                 <div className="flex-1 w-full flex flex-col justify-center">
                    <span className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-2 block text-center sm:text-left">GeM Bid Document ID</span>
                    <RevealBidNumber bidNumber={tender.bid_number} asButton={true} tenderId={tender.id} />
                 </div>
                 <div className="w-px h-12 bg-slate-200 dark:bg-muted hidden sm:block"></div>
                 <div className="flex-1 w-full flex flex-col justify-center pt-4 sm:pt-0 border-t border-slate-200 dark:border-border sm:border-t-0">
                    <span className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-2 block text-center sm:text-left">Tender Document</span>
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
              <div className="bg-white dark:bg-card rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/80 dark:border-border">
                <div className="space-y-6">

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-card rounded-2xl p-4 border border-slate-100 dark:border-border">
                      <span className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider block mb-1.5">EMD Amount</span>
                      <span className="text-lg font-black text-slate-800 dark:text-foreground wrap-break-word">{formattedEMD}</span>
                    </div>
                    <div className={`rounded-2xl p-4 border ${isClosingSoon ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 dark:bg-card border-slate-100 dark:border-border'}`}>
                      <span className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider block mb-1.5">Ends On</span>
                      <span className={`text-base font-bold ${isClosingSoon ? 'text-red-600' : 'text-slate-800 dark:text-foreground'} block wrap-break-word`}>
                        {new Date(tender.end_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                      </span>
                      {isClosingSoon && (
                        <span className="text-xs uppercase font-bold text-red-500 tracking-wide mt-1 block">Act Fast</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pro AI Analysis */}
              <ProAnalysis
                tender={{
                  title: tender.title,
                  ai_summary: typeof tender.ai_summary === 'string' ? tender.ai_summary.substring(0, 500) : undefined,
                  emd_amount: tender.emd_amount,
                  end_date: tender.end_date,
                  eligibility_msme: tender.eligibility_msme,
                  eligibility_mii: tender.eligibility_mii,
                  ministry_name: tender.ministry_name,
                  organisation_name: tender.organisation_name,
                  state: tender.state,
                }}
                isPro={membershipPlan === 'pro'}
              />

            </div>
          </div>

        </div>

        {/* Disclaimer Card */}
        <div className="mt-6 bg-slate-100/50 dark:bg-card border border-slate-200 dark:border-border rounded-3xl p-5 flex items-start space-x-3">
          <Info className="w-5 h-5 text-slate-600 dark:text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed font-medium">
            Summary information is processed by AI. Always refer to the official tender document for accurate dates, requirements, and legal specifics before bidding.
          </p>
        </div>

      </main>
    </div>
  );
}
