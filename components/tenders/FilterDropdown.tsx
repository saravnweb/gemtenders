import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, ChevronDown, X } from "lucide-react";

type FDItem = string | { label: string; value: string; count?: number };

function fdValue(item: FDItem) { return typeof item === "string" ? item : item.value; }
function fdLabel(item: FDItem) { return typeof item === "string" ? item : item.label; }
function fdCount(item: FDItem) { return typeof item === "string" ? undefined : item.count; }

export function FilterDropdown({
  label,
  items,
  selected,
  mode = "multi",
  onToggle,
  onSelect,
  onClear,
  onOpen,
  loading = false,
  disabled = false,
  searchable = true,
  searchPlaceholder = "Search…",
}: {
  label: string;
  items: FDItem[];
  selected: string[];
  mode?: "multi" | "single";
  onToggle?: (v: string) => void;
  onSelect?: (v: string) => void;
  onClear: () => void;
  onOpen?: () => void;
  loading?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const opened = useRef(false);
  const prevOnOpen = useRef(onOpen);

  // Reset the "already opened" guard when the onOpen callback changes
  useEffect(() => {
    if (prevOnOpen.current !== onOpen) {
      prevOnOpen.current = onOpen;
      opened.current = false;
    }
  }, [onOpen]);

  useEffect(() => { setMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const updatePosition = useCallback(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelW = Math.min(360, vw - 16);
    let left = rect.left;
    if (left + panelW > vw - 8) left = vw - panelW - 8;
    left = Math.max(8, left);
    setPanelStyle({ position: "fixed", top: rect.bottom + 6, left, width: panelW, zIndex: 9999, visibility: "visible" });
    // Focus after position is set so the browser doesn't scroll to the portal element
    requestAnimationFrame(() => { searchInputRef.current?.focus({ preventScroll: true }); });
  }, [open]);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  // Update position on window scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, { passive: true, capture: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, { capture: true });
      window.removeEventListener("resize", handler);
    };
  }, [open, updatePosition]);

  function handleToggle() {
    if (disabled) return;
    if (!open && !opened.current) { opened.current = true; onOpen?.(); }
    if (open) setPanelStyle({ position: "fixed", visibility: "hidden" });
    setOpen((v) => !v);
    setQuery("");
  }

  const filtered = query.trim()
    ? items.filter((i) => fdLabel(i).toLowerCase().includes(query.toLowerCase()))
    : items;

  const isActive = selected.length > 0;
  const buttonLabel = label;

  const panel = (
    <div
      ref={panelRef}
      style={panelStyle}
      className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-2xl shadow-xl overflow-hidden flex flex-col"
    >
      <div className="p-2 border-b border-slate-100 dark:border-border flex items-center gap-2">
        {searchable ? (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-card border border-slate-200 dark:border-border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-muted-foreground placeholder:text-slate-400 transition-all"
            />
          </div>
        ) : (
          <div className="flex-1 px-2 text-sm font-bold text-slate-700 dark:text-muted-foreground">{label}</div>
        )}
        <button
          onClick={() => setOpen(false)}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-muted rounded-full transition-colors shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="max-h-[min(420px,70vh)] overflow-y-auto flex-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No results</div>
        ) : filtered.map((item) => {
          const val = fdValue(item);
          const lbl = fdLabel(item);
          const checked = selected.includes(val);
          const cnt = fdCount(item);
          return (
            <button
              key={val}
              onClick={() => {
                if (mode === "single") { onSelect?.(val); setOpen(false); }
                else { onToggle?.(val); }
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-muted ${
                checked ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-link-hover font-bold" : "text-slate-700 dark:text-muted-foreground"
              }`}
            >
              {mode === "multi" ? (
                <span className={`w-3.5 h-3.5 shrink-0 rounded border flex items-center justify-center transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300 dark:border-border"}`}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
              ) : (
                <span className={`w-3.5 h-3.5 shrink-0 rounded-full border flex items-center justify-center transition-colors ${checked ? "border-blue-600" : "border-slate-300 dark:border-border"}`}>
                  {checked && <span className="w-2 h-2 rounded-full bg-blue-600 block" />}
                </span>
              )}
              <span className="flex-1 leading-tight">{lbl}</span>
              {cnt !== undefined && cnt > 0 && (
                <span suppressHydrationWarning className={`shrink-0 tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  checked ? "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200" : "bg-slate-100 dark:bg-card text-slate-500 dark:text-muted-foreground"
                }`}>
                  {cnt.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(mode === "multi" || selected.length > 0) && (
        <div className="p-2 border-t border-slate-100 dark:border-border flex items-center gap-2 bg-slate-50/50 dark:bg-card">
          {selected.length > 0 && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className="flex-1 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-muted-foreground dark:hover:text-foreground rounded-xl hover:bg-slate-100 dark:hover:bg-muted transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className={`${(mode === "multi" || selected.length > 0) ? "flex-1" : "w-full"} py-2 px-4 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-[0.98] text-center`}
          >
            {mode === "multi" ? "Done" : "Close"}
          </button>
        </div>
      )}

    </div>
  );

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-white dark:bg-card border-slate-200 dark:border-border text-slate-400"
            : isActive
              ? "bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
              : "bg-white dark:bg-card border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:border-slate-300 dark:hover:border-muted-foreground/35"
        }`}
      >
        <span className="max-w-[140px] sm:max-w-[200px] truncate">{buttonLabel}</span>
        {isActive && selected.length > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10px] font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""} ${isActive ? "text-blue-500" : ""}`} />
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  );
}
