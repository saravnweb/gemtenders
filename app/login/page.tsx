"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, Lock, ArrowRight, Github, Chrome } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push("/tenders");
        router.refresh();
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
     await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`
        }
     });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-fresh-sky-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-4xl p-8 sm:p-10 shadow-2xl shadow-fresh-sky-200/50 border border-fresh-sky-100 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-linear-to-br from-atomic-tangerine-500 to-atomic-tangerine-600 rounded-3xl flex items-center justify-center shadow-xl shadow-atomic-tangerine-200 mx-auto mb-6">
            <Zap className="w-10 h-10 text-white fill-current" />
          </div>
          <h1 className="text-3xl font-black text-fresh-sky-950 tracking-tight mb-2">Welcome Back</h1>
          <p className="text-fresh-sky-600 font-medium">Log in to your GeM Watch account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl font-medium flex items-center animate-in slide-in-from-top-2 duration-300">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-fresh-sky-900 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fresh-sky-300 group-focus-within:text-atomic-tangerine-500 transition-colors" />
              <input
                type="email"
                placeholder="name@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-fresh-sky-50/50 border border-fresh-sky-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-atomic-tangerine-100 focus:border-atomic-tangerine-300 outline-none transition-all placeholder:text-fresh-sky-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold text-fresh-sky-900 uppercase tracking-widest">Password</label>
              <Link href="/forgot-password" className="text-xs font-bold text-atomic-tangerine-600 hover:text-atomic-tangerine-700">Forgot?</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fresh-sky-300 group-focus-within:text-atomic-tangerine-500 transition-colors" />
              <input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-fresh-sky-50/50 border border-fresh-sky-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-atomic-tangerine-100 focus:border-atomic-tangerine-300 outline-none transition-all placeholder:text-fresh-sky-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-600 hover:from-atomic-tangerine-600 hover:to-atomic-tangerine-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-atomic-tangerine-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            <span className="text-base">{loading ? "Authenticating..." : "Sign In"}</span>
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-fresh-sky-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest bg-white px-4 text-fresh-sky-300">
            Or continue with
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            type="button"
            onClick={signInWithGoogle}
            className="flex items-center justify-center space-x-2 py-3.5 border border-fresh-sky-100 rounded-2xl hover:bg-fresh-sky-50 transition-colors font-bold text-sm text-fresh-sky-700 active:scale-95"
          >
            <Chrome className="w-4 h-4 text-atomic-tangerine-500" />
            <span>Google</span>
          </button>
          <button 
            type="button"
            className="flex items-center justify-center space-x-2 py-3.5 border border-fresh-sky-100 rounded-2xl hover:bg-fresh-sky-50 transition-colors font-bold text-sm text-fresh-sky-700 active:scale-95"
          >
            <Github className="w-4 h-4 text-fresh-sky-900" />
            <span>GitHub</span>
          </button>
        </div>

        <p className="mt-10 text-center text-sm text-fresh-sky-600 font-medium">
          Don't have an account?{" "}
          <Link href="/signup" className="text-atomic-tangerine-600 font-bold hover:text-atomic-tangerine-700 hover:underline decoration-2 underline-offset-4">Create one for free</Link>
        </p>
      </div>
    </div>
  );
}
