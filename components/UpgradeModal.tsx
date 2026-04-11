"use client";

import { useRef, useEffect } from 'react';
import { X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type UpgradeReason = 'keywords' | 'state' | 'city' | 'pdf';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason: UpgradeReason;
    currentPlan?: string;
    currentCount?: number;
    limitCount?: number;
}

const REASON_CONFIG: Record<UpgradeReason, {
    title: string;
    subtitle: (current: number, limit: number) => string;
    starterBenefit: string;
}> = {
    keywords: {
        title: "Unlock Unlimited Keywords",
        subtitle: (current, limit) => `You've hit the ${limit}-keyword limit on the Free plan. Starter lets you track every category, ministry, and location you sell into.`,
        starterBenefit: "Track unlimited keywords",
    },
    state: {
        title: "Unlock More State Filters",
        subtitle: (_current, limit) => `Your Free plan allows ${limit} state filter per monitor. Upgrade to track tenders across multiple states.`,
        starterBenefit: "Filter across multiple states",
    },
    city: {
        title: "Unlock City Filters",
        subtitle: (_current, limit) => `Your Free plan allows ${limit} city filter. Upgrade to target tenders in specific cities.`,
        starterBenefit: "Unlimited city filters",
    },
    pdf: {
        title: "Download This Tender's Documents",
        subtitle: () => "You've used your free PDF downloads for today. Starter subscribers download unlimited bid documents, BOQs, and evaluation criteria.",
        starterBenefit: "Unlimited PDF downloads",
    },
};

export default function UpgradeModal({
    isOpen,
    onClose,
    reason,
    currentCount = 0,
    limitCount = 1,
}: UpgradeModalProps) {
    const router = useRouter();
    const config = REASON_CONFIG[reason];
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (isOpen && dialogRef.current) {
            if (!dialogRef.current.open) {
                dialogRef.current.showModal();
            }
        } else if (!isOpen && dialogRef.current?.open) {
            dialogRef.current.close();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleUpgrade = () => {
        router.push('/dashboard/subscriptions');
        onClose();
    };

    return (
        <dialog
            ref={dialogRef}
            className="bg-transparent backdrop:bg-black/50 backdrop:backdrop-blur-sm focus:outline-none open:flex items-center justify-center p-4 w-full h-full max-w-none max-h-none border-none"
            onClose={onClose}
            onClick={(e) => {
                if (e.target === dialogRef.current) onClose();
            }}
        >
            <div className="relative bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative bg-linear-to-br from-atomic-tangerine-500 via-atomic-tangerine-600 to-atomic-tangerine-700 px-6 pt-6 pb-10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-4 ring-4 ring-white/10">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>

                    <h2 id="upgrade-modal-title" className="text-xl font-black text-white tracking-tight">
                        {config.title}
                    </h2>
                    <p className="text-sm text-orange-100 mt-1 font-medium">
                        {config.subtitle(currentCount, limitCount)}
                    </p>
                </div>

                {/* Overlapping plan card */}
                <div className="relative -mt-5 mx-4">
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest">Starter — ₹99/mo</p>
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{config.starterBenefit}</p>
                        </div>
                    </div>
                </div>

                {/* Features list */}
                <div className="px-6 pt-4 pb-2">
                    <p className="text-xs font-black text-slate-400 dark:text-muted-tertiary uppercase tracking-widest mb-3">What you unlock</p>
                    <ul className="space-y-2.5">
                        {[
                            config.starterBenefit,
                            "Daily email digest on your keywords",
                            "Unlimited PDF downloads",
                            "Push & mobile alerts",
                        ].map((feat) => (
                            <li key={feat} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-3" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-muted-foreground">{feat}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Value anchor */}
                <p className="px-6 pt-3 text-xs text-slate-400 dark:text-muted-foreground text-center italic">
                    One won GeM tender can be worth ₹50,000–₹5 Crore. ₹99/month is the smallest investment you'll make this year.
                </p>

                {/* CTAs */}
                <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                    <button
                        onClick={handleUpgrade}
                        className="w-full py-3.5 bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-600 hover:from-atomic-tangerine-600 hover:to-atomic-tangerine-700 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-atomic-tangerine-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Upgrade to Starter
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-sm font-bold text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground transition-colors"
                    >
                        I'll stay on Free
                    </button>
                </div>
            </div>
        </dialog>
    );
}
