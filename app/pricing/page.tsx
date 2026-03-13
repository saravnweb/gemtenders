"use client";

import { Check, Star, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-fresh-sky-50 font-sans py-20 px-4 sm:px-6 lg:px-8">
      {/* Header section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-4xl md:text-5xl font-black text-fresh-sky-950 tracking-tight mb-6">
          Simple pricing for <span className="text-atomic-tangerine-500">smart decisions</span>
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
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-16 h-8 bg-fresh-sky-200 rounded-full flex items-center p-1 cursor-pointer transition-colors relative focus:outline-none"
            title="Toggle billing cycle"
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${isAnnual ? 'translate-x-8 bg-atomic-tangerine-500' : 'translate-x-0'}`}>
               {isAnnual && <Star className="w-3.5 h-3.5 text-white" />}
            </div>
          </button>
          <span className={`text-sm font-bold flex items-center ${isAnnual ? 'text-fresh-sky-900' : 'text-fresh-sky-400'}`}>
            Annually <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-wider">Save 20%</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-20">
        
        {/* Free Tier */}
        <div className="bg-white rounded-[2rem] p-8 border border-fresh-sky-100 shadow-sm shadow-fresh-sky-200/20 hover:shadow-xl hover:shadow-fresh-sky-200/40 transition-shadow">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-fresh-sky-900 mb-2">Basic</h3>
            <p className="text-sm text-fresh-sky-500 font-medium h-10">Manual tracking for casual users.</p>
          </div>
          <div className="mb-8 flex items-baseline outline-none focus:outline-none">
            <span className="text-5xl font-black text-fresh-sky-950">₹0</span>
            <span className="text-sm text-fresh-sky-400 ml-2 font-bold uppercase tracking-wider">/forever</span>
          </div>
          <Link 
            href="/signup"
            className="w-full block text-center py-4 bg-fresh-sky-50 hover:bg-fresh-sky-100 text-fresh-sky-900 font-bold rounded-2xl transition-colors mb-8 focus:outline-none"
          >
            Get Started
          </Link>
          <ul className="space-y-4">
            <FeatureItem text="Search active tenders" />
            <FeatureItem text="View basic tender details" />
            <FeatureItem text="1 saved tender limit" />
            <FeatureItem disabled text="No daily email summaries" />
            <FeatureItem disabled text="No AI extraction summaries" />
          </ul>
        </div>

        {/* Pro Tier (Popular) */}
        <div className="bg-white rounded-[2rem] p-8 border-2 border-atomic-tangerine-500 shadow-2xl shadow-atomic-tangerine-200/50 relative transform md:-translate-y-4">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-atomic-tangerine-500 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center space-x-1 drop-shadow-md">
             <Zap className="w-3.5 h-3.5 fill-current" />
             <span>Most Popular</span>
          </div>
          
          <div className="mb-8 mt-2">
            <h3 className="text-xl font-bold text-atomic-tangerine-600 mb-2">Pro</h3>
            <p className="text-sm text-fresh-sky-500 font-medium h-10">Automated alerts and AI insights for serious bidders.</p>
          </div>
          <div className="mb-8 flex items-baseline">
            <span className="text-5xl font-black text-fresh-sky-950 outline-none focus:outline-none">{isAnnual ? '₹499' : '₹599'}</span>
            <span className="text-sm text-fresh-sky-400 ml-2 font-bold uppercase tracking-wider">/month</span>
          </div>
          <Link 
            href="/signup"
            className="w-full flex items-center justify-center py-4 bg-linear-to-r from-atomic-tangerine-500 to-atomic-tangerine-600 hover:from-atomic-tangerine-600 hover:to-atomic-tangerine-700 text-white font-bold rounded-2xl shadow-xl shadow-atomic-tangerine-200 transition-all active:scale-95 mb-8 focus:outline-none"
          >
            Start Free Trial
          </Link>
          <ul className="space-y-4">
            <FeatureItem text="Unlimited saved tenders" />
            <FeatureItem text="Daily email digest matching your keywords" />
            <FeatureItem text="Gemini AI technical summaries" />
            <FeatureItem text="Direct PDF downloads" />
            <FeatureItem text="Priority email support" />
          </ul>
        </div>

        {/* Enterprise Tier */}
        <div className="bg-fresh-sky-950 rounded-[2rem] p-8 border border-fresh-sky-800 shadow-sm text-fresh-sky-50">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-white mb-2">Enterprise</h3>
            <p className="text-sm text-fresh-sky-400 font-medium h-10">Custom workflows and team collaboration.</p>
          </div>
          <div className="mb-8 flex items-baseline">
            <span className="text-5xl font-black text-white outline-none focus:outline-none">Custom</span>
          </div>
          <button 
            type="button"
            className="w-full py-4 bg-fresh-sky-800 hover:bg-fresh-sky-700 text-white font-bold rounded-2xl transition-colors mb-8 focus:outline-none"
          >
            Contact Sales
          </button>
          <ul className="space-y-4">
            <FeatureItem text="Everything in Pro" dark />
            <FeatureItem text="Instant WhatsApp/SMS alerts" dark />
            <FeatureItem text="Multi-user team dashboard" dark />
            <FeatureItem text="API Access to raw data" dark />
            <FeatureItem text="Dedicated account manager" dark />
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
        <Check className="w-3 h-3 stroke-[3]" />
      </div>
      <span className={`text-sm font-medium ${disabled ? (dark ? 'text-fresh-sky-500 outline-none focus:outline-none' : 'text-fresh-sky-400 outline-none focus:outline-none') : (dark ? 'text-fresh-sky-200 outline-none focus:outline-none' : 'text-fresh-sky-700 outline-none focus:outline-none')}`}>
        {text}
      </span>
    </li>
  );
}
