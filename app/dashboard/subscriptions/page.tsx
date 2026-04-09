"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createRazorpaySubscription, cancelRazorpaySubscription } from "@/app/actions/razorpay";
import { Zap, Shield, Check, RefreshCw } from "lucide-react";
import Script from "next/script";

function SubscriptionsContent() {

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const searchParams = useSearchParams();
  const autoCheckoutDone = useRef(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        // Use client-side Supabase directly — always has a valid session (localStorage-based)
        // This avoids server-side cookie auth issues that cause /api/profile to return 401
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setProfile({ membership_plan: 'free' });
          return;
        }

        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileData) {
          setProfile({ ...profileData, email: user.email });
        } else if (error) {
          console.error("[subscriptions] profile fetch error:", error.message);
          setProfile({ id: user.id, membership_plan: 'free', email: user.email });
        } else {
          // No profile row yet
          setProfile({ id: user.id, membership_plan: 'free', email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User' });
        }
      } catch {
        setProfile({ membership_plan: 'free' });
      }
    }
    loadProfile();
  }, []);

  // Auto-trigger checkout when user arrives from pricing page with ?autoplan=
  useEffect(() => {
    const autoplan = searchParams.get('autoplan') as "starter" | "pro" | null;
    if (!autoplan || autoCheckoutDone.current) return;
    if (!profile || profile.membership_plan !== 'free') return;
    autoCheckoutDone.current = true;
    handleCheckout(autoplan);
  }, [profile, searchParams]);

  const handleCheckout = async (plan: "starter" | "pro") => {
    if (!profile?.id) {
       window.location.href = "/login?callback=/dashboard/subscriptions";
       return;
    }
    setLoading(true);
    try {
      const subscription = await createRazorpaySubscription(plan);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_dummy_key",
        subscription_id: subscription.id,
        name: "GeMTenders.org",
        description: `${plan === 'starter' ? 'Starter – ₹99/mo' : 'Pro – ₹299/mo'} · Auto-renews monthly`,
        handler: async function (response: any) {
          try {
            const res = await fetch("/api/billing/verify", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                   razorpay_subscription_id: response.razorpay_subscription_id || subscription.id,
                   razorpay_payment_id: response.razorpay_payment_id || "",
                   razorpay_signature: response.razorpay_signature || "",
                   plan,
               })
            });
            const result = await res.json();
            
            if (!res.ok) {
               throw new Error(result.error || "Payment verification failed on server.");
            }

            const { data: { user: refreshedUser } } = await supabase.auth.getUser();
            const { data: refreshedProfile } = await supabase
              .from("profiles").select("*").eq("id", refreshedUser!.id).maybeSingle();
            if (refreshedProfile) setProfile({ ...refreshedProfile, email: refreshedUser!.email });
            alert(`You're now on the ${plan} plan! 🎉`);
          } catch (err: any) {
            console.error("Verification error:", err);
            alert(`Payment succeeded but verification failed: ${err.message}`);
          }
        },
        prefill: {
          name: profile?.full_name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone_number || undefined,
        },
        theme: { color: "#F97316" },
      };

      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => { setRazorpayReady(true); resolve(); };
          script.onerror = () => reject(new Error("Razorpay SDK failed to load."));
          document.body.appendChild(script);
        });
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (e: any) {
      console.error(e);
      alert(`Checkout failed: ${e.message || 'Unknown error.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel your subscription? You'll keep access until the end of this billing month.")) return;
    setLoading(true);
    try {
      await cancelRazorpaySubscription();
      alert("Subscription cancelled. Access continues until month end.");
      const { data: { user: cancelUser } } = await supabase.auth.getUser();
      if (cancelUser) {
        const { data: cancelProfile } = await supabase
          .from("profiles").select("*").eq("id", cancelUser.id).maybeSingle();
        if (cancelProfile) setProfile({ ...cancelProfile, email: cancelUser.email });
      }
    } catch (e: any) {
      alert(e.message || "Failed to cancel subscription");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
       <div className="w-10 h-10 border-4 border-slate-200 dark:border-border border-t-atomic-tangerine-600 rounded-full animate-spin"></div>
       <p className="text-sm font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest animate-pulse">Loading...</p>
    </div>
  );

  const isSubscribed = profile.membership_plan !== 'free';
  const isCancelled = profile.subscription_status === 'cancelled';

  return (
    <div className="space-y-8">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => console.warn("Razorpay script failed to load — will retry on checkout.")}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-fresh-sky-950 dark:text-foreground tracking-tight">Manage Subscription</h1>
        <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium mt-1">
          All plans auto-renew monthly. Cancel anytime.
        </p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-white dark:bg-card rounded-xl p-5 border border-slate-200 dark:border-border shadow-sm flex items-center justify-between flex-wrap gap-4">
         <div>
            <p className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider mb-1">Current Plan</p>
            <div className="flex items-center gap-3">
               <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground capitalize flex items-center gap-2">
                  {profile.membership_plan}
                  {isSubscribed && <Shield className="w-5 h-5 text-emerald-500" />}
               </h2>
               {isCancelled && (
                 <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">Cancelled</span>
               )}
               {isSubscribed && !isCancelled && (
                 <span className="text-[10px] bg-emerald-100 text-emerald-600 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight flex items-center gap-1">
                   <RefreshCw className="w-2.5 h-2.5" /> Auto-renews monthly
                 </span>
               )}
            </div>
            {profile.next_billing_date && (
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {isCancelled ? 'Access until: ' : 'Next charge: '}
                <span className="font-bold">{new Date(profile.next_billing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </p>
            )}
         </div>
         {profile.subscription_id && !isCancelled && (
           <button
             onClick={handleCancel}
             disabled={loading}
             className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider disabled:opacity-40"
           >
             Cancel Subscription
           </button>
         )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Free Plan */}
        <div className={`bg-white dark:bg-card rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'free' ? 'border-blue-500 shadow-md ring-4 ring-blue-100 dark:ring-blue-900/30' : 'border-slate-200 dark:border-border'}`}>
           <h3 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2 flex items-center justify-between">
              Basic
              {profile.membership_plan === 'free' && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-link px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-muted-foreground h-10">Search, browse and bookmark all active tenders.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-foreground">₹0</span>
             <span className="text-sm text-slate-500 dark:text-muted-foreground font-bold"> / forever</span>
           </div>

           <button disabled className="w-full py-3 bg-slate-100 dark:bg-muted text-slate-500 dark:text-muted-foreground font-bold rounded-xl mb-6">
             {profile.membership_plan === 'free' ? 'Current Plan' : 'Free Tier'}
           </button>

           <ul className="space-y-3">
             <FeatureItem text="Search & browse all active tenders" />
             <FeatureItem text="Bookmark unlimited tenders" />
             <FeatureItem text="Track up to 5 keywords" />
             <FeatureItem text="AI smart-summaries of tenders" />
             <FeatureMissing text="No email or mobile alerts" />
           </ul>
        </div>

        {/* Starter Plan */}
        <div className={`bg-white dark:bg-card rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'starter' ? 'border-atomic-tangerine-600 shadow-md ring-4 ring-atomic-tangerine-100 dark:ring-orange-900/30' : 'border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-muted-foreground/40'}`}>
           <h3 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2 flex items-center justify-between">
              Starter
              {profile.membership_plan === 'starter' && <span className="text-xs bg-atomic-tangerine-100 text-atomic-tangerine-700 px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-muted-foreground h-10">Email alerts and unlimited keyword tracking.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-foreground">₹99</span>
             <span className="text-sm text-slate-500 dark:text-muted-foreground font-bold"> / month</span>
           </div>

           <div className="mb-6">
             <button
               onClick={() => handleCheckout('starter')}
               disabled={loading || profile.membership_plan === 'starter' || profile.membership_plan === 'pro'}
               className="w-full py-3 bg-slate-900 dark:bg-foreground hover:bg-slate-800 dark:hover:bg-foreground/90 disabled:opacity-50 text-white dark:text-background font-bold rounded-xl transition-colors"
             >
               {profile.membership_plan === 'starter' ? 'Current Plan' : profile.membership_plan === 'pro' ? 'Downgrade' : 'Start 7-Day Free Trial'}
             </button>
             {profile.membership_plan === 'free' && (
               <p className="text-center text-xs text-slate-500 font-medium mt-2">Free for 7 days · then ₹99/mo · Cancel anytime</p>
             )}
           </div>

           <ul className="space-y-3">
             <FeatureItem text="Everything in Basic" />
             <FeatureItem text="Track unlimited keywords" />
             <FeatureItem text="Daily email digest on your keywords" />
             <FeatureItem text="Alerts on phone & browser" />
             <FeatureItem text="Unlimited PDF downloads" />
             <FeatureItem text="Standard email support" />
           </ul>
        </div>

        {/* Pro Plan */}
        <div className={`bg-white dark:bg-card rounded-2xl p-6 border-2 transition-all ${profile.membership_plan === 'pro' ? 'border-amber-500 shadow-md ring-4 ring-amber-100 dark:ring-amber-900/30' : 'border-slate-200 dark:border-border hover:border-slate-300 dark:hover:border-muted-foreground/40'}`}>
           <div className="flex items-center space-x-2 text-amber-500 mb-2">
              <Zap className="w-4 h-4 fill-current" />
              <span className="text-xs font-bold uppercase tracking-wider">Most Popular</span>
           </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-foreground mb-2 flex items-center justify-between">
              Pro
              {profile.membership_plan === 'pro' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
           </h3>
           <p className="text-sm text-slate-500 dark:text-muted-foreground h-10">Everything in Starter, plus WhatsApp and AI analysis.</p>
           <div className="my-6">
             <span className="text-4xl font-black text-slate-900 dark:text-foreground">₹299</span>
             <span className="text-sm text-slate-500 dark:text-muted-foreground font-bold"> / month</span>
           </div>

           <div className="mb-6">
             <button
               onClick={() => handleCheckout('pro')}
               disabled={loading || profile.membership_plan === 'pro'}
               className="w-full py-3 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
             >
               {profile.membership_plan === 'pro' ? 'Current Plan' : 'Subscribe – ₹299/mo'}
             </button>
             <p className="text-center text-xs text-amber-600/70 font-medium mt-2">Cancel anytime</p>
           </div>

           <ul className="space-y-3">
             <FeatureItem text="Everything in Starter" />
             <FeatureItem text="Deep AI analysis — bid worthiness, checklist & tips" />
             <FeatureItem text="WhatsApp & SMS alerts (coming soon)" />
             <FeatureItem text="Team dashboard (coming soon)" />
             <FeatureItem text="Priority VIP support" />
           </ul>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 dark:border-border border-t-atomic-tangerine-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest animate-pulse">Loading...</p>
      </div>
    }>
      <SubscriptionsContent />
    </Suspense>
  )
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center space-x-3">
      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
         <Check className="w-3 h-3 text-emerald-600 dark:text-green-400 stroke-3" />
      </div>
      <span className="text-sm font-medium text-slate-600 dark:text-muted-foreground">{text}</span>
    </li>
  );
}

function FeatureMissing({ text }: { text: string }) {
  return (
    <li className="flex items-center space-x-3 opacity-40">
      <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-muted flex items-center justify-center shrink-0">
         <Check className="w-3 h-3 text-slate-400 stroke-3" />
      </div>
      <span className="text-sm font-medium text-slate-500">{text}</span>
    </li>
  );
}
