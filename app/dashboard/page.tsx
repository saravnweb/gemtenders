import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { User, Mail, Shield, Zap, Bookmark, ChevronRight, Bell, CreditCard } from 'lucide-react';
import Link from 'next/link';
import MyLocations from './MyLocations';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?callback=/dashboard');
  }

  // Fetch some stats for the overview
  const { data: savedSearches } = await supabase.from("saved_searches").select("id").eq("user_id", user!.id);
  const { data: savedTenders } = await supabase.from("saved_tenders").select("id").eq("user_id", user!.id);
  // Fetch profile to get membership plan
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const membershipPlan = profile?.membership_plan || 'free';
  const isPremium = membershipPlan !== 'free';
  return (
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-fresh-sky-950 tracking-tight">Account Overview</h1>
            <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium">Manage your search monitors and saved opportunities.</p>
          </div>
          <div className="flex items-center space-x-2 bg-white dark:bg-card px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border shadow-sm">
             <div className={`w-2 h-2 rounded-full ${isPremium ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
             <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground">Plan:</span>
             <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground uppercase">{membershipPlan}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Identity Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-card rounded-xl p-6 border border-slate-200 dark:border-border shadow-sm">
               <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-16 h-16 bg-linear-to-br from-atomic-tangerine-600 to-atomic-tangerine-700 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                     <User className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                     <h2 className="text-xl font-bold text-fresh-sky-950 truncate mb-1">{user?.email?.split('@')[0]}</h2>
                     <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 text-slate-600 dark:text-muted-foreground font-medium text-xs">
                        <div className="flex items-center gap-1">
                           <Mail className="w-3.5 h-3.5" />
                           <span>{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-green-400">
                           <Shield className="w-3.5 h-3.5" />
                           <span>Verified</span>
                        </div>
                     </div>
                  </div>
                  <button className="w-full sm:w-auto px-5 py-2 bg-slate-50 dark:bg-background text-slate-700 dark:text-muted-foreground font-bold text-xs uppercase tracking-widest rounded-lg border border-slate-200 dark:border-border hover:bg-slate-100 dark:hover:bg-muted transition-all">
                     Edit Profile
                  </button>
               </div>
            </div>

          {/* Account Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <MetricCard
                icon={<Bookmark className="w-5 h-5 text-fresh-sky-600 dark:text-fresh-sky-400" />}
                label="Saved Bids"
                value={savedTenders?.length || 0}
                href="/dashboard/saved"
                color="blue"
             />
             <MetricCard
                icon={<Zap className="w-5 h-5 text-atomic-tangerine-600" />}
                label="Active Keywords"
                value={savedSearches?.length || 0}
                href="/dashboard/keywords"
                color="orange"
             />
          </div>
        </div>

        {/* Sidebar Mini-info */}
          <div className="lg:col-span-1 space-y-6">
             <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                     <CreditCard className="w-4 h-4 text-atomic-tangerine-400" />
                     <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-muted-foreground">Subscription</span>
                  </div>
                  <h3 className="text-lg font-bold mb-4 capitalize">{membershipPlan} Plan</h3>
                  <p className="text-slate-600 dark:text-muted-foreground text-xs font-medium mb-6 leading-relaxed">
                     Tracking {savedSearches?.length || 0} smart monitors. Get Platinum for instant WhatsApp alerts.
                  </p>
                  <Link href="/dashboard/subscriptions" className="flex items-center justify-between bg-white dark:bg-card text-slate-900 dark:text-foreground px-4 py-3 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-muted group">
                     <span className="text-xs font-bold uppercase tracking-wider">Upgrade Account</span>
                     <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
             </div>

              <div className="bg-white dark:bg-card rounded-xl p-6 border border-slate-200 dark:border-border shadow-sm">
                 <h4 className="text-xs font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-wider mb-4">Safety Info</h4>
                 <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-slate-500 dark:text-muted-foreground">Last Active</span>
                       <span className="font-bold text-slate-700 dark:text-muted-foreground">Just Now</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-slate-500 dark:text-muted-foreground">Security</span>
                       <span className="text-emerald-600 dark:text-green-400 font-bold">Encrypted</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Full Width Bottom Section */}
           <div className="lg:col-span-3">
              <MyLocations user={user} />
           </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, href, color }: { icon: any, label: string, value: number, href: string, color: 'blue' | 'orange' }) {
    return (
        <Link href={href} className="bg-white dark:bg-card rounded-xl p-6 border border-slate-200 dark:border-border shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-border hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
               <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color === 'blue' ? 'bg-fresh-sky-50 dark:bg-fresh-sky-900/20' : 'bg-atomic-tangerine-50 dark:bg-atomic-tangerine-900/20'}`}>
                  {icon}
               </div>
               <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{value}</p>
               </div>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-background rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-all border border-slate-100 dark:border-border">
               <ChevronRight className="w-4 h-4" />
            </div>
        </Link>
    );
}
