"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap, Mail, Bell, Star } from 'lucide-react';

const STORAGE_KEY = 'gemtenders_upsell_dismissed';

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (visible && dialogRef.current) {
      if (!dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    } else if (!visible && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [visible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;
    // Delay modal until user has had time to see the product (75 seconds)
    const timer = setTimeout(() => setVisible(true), 75000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleCta = () => {
    dismiss();
    router.push('/pricing');
  };

  if (!visible) return null;

  return (
    <dialog
      ref={dialogRef}
      className="bg-transparent backdrop:bg-black/40 backdrop:backdrop-blur-sm focus:outline-none open:flex items-center justify-center p-4 w-full h-full max-w-none max-h-none border-none"
      onClose={dismiss}
      onClick={(e) => {
        if (e.target === dialogRef.current) dismiss();
      }}
    >
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

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-atomic-tangerine-50 dark:bg-atomic-tangerine-900/20 text-atomic-tangerine-600 dark:text-atomic-tangerine-400 text-xs font-semibold px-3 py-1 rounded-full mb-5">
          <Star className="w-3 h-3 fill-current" />
          Starter Plan — Free for 14 days
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-black text-slate-900 dark:text-foreground leading-tight mb-2">
          Your first relevant tender<br />is probably live right now
        </h2>
        <p className="text-sm text-slate-500 dark:text-muted-foreground leading-relaxed mb-6">
          Set up your keywords and get matching tenders delivered to your inbox every morning — no more manual searching.
        </p>

        {/* Benefits */}
        <ul className="space-y-3 mb-7">
          {[
            { icon: <Mail className="w-4 h-4 text-fresh-sky-500" />, text: 'Daily email digest with tenders matching your keywords' },
            { icon: <Bell className="w-4 h-4 text-atomic-tangerine-500" />, text: 'Instant alerts the moment a relevant tender goes live' },
            { icon: <Zap className="w-4 h-4 text-amber-500" />, text: 'AI summaries so you decide in seconds, not hours' },
          ].map(({ icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-slate-700 dark:text-muted-foreground">
              <span className="mt-0.5 shrink-0">{icon}</span>
              {text}
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleCta}
            className="w-full py-3 bg-atomic-tangerine-500 hover:bg-atomic-tangerine-600 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Set Up My Alerts — Free for 14 Days
          </button>
          <button
            onClick={dismiss}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-muted-foreground transition-colors"
          >
            I'll stay on Free
          </button>
        </div>
      </div>
    </dialog>
  );
}
