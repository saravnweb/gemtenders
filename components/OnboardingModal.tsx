"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Bookmark, Bell, FileText, ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'gemtenders_onboarding_done';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  href: string;
}

const STEPS: Step[] = [
  {
    icon: <Zap className="w-6 h-6 text-amber-500" />,
    title: 'Set up keyword alerts',
    description: 'Tell us what you supply — "solar panels", "CCTV", "laptop" — and we\'ll notify you whenever a matching tender is published.',
    cta: 'Set keywords →',
    href: '/dashboard/keywords',
  },
  {
    icon: <Bookmark className="w-6 h-6 text-fresh-sky-500" />,
    title: 'Bookmark interesting tenders',
    description: 'Click the bookmark on any tender to save it. Find all your saved bids in Dashboard → Saved.',
    cta: 'Browse tenders →',
    href: '/',
  },
  {
    icon: <FileText className="w-6 h-6 text-emerald-500" />,
    title: 'Read AI summaries — skip the PDFs',
    description: 'Every tender card shows a one-line AI summary. You get 3 free PDF downloads per day to dig deeper.',
    cta: 'Explore tenders →',
    href: '/explore',
  },
  {
    icon: <Bell className="w-6 h-6 text-atomic-tangerine-500" />,
    title: 'Upgrade for daily email alerts',
    description: 'Starter plan (₹99/mo) sends a daily digest email with all new tenders matching your keywords — directly to your inbox.',
    cta: 'See plans →',
    href: '/pricing',
  },
];

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleCta = () => {
    const href = STEPS[step].href;
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
    router.push(href);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={dismiss}>
      <div
        className="relative bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-muted flex items-center justify-center hover:bg-slate-200 dark:hover:bg-muted/80 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors ${i <= step ? 'bg-atomic-tangerine-500' : 'bg-slate-200 dark:bg-border'}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-muted flex items-center justify-center mb-4">
          {current.icon}
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2">{current.title}</h2>
        <p className="text-sm text-slate-500 dark:text-muted-foreground leading-relaxed mb-8">{current.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={dismiss}
            className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-muted-foreground transition-colors underline underline-offset-2"
          >
            Skip tour
          </button>
          <button
            onClick={handleCta}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-foreground hover:bg-slate-800 text-white dark:text-background font-bold text-sm rounded-xl transition-colors"
          >
            {current.cta}
            {step < STEPS.length - 1 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
