"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, Lock, ArrowRight, UserPlus, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        setSuccess(true);
        setLoading(false);
      }
    } catch (err: any) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-fresh-sky-50 font-sans">
        <div className="max-w-md w-full bg-white rounded-4xl p-10 text-center shadow-2xl shadow-fresh-sky-200/50 border border-fresh-sky-100 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-3xl font-black text-fresh-sky-950 mb-4 tracking-tight">Check your email</h2>
          <p className="text-fresh-sky-600 font-medium leading-relaxed mb-8">
            We've sent a verification link to <span className="text-fresh-sky-900 font-bold">{email}</span>. 
            Please confirm your email to activate your account.
          </p>
          <Link 
            href="/login"
            className="inline-flex items-center justify-center w-full bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-atomic-tangerine-200 hover:from-atomic-tangerine-600 hover:to-atomic-tangerine-700 transition-all active:scale-95"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-fresh-sky-50 font-sans">
      <div className="max-w-md w-full bg-white rounded-4xl p-8 sm:p-10 shadow-2xl shadow-fresh-sky-200/50 border border-fresh-sky-100 animate-in fade-in zoom-in duration-500">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-linear-to-br from-atomic-tangerine-500 to-atomic-tangerine-600 rounded-3xl flex items-center justify-center shadow-xl shadow-atomic-tangerine-200 mx-auto mb-6">
            <UserPlus className="w-10 h-10 text-white fill-current" />
          </div>
          <h1 className="text-3xl font-black text-fresh-sky-950 tracking-tight mb-2">Create Account</h1>
          <p className="text-fresh-sky-600 font-medium">Join GeM Watch and never miss a bid</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl font-medium flex items-center animate-in slide-in-from-top-2 duration-300">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-6">
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
            <label className="text-xs font-bold text-fresh-sky-900 uppercase tracking-widest ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fresh-sky-300 group-focus-within:text-atomic-tangerine-500 transition-colors" />
              <input
                type="password"
                placeholder="Min 6 characters"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-fresh-sky-50/50 border border-fresh-sky-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-atomic-tangerine-100 focus:border-atomic-tangerine-300 outline-none transition-all placeholder:text-fresh-sky-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-fresh-sky-900 uppercase tracking-widest ml-1">Confirm Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fresh-sky-300 group-focus-within:text-atomic-tangerine-500 transition-colors" />
              <input
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-fresh-sky-50/50 border border-fresh-sky-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-atomic-tangerine-100 focus:border-atomic-tangerine-300 outline-none transition-all placeholder:text-fresh-sky-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-600 hover:from-atomic-tangerine-600 hover:to-atomic-tangerine-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-atomic-tangerine-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            <span className="text-base">{loading ? "Creating Account..." : "Sign Up"}</span>
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <p className="mt-10 text-center text-sm text-fresh-sky-600 font-medium">
          Already have an account?{" "}
          <Link href="/login" className="text-atomic-tangerine-600 font-bold hover:text-atomic-tangerine-700 hover:underline decoration-2 underline-offset-4">Log in here</Link>
        </p>

        <p className="mt-8 text-center text-[10px] text-fresh-sky-300 leading-relaxed px-4">
          By signing up, you agree to our <span className="text-fresh-sky-400 underline">Terms of Service</span> and <span className="text-fresh-sky-400 underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
