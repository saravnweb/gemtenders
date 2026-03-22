"use client";

import { useState, useEffect } from "react";
import { Download, Zap, ExternalLink as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DownloadButtons({
    pdfUrl,
    detailsUrl,
    slug,
    isMobile
}: {
    pdfUrl: string | null;
    detailsUrl: string;
    slug: string;
    isMobile: boolean;
}) {
    const router = useRouter();
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from("profiles").select("membership_plan").eq("id", user.id).single()
                    .then(({ data }) => {
                        if (data && (data.membership_plan === "starter" || data.membership_plan === "pro")) {
                            setIsPremium(true);
                        }
                    });
            }
        });
    }, []);

    const handleDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (!pdfUrl) return;

        if (!isPremium) {
            // Check local storage for daily limit
            const today = new Date().toDateString();
            const storageKey = "gem_pdf_downloads";
            try {
                const stored = localStorage.getItem(storageKey);
                let data = stored ? JSON.parse(stored) : { date: today, count: 0 };
                
                if (data.date !== today) {
                    data = { date: today, count: 0 };
                }

                if (data.count >= 5) {
                    e.preventDefault();
                    if (confirm(`Free plan allows up to 5 PDF downloads daily.\n\nYou have reached your limit for today. Would you like to upgrade to Starter or Pro to download unlimited PDFs?`)) {
                        router.push("/dashboard/subscriptions");
                    }
                    return;
                }

                data.count += 1;
                localStorage.setItem(storageKey, JSON.stringify(data));
            } catch (err) {
               // ignore
            }
        }
        // Allows default action (href target _blank to proceed)
    };

    if (isMobile) {
        return (
            <div className="flex w-full gap-3">
                {pdfUrl ? (
                    <a
                        href={`/api/download/${slug}`}
                        target="_blank"
                        onClick={handleDownload}
                        className="flex-1 py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md"
                    >
                        <Download className="w-5 h-5" />
                        <span>Download PDF</span>
                    </a>
                ) : (
                    <div className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 cursor-not-allowed border border-slate-200/60 dark:border-slate-700 shadow-sm">
                        <Download className="w-5 h-5" />
                        <span>Document Unavailable</span>
                    </div>
                )}
            </div>
        );
    }

    // Desktop View
    return (
        <div className="space-y-3 w-full">
            {pdfUrl ? (
                <a
                    href={`/api/download/${slug}`}
                    target="_blank"
                    onClick={handleDownload}
                    className="flex w-full relative group overflow-hidden py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5"
                >
                    <Download className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Download PDF</span>
                </a>
            ) : (
                <div className="flex w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 cursor-not-allowed border border-slate-200/60 dark:border-slate-700 shadow-sm">
                    <Download className="w-4 h-4" />
                    <span>Document Unavailable</span>
                </div>
            )}
        </div>
    );
}
