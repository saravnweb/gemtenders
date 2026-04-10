"use client";

import { useState } from 'react';
import { Bell, ChevronRight, Trash2, X, Plus, Pencil, Check } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import UpgradeModal, { type UpgradeReason } from '@/components/UpgradeModal';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"
].sort();

export default function MonitorCard({ search, membershipPlan, totalKeywords }: { search: any, membershipPlan: string, totalKeywords: number }) {
    const router = useRouter();
    const [keywords, setKeywords] = useState<string[]>(
        search.query_params.q ? search.query_params.q.split(',').map((k: string) => k.trim()).filter(Boolean) : []
    );
    const [isAdding, setIsAdding] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    
    const [states, setStates] = useState<string[]>(search.query_params.states || []);
    const [cities, setCities] = useState<string[]>(search.query_params.cities || []);
    
    const [isAddingState, setIsAddingState] = useState(false);
    const [isAddingCity, setIsAddingCity] = useState(false);
    const [newCity, setNewCity] = useState('');

    const [name, setName] = useState(search.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(search.name);
    const [frequency, setFrequency] = useState(search.notification_frequency || 'daily');
    const [upgradeModal, setUpgradeModal] = useState<{ reason: UpgradeReason; currentCount: number; limitCount: number } | null>(null);

    const handleUpdateName = async () => {
        if (!editNameValue.trim() || editNameValue === name) {
            setIsEditingName(false);
            setEditNameValue(name);
            return;
        }

        setIsUpdating(true);
        const { error } = await supabase
            .from('saved_searches')
            .update({ name: editNameValue.trim() })
            .eq('id', search.id);

        if (!error) {
            setName(editNameValue.trim());
            router.refresh();
        } else {
            console.error("Failed to update name", error);
            setEditNameValue(name); // Revert on error
        }
        setIsEditingName(false);
        setIsUpdating(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleUpdateName();
        } else if (e.key === 'Escape') {
            setIsEditingName(false);
            setEditNameValue(name);
        }
    };

    const updateKeywords = async (newKeywordsList: string[]) => {
        setIsUpdating(true);
        const { error } = await supabase
            .from('saved_searches')
            .update({
                query_params: {
                    ...search.query_params,
                    q: newKeywordsList.join(',')
                }
            })
            .eq('id', search.id);

        if (!error) {
            setKeywords(newKeywordsList);
            router.refresh(); // Tell Next.js server components to re-fetch
        } else {
            console.error("Failed to update keywords", error);
        }
        setIsUpdating(false);
    };

    const updateFilters = async (newStates: string[], newCities: string[]) => {
        setIsUpdating(true);
        const { error } = await supabase
            .from('saved_searches')
            .update({
                query_params: {
                    ...search.query_params,
                    states: newStates,
                    cities: newCities
                }
            })
            .eq('id', search.id);

        if (!error) {
            setStates(newStates);
            setCities(newCities);
            router.refresh();
        } else {
            console.error("Failed to update filters", error);
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
        if (!state) { setIsAddingState(false); return; }

        if (membershipPlan === 'free' && states.length >= 1) {
            setUpgradeModal({ reason: 'state', currentCount: states.length, limitCount: 1 });
            setIsAddingState(false);
            return;
        }
        if (membershipPlan === 'starter' && states.length >= 1) {
            setUpgradeModal({ reason: 'state', currentCount: states.length, limitCount: 1 });
            setIsAddingState(false);
            return;
        }
        if (!states.includes(state)) {
            updateFilters([...states, state], cities);
        }
        setIsAddingState(false);
    };

    const handleAddCity = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCity.trim()) { setIsAddingCity(false); return; }
        
        const citiesToAdd = newCity.split(',').map(c => c.trim()).filter(Boolean);
        const cityCount = cities.length + citiesToAdd.length;
        
        if (membershipPlan === 'free' && cityCount > 1) {
            setUpgradeModal({ reason: 'city', currentCount: cities.length, limitCount: 1 });
            return;
        }
        
        const newCities = Array.from(new Set([...cities, ...citiesToAdd]));
        updateFilters(states, newCities);
        setNewCity('');
        setIsAddingCity(false);
    };

    const handleRemoveKeyword = (indexToRemove: number) => {
        const newKeywordsList = keywords.filter((_, index) => index !== indexToRemove);
        updateKeywords(newKeywordsList);
    };

    const handleAddKeyword = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim()) {
            setIsAdding(false);
            return;
        }

        const addedKwsCount = newKeyword.split(',').filter(k => k.trim()).length;
        if (membershipPlan === 'free' && totalKeywords + addedKwsCount > 10) {
            setUpgradeModal({ reason: 'keywords', currentCount: totalKeywords, limitCount: 10 });
            return;
        }

        const newKeywordsList = [...keywords, newKeyword.trim()];
        updateKeywords(newKeywordsList);
        setNewKeyword('');
        setIsAdding(false);
    };

    const handleDeleteMonitor = async () => {
        if (!confirm("Are you sure you want to delete this monitor?")) return;
        
        setIsUpdating(true);
        const { error } = await supabase
            .from('saved_searches')
            .delete()
            .eq('id', search.id);

        if (!error) {
            router.refresh();
        } else {
            console.error("Failed to delete monitor", error);
        }
        setIsUpdating(false);
    };

    const handleUpdateFrequency = async (newFreq: string) => {
        setIsUpdating(true);
        const { error } = await supabase
            .from('saved_searches')
            .update({ notification_frequency: newFreq })
            .eq('id', search.id);

        if (!error) {
            setFrequency(newFreq);
            router.refresh();
        } else {
            console.error("Failed to update frequency", error);
        }
        setIsUpdating(false);
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
            <div className={`group bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-6 hover:border-slate-300 dark:hover:border-muted-foreground/30 hover:shadow-md transition-all relative overflow-hidden shadow-sm ${isUpdating ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                    <Bell className="w-4 h-4 text-atomic-tangerine-600" />
                </div>
                <div className="flex items-center space-x-1.5 bg-muted dark:bg-muted/50 px-2.5 py-1 rounded-full border border-border dark:border-muted-foreground/30">
                    <span className="w-1.5 h-1.5 bg-atomic-tangerine-600 dark:bg-atomic-tangerine-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-widest leading-none">Tracking</span>
                </div>
            </div>

            <div className="group/title flex items-center justify-between gap-2 mb-3 min-h-[32px]">
                {isEditingName ? (
                    <div className="flex items-center w-full gap-1">
                        <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={handleNameKeyDown}
                            className="flex-1 text-base font-bold text-slate-900 dark:text-foreground border-b-2 border-link dark:border-link focus:outline-none focus:border-link-hover dark:focus:border-link-hover uppercase tracking-tight bg-transparent"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleUpdateName}
                            className="p-1.5 text-link dark:text-link hover:bg-muted dark:hover:bg-muted/50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
                            aria-label="Save monitor name"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditingName(false);
                                setEditNameValue(name);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                            aria-label="Cancel editing"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-foreground group-hover/title:text-link dark:group-hover/title:text-link transition-colors uppercase tracking-tight">
                            {name}
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsEditingName(true)}
                            className="opacity-0 group-hover/title:opacity-100 focus:opacity-100 p-1 text-slate-600 dark:text-muted-foreground hover:text-link dark:hover:text-link transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link rounded"
                            aria-label="Edit monitor name"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-muted dark:bg-muted/50 px-2.5 py-1.5 rounded-full border border-border dark:border-muted-foreground/30 text-muted-foreground dark:text-muted-foreground group/pill">
                            <span>{keyword}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveKeyword(idx)}
                                className="hover:bg-border dark:hover:bg-muted-foreground/20 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
                                aria-label={`Remove keyword ${keyword}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {states.map((st: string, idx: number) => (
                        <div key={`st-${idx}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-muted-olive-50 dark:bg-muted-olive-900/20 px-2.5 py-1.5 rounded-full border border-muted-olive-200 dark:border-muted-olive-800 text-muted-olive-700 dark:text-muted-olive-400 group/pill">
                            <span>{st}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveState(idx)}
                                className="hover:bg-muted-olive-200 dark:hover:bg-muted-olive-800/50 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted-olive-500"
                                aria-label={`Remove state ${st}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {isAddingState ? (
                        <select
                            aria-label="Select a state to add"
                            className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-muted-foreground/30 dark:border-muted-foreground/30 focus:outline-none focus:border-link dark:focus:border-link focus-visible:ring-2 focus-visible:ring-link bg-white dark:bg-card"
                            autoFocus
                            onChange={handleAddState}
                            onBlur={() => setIsAddingState(false)}
                        >
                            <option value="">Select State</option>
                            {STATES.filter(s => !states.includes(s)).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setIsAddingState(true)}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-muted dark:bg-muted/50 hover:bg-border dark:hover:bg-muted-foreground/20 px-2.5 py-1.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground dark:text-muted-foreground transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            <span>State</span>
                        </button>
                    )}

                    {cities.map((city: string, idx: number) => (
                        <div key={`ct-${idx}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-fresh-sky-50 dark:bg-fresh-sky-900/20 px-2.5 py-1.5 rounded-full border border-fresh-sky-200 dark:border-fresh-sky-800 text-fresh-sky-700 dark:text-fresh-sky-400 group/pill">
                            <span>{city}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveCity(idx)}
                                className="hover:bg-fresh-sky-200 dark:hover:bg-fresh-sky-800/50 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresh-sky-500"
                                aria-label={`Remove city ${city}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {isAddingCity ? (
                        <form onSubmit={handleAddCity} className="flex items-center gap-1">
                            <input
                                type="text"
                                aria-label="Add city filter"
                                value={newCity}
                                onChange={(e) => setNewCity(e.target.value)}
                                placeholder="e.g. Mumbai, Pune"
                                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-muted-foreground/30 dark:border-muted-foreground/30 focus:outline-none focus:border-link dark:focus:border-link focus:ring-1 focus:ring-link w-36 bg-white dark:bg-card dark:text-foreground"
                                autoFocus
                                onBlur={() => setIsAddingCity(false)}
                            />
                        </form>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setIsAddingCity(true)}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-muted dark:bg-muted/50 hover:bg-border dark:hover:bg-muted-foreground/20 px-2.5 py-1.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground dark:text-muted-foreground transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            <span>City</span>
                        </button>
                    )}                    
                    
                    {isAdding ? (
                        <form onSubmit={handleAddKeyword} className="flex items-center gap-1">
                            <input
                                type="text"
                                aria-label="Add new keyword"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="New keyword"
                                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-muted-foreground/30 dark:border-muted-foreground/30 focus:outline-none focus:border-link dark:focus:border-link focus:ring-1 focus:ring-link w-32 bg-white dark:bg-card dark:text-foreground"
                                autoFocus
                                onBlur={() => setIsAdding(false)}
                            />
                        </form>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-full border border-dashed border-slate-300 text-slate-600 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            <span>Keyword</span>
                        </button>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-50 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                        <span>Email Digest</span>
                        <select
                            value={frequency}
                            onChange={(e) => handleUpdateFrequency(e.target.value)}
                            className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-atomic-tangerine-600 hover:text-atomic-tangerine-700 dark:text-atomic-tangerine-500 font-bold"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="off">Off</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <Link 
                            href={`/?q=${encodeURIComponent(keywords.join(',') || '')}${states.length > 0 ? `&states=${encodeURIComponent(states.join(','))}` : ''}${cities.length > 0 ? `&cities=${encodeURIComponent(cities.join(','))}` : ''}`} 
                            className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold tracking-widest uppercase text-center hover:bg-slate-100 transition-all flex items-center justify-center space-x-1 border border-slate-200"
                        >
                            <span>Live Bids</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                            onClick={handleDeleteMonitor}
                            className="p-2.5 text-muted-foreground dark:text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label="Delete monitor"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
