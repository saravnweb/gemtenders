"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createRazorpayOrder } from "@/app/actions/razorpay";
import { Zap, Shield, Check } from "lucide-react";
import Script from "next/script";

export default function SubscriptionsPage() {

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          if (data) {
             setProfile({ ...data, email: user.email });
          } else {
             // Fallback if the user was created before the DB trigger existed
             setProfile({
                id: user.id,
                full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
                membership_plan: 'free',
                phone_number: '',
                email: user.email
             });
          }
        } else {
          // not logged in
          setProfile({ membership_plan: 'free' });
        }
      } catch (err) {
         setProfile({ membership_plan: 'free' });
      }
    }
    loadProfile();
  }, []);

  const handleCheckout = async (plan: "starter" | "pro") => {
    if (!profile?.id) {
       window.location.href = "/login?callback=/dashboard/subscriptions";
       return;
    }
    setLoading(true);
    try {
      const order = await createRazorpayOrder(plan, isAnnual);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy_key",
        amount: order.amount,
        currency: order.currency,
        name: "GeMTenders.org",
        description: `${plan.toUpperCase()} Plan Subscription`,
        order_id: order.id,
        handler: async function (response: any) {
          // Verify on client immediately to give fast feedback. It'll work locally without webhooks.
          const res = await fetch("/api/billing/verify", {
             method: "POST",
             headers: {
                "Content-Type": "application/json"
             },
             body: JSON.stringify({
                 razorpay_order_id: response.razorpay_order_id || order.id,
                 razorpay_payment_id: response.razorpay_payment_id || "dummy_payment",
                 razorpay_signature: response.razorpay_signature || "dummy",
                 plan: plan,
                 userId: profile?.id
             })
          });
          const updateData = await res.json();
          // Reload profile details
          const { data } = await supabase.from("profiles").select("*").eq("id", profile?.id).single();
          setProfile(data);
          alert(`Successfully upgraded to ${plan}!`);
        },
        prefill: {
          name: profile?.full_name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone_number || undefined,
        },
        theme: {
          color: "#F97316", // atomic-tangerine base
        },
      };

      if (!(window as any).Razorpay) {
        throw new Error("Razorpay SDK failed to load. Please check your connection.");
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      console.error(err);
      alert(`Failed to initialize checkout: ${err.message || 'Unknown error. Check console.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
       <div className="w-10 h-10 border-4 border-slate-200 dark:border-zinc-700 border-t-atomic-tangerine-600 rounded-full animate-spin"></div>
       <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">Loading secure checkout...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div>
        <h1 className="text-2xl font-bold text-fresh-sky-950 tracking-tight">Manage Subscription</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Upgrade your plan to unlock more features.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm flex items-center justify-between">
         <div>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 capitalize flex items-center gap-2">
               {profile.membership_plan}
               {profile.membership_plan !== 'free' && <Shield className="w-5 h-5 text-emerald-500" />}
            </h2>
         </div>
         <div className="text-right flex items-center space-x-3">
             <span className={`text-sm font-bold ${!isAnnual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>Monthly</span>
             <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-12 h-6 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center p-1 cursor-pointer transition-colors relative"
             >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isAnnual ? 'translate-x-6 bg-atomic-tangerine-600' : 'translate-x-0'}`}>
                </div>
             </button>
             <span className={`text-sm font-bold flex items-center ${isAnnual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                Annually
             </span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Basic Plan */}
        <div className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'free' ? 'border-blue-500 shadow-md ring-4 ring-blue-100' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
              Basic
              {profile.membership_plan === 'free' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 h-10">Perfect for getting started and exploring active tenders.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-slate-100">₹0</span>
             <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">/forever</span>
           </div>

           <div className="flex flex-col mb-6">
             <button
               disabled={true}
               className="w-full py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl"
             >
               {profile.membership_plan === 'free' ? 'Current Plan' : 'Free Tier'}
             </button>
             {isAnnual && profile.membership_plan !== 'free' && profile.membership_plan !== 'starter' && profile.membership_plan !== 'pro' && (
               <span className="text-center text-xs text-slate-600 font-medium mt-2 invisible">Placeholder</span>
             )}
           </div>

           <ul className="space-y-3">
             <FeatureItem text="Search & browse all active tenders" />
             <FeatureItem text="Bookmark unlimited tenders" />
             <FeatureItem text="Track up to 10 unique keywords" />
             <FeatureItem text="Quick AI smart-summaries of tenders" />
             <FeatureItem text="Download up to 5 tender PDFs daily" />
             <li className="flex items-center space-x-3 opacity-50">
               <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-slate-600 stroke-3" />
               </div>
               <span className="text-sm font-medium text-slate-500">No automated email or mobile alerts</span>
             </li>
           </ul>
        </div>

        {/* Starter Plan */}
        <div className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'starter' ? 'border-atomic-tangerine-600 shadow-md ring-4 ring-atomic-tangerine-100' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
              Starter
              {profile.membership_plan === 'starter' && <span className="text-xs bg-atomic-tangerine-100 text-atomic-tangerine-700 px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 h-10">Essential alerts and insights for freelancers.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-slate-100">{isAnnual ? '₹79' : '₹99'}</span>
             <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">/mo</span>
           </div>

           <div className="flex flex-col mb-6">
             <button
               onClick={() => handleCheckout('starter')}
               disabled={loading || profile.membership_plan === 'starter' || profile.membership_plan === 'pro'}
               className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
             >
               {profile.membership_plan === 'starter' ? 'Current Plan' : 'Upgrade to Starter'}
             </button>
             {isAnnual && profile.membership_plan !== 'starter' && profile.membership_plan !== 'pro' && (
               <span className="text-center text-xs text-slate-600 dark:text-slate-400 font-medium mt-2">Billed ₹948 once per year</span>
             )}
           </div>

           <ul className="space-y-3">
             <FeatureItem text="Everything in the Basic plan" />
             <FeatureItem text="Track unlimited keywords" />
             <FeatureItem text="Download unlimited tender PDFs (Direct PDF downloads)" />
             <FeatureItem text="Daily email updates (digest) on your keywords" />
             <FeatureItem text="Get alerts on your phone & computer" />
             <FeatureItem text="Standard email support" />
           </ul>
        </div>

        {/* Pro Plan */}
        <div className={`bg-white dark:bg-zinc-900 rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'pro' ? 'border-amber-500 shadow-md ring-4 ring-amber-100' : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300'}`}>
           <div className="flex items-center space-x-2 text-amber-500 mb-2">
              <Zap className="w-4 h-4 fill-current" />
              <span className="text-xs font-bold uppercase tracking-wider">Most Powerful</span>
           </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center justify-between">
              Pro
              {profile.membership_plan === 'pro' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 h-10">Advanced features for power users and teams.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-slate-100">{isAnnual ? '₹239' : '₹299'}</span>
             <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">/mo</span>
           </div>

           <div className="flex flex-col mb-6">
             <button
               onClick={() => handleCheckout('pro')}
               disabled={loading || profile.membership_plan === 'pro'}
               className="w-full py-3 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
             >
               {profile.membership_plan === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
             </button>
             {isAnnual && profile.membership_plan !== 'pro' && (
               <span className="text-center text-xs text-amber-600/60 font-medium mt-2">Billed ₹2,868 once per year</span>
             )}
           </div>

           <ul className="space-y-3">
             <FeatureItem text="Everything in the Starter plan" />
             <FeatureItem text="Instant alerts sent directly to WhatsApp / SMS" />
             <FeatureItem text="Deep AI breakdown (technical analysis) of tender requirements" />
             <FeatureItem text="Share your account with team members (Multi-user team dashboard)" />
             <FeatureItem text="Priority VIP customer support" />
           </ul>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center space-x-3">
      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
         <Check className="w-3 h-3 text-emerald-600 dark:text-green-400 stroke-3" />
      </div>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{text}</span>
    </li>
  );
}
