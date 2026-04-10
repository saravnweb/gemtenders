"use client";
import { useState, ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";

interface FilterSectionProps {
  title: string;
  icon?: ReactNode;
  count: number;
  children: ReactNode;
  onClear?: () => void;
  defaultOpen?: boolean;
}

export function FilterSection({
  title,
  icon,
  count,
  children,
  onClear,
  defaultOpen = true,
}: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-100 dark:border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-slate-400 dark:text-muted-foreground shrink-0 flex items-center">
              {icon}
            </span>
          )}
          <span className="text-[10px] font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest truncate">
            {title}
          </span>
          {count > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {count > 0 && onClear && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              aria-label={`Clear ${title} filters`}
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {open && <div className="px-2 pb-2 space-y-1">{children}</div>}
    </div>
  );
}
