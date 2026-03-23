"use client";

import { useState, useTransition, useEffect } from 'react';
import { Plus, X, Loader2, Search, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import UpgradeModal from '@/components/UpgradeModal';

export default function KeywordsCard({ search, membershipPlan, totalKeywords }: { search: any, membershipPlan: string, totalKeywords: number }) {
    const router = useRouter();
    const [keywords, setKeywords] = useState<string[]>(
        search.query_params.q ? search.query_params.q.split(',').map((k: string) => k.trim()).filter(Boolean) : []
    );
    const [newKeyword, setNewKeyword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        setKeywords(search.query_params.q ? search.query_params.q.split(',').map((k: string) => k.trim()).filter(Boolean) : []);
    }, [search.query_params.q]);

    const updateKeywords = async (newKeywordsList: string[]) => {
        setIsUpdating(true);
        // Protect against read-modify-write race conditions by fetching freshest state
        const { data: latest } = await supabase.from('saved_searches').select('query_params').eq('id', search.id).single();
        const currentParams = latest?.query_params || search.query_params;

        const { error } = await supabase
            .from('saved_searches')
            .update({
                query_params: {
                    ...currentParams,
                    q: newKeywordsList.join(',')
                }
            })
            .eq('id', search.id);

        if (!error) {
            setKeywords(newKeywordsList);
            startTransition(() => {
                router.refresh();
            });
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
        if (!newKeyword.trim()) return;

        const addedKwsCount = newKeyword.split(',').filter(k => k.trim()).length;
        if (membershipPlan === 'free' && totalKeywords + addedKwsCount > 10) {
            setShowUpgradeModal(true);
            return;
        }

        const newKeywordsList = Array.from(new Set([...keywords, ...newKeyword.split(',').map(k => k.trim()).filter(Boolean)]));
        updateKeywords(newKeywordsList);
        setNewKeyword('');
    };

    return (
        <>
        <UpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            reason="keywords"
            currentPlan={membershipPlan}
            currentCount={totalKeywords}
            limitCount={10}
        />
        <div className={`bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-6 hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-md transition-all flex flex-col h-full shadow-sm ${isUpdating || isPending ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex flex-col mb-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Tender Keywords</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Add products, services, or categories.</p>
            </div>

            <div className="flex-1 mb-6">
                {keywords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50 dark:bg-zinc-950 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                        <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">No keywords yet</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400 group">
                                <span>{keyword}</span>
                                <button
                                    type="button" 
                                    onClick={() => handleRemoveKeyword(idx)}
                                    className="hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5 rounded-full transition-colors focus:outline-none opacity-50 hover:opacity-100"
                                    title="Remove keyword"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <form onSubmit={handleAddKeyword} className="flex gap-2 mt-auto">
                <input 
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g. Solar, Security, Computers..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-inner transition-all dark:text-slate-100"
                />
                <button 
                    type="submit"
                    disabled={!newKeyword.trim() || isUpdating || isPending}
                    className="px-4 py-2.5 bg-blue-600 text-white font-bold text-sm uppercase tracking-widest rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1 shadow-md disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add</span>
                </button>
            </form>
        </div>
        </>
    );
}
