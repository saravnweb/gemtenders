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
        <div className={`group bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:shadow-md transition-all relative overflow-hidden shadow-sm ${isUpdating ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                    <Bell className="w-4 h-4 text-atomic-tangerine-600" />
                </div>
                <div className="flex items-center space-x-1.5 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-bold text-green-700 uppercase tracking-widest leading-none">Tracking</span>
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
                            className="flex-1 text-base font-bold text-slate-900 border-b-2 border-blue-500 focus:outline-none focus:border-blue-700 uppercase tracking-tight bg-transparent"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleUpdateName}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                        <h3 className="text-base font-bold text-slate-900 group-hover/title:text-blue-600 transition-colors uppercase tracking-tight">
                            {name}
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsEditingName(true)}
                            className="opacity-0 group-hover/title:opacity-100 focus:opacity-100 p-1 text-slate-600 hover:text-blue-600 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
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
                        <div key={idx} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-blue-50 px-2.5 py-1.5 rounded-full border border-blue-100 text-blue-700 group/pill">
                            <span>{keyword}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveKeyword(idx)}
                                className="hover:bg-blue-200 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                aria-label={`Remove keyword ${keyword}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {states.map((st: string, idx: number) => (
                        <div key={`st-${idx}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-100 text-emerald-700 group/pill">
                            <span>{st}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveState(idx)}
                                className="hover:bg-emerald-200 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                aria-label={`Remove state ${st}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {isAddingState ? (
                        <select
                            aria-label="Select a state to add"
                            className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-emerald-200 focus:outline-none focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 bg-white"
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
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-full border border-dashed border-emerald-300 text-emerald-700 transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            <span>State</span>
                        </button>
                    )}

                    {cities.map((city: string, idx: number) => (
                        <div key={`ct-${idx}`} className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-purple-50 px-2.5 py-1.5 rounded-full border border-purple-100 text-purple-700 group/pill">
                            <span>{city}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveCity(idx)}
                                className="hover:bg-purple-200 p-0.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
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
                                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-purple-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-36 bg-white"
                                autoFocus
                                onBlur={() => setIsAddingCity(false)}
                            />
                        </form>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setIsAddingCity(true)}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-full border border-dashed border-purple-300 text-purple-700 transition-colors"
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
                                className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
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

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-3">
                    <Link 
                        href={`/?q=${encodeURIComponent(keywords.join(',') || '')}${states.length > 0 ? `&states=${encodeURIComponent(states.join(','))}` : ''}${cities.length > 0 ? `&cities=${encodeURIComponent(cities.join(','))}` : ''}`} 
                        className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold tracking-widest uppercase text-center hover:bg-slate-100 transition-all flex items-center justify-center space-x-1 border border-slate-200"
                    >
                        <span>Live Bids</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <button
                        onClick={handleDeleteMonitor}
                        className="p-2.5 text-slate-300 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label="Delete monitor"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
        </>
    );
}
