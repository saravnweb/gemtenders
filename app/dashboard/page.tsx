import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bell, Bookmark, CreditCard, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?callback=/dashboard');
  }

  const { data: savedSearches } = await supabase.from("saved_searches").select("id").eq("user_id", user!.id);
  const { data: savedTenders } = await supabase.from("saved_tenders").select("id").eq("user_id", user!.id);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const membershipPlan = profile?.membership_plan || 'free';
  const isPremium = membershipPlan !== 'free';

  return (
    <div className="space-y-8">
      {/* Upgrade banner for free users */}
      {membershipPlan === 'free' && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300 text-sm">Unlock all features with Starter</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">PDF downloads, keyword alerts, save tenders, and more — from ₹99/month.</p>
          </div>
          <Link href="/dashboard/subscriptions" className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition-colors text-center">
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fresh-sky-950 dark:text-foreground tracking-tight">My Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium">Track government tenders that matter to your business.</p>
        </div>
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border shadow-sm ${isPremium ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600'}`}>
          <div className={`w-2 h-2 rounded-full ${isPremium ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`}></div>
          <span className={`text-xs font-bold uppercase tracking-wider ${isPremium ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>Plan:</span>
          <span className={`text-xs font-black uppercase tracking-widest ${isPremium ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{membershipPlan}</span>
        </div>
      </div>

      {/* 3 action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <ActionCard
          icon={<Bell className="w-6 h-6 text-atomic-tangerine-600" />}
          iconBg="bg-atomic-tangerine-50 dark:bg-atomic-tangerine-900/20"
          title="Set Up My Alerts"
          description="Tell us what products or services you sell. We'll email you every morning when matching tenders are published."
          badge={`${savedSearches?.length || 0} active`}
          cta="Manage Alerts"
          href="/dashboard/keywords"
        />
        <ActionCard
          icon={<Bookmark className="w-6 h-6 text-fresh-sky-600 dark:text-fresh-sky-400" />}
          iconBg="bg-fresh-sky-50 dark:bg-fresh-sky-900/20"
          title="Saved Tenders"
          description="Tenders you've bookmarked to review, download, or bid on."
          badge={`${savedTenders?.length || 0} saved`}
          cta="View Saved"
          href="/dashboard/saved"
        />
        <ActionCard
          icon={<CreditCard className="w-6 h-6 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="My Subscription Plan"
          description={isPremium
            ? `You are on the ${membershipPlan} plan. Manage or cancel anytime.`
            : "You're on the free plan. Upgrade to get daily email alerts on tenders matching your business."}
          badge={membershipPlan}
          cta={isPremium ? "Manage Plan" : "Upgrade Now"}
          href="/dashboard/subscriptions"
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon, iconBg, title, description, badge, cta, href
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badge: string;
  cta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col bg-white dark:bg-card rounded-xl p-6 border border-slate-200 dark:border-border shadow-sm hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
        {icon}
      </div>
      <h2 className="text-sm font-bold text-slate-900 dark:text-foreground mb-2">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed flex-1 mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 dark:text-muted-foreground uppercase tracking-wider">{badge}</span>
        <span className="flex items-center gap-1 text-xs font-bold text-fresh-sky-700 dark:text-fresh-sky-400 group-hover:gap-2 transition-all">
          {cta} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
