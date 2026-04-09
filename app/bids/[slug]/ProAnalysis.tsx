"use client";

import { useState } from 'react';
import { Zap, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ProAnalysisProps {
  tender: {
    title: string;
    ai_summary?: string;
    emd_amount?: number;
    end_date?: string;
    eligibility_msme?: boolean;
    eligibility_mii?: boolean;
    ministry_name?: string;
    organisation_name?: string;
    state?: string;
  };
  isPro: boolean;
}

export default function ProAnalysis({ tender, isPro }: ProAnalysisProps) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tender),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setAnalysis(data.analysis);
      setExpanded(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const worthinessMap: Record<string, string> = {
    'High': 'text-emerald-600 bg-emerald-50 border-emerald-200',
    'Medium': 'text-amber-600 bg-amber-50 border-amber-200',
    'Low': 'text-red-600 bg-red-50 border-red-200',
  };
  const worthinessColor = worthinessMap[analysis?.bid_worthiness] || 'text-slate-600 bg-slate-50 border-slate-200';

  if (!isPro) {
    return (
      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-0.5">Pro: Deep AI Analysis</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">Get bid worthiness score, eligibility checklist, winning tips, and time-to-prepare estimate for this tender.</p>
            <Link href="/dashboard/subscriptions" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors">
              <Zap className="w-3 h-3" /> Upgrade to Pro
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
          <span className="text-sm font-bold text-amber-800 dark:text-amber-300">Pro AI Analysis</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">Pro</span>
        </div>
        {analysis && (
          <button onClick={() => setExpanded(e => !e)} className="text-amber-600 hover:text-amber-800 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      <div className="p-4">
        {!analysis && !loading && (
          <div className="text-center py-2">
            <p className="text-xs text-slate-500 dark:text-muted-foreground mb-3">
              Get a full breakdown: bid worthiness, eligibility checklist, and winning tips.
            </p>
            <button
              onClick={fetchAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> Analyse This Tender
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Analysing tender…
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center py-2">{error}</p>
        )}

        {analysis && expanded && (
          <div className="space-y-4 mt-1">
            {/* Bid worthiness */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bid Worthiness</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded border ${worthinessColor}`}>
                {analysis.bid_worthiness}
              </span>
            </div>
            {analysis.bid_worthiness_reason && (
              <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed -mt-2">{analysis.bid_worthiness_reason}</p>
            )}

            {/* Key requirements */}
            {analysis.key_requirements?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-foreground uppercase tracking-wider mb-2">Key Requirements</p>
                <ul className="space-y-1">
                  {analysis.key_requirements.map((r: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Eligibility checklist */}
            {analysis.eligibility_checklist?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-foreground uppercase tracking-wider mb-2">Eligibility Checklist</p>
                <ul className="space-y-1">
                  {analysis.eligibility_checklist.map((item: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-muted-foreground">
                      {item.required
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                      {item.item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Winning tips */}
            {analysis.winning_tips?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Winning Tips
                </p>
                <ul className="space-y-1">
                  {analysis.winning_tips.map((tip: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-muted-foreground pl-3 border-l-2 border-emerald-200">{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Watch out */}
            {analysis.watch_out && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{analysis.watch_out}</p>
              </div>
            )}

            {/* Time to prepare */}
            {analysis.time_to_prepare && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>Estimated prep time: <strong className="text-slate-700 dark:text-foreground">{analysis.time_to_prepare}</strong></span>
              </div>
            )}

            <button
              onClick={fetchAnalysis}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2"
            >
              Regenerate analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
