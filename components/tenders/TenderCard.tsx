import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Clock, Zap, MapPin, Share2, Bookmark } from "lucide-react";
import { getCategoryById } from "@/lib/categories";
import { HighlightedText } from "./HighlightedText";
import { toTitleCase, formatDepartmentInfo, getCategory } from "./utils";

const TenderCard = React.memo(function TenderCard({
  tender, setSearchQuery, setSelectedStates, isSaved, onToggleSave, highlightTerms = [],
}: {
  tender: any;
  setSearchQuery: (q: string) => void;
  setSelectedStates: React.Dispatch<React.SetStateAction<string[]>>;
  isSaved: boolean;
  onToggleSave: () => void;
  highlightTerms?: string[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosingSoon, setIsClosingSoon] = useState(false);
  const isFallbackDate = tender.start_date === tender.end_date;

  useEffect(() => {
    setIsClosingSoon(!isFallbackDate && (new Date(tender.end_date).getTime() - Date.now() < 86400000));
  }, [isFallbackDate, tender.end_date]);

  const formattedEMD = useMemo(() => {
    if (tender.emd_amount === 0) return "No EMD";
    if (!tender.emd_amount) return "Not Specified";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(tender.emd_amount);
  }, [tender.emd_amount]);

  const departmentDisplay = useMemo(() => formatDepartmentInfo(tender.ministry_name, tender.department_name || tender.department, tender.organisation_name), [tender.ministry_name, tender.department_name, tender.department, tender.organisation_name]);
  const category = useMemo(() => (tender.category ? getCategoryById(tender.category) : null) ?? getCategory(tender.title, tender.ai_summary), [tender.category, tender.title, tender.ai_summary]);

  const insight = useMemo(() => {
    let displayInsight = tender.ai_summary;
    let hasValidInsight = !!tender.ai_summary;
    try {
      if (tender.ai_summary && tender.ai_summary.startsWith('{')) {
        const parsed = JSON.parse(tender.ai_summary);
        if (parsed.ai_insight) displayInsight = parsed.ai_insight;
        else hasValidInsight = false;
      }
    } catch(e) { /* fallback */ }

    if (!displayInsight || displayInsight.trim().length === 0 || displayInsight.length > 400 || /[\u0900-\u097F]/.test(displayInsight)) {
      hasValidInsight = false;
    }
    return { displayInsight, hasValidInsight };
  }, [tender.ai_summary]);

  const formatDate = useCallback((d: string) => {
    if (!d) return "N/A";
    let date = new Date(d);
    if (isNaN(date.getTime()) && typeof d === "string") {
      const parts = d.split("-");
      if (parts.length === 3 && parts[0].length <= 2) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      }
    }
    return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }, []);

  return (
    <div
      role="row"
      className="group bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-muted-foreground/35 hover:shadow-md flex flex-col h-full relative overflow-hidden"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '300px' }}
    >

      {/* Title */}
      <div role="cell" className="mb-2 w-full">
        <Link href={`/bids/${encodeURIComponent(tender.slug || "")}`} className="hover:no-underline group/title focus:outline-none">
          <h3 className={`text-sm sm:text-[15px] font-medium text-slate-800 dark:text-foreground leading-snug transition-colors group-hover/title:text-fresh-sky-700 dark:group-hover/title:text-fresh-sky-400 after:absolute after:inset-0 after:z-0 ${isExpanded ? "" : "line-clamp-2"}`}>
            <HighlightedText text={tender.title} highlightTerms={highlightTerms} />
          </h3>
        </Link>
        {tender.title && tender.title.length > 60 && (
          <div className="flex items-center space-x-2 mt-1 relative z-10">
            <button aria-expanded={isExpanded} aria-label={isExpanded ? "Show less title" : "Show more title"} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded(!isExpanded); }} className="text-xs text-fresh-sky-600 dark:text-fresh-sky-400 hover:text-fresh-sky-800 dark:hover:text-fresh-sky-300">
              {isExpanded ? "Show less" : "Show more"}
            </button>
            {category && (
              <span className="ml-auto flex items-center space-x-1 px-1.5 py-0.5 bg-slate-100 dark:bg-card border border-slate-200 dark:border-border rounded text-xs font-bold text-slate-500 dark:text-muted-foreground">
                <span>{category.icon}</span><span>{category.label}</span>
              </span>
            )}
          </div>
        )}
        {tender.title && tender.title.length <= 60 && category && (
          <div className="flex items-center space-x-2 mt-1 relative z-10">
            <span className="ml-auto flex items-center space-x-1 px-1.5 py-0.5 bg-slate-100 dark:bg-card border border-slate-200 dark:border-border rounded text-xs font-bold text-slate-500 dark:text-muted-foreground">
              <span>{category.icon}</span><span>{category.label}</span>
            </span>
          </div>
        )}
      </div>

      {/* Department */}
      <div role="cell" className="mb-3 relative z-20 w-full">
        <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-muted-foreground leading-tight">
          {departmentDisplay.split(", ").filter(Boolean).map((part, idx, arr) => (
            <span key={idx} className="flex items-center">
              <button aria-label={`Search for ${part}`} onClick={(e) => { e.stopPropagation(); setSearchQuery(part); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-fresh-sky-600 dark:hover:text-fresh-sky-400 hover:underline transition-colors text-left py-1">
                {part}
              </button>
              {idx < arr.length - 1 && <span className="ml-1 text-slate-300 dark:text-muted-tertiary">,</span>}
            </span>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      {insight.hasValidInsight && (
        <div role="cell" className="mb-3 p-2 sm:p-2.5 bg-fresh-sky-50/40 dark:bg-fresh-sky-900/15 rounded-lg border border-fresh-sky-100 dark:border-fresh-sky-900 relative z-10 w-full">
          <div className="flex items-center space-x-1 mb-1 opacity-60">
            <Zap className="w-2.5 h-2.5 text-fresh-sky-600 dark:text-fresh-sky-500" />
            <span className="text-[9px] font-bold text-fresh-sky-600 dark:text-fresh-sky-400 uppercase tracking-tighter">AI Insight</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-muted-foreground line-clamp-2 leading-relaxed italic">
            "<HighlightedText text={insight.displayInsight} highlightTerms={highlightTerms} />"
          </p>
        </div>
      )}

      {/* Location & Bid ID */}
      <div role="cell" className="flex items-center justify-between mb-3 relative z-20 w-full">
        <div className="flex items-center text-xs text-slate-600 dark:text-muted-foreground space-x-1.5 min-w-0">
          <MapPin className="w-3 h-3 text-slate-300 dark:text-muted-tertiary shrink-0" />
          <div className="flex items-center truncate">
            {tender.city && (
              <>
                <button aria-label={`Search for city ${tender.city}`} onClick={(e) => { e.stopPropagation(); setSearchQuery(tender.city); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-blue-600 hover:underline transition-colors truncate">
                  {toTitleCase(tender.city)}
                </button>
                {tender.state && <span className="mx-1">,</span>}
              </>
            )}
            {tender.state && (
              <button aria-label={`Filter by state ${tender.state}`} onClick={(e) => { e.stopPropagation(); setSelectedStates((prev: any) => [tender.state]); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-blue-600 hover:underline transition-colors truncate">
                {toTitleCase(tender.state)}
              </button>
            )}
            {!tender.city && !tender.state && <span className="truncate">{tender.location || "N/A"}</span>}
          </div>
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          {tender.eligibility_msme && <span className="text-xs font-bold px-1.5 py-0.5 bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-600 dark:text-fresh-sky-400 rounded border border-fresh-sky-100 dark:border-fresh-sky-800" title="MSE Preferred">MSE</span>}
          {tender.eligibility_mii  && <span className="text-xs font-bold px-1.5 py-0.5 bg-atomic-tangerine-50 dark:bg-atomic-tangerine-900/20 text-atomic-tangerine-600 dark:text-atomic-tangerine-400 rounded border border-atomic-tangerine-100 dark:border-atomic-tangerine-800" title="MII Preferred">MII</span>}
          {tender.ra_number && (
            <span
              className="text-xs font-bold px-1.5 py-0.5 bg-muted-olive-50 dark:bg-muted-olive-900/20 text-muted-olive-600 dark:text-muted-olive-400 rounded border border-muted-olive-100 dark:border-muted-olive-800 cursor-help"
              title={`This bid moved to Reverse Auction\nRA No: ${tender.ra_number}\nClick to search by RA number`}
              onClick={(e) => { e.stopPropagation(); setSearchQuery(tender.ra_number); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              Reverse Auction ↗
            </span>
          )}
          <span className="text-xs font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-card text-slate-500 dark:text-muted-foreground rounded">GeM</span>
        </div>
      </div>

      {/* 4: EMD & Dates */}
      <div role="cell" className="grid grid-cols-3 gap-2 py-2 sm:py-2.5 border-y border-slate-100 dark:border-border mb-4 bg-slate-50 dark:bg-card -mx-4 px-4 relative z-10 pointer-events-none mt-auto w-full">
        <div className="flex flex-col items-center">
          <span className="text-xs text-slate-500 dark:text-muted-foreground mb-0.5">EMD Amount</span>
          <span suppressHydrationWarning className="text-[13px] font-medium text-slate-700 dark:text-muted-foreground truncate">{formattedEMD}</span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200 dark:border-border">
          <span className="text-xs text-slate-500 dark:text-muted-foreground mb-0.5">Start Date</span>
          <span suppressHydrationWarning className="text-[13px] font-medium text-slate-700 dark:text-muted-foreground">
            {isFallbackDate ? "Pending" : (tender.start_date ? formatDate(tender.start_date) : "N/A")}
          </span>
        </div>
        <div className="flex flex-col items-center border-l border-slate-200 dark:border-border">
          <div className="flex items-center space-x-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-slate-500 dark:text-muted-foreground" />
            <span className="text-xs text-slate-500 dark:text-muted-foreground">Close Date</span>
          </div>
          <span suppressHydrationWarning className={`text-[13px] font-medium ${isClosingSoon ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-muted-foreground'}`}>
            {isFallbackDate ? "Pending" : formatDate(tender.end_date)}
          </span>
        </div>
      </div>

      {/* 5: Actions */}
      <div role="cell" className="flex gap-2 items-center relative z-20 mt-auto w-full">
        <Link
          href={`/bids/${encodeURIComponent(tender.slug || '')}`}
          className="flex-1 h-10 rounded-xl border border-fresh-sky-200 dark:border-fresh-sky-700 bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-700 dark:text-fresh-sky-400 text-xs sm:text-sm font-bold flex items-center justify-center transition-all hover:bg-fresh-sky-100 dark:hover:bg-fresh-sky-800/30 active:scale-[0.98]"
        >
          View Full Details
        </Link>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({
                title: tender.title,
                url: `${window.location.origin}/bids/${encodeURIComponent(tender.slug || '')}`
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(`${window.location.origin}/bids/${encodeURIComponent(tender.slug || '')}`);
              alert("Link copied to clipboard!");
            }
          }}
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground hover:bg-slate-50 dark:hover:bg-muted flex items-center justify-center transition-all active:scale-[0.98]"
          title="Share"
          aria-label={`Share ${tender.title}`}
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center transition-all active:scale-[0.98] ${isSaved ? 'bg-fresh-sky-50 dark:bg-fresh-sky-900/20 border-fresh-sky-200 dark:border-fresh-sky-700 text-fresh-sky-600 dark:text-fresh-sky-400 shadow-sm' : 'bg-white dark:bg-card border-slate-200 dark:border-border text-slate-500 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted hover:text-slate-700 dark:hover:text-muted-foreground'}`}
          title={isSaved ? "Saved" : "Save tender"}
          aria-label={isSaved ? `Unsave ${tender.title}` : `Save ${tender.title}`}
          aria-pressed={isSaved}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-current text-fresh-sky-600 dark:text-fresh-sky-400" : ""}`} />
        </button>
      </div>
    </div>
  );
});

export default TenderCard;
