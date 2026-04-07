import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Settings } from 'lucide-react';
import AlertSetupCard from './AlertSetupCard';

export default async function KeywordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?callback=/dashboard/keywords');
  }

  // Fetch saved searches (Monitors)
  const { data: savedSearches } = await supabase
    .from("saved_searches")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('membership_plan')
    .eq('id', user.id)
    .single();
    
  const membershipPlan = profile?.membership_plan || 'free';

  // Master Configuration Logic
  let masterConfig = null;
  if (savedSearches && savedSearches.length > 0) {
      if (savedSearches.length === 1) {
          masterConfig = savedSearches[0];
      } else {
          // Merge all legacy monitors into the most recent one
          let allKeywords: string[] = [];
          let allStates: string[] = [];
          let allCities: string[] = [];
          
          savedSearches.forEach((search: any) => {
              if (search.query_params?.q) {
                  allKeywords = [...allKeywords, ...search.query_params.q.split(',').map((s: string) => s.trim()).filter(Boolean)];
              }
              if (search.query_params?.states) {
                  allStates = [...allStates, ...search.query_params.states];
              }
              if (search.query_params?.cities) {
                  allCities = [...allCities, ...search.query_params.cities];
              }
          });
          
          // Deduplicate
          allKeywords = Array.from(new Set(allKeywords));
          allStates = Array.from(new Set(allStates));
          allCities = Array.from(new Set(allCities));
          
          masterConfig = savedSearches[0];
          const newQueryParams = { q: allKeywords.join(','), states: allStates, cities: allCities };
          
          // Update the newest one
          await supabase.from('saved_searches').update({
              name: "Unified Alert",
              query_params: newQueryParams
          }).eq('id', masterConfig.id);
          
          // Delete all older ones
          const idsToDelete = savedSearches.slice(1).map((s: any) => s.id);
          await supabase.from('saved_searches').delete().in('id', idsToDelete);
          
          masterConfig.query_params = newQueryParams;
          masterConfig.name = "Unified Alert";
      }
  } else {
      // Create a default master config for new users
      const { data: newConfig } = await supabase.from('saved_searches').insert({
          user_id: user.id,
          name: "Unified Alert",
          query_params: { q: '', states: [], cities: [] },
          is_alert_enabled: true
      }).select().single();
      masterConfig = newConfig;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="border-b border-slate-100 dark:border-border pb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-link dark:text-link" />
          Alert Preferences
        </h1>
        <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium">Configure keywords and location for automatic tracking and daily emails.</p>
      </div>

      <AlertSetupCard search={masterConfig} membershipPlan={membershipPlan} />
    </div>
  );
}
