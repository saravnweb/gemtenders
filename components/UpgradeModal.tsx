"use client";

import { X, Zap, Check, ArrowRight, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type UpgradeReason = 'keywords' | 'state' | 'city';

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
    lockedFeature: string;
    starterBenefit: string;
    proBenefit: string;
}> = {
    keywords: {
        title: "Keyword Limit Reached",
        subtitle: (current, limit) => `You're using ${current} of ${limit} keywords on the Free plan.`,
        lockedFeature: "More keyword monitors",
        starterBenefit: "Track unlimited keywords",
        proBenefit: "Unlimited keywords + multi-state coverage",
    },
    state: {
        title: "State Filter Limit Reached",
        subtitle: (current, limit) => `Your plan allows only ${limit} state filter per monitor.`,
        lockedFeature: "Multiple state filters",
        starterBenefit: "Filter by up to 3 states per monitor",
        proBenefit: "Unlimited states across all monitors",
    },
    city: {
        title: "City Filter Limit Reached",
        subtitle: (current, limit) => `Your plan allows only ${limit} city filter per monitor.`,
        lockedFeature: "Multiple city filters",
        starterBenefit: "Filter by up to 5 cities per monitor",
        proBenefit: "Unlimited cities across all monitors",
    },
};

export default function UpgradeModal({
    isOpen,
    onClose,
    reason,
    currentPlan = 'free',
    currentCount = 0,
    limitCount = 1,
}: UpgradeModalProps) {
    const router = useRouter();
    const config = REASON_CONFIG[reason];

    if (!isOpen) return null;

    const handleUpgrade = () => {
        router.push('/dashboard/subscriptions');
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header gradient */}
                <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 pt-6 pb-10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Lock icon with glow */}
                    <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-4 ring-4 ring-white/10">
                        <Lock className="w-6 h-6 text-white" />
                    </div>

                    <h2 id="upgrade-modal-title" className="text-xl font-black text-white tracking-tight">
                        {config.title}
                    </h2>
                    <p className="text-sm text-blue-100 mt-1 font-medium">
                        {config.subtitle(currentCount, limitCount)}
                    </p>
                </div>

                {/* Overlapping plan card */}
                <div className="relative -mt-5 mx-4">
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-current" />
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
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-muted-foreground">{feat}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* CTAs */}
                <div className="px-6 pt-4 pb-6 flex flex-col gap-2.5">
                    <button
                        onClick={handleUpgrade}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Zap className="w-4 h-4 fill-current" />
                        Upgrade to Starter
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 text-sm font-bold text-slate-500 dark:text-muted-foreground hover:text-slate-700 dark:hover:text-foreground transition-colors"
                    >
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
}
