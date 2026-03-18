"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { MapPin, Loader2, Check } from "lucide-react";

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
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
       <div className="flex items-center gap-2 mb-2">
         <MapPin className="w-5 h-5 text-blue-500" />
         <h2 className="text-lg font-bold text-fresh-sky-950">My Territories</h2>
       </div>
       <p className="text-sm text-slate-500 mb-6 font-medium">
         Set your operational territories. Your "For You" feed automatically filters tenders to these locations unless specified otherwise in a custom alert.
       </p>
       
       <div className="space-y-5">
         <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">States</label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-inner no-scrollbar">
              {STATES.map(state => (
                <button
                  key={state}
                  onClick={() => toggleState(state)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                    selectedStates.includes(state) 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
         </div>
         
         <div>
           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Cities (Comma-separated)</label>
           <input
             type="text"
             value={citiesInput}
             onChange={(e) => setCitiesInput(e.target.value)}
             placeholder="e.g. Mumbai, Pune, Nagpur"
             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none shadow-inner transition-all"
           />
         </div>
         
         <div className="pt-2">
           <button
             onClick={handleSave}
             disabled={isSaving}
             className={`px-6 py-3 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                saveSuccess ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'
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
