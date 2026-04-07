import React from "react";

export function HighlightedText({ text, highlightTerms }: { text: string; highlightTerms: string[] }) {
  if (!text || !highlightTerms.length) return <>{text}</>;
  const valid = highlightTerms.filter((t) => t.trim().length > 0);
  if (!valid.length) return <>{text}</>;

  const regex = new RegExp(
    `(${valid.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length).join("|")})`,
    "gi"
  );
  return (
    <>
      {text.split(regex).map((part, i) =>
        valid.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-slate-900 dark:text-foreground rounded-[2px] px-[2px] font-bold shadow-[0_0_2px_rgba(0,0,0,0.1)]">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
