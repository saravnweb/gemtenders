"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MapPin, Loader2, Check } from "lucide-react";
import { getNearbyCities } from "@/lib/nearby-cities";

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"
].sort();

export default function MyLocations({ user }: { user: any }) {
  const [selectedStates, setSelectedStates] = useState<string[]>(user?.user_metadata?.preferred_states || []);
  const [citiesInput, setCitiesInput] = useState<string>(user?.user_metadata?.preferred_cities?.join(", ") || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleState = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const preferredCities = citiesInput.split(",").map(c => c.trim()).filter(Boolean);

    const { error } = await supabase.auth.updateUser({
      data: {
        preferred_states: selectedStates,
        preferred_cities: preferredCities
      }
    });

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
        console.error("Failed to update user profile", error);
    }
    setIsSaving(false);
  };

  return (
    <div className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-6 shadow-sm">
       <div className="flex items-center gap-2 mb-2">
         <MapPin className="w-5 h-5 text-blue-500" />
         <h2 className="text-lg font-bold text-fresh-sky-950 dark:text-foreground">Profile Location Defaults</h2>
       </div>
       <p className="text-sm text-slate-500 dark:text-muted-foreground mb-2 font-medium leading-relaxed">
         Set your primary operational areas. Used as your global default for the "For You" feed.
       </p>
       <div className="flex items-start gap-2 mb-5 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300 font-medium">
         <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
         <span>These are your <strong>profile-level defaults</strong>. Each keyword monitor has its own independent <strong>Location Filters</strong> — configure those per-monitor in the Keywords page.</span>
       </div>
       
       <div className="space-y-5">
         <div>
            <label className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-3 block">States</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-4 bg-slate-50 dark:bg-muted/50 border border-slate-200 dark:border-border rounded-xl shadow-inner max-h-52 overflow-y-auto">
              {STATES.map(state => (
                <button
                  key={state}
                  onClick={() => toggleState(state)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    selectedStates.includes(state)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-card text-slate-600 dark:text-muted-foreground border-slate-300 dark:border-border hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
         </div>
         
         <div>
           <label className="text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-widest mb-2 block">Cities (Comma-separated)</label>
           <input
             type="text"
             value={citiesInput}
             onChange={(e) => setCitiesInput(e.target.value)}
             placeholder="e.g. Mumbai, Pune, Nagpur"
             className="w-full px-4 py-3 bg-slate-50 dark:bg-muted/50 border border-slate-200 dark:border-border rounded-xl text-sm font-medium text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 outline-none shadow-inner transition-all"
           />
           {/* Nearby cities preview */}
           {citiesInput.split(",").map(c => c.trim()).filter(Boolean).some(c => getNearbyCities(c).length > 0) && (
             <div className="mt-3 space-y-2">
               {citiesInput.split(",").map(c => c.trim()).filter(Boolean).map(city => {
                 const nearby = getNearbyCities(city);
                 if (!nearby.length) return null;
                 return (
                   <div key={city} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground">
                     <span className="font-semibold text-slate-600 dark:text-muted-foreground">{city}:</span>
                     <span className="text-slate-600 dark:text-muted-foreground">also includes</span>
                     {nearby.map(n => (
                       <span key={n} className="px-2 py-0.5 bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-600 dark:text-fresh-sky-400 border border-fresh-sky-100 dark:border-fresh-sky-800 rounded-md font-medium capitalize">
                         {n}
                       </span>
                     ))}
                   </div>
                 );
               })}
             </div>
           )}
         </div>
         
         <div className="pt-2">
           <button
             onClick={handleSave}
             disabled={isSaving}
             className={`px-6 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                saveSuccess ? 'bg-atomic-tangerine-600 dark:bg-atomic-tangerine-700 text-white hover:bg-atomic-tangerine-700 dark:hover:bg-atomic-tangerine-800' : 'bg-slate-900 dark:bg-slate-800 text-white hover:bg-black dark:hover:bg-slate-900 active:scale-[0.98]'
             }`}
           >
             {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : null}
             <span>{saveSuccess ? 'Saved Successfully' : 'Save Locations'}</span>
           </button>
         </div>
       </div>
    </div>
  );
}
