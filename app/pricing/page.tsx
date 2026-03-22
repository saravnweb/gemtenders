"use client";

import { Check, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div id="main-content" className="min-h-screen bg-fresh-sky-50 font-sans py-20 px-4 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-black text-fresh-sky-950 tracking-tight mb-6">
          Simple pricing for <span className="text-atomic-tangerine-700">smart decisions</span>
        </h1>
        <p className="text-lg text-fresh-sky-600 font-medium leading-relaxed mb-10">
          Get notified instantly when relevant GeM tenders are published. 
          Stop browsing manually, start winning faster.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center space-x-4">
          <span className={`text-sm font-bold ${!isAnnual ? 'text-fresh-sky-900' : 'text-fresh-sky-400'}`}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={isAnnual}
            aria-label="Toggle billing cycle: Annual"
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-16 h-8 bg-fresh-sky-200 rounded-full flex items-center p-1 cursor-pointer transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${isAnnual ? 'translate-x-8 bg-atomic-tangerine-600' : 'translate-x-0'}`}>
               {isAnnual && <Star className="w-3.5 h-3.5 text-white" />}
            </div>
          </button>
          <span className={`text-sm font-bold flex items-center ${isAnnual ? 'text-fresh-sky-900' : 'text-fresh-sky-400'}`}>
            Annually <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-wider">Save 20%</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
        
        {/* Free Tier */}
        <div className="bg-white rounded-4xl p-8 border border-fresh-sky-100 shadow-sm shadow-fresh-sky-200/20 hover:shadow-xl hover:shadow-fresh-sky-200/40 transition-shadow">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-fresh-sky-900 mb-2">Basic</h3>
            <p className="text-sm text-fresh-sky-700 font-medium h-10">Perfect for getting started and exploring active tenders.</p>
          </div>
          <div className="mb-8 flex items-baseline">
            <span className="text-5xl font-black text-fresh-sky-950">₹0</span>
            <span className="text-sm text-fresh-sky-600 ml-2 font-bold uppercase tracking-wider">/forever</span>
          </div>
          <Link 
            href="/signup?plan=free"
            className="w-full block text-center py-4 bg-fresh-sky-50 hover:bg-fresh-sky-100 text-fresh-sky-900 font-bold rounded-2xl transition-colors mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            Get Started
          </Link>
          <ul className="space-y-4">
            <FeatureItem text="Search & browse all active tenders" />
            <FeatureItem text="Bookmark unlimited tenders" />
            <FeatureItem text="Track up to 10 unique keywords" />
            <FeatureItem text="Quick AI smart-summaries of tenders" />
            <FeatureItem text="Download up to 5 tender PDFs daily" />
            <FeatureItem disabled text="No automated email or mobile alerts" />
          </ul>
        </div>

        {/* Starter Tier (Popular) */}
        <div className="bg-white rounded-4xl p-8 border-2 border-atomic-tangerine-500 shadow-2xl shadow-atomic-tangerine-200/50 relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-atomic-tangerine-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center space-x-1 drop-shadow-md">
             <Zap className="w-3.5 h-3.5 fill-current" />
             <span>Most Popular</span>
          </div>
          
          <div className="mb-8 mt-2">
            <h3 className="text-xl font-bold text-atomic-tangerine-600 mb-2">Starter</h3>
            <p className="text-sm text-fresh-sky-700 font-medium h-10">Automation and alerts to help your business win faster.</p>
          </div>
          <div className="mb-8 flex items-baseline">
            <span className="text-5xl font-black text-fresh-sky-950">{isAnnual ? '₹79' : '₹99'}</span>
            <span className="text-sm text-fresh-sky-600 ml-2 font-bold uppercase tracking-wider">/month</span>
          </div>
          <div className="flex flex-col mb-8">
            <Link 
              href={`/signup?plan=starter&billing=${isAnnual ? 'annual' : 'monthly'}`}
              className="w-full flex items-center justify-center py-4 bg-linear-to-r from-atomic-tangerine-600 to-atomic-tangerine-700 hover:from-atomic-tangerine-700 hover:to-atomic-tangerine-800 text-white font-bold rounded-2xl shadow-xl shadow-atomic-tangerine-200 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
            >
              Start Free Trial
            </Link>
            {isAnnual && (
              <span className="text-center text-xs text-fresh-sky-700 mt-2 font-medium">Billed ₹948 once per year</span>
            )}
          </div>
          <ul className="space-y-4">
            <FeatureItem text="Everything in the Basic plan" />
            <FeatureItem text="Track unlimited keywords" />
            <FeatureItem text="Download unlimited tender PDFs (Direct PDF downloads)" />
            <FeatureItem text="Daily email updates (digest) on your keywords" />
            <FeatureItem text="Get alerts on your phone & computer" />
            <FeatureItem text="Standard email support" />
          </ul>
        </div>

        {/* Pro Tier */}
        <div className="bg-fresh-sky-950 rounded-4xl p-8 border border-fresh-sky-800 shadow-sm text-fresh-sky-50">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
            <p className="text-sm text-fresh-sky-400 font-medium h-10">Advanced tools for businesses serious about winning tenders.</p>
          </div>
          <div className="mb-8 flex items-baseline">
            <span className="text-5xl font-black text-white">{isAnnual ? '₹239' : '₹299'}</span>
            <span className="text-sm text-fresh-sky-400 ml-2 font-bold uppercase tracking-wider">/month</span>
          </div>
          <div className="flex flex-col mb-8">
            <Link 
              href={`/signup?plan=pro&billing=${isAnnual ? 'annual' : 'monthly'}`}
              className="w-full block text-center py-4 bg-fresh-sky-800 hover:bg-fresh-sky-700 text-white font-bold rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
            >
              Get Started
            </Link>
            {isAnnual && (
              <span className="text-center text-xs text-fresh-sky-400 mt-2 font-medium">Billed ₹2,868 once per year</span>
            )}
          </div>
          <ul className="space-y-4">
            <FeatureItem text="Everything in the Starter plan" dark />
            <FeatureItem text="Instant alerts sent directly to WhatsApp / SMS" dark />
            <FeatureItem text="Deep AI breakdown (technical analysis) of tender requirements" dark />
            <FeatureItem text="Share your account with team members (Multi-user team dashboard)" dark />
            <FeatureItem text="Priority VIP customer support" dark />
          </ul>
        </div>

      </div>
    </div>
  );
}

function FeatureItem({ text, disabled = false, dark = false }: { text: string, disabled?: boolean, dark?: boolean }) {
  return (
    <li className={`flex items-start space-x-3 ${disabled ? (dark ? 'opacity-40' : 'opacity-40') : ''}`}>
      <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${disabled ? 'bg-fresh-sky-100 text-fresh-sky-300' : (dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-green-100 text-green-600')}`}>
        <Check className="w-3 h-3 stroke-3" />
      </div>
      <span className={`text-sm font-medium ${disabled ? (dark ? 'text-fresh-sky-500' : 'text-fresh-sky-400') : (dark ? 'text-fresh-sky-200' : 'text-fresh-sky-700')}`}>
        {text}
      </span>
    </li>
  );
}
