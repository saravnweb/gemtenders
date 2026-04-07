"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

export default function RevealBidNumber({ bidNumber, asButton = false }: { bidNumber: string, asButton?: boolean }) {
  const [revealed, setRevealed] = useState(false);

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

  if (asButton) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="flex w-full relative group overflow-hidden py-3.5 bg-white dark:bg-card border-2 border-slate-200/80 dark:border-border text-slate-700 dark:text-foreground text-sm rounded-2xl font-semibold items-center justify-center space-x-2.5 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-muted transition-all cursor-pointer shadow-sm hover:shadow"
      >
        <Eye className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:text-muted-tertiary dark:group-hover:text-slate-400 transition-colors" />
        <span>Reveal Bid Number</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setRevealed(true)}
      className="group flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-500 dark:text-muted-foreground bg-slate-100 dark:bg-card hover:bg-slate-200 dark:hover:bg-muted px-3 py-1 rounded-md tracking-wide transition-colors cursor-pointer"
    >
      <Eye className="w-3 h-3" />
      <span>Click to reveal bid no.</span>
    </button>
  );
}
