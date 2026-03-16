"use client";

import { useFormStatus } from "react-dom";
import { Globe, Cpu, Loader2 } from "lucide-react";

export function ScrapeButton() {
  const { pending } = useFormStatus();

  return (
    <button 
      disabled={pending}
      className={`w-full py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 group shadow-lg shadow-blue-500/20 ${pending ? 'opacity-80 cursor-not-allowed' : 'hover:bg-blue-500'}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Running... (Check terminal for live logs)</span>
        </>
      ) : (
        <>
          <Globe className="w-5 h-5 group-hover:animate-spin" />
          <span>Start Full Ingestion Engine</span>
        </>
      )}
    </button>
  );
}

export function EnrichButton({ pendingEnrichment }: { pendingEnrichment: number }) {
  const { pending } = useFormStatus();

  return (
    <button 
      disabled={pendingEnrichment === 0 || pending}
      className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center space-x-3 group ${
        pendingEnrichment > 0 
        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300' 
        : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
      } ${pending ? 'opacity-80 cursor-not-allowed' : ''}`}
    >
      {pending ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing... (Check terminal for live logs)</span>
        </>
      ) : (
        <>
          <Cpu className="w-5 h-5" />
          <span>{pendingEnrichment > 0 ? `Fix ${pendingEnrichment} Backlogged Items` : 'Backlog Clear'}</span>
        </>
      )}
    </button>
  );
}
