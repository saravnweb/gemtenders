"use client";

import { useState, useTransition, useEffect } from 'react';
import { MapPin, Plus, X, Loader2, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { getCitiesForStates } from './actions';
import UpgradeModal, { type UpgradeReason } from '@/components/UpgradeModal';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"
].sort();

export default function LocationCard({ search, membershipPlan }: { search: any, membershipPlan: string }) {
    const router = useRouter();
    const [states, setStates] = useState<string[]>(search.query_params.states || []);
    const [cities, setCities] = useState<string[]>(search.query_params.cities || []);
    
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [newCity, setNewCity] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [upgradeModal, setUpgradeModal] = useState<{ reason: UpgradeReason; currentCount: number; limitCount: number } | null>(null);

    useEffect(() => {
        setStates(search.query_params.states || []);
        setCities(search.query_params.cities || []);
    }, [search.query_params.states, search.query_params.cities]);

    useEffect(() => {
        if (states.length === 0) {
            setAvailableCities([]);
            return;
        }
        getCitiesForStates(states)
            .then(fullCities => setAvailableCities(fullCities))
            .catch(err => console.error("Failed to fetch cities", err));
    }, [states]);

    const updateFilters = async (newStates: string[], newCities: string[]) => {
        setIsUpdating(true);
        // Protect against read-modify-write race conditions by fetching freshest state
        const { data: latest } = await supabase.from('saved_searches').select('query_params').eq('id', search.id).single();
        const currentParams = latest?.query_params || search.query_params;

        const { error } = await supabase
            .from('saved_searches')
            .update({
                query_params: {
                    ...currentParams,
                    states: newStates,
                    cities: newCities
                }
            })
            .eq('id', search.id);

        if (!error) {
            setStates(newStates);
            setCities(newCities);
            startTransition(() => {
                router.refresh();
            });
        } else {
            console.error("Failed to update location filters", error);
        }
        setIsUpdating(false);
    };

    const handleRemoveState = (indexToRemove: number) => {
        const newStates = states.filter((_, idx) => idx !== indexToRemove);
        updateFilters(newStates, cities);
    };
    
    const handleRemoveCity = (indexToRemove: number) => {
        const newCities = cities.filter((_, idx) => idx !== indexToRemove);
        updateFilters(states, newCities);
    };

    const handleAddState = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const state = e.target.value;
        if (!state) return;

        // Plan Checks
        if ((membershipPlan === 'free' || membershipPlan === 'basic') && states.length >= 1) {
            setUpgradeModal({ reason: 'state', currentCount: states.length, limitCount: 1 });
            e.target.value = "";
            return;
        }
        if (membershipPlan === 'starter' && states.length >= 1) {
            setUpgradeModal({ reason: 'state', currentCount: states.length, limitCount: 1 });
            e.target.value = "";
            return;
        }

        if (!states.includes(state)) {
            updateFilters([...states, state], cities);
        }
        e.target.value = "";
    };

    const handleAddCity = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCity.trim()) return;
        
        const citiesToAdd = newCity.split(',').map(c => c.trim()).filter(Boolean);
        const cityCount = cities.length + citiesToAdd.length;
        
        // Plan Checks
        if ((membershipPlan === 'free' || membershipPlan === 'basic') && cityCount > 1) {
            setUpgradeModal({ reason: 'city', currentCount: cities.length, limitCount: 1 });
            return;
        }
        
        const newCities = Array.from(new Set([...cities, ...citiesToAdd]));
        updateFilters(states, newCities);
        setNewCity('');
    };

    return (
        <>
        {upgradeModal && (
            <UpgradeModal
                isOpen={true}
                onClose={() => setUpgradeModal(null)}
                reason={upgradeModal.reason}
                currentPlan={membershipPlan}
                currentCount={upgradeModal.currentCount}
                limitCount={upgradeModal.limitCount}
            />
        )}
        <div className={`bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-6 hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-md transition-all flex flex-col h-full shadow-sm ${isUpdating || isPending ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex flex-col mb-6">
                <h2 className="text-base font-bold text-slate-900 dark:text-foreground tracking-tight">Location Filters</h2>
                <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium mt-1">Narrow down by State and City.</p>
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">Select State</label>
                    <select 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner transition-all appearance-none dark:text-foreground"
                        onChange={handleAddState}
                        defaultValue=""
                        disabled={isUpdating || isPending}
                    >
                        <option value="" disabled>Choose a state to add...</option>
                        {STATES.filter(s => !states.includes(s)).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-muted-foreground">Add City</label>
                    <form onSubmit={handleAddCity} className="flex gap-2 items-center">
                        {states.length === 0 ? (
                            <div className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-muted border border-slate-200 dark:border-border rounded-xl text-sm font-medium text-slate-400 dark:text-muted-tertiary cursor-not-allowed flex items-center">
                                Select a state first...
                            </div>
                        ) : (
                            <select 
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner transition-all appearance-none dark:text-foreground"
                                disabled={isUpdating || isPending}
                            >
                                <option value="" disabled>Choose a city from selected state(s)...</option>
                                {availableCities.filter(c => !cities.includes(c)).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}
                        <button
                            type="submit"
                            disabled={!newCity || isUpdating || isPending}
                            className="shrink-0 w-10 h-10 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>

            <div className="flex-1">
                {states.length === 0 && cities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-slate-50 dark:bg-background rounded-xl border border-dashed border-slate-200 dark:border-border">
                        <Compass className="w-8 h-8 text-slate-300 dark:text-muted-tertiary mb-3" />
                        <span className="text-xs font-medium text-slate-500 dark:text-muted-foreground">All India (No Filters)</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {states.map((st: string, idx: number) => (
                            <div key={`st-${idx}`} className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 group">
                                <MapPin className="w-3.5 h-3.5 opacity-50" />
                                <span>{st}</span>
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveState(idx)}
                                    className="hover:bg-emerald-200 dark:hover:bg-emerald-800 p-0.5 rounded-full transition-colors focus:outline-none opacity-50 hover:opacity-100 ml-1" 
                                    title="Remove state"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        {cities.map((city: string, idx: number) => (
                            <div key={`ct-${idx}`} className="flex items-center gap-1.5 text-xs font-semibold bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400 group">
                                <MapPin className="w-3.5 h-3.5 opacity-50" />
                                <span>{city}</span>
                                <button 
                                    type="button" 
                                    onClick={() => handleRemoveCity(idx)}
                                    className="hover:bg-purple-200 dark:hover:bg-purple-800 p-0.5 rounded-full transition-colors focus:outline-none opacity-50 hover:opacity-100 ml-1" 
                                    title="Remove city"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </>
    );
}
