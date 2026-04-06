"use client";

import { useState, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";
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
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return;
            supabase.from("profiles").select("membership_plan").eq("id", user.id).single()
                .then(({ data }) => {
                    if (data && (data.membership_plan === "starter" || data.membership_plan === "pro")) {
                        setIsPremium(true);
                    }
                });
        });
    }, []);

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (loading) return;

        // Free user daily limit (client-side)
        if (!isPremium) {
            const today = new Date().toDateString();
            const storageKey = "gem_pdf_downloads";
            try {
                const stored = localStorage.getItem(storageKey);
                let data = stored ? JSON.parse(stored) : { date: today, count: 0 };
                if (data.date !== today) data = { date: today, count: 0 };
                if (data.count >= 5) {
                    if (confirm(`Free plan allows up to 5 PDF downloads daily.\n\nYou've reached your limit. Upgrade to download unlimited PDFs?`)) {
                        router.push("/dashboard/subscriptions");
                    }
                    return;
                }
                data.count += 1;
                localStorage.setItem(storageKey, JSON.stringify(data));
            } catch {}
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/download/${slug}`);

            if (res.status === 401) {
                router.push("/login");
                return;
            }
            if (res.status === 403) {
                if (confirm("Upgrade to a paid plan to download PDFs. Go to subscriptions?")) {
                    router.push("/dashboard/subscriptions");
                }
                return;
            }
            if (!res.ok) {
                alert("PDF is not available for this tender yet. Please try again later.");
                return;
            }

            const { signedUrl } = await res.json();
            if (signedUrl) {
                window.open(signedUrl, "_blank");
            } else {
                alert("Could not retrieve PDF. Please try again.");
            }
        } catch {
            alert("Download failed. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const btnClass = (base: string) =>
        `${base} ${loading ? "opacity-60 cursor-wait" : ""}`;

    if (!pdfUrl) {
        return (
            <div className="flex flex-col w-full gap-3">
                <div className={`flex-1 ${isMobile ? "py-3.5" : "py-3.5"} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 text-xs ${isMobile ? "rounded-xl" : "rounded-2xl"} font-medium flex items-center justify-center space-x-2 border border-slate-200/60 dark:border-slate-700 shadow-sm opacity-70`}>
                    <Download className="w-4 h-4 opacity-40" />
                    <span>Internal PDF Unavailable</span>
                </div>
                <a
                    href={detailsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all shadow-md hover:shadow-lg"
                >
                    <Loader2 className="w-4 h-4" />
                    <span>View on GeM Portal</span>
                </a>
                <p className="text-[10px] text-center text-slate-400 font-medium">Original document available on official portal</p>
            </div>
        );
    }

    if (isMobile) {
        return (
            <div className="flex flex-col w-full gap-3">
                <button
                    onClick={handleDownload}
                    disabled={loading}
                    className={btnClass("flex-1 py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-xl font-semibold flex items-center justify-center space-x-2 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md")}
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    <span>{loading ? "Loading..." : "Download PDF"}</span>
                </button>
                <a
                    href={detailsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 text-slate-500 text-[11px] font-bold flex items-center justify-center hover:text-blue-600 transition-colors"
                >
                    View on GeM Portal
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full">
            <button
                onClick={handleDownload}
                disabled={loading}
                className={btnClass("flex w-full relative group overflow-hidden py-3.5 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:bg-black dark:hover:bg-slate-600 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5")}
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin relative z-10" /> : <Download className="w-5 h-5 relative z-10" />}
                <span className="relative z-10">{loading ? "Loading..." : "Download PDF"}</span>
            </button>
            <a
                href={detailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full py-2.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 text-xs font-bold items-center justify-center transition-colors border border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-900"
            >
                View full document on GeM Portal
            </a>
        </div>
    );
}
