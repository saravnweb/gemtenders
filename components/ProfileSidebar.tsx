"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Bookmark, Zap, CreditCard, LogOut, ChevronRight, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const MENU_ITEMS = [
  { label: "Profile", icon: User, href: "/dashboard" },
  { label: "Saved Bids", icon: Bookmark, href: "/dashboard/saved" },
  { label: "Keywords", icon: Zap, href: "/dashboard/keywords" },
  { label: "Subscriptions", icon: CreditCard, href: "/dashboard/subscriptions" },
];

export default function ProfileSidebar({ user, onClose }: { user: any, onClose?: () => void }) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-background border-r border-slate-200 dark:border-border w-full md:w-64 shadow-sm">
      {/* Sidebar Header - Mobile Close */}
      <div className="p-4 border-b border-slate-100 dark:border-border flex items-center justify-between md:hidden">
        <span className="font-bold text-fresh-sky-950 dark:text-foreground">Menu</span>
        <button onClick={onClose} className="p-2 text-slate-600 dark:text-muted-foreground">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* User Summary */}
      <div className="p-6 bg-slate-50/50 dark:bg-card/50 border-b border-slate-200 dark:border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-linear-to-br from-atomic-tangerine-500 to-atomic-tangerine-600 rounded-xl flex items-center justify-center shadow-md">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-800 dark:text-foreground truncate">{user?.email?.split('@')[0] || "Guest User"}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground uppercase tracking-wide">{user ? "Member Account" : "Free Plan"}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                isActive
                  ? "bg-slate-900 dark:bg-muted text-white shadow-md shadow-slate-200 dark:shadow-slate-900"
                  : "text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted hover:text-fresh-sky-950 dark:hover:text-foreground"
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-600 dark:text-muted-foreground group-hover:text-blue-500"}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <ChevronRight className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "hidden" : ""}`} />
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-border">
        {user ? (
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-3 w-full px-4 py-3 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>LOGOUT</span>
          </button>
        ) : (
          <Link
            href="/login?callback=/dashboard/subscriptions"
            className="flex items-center justify-center space-x-3 w-full px-4 py-3 text-white bg-blue-600 font-bold text-xs uppercase tracking-widest hover:bg-blue-700 rounded-xl transition-all"
          >
            <User className="w-4 h-4" />
            <span>LOGIN</span>
          </Link>
        )}
      </div>
    </div>
  );
}
