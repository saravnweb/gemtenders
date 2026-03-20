"use client";

import { useState } from 'react';
import { Bell, ChevronRight, Trash2, X, Plus, Pencil, Check } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MonitorCard({ search, membershipPlan, totalKeywords }: { search: any, membershipPlan: string, totalKeywords: number }) {
    const router = useRouter();
    const [keywords, setKeywords] = useState<string[]>(
        search.query_params.q ? search.query_params.q.split(',').map((k: string) => k.trim()).filter(Boolean) : []
    );
    const [isAdding, setIsAdding] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    
    const [name, setName] = useState(search.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState(search.name);

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
            if (confirm(`Free plan allows up to 10 keywords across all monitors. You are tracking ${totalKeywords} currently.\n\nWould you like to upgrade to Starter or Pro to add more?`)) {
                router.push("/dashboard/subscriptions");
            }
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
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Save name"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditingName(false);
                                setEditNameValue(name);
                            }}
                            className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                            title="Cancel"
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
                            className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-600 hover:text-blue-600 transition-all focus:outline-none"
                            title="Edit group name"
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
                                className="hover:bg-blue-200 p-0.5 rounded-full transition-colors focus:outline-none"
                                title="Remove keyword"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {search.query_params.state && (
                        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-indigo-50 px-2.5 py-1.5 rounded-full border border-indigo-100 text-indigo-700">
                            <span>{search.query_params.state}</span>
                            <button 
                                type="button" 
                                className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors focus:outline-none" 
                                title="Remove state (Not yet supported in UI)"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    {search.query_params.city && (
                        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest bg-indigo-50 px-2.5 py-1.5 rounded-full border border-indigo-100 text-indigo-700">
                            <span>{search.query_params.city}</span>
                            <button 
                                type="button" 
                                className="hover:bg-indigo-200 p-0.5 rounded-full transition-colors focus:outline-none" 
                                title="Remove city (Not yet supported in UI)"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}                    
                    {isAdding ? (
                        <form onSubmit={handleAddKeyword} className="flex items-center gap-1">
                            <input 
                                type="text"
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
                            <span>Add</span>
                        </button>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-50 flex items-center justify-between gap-3">
                    <Link 
                        href={`/?q=${encodeURIComponent(keywords.join(',') || '')}${search.query_params.state ? `&state=${search.query_params.state}` : ''}${search.query_params.city ? `&city=${search.query_params.city}` : ''}`} 
                        className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold tracking-widest uppercase text-center hover:bg-slate-100 transition-all flex items-center justify-center space-x-1 border border-slate-200"
                    >
                        <span>Live Bids</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <button 
                        onClick={handleDeleteMonitor}
                        className="p-2.5 text-slate-300 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                        title="Delete Monitor"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
