"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callback") || searchParams.get("next") || "/";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`
        }
      });
      if (error) throw error;
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Auto-trigger Google sign-in on page load
  useEffect(() => {
    signInWithGoogle();
  }, []);

  return (
    <div id="main-content" className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-fresh-sky-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-4xl p-8 sm:p-10 shadow-2xl shadow-fresh-sky-200/50 border border-fresh-sky-100 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center mb-10">
          <div className="mb-8 flex justify-center">
            <Image src="/logo.png" alt="GeMTenders.org" width={400} height={128} priority className="w-64 sm:w-80 h-auto object-contain brightness-110" />
          </div>
          <h1 className="text-3xl font-black text-fresh-sky-950 tracking-tight mb-2">Welcome</h1>
          <p className="text-fresh-sky-600 font-medium">Sign in to your GeMTenders.org account</p>
        </div>

        {error && (
          <div role="alert" aria-live="assertive" className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl font-medium flex items-center animate-in slide-in-from-top-2 duration-300">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button 
            type="button"
            disabled={loading}
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center space-x-3 py-4 border-2 border-fresh-sky-100 rounded-2xl hover:bg-fresh-sky-50 hover:border-atomic-tangerine-200 transition-all font-bold text-base text-fresh-sky-700 active:scale-95 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>{loading ? "Connecting..." : "Continue with Google"}</span>
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-fresh-sky-600 leading-relaxed px-4">
          By continuing, you agree to our <Link href="/privacy" className="text-fresh-sky-700 underline hover:text-fresh-sky-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Terms of Service</Link> and <Link href="/privacy" className="text-fresh-sky-700 underline hover:text-fresh-sky-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-fresh-sky-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-fresh-sky-200 rounded-full mb-4"></div>
          <div className="w-32 h-4 bg-fresh-sky-100 rounded"></div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
