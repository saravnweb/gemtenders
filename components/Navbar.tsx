"use client";

import Link from "next/link";
import Image from "next/image";
import { Zap, LogOut, Menu, X, LayoutDashboard, Bookmark, CreditCard, ChevronRight, Bell, Sun, Moon, Inbox, CheckCircle2, Info, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState<{ name: string } | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => setMounted(true), []);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (e: any) {
      console.error("Sign in error:", e.message);
      setIsSigningIn(false);
    }
  };

  const showWelcome = (name: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setWelcomeToast({ name });
    toastTimerRef.current = setTimeout(() => setWelcomeToast(null), 3500);
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
      
      if (user) {
         fetch('/api/notifications', { cache: 'no-store' })
           .then(res => res.json())
           .then(data => {
             if (data.notifications) setNotifications(data.notifications);
           })
           .catch(console.error);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' && session?.user) {
        const name = session.user.user_metadata?.full_name?.split(' ')[0]
          || session.user.email?.split('@')[0]
          || 'there';
        showWelcome(name);
        // Fetch notifications for newly signed-in user
        fetch('/api/notifications', { cache: 'no-store' })
          .then(res => res.json())
          .then(data => { if (data.notifications) setNotifications(data.notifications); })
          .catch(console.error);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleClearAll = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });
      if (response.ok) {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  return (
    <>
      <header className="border-b border-fresh-sky-100 dark:border-fresh-sky-900 bg-white/80 dark:bg-background/80 backdrop-blur-md sticky top-0 z-50 shadow-sm font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 relative">
            {/* Mobile Menu Button - Left Aligned */}
            <div className="md:hidden flex items-center z-10">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-fresh-sky-700 dark:text-fresh-sky-300 p-2 hover:bg-fresh-sky-50 dark:hover:bg-fresh-sky-900/30 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
                aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Logo - Centered on Mobile, Left on Desktop */}
            <div className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:flex-1 flex items-center justify-center md:justify-start">
              <Link href="/" aria-label="Home" className="flex items-center space-x-1.5 sm:space-x-2 group scale-100 sm:scale-105 transition-transform origin-left">
                <div className="relative h-9 w-9 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center">
                  <Image 
                    src="/android-chrome-192x192.png" 
                    alt="GeMTenders.org Home" 
                    width={48}
                    height={48}
                    priority
                    className="h-full w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <span className="font-sans text-base sm:text-xl font-black tracking-tight flex items-center leading-none" style={{ color: '#397FB3' }}>
                  GeMTenders.org
                </span>
              </Link>
            </div>

            {/* Right Side Icons & Desktop Nav */}
            <div className="flex items-center space-x-1 sm:space-x-4 z-10">

              {/* Notification Icon and Dropdown */}
              {user && (
                <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                      aria-expanded={isNotificationsOpen}
                      aria-haspopup="true"
                      className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full transition-colors relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500 ${isNotificationsOpen ? 'bg-fresh-sky-100 dark:bg-muted text-atomic-tangerine-600' : 'text-fresh-sky-700 dark:text-fresh-sky-300 hover:bg-fresh-sky-50 dark:hover:bg-fresh-sky-900/30'}`}
                      aria-label={`Notifications${notifications.some(n => !n.is_read) ? ' — you have unread alerts' : ''}`}
                    >
                      <Bell className="w-5 h-5 transition-transform group-hover:rotate-12" />
                      {notifications.some(n => !n.is_read) && (
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-atomic-tangerine-600 rounded-full border-1.5 border-white dark:border-background" aria-hidden="true"></span>
                      )}
                    </button>

                  {isNotificationsOpen && (
                    <div role="dialog" aria-label="Notifications panel" className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] bg-white dark:bg-card border border-slate-100 dark:border-border rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                      <div className="p-4 border-b border-slate-50 dark:border-border bg-slate-50/50 dark:bg-card/50 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-foreground">Alerts</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-atomic-tangerine-100 text-atomic-tangerine-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{notifications.filter(n => !n.is_read).length} New</span>
                          {notifications.length > 0 && (
                            <button
                              onClick={handleClearAll}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-muted rounded transition-colors text-slate-500 hover:text-slate-700 dark:text-muted-foreground dark:hover:text-foreground"
                              aria-label="Clear all notifications"
                              title="Clear all notifications"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center flex flex-col items-center justify-center">
                            <Inbox className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-sm font-medium text-slate-500">No new alerts.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-50 dark:divide-border/50">
                            {notifications.map((notif: any) => (
                              <button
                                key={notif.id}
                                onClick={async () => {
                                  if (!notif.is_read) {
                                    setNotifications(current => current.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
                                    await fetch('/api/notifications', { method: 'POST', body: JSON.stringify({ id: notif.id }) });
                                  }
                                  setIsNotificationsOpen(false);
                                  if (notif.link) router.push(notif.link);
                                }}
                                className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors flex flex-col gap-1 ${notif.is_read ? 'opacity-60' : 'bg-blue-50/30 dark:bg-blue-900/10'}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-foreground line-clamp-1">{notif.title}</span>
                                  {!notif.is_read && <span className="w-1.5 h-1.5 shrink-0 bg-blue-500 rounded-full mt-1.5"></span>}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-muted-foreground line-clamp-2 leading-relaxed">{notif.message}</p>
                                <span suppressHydrationWarning className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{new Date(notif.created_at).toLocaleDateString()}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-2 border-t border-slate-50 dark:border-border bg-slate-50/50 dark:bg-card/50 text-center">
                        <Link href="/dashboard" onClick={() => setIsNotificationsOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">See all matches in Dashboard</Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center space-x-6">
                <Link href="/explore" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Explore</span>
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
                    <Link href="/explore" className="text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                      Explore Bids
                    </Link>
                )}

                <Link href="/about" className="flex items-center space-x-1.5 text-xs font-black uppercase tracking-widest text-fresh-sky-700 dark:text-fresh-sky-300 hover:text-atomic-tangerine-600 transition-colors">
                  <Info className="w-4 h-4" />
                  <span>About</span>
                </Link>

                <div className="h-6 w-px bg-fresh-sky-100 mx-2"></div>

                {!loading && (
                  <>
                    {user ? (
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-3 bg-white dark:bg-card px-3 py-1.5 rounded-full border border-fresh-sky-100 dark:border-border shadow-sm">
                          <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 dark:border-border shrink-0 bg-white flex items-center justify-center">
                            {user.user_metadata?.avatar_url ? (
                              <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <GoogleIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-fresh-sky-900 dark:text-fresh-sky-100 truncate leading-tight">{user.email?.split('@')[0]}</span>
                            <span className="text-[8px] font-bold text-atomic-tangerine-600 uppercase tracking-tighter">Enterprise</span>
                          </div>
                          <button
                            onClick={handleSignOut}
                            className="p-1 text-fresh-sky-300 hover:text-red-500 transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
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

      {/* Sign-in Success Toast */}
      {welcomeToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-200 pointer-events-none animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-fresh-sky-950 dark:bg-card text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-fresh-sky-800 dark:border-border">
            <div className="w-8 h-8 bg-linear-to-br from-atomic-tangerine-400 to-atomic-tangerine-600 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Signed in, {welcomeToast.name}!</p>
              <p className="text-xs text-fresh-sky-400 leading-tight mt-0.5">Welcome to GeMTenders.org</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay - OUTSIDE Header */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-100 md:hidden">
          <div 
            className="fixed inset-0 bg-slate-900/60 transition-opacity cursor-pointer" 
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          
          {/* Drawer */}
          <div id="mobile-menu" className="fixed inset-y-0 left-0 w-[240px] h-dvh bg-white dark:bg-background shadow-2xl flex flex-col border-r border-slate-100 dark:border-border animate-in slide-in-from-left duration-300 ease-out" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-50 dark:border-border flex items-center justify-between h-14 sm:h-16 shrink-0 bg-white dark:bg-background">
              <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-[0.2em] ml-2">Navigation</span>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 text-slate-600 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors rounded-lg bg-slate-50 dark:bg-card border border-slate-100 dark:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-border"
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
                      <div className="flex items-center space-x-3 p-4 bg-slate-50 dark:bg-card/50 rounded-xl border border-slate-200/50 dark:border-border/50">
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-border shadow-md bg-white dark:bg-card flex items-center justify-center">
                          {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <GoogleIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-900 dark:text-foreground truncate tracking-tight">{user.email?.split('@')[0]}</span>
                          <span className="text-[9px] font-medium text-slate-600 dark:text-muted-foreground uppercase tracking-widest">Active Account</span>
                        </div>
                      </div>
                    ) : (
                      /* Sign In Button - Only in Guest Mode */
                      <button 
                        onClick={() => { signInWithGoogle(); setIsMenuOpen(false); }} 
                        disabled={isSigningIn}
                        className="w-full text-center py-3.5 text-slate-900 dark:text-foreground font-bold text-xs uppercase tracking-widest border border-slate-200 dark:border-border rounded-xl hover:bg-slate-50 dark:hover:bg-card transition-all disabled:opacity-50"
                      >
                        {isSigningIn ? "Connecting..." : "Sign In"}
                      </button>
                    )}

                    {/* Navigation Links - Always Visible */}
                    <div className="flex flex-col space-y-1">
                      <MenuListItem 
                        href="/explore" 
                        icon={<LayoutDashboard className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />} 
                        label="Explore" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem 
                        href="/dashboard/saved" 
                        icon={<Bookmark className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />} 
                        label="Saved Bids" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem 
                        href="/dashboard/keywords" 
                        icon={<Zap className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />} 
                        label="Saved Keywords" 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <MenuListItem
                        href="/dashboard/subscriptions"
                        icon={<CreditCard className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />}
                        label="Plans"
                        onClick={() => setIsMenuOpen(false)}
                      />
                      <MenuListItem
                        href="/about"
                        icon={<Info className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />}
                        label="About"
                        onClick={() => setIsMenuOpen(false)}
                      />
                    </div>

                    {/* Conditional Bottom Action: Sign Out or Register */}
                    <div className="pt-4 border-t border-slate-100 dark:border-border space-y-2">
                      {user ? (
                        <button
                          onClick={() => { handleSignOut(); setIsMenuOpen(false); }}
                          className="w-full flex items-center justify-center space-x-2 py-3.5 text-red-500 dark:text-red-400 font-bold text-xs uppercase tracking-widest border border-red-50 dark:border-red-900/30 rounded-xl bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out Account</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => { signInWithGoogle(); setIsMenuOpen(false); }}
                          disabled={isSigningIn}
                          className="w-full text-center py-3.5 text-white dark:text-background font-bold text-xs uppercase tracking-widest bg-slate-900 dark:bg-white rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isSigningIn ? "Creating Account..." : "Register Free"}
                        </button>
                      )}

                      {/* Dark Mode Toggle */}
                      {mounted && (
                        <button
                          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                          className="w-full flex items-center justify-between px-4 py-3.5 text-slate-600 dark:text-muted-foreground font-bold text-xs uppercase tracking-widest border border-slate-100 dark:border-border rounded-xl bg-slate-50 dark:bg-card hover:bg-slate-100 dark:hover:bg-muted transition-all"
                          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        >
                          <div className="flex items-center space-x-2">
                            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            <span>Dark Mode</span>
                          </div>
                          <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${theme === "dark" ? "bg-fresh-sky-600" : "bg-slate-300"}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${theme === "dark" ? "translate-x-5" : "translate-x-0.5"}`} />
                          </div>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MenuListItem({ href, icon, label, onClick }: { href: string, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <Link 
      href={href} 
      onClick={onClick} 
      className="flex items-center justify-between p-4 bg-white dark:bg-card/50 border border-slate-100 dark:border-border rounded-xl hover:bg-slate-50 dark:hover:bg-muted transition-all group"
    >
      <div className="flex items-center space-x-3">
        {icon}
        <span className="text-xs font-bold text-slate-700 dark:text-muted-foreground uppercase tracking-wide leading-none">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-muted-tertiary group-hover:translate-x-1 transition-transform" />
    </Link>
  );
}
