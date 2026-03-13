"use client";

import Link from "next/link";
import { Zap, User, LogOut, Menu, X, LayoutDashboard } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <header className="border-b border-fresh-sky-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-9 h-9 bg-linear-to-br from-atomic-tangerine-500 to-atomic-tangerine-600 rounded-xl flex items-center justify-center shadow-lg shadow-atomic-tangerine-200 group-hover:scale-105 transition-all">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <span className="text-xl font-bold text-fresh-sky-950 tracking-tight">
              GeM<span className="text-atomic-tangerine-500">Watch</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/tenders" className="text-sm font-medium text-fresh-sky-700 hover:text-atomic-tangerine-500 transition-colors">
              Find Tenders
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-fresh-sky-700 hover:text-atomic-tangerine-500 transition-colors">
              Pricing
            </Link>
            
            <div className="h-6 w-px bg-fresh-sky-100"></div>

            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-6">
                    <Link href="/dashboard" className="flex items-center space-x-2 text-sm font-medium text-fresh-sky-700 hover:text-atomic-tangerine-500 transition-colors">
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                    <div className="flex items-center space-x-3 bg-fresh-sky-50 px-3 py-1.5 rounded-full border border-fresh-sky-100">
                      <div className="w-6 h-6 bg-atomic-tangerine-100 rounded-full flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-atomic-tangerine-600" />
                      </div>
                      <span className="text-xs font-semibold text-fresh-sky-900 truncate max-w-[100px]">{user.email?.split('@')[0]}</span>
                      <button 
                        onClick={handleSignOut}
                        className="p-1 text-fresh-sky-400 hover:text-red-500 transition-colors"
                        title="Sign Out"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Link href="/login" className="text-sm font-semibold text-fresh-sky-700 hover:text-atomic-tangerine-500 transition-colors">
                      Log in
                    </Link>
                    <Link 
                      href="/signup" 
                      className="bg-atomic-tangerine-500 hover:bg-atomic-tangerine-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-atomic-tangerine-100 transition-all active:scale-95"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-fresh-sky-700 p-2"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-fresh-sky-50 px-4 py-6 space-y-4 animate-in slide-in-from-top duration-300">
          <Link href="/tenders" onClick={() => setIsMenuOpen(false)} className="block text-base font-medium text-fresh-sky-700 px-2">Find Tenders</Link>
          <Link href="/pricing" onClick={() => setIsMenuOpen(false)} className="block text-base font-medium text-fresh-sky-700 px-2">Pricing</Link>
          <div className="pt-4 border-t border-fresh-sky-50">
            {user ? (
              <div className="space-y-4 px-2">
                <div className="flex items-center space-x-3 text-fresh-sky-900 font-bold">
                   <div className="w-8 h-8 bg-atomic-tangerine-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-atomic-tangerine-600" />
                   </div>
                   <span>{user.email}</span>
                </div>
                <Link href="/dashboard" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 text-base font-medium text-fresh-sky-700">
                    <LayoutDashboard className="w-5 h-5" />
                    <span>Dashboard</span>
                </Link>
                <button onClick={handleSignOut} className="flex items-center space-x-2 text-red-500 font-medium">
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-3">
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-center py-3 text-fresh-sky-700 font-medium bg-fresh-sky-50 rounded-xl">Log in</Link>
                <Link href="/signup" onClick={() => setIsMenuOpen(false)} className="text-center py-3 text-white font-medium bg-atomic-tangerine-500 rounded-xl shadow-lg shadow-atomic-tangerine-100">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
