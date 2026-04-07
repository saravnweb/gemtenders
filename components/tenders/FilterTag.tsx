import React from "react";
import { X } from "lucide-react";

export function FilterTag({ label, onRemove, color = "blue" }: { label: string; onRemove: () => void; color?: "blue" | "indigo" }) {
  const cls = color === "indigo"
    ? "bg-muted-olive-50 text-muted-olive-600 dark:bg-muted-olive-900/20 dark:text-muted-olive-400 border-muted-olive-100 dark:border-muted-olive-800"
    : "bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-600 dark:text-fresh-sky-400 border-fresh-sky-100 dark:border-fresh-sky-800";
  return (
    <button aria-label={`Remove filter ${label}`} onClick={onRemove} className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap ${cls}`}>
      <span>{label}</span>
      <X className="w-3 h-3" />
    </button>
  );
}
