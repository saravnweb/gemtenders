"use client";

import Link from "next/link";
import Image from "next/image";
import { Zap, User, LogOut, Menu, X, LayoutDashboard, Bookmark, CreditCard, ChevronRight, Bell, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `https://gemtenders.org/auth/callback`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Sign in error:", err.message);
      setIsSigningIn(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <header className="border-b border-fresh-sky-100 dark:border-fresh-sky-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 shadow-sm font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 relative">
            {/* Mobile Menu Button - Left Aligned */}
            <div className="md:hidden flex items-center z-10">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-fresh-sky-700 p-2 hover:bg-fresh-sky-50 rounded-lg transition-colors"
                aria-label="Toggle Menu"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Logo - Centered on Mobile, Left on Desktop */}
            <div className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:flex-1 flex items-center justify-center md:justify-start">
              <Link href="/" aria-label="Home" className="flex items-center space-x-2 sm:space-x-3 group scale-100 sm:scale-110 transition-transform origin-left">
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 flex items-center justify-center">
                  <Image 
                    src="/favicon.png" 
                    alt="GeMTenders.org Home" 
                    width={64}
                    height={64}
                    priority
                    className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <span className="text-xl sm:text-2xl font-black text-fresh-sky-950 dark:text-white tracking-tight flex items-center leading-none">
                  GeMTenders.org
                </span>
              </Link>
            </div>

            {/* Right Side Icons & Desktop Nav */}
            <div className="flex items-center space-x-1 sm:space-x-4 z-10">
              {/* Dark Mode Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2 text-fresh-sky-700 dark:text-fresh-sky-300 hover:bg-fresh-sky-50 dark:hover:bg-fresh-sky-900/30 rounded-full transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}

              {/* Notification Icon - Right Aligned (Always Visible) */}
              <button className="p-2 text-fresh-sky-700 dark:text-fresh-sky-300 hover:bg-fresh-sky-50 dark:hover:bg-fresh-sky-900/30 rounded-full transition-colors relative group" aria-label="Notifications">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-12" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-atomic-tangerine-600 rounded-full border border-white dark:border-zinc-950"></span>
              </button>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/categories" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Categories</span>
                </Link>
                {!loading && user ? (
                  <>
                    <Link href="/dashboard/saved" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                      <Bookmark className="w-4 h-4" />
                      <span>Saved Bids</span>
                    </Link>
                    <Link href="/dashboard/keywords" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                      <Zap className="w-4 h-4" />
                      <span>Saved Keywords</span>
                    </Link>
                    <Link href="/dashboard/subscriptions" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                      <CreditCard className="w-4 h-4" />
                      <span>Plans</span>
                    </Link>
                  </>
                ) : (
                    <Link href="/" className="text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                      Explore Bids
                    </Link>
                )}

                <div className="h-6 w-px bg-fresh-sky-100 mx-2"></div>

                {!loading && (
                  <>
                    {user ? (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-fresh-sky-100 dark:border-zinc-700 shadow-sm">
                          <div className="w-7 h-7 bg-linear-to-br from-atomic-tangerine-400 to-atomic-tangerine-600 rounded-full flex items-center justify-center border border-white/20">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-fresh-sky-900 dark:text-fresh-sky-100 truncate leading-tight">{user.email?.split('@')[0]}</span>
                            <span className="text-[8px] font-bold text-atomic-tangerine-600 uppercase tracking-tighter">Enterprise</span>
                          </div>
                          <button 
                            onClick={handleSignOut}
                            className="p-1 text-fresh-sky-300 hover:text-red-500 transition-colors ml-1"
                            title="Sign Out"
                            aria-label="Sign Out"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={signInWithGoogle}
                          disabled={isSigningIn}
                          className="text-sm font-bold text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors disabled:opacity-50"
                        >
                          {isSigningIn ? "..." : "Sign In"}
                        </button>
                        <button 
                          onClick={signInWithGoogle}
                          disabled={isSigningIn}
                          className="bg-fresh-sky-950 hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isSigningIn ? "Connecting..." : "Join Free"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay - OUTSIDE Header */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-100 md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 transition-opacity cursor-pointer" 
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          
          {/* Drawer */}
          <div id="mobile-menu" className="fixed inset-y-0 left-0 w-[240px] h-dvh bg-white dark:bg-zinc-950 shadow-2xl flex flex-col border-r border-slate-100 dark:border-zinc-800 animate-in slide-in-from-left duration-300 ease-out" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-50 dark:border-zinc-800 flex items-center justify-between h-16 shrink-0 bg-white dark:bg-zinc-950">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-[0.2em] ml-2">Navigation</span>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 text-slate-600 hover:text-slate-900 transition-colors rounded-lg bg-slate-50 border border-slate-100"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 pb-10 scrollbar-none">
              <div className="space-y-6">
                {!loading && (
                  <>
                    {user ? (
                      /* User Profile Summary - Only when logged in */
                      <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-200/50">
                        <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-md">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 truncate tracking-tight">{user.email?.split('@')[0]}</span>
                          <span className="text-[9px] font-medium text-slate-600 uppercase tracking-widest">Active Account</span>
                        </div>
                      </div>
                    ) : (
                      /* Sign In Button - Only in Guest Mode */
                      <button 
                        onClick={() => { signInWithGoogle(); setIsMenuOpen(false); }} 
                        disabled={isSigningIn}
                        className="w-full text-center py-3.5 text-slate-900 font-bold text-xs uppercase tracking-widest border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                        {isSigningIn ? "Connecting..." : "Sign In"}
                      </button>
                    )}

                    {/* Navigation Links - Always Visible */}
                    <div className="flex flex-col space-y-1">
                      <MenuListItem 
                        href="/categories" 
                        icon={<LayoutDashboard className="w-4 h-4 text-slate-600" />} 
                        label="Categories" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem 
                        href="/dashboard/saved" 
                        icon={<Bookmark className="w-4 h-4 text-slate-600" />} 
                        label="Saved Bids" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem 
                        href="/dashboard/keywords" 
                        icon={<Zap className="w-4 h-4 text-slate-600" />} 
                        label="Saved Keywords" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem 
                        href="/dashboard/subscriptions" 
                        icon={<CreditCard className="w-4 h-4 text-slate-600" />} 
                        label="Plans" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                    </div>

                    {/* Conditional Bottom Action: Sign Out or Register */}
                    <div className="pt-4 border-t border-slate-100">
                      {user ? (
                        <button 
                          onClick={() => { handleSignOut(); setIsMenuOpen(false); }} 
                          className="w-full flex items-center justify-center space-x-2 py-3.5 text-red-500 font-bold text-xs uppercase tracking-widest border border-red-50 rounded-xl bg-red-50/50 hover:bg-red-50 transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out Account</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => { signInWithGoogle(); setIsMenuOpen(false); }} 
                          disabled={isSigningIn}
                          className="w-full text-center py-3.5 text-white font-bold text-xs uppercase tracking-widest bg-slate-900 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSigningIn ? "Creating Account..." : "Register Free"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuListItem({ href, icon, label, onClick }: { href: string, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <Link 
      href={href} 
      onClick={onClick} 
      className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all group"
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide leading-none">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
