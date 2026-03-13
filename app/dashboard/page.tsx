import { createClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Zap, LayoutDashboard, Bookmark, Settings, Bell, ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Define subscription tier (mock for now, will come from db later)
  const isPremium = false;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-fresh-sky-50 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-fresh-sky-950 tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-8 h-8 text-atomic-tangerine-500" />
              My Dashboard
            </h1>
            <p className="text-fresh-sky-600 font-medium mt-1">Welcome back, {user.email?.split('@')[0]}!</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-3">
             <div className="bg-white px-4 py-2 rounded-xl border border-fresh-sky-100 shadow-sm flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-fresh-sky-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${isPremium ? 'bg-atomic-tangerine-100 text-atomic-tangerine-700' : 'bg-fresh-sky-100 text-fresh-sky-700'}`}>
                  {isPremium ? 'PRO PLAN' : 'FREE PLAN'}
                </span>
             </div>
             {!isPremium && (
                <Link href="/pricing" className="bg-atomic-tangerine-500 hover:bg-atomic-tangerine-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-atomic-tangerine-100 transition-all active:scale-95">
                  Upgrade
                </Link>
             )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            icon={<Bookmark className="w-6 h-6 text-blue-500" />}
            title="Saved Tenders"
            value="0"
            color="blue"
          />
          <StatCard 
            icon={<Bell className="w-6 h-6 text-atomic-tangerine-500" />}
            title="Active Alerts"
            value="0"
            color="atomic-tangerine"
          />
          <StatCard 
            icon={<Download className="w-6 h-6 text-emerald-500" />}
            title="PDF Downloads"
            value="0"
            color="emerald"
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Alerts & Preferences */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-fresh-sky-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-fresh-sky-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-fresh-sky-400" />
                  Preferences
                </h2>
              </div>
              
              {!isPremium ? (
                <div className="bg-fresh-sky-50 rounded-2xl p-5 text-center border border-fresh-sky-100">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Zap className="w-5 h-5 text-atomic-tangerine-500" />
                  </div>
                  <h3 className="font-bold text-fresh-sky-900 mb-1">Unlock Alerts</h3>
                  <p className="text-xs text-fresh-sky-600 leading-relaxed mb-4">Get instant WhatsApp and Email notifications when tenders match your keywords.</p>
                  <Link href="/pricing" className="block w-full py-2 bg-white border border-atomic-tangerine-200 text-atomic-tangerine-600 text-sm font-bold rounded-xl hover:bg-atomic-tangerine-50 transition-colors pointer-events-auto">
                    View Pricing
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Premium preferences form would go here */}
                  <p className="text-sm text-fresh-sky-600">Your keyword alerts are active.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Saved Tenders */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl p-6 border border-fresh-sky-100 shadow-sm lg:min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-fresh-sky-900 flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-fresh-sky-400" />
                  Saved Tenders
                </h2>
                <Link href="/tenders" className="text-sm font-bold text-atomic-tangerine-500 hover:text-atomic-tangerine-600 flex items-center">
                  Browse <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>

              <div className="flex flex-col items-center justify-center h-[250px] text-center border-2 border-dashed border-fresh-sky-100 rounded-2xl bg-fresh-sky-50/50 p-6">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <Bookmark className="w-6 h-6 text-fresh-sky-300" />
                </div>
                <h3 className="text-base font-bold text-fresh-sky-900 mb-1">No saved tenders yet</h3>
                <p className="text-sm text-fresh-sky-500 max-w-sm mb-6">When you find a tender you're interested in, save it to track its status here.</p>
                <Link href="/tenders" className="px-5 py-2.5 bg-fresh-sky-900 text-white text-sm font-bold rounded-xl hover:bg-fresh-sky-800 transition-colors shadow-md">
                  Explore Tenders
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: string, color: string }) {
  const bgColors: Record<string, string> = {
    'blue': 'bg-blue-50',
    'atomic-tangerine': 'bg-atomic-tangerine-50',
    'emerald': 'bg-emerald-50'
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-fresh-sky-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs font-bold text-fresh-sky-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-fresh-sky-950">{value}</p>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${bgColors[color]} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
    </div>
  );
}
