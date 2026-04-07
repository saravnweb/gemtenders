"use client";

import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function RevealBidNumber({ 
  bidNumber, 
  asButton = false,
  tenderId 
}: { 
  bidNumber: string
  asButton?: boolean
  tenderId?: string
}) {
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  const handleReveal = async () => {
    setIsLoading(true);
    setLimitError(null);

    // Only check API limit if user is logged in and we have a tenderId
    if (user && tenderId) {
      try {
        const response = await fetch("/api/bids/reveal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenderId }),
        });

        if (!response.ok) {
          const data = await response.json();
          setLimitError(data.error);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Reveal error:", error);
        setLimitError("Failed to reveal bid number");
        setIsLoading(false);
        return;
      }
    }

    setRevealed(true);
    setIsLoading(false);
  };

  if (revealed) {
    if (asButton) {
      return (
        <div className="flex w-full py-3.5 bg-slate-100 dark:bg-card border-2 border-slate-200/80 dark:border-border text-slate-800 dark:text-foreground text-base rounded-2xl font-mono font-bold items-center justify-center tracking-widest shadow-inner">
          {bidNumber}
        </div>
      );
    }
    return (
      <span className="font-mono text-xs font-bold text-slate-500 dark:text-muted-foreground bg-slate-100 dark:bg-card px-3 py-1 rounded-md tracking-wide">
        {bidNumber}
      </span>
    );
  }

  if (limitError) {
    return (
      <div className={asButton ? "w-full" : ""}>
        <div className={`${asButton ? "flex w-full py-3.5" : "flex items-center gap-1.5"} relative group overflow-hidden bg-red-50 dark:bg-red-950/20 border-2 ${asButton ? "border-red-200" : "border-red-100"} text-red-700 dark:text-red-300 ${asButton ? "text-sm rounded-2xl" : "text-[11px] rounded-md"} font-semibold items-center justify-center px-3 transition-all cursor-not-allowed shadow-sm`}>
          <span className="text-center">{limitError}</span>
        </div>
      </div>
    );
  }

  if (asButton) {
    return (
      <button
        onClick={handleReveal}
        disabled={isLoading}
        className="flex w-full relative group overflow-hidden py-3.5 bg-white dark:bg-card border-2 border-slate-200/80 dark:border-border text-slate-700 dark:text-foreground text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-muted transition-all cursor-pointer shadow-sm hover:shadow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Eye className={`w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:text-muted-tertiary dark:group-hover:text-slate-400 transition-colors ${isLoading ? "animate-pulse" : ""}`} />
        <span>{isLoading ? "Loading..." : "Reveal Bid Number"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleReveal}
      disabled={isLoading}
      className="group flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-500 dark:text-muted-foreground bg-slate-100 dark:bg-card hover:bg-slate-200 dark:hover:bg-muted px-3 py-1 rounded-md tracking-wide transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Eye className={`w-3 h-3 ${isLoading ? "animate-pulse" : ""}`} />
      <span>{isLoading ? "Loading..." : "Click to reveal bid no."}</span>
    </button>
  );
}
