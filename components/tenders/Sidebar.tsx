import { Clock } from "lucide-react";

interface SidebarProps {
  activeTab: "all" | "foryou" | "archived";
  setActiveTab: (tab: "all" | "foryou" | "archived") => void;
  activeCount: number | null;
  archivedCount: number | null;
  tendersLength: number;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  activeCount,
  archivedCount,
  tendersLength,
}: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col gap-1 w-40 shrink-0 sticky top-20">
      <p className="text-xs font-bold text-slate-400 dark:text-muted-tertiary uppercase tracking-widest px-3 mb-1">View</p>
      {(["all", "archived"] as const).map((tab) => {
        const cnt = tab === "all" ? activeCount : archivedCount;
        return (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left w-full ${
              activeTab === tab
                ? "bg-slate-900 dark:bg-muted text-white shadow-sm"
                : "text-slate-600 dark:text-muted-foreground hover:bg-slate-100 dark:hover:bg-muted hover:text-slate-900 dark:hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2.5">
              {tab === "all"      && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
              {tab === "archived" && <Clock className="w-3.5 h-3.5 shrink-0" />}
              {tab === "all" ? "Active" : "Archived Bids"}
            </span>
            <span suppressHydrationWarning className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-100"}`}>
              {(cnt ?? (tab === 'all' ? tendersLength : 0)).toLocaleString()}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
