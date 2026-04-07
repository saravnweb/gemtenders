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
        if (membershipPlan === 'free' && totalKeywords + addedKwsCount > 5) {
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
        <div className={`bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl p-6 hover:border-slate-300 dark:hover:border-zinc-600 hover:shadow-md transition-all flex flex-col h-full shadow-sm ${isUpdating || isPending ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="flex flex-col mb-6">
                <h2 className="text-base font-bold text-slate-900 dark:text-foreground tracking-tight">Tender Keywords</h2>
                <p className="text-sm text-slate-500 dark:text-muted-foreground font-medium mt-1">Add products, services, or categories.</p>
            </div>

            <div className="flex-1 mb-6">
                {keywords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center bg-slate-50 dark:bg-background rounded-xl border border-dashed border-slate-200 dark:border-border">
                        <Zap className="w-8 h-8 text-slate-300 dark:text-muted-tertiary mb-3" />
                        <span className="text-xs font-medium text-slate-500 dark:text-muted-foreground">No keywords yet</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white group">
                                <span>{keyword}</span>
                                <button
                                    type="button" 
                                    onClick={() => handleRemoveKeyword(idx)}
                                    className="hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 rounded-full transition-colors focus:outline-none opacity-50 hover:opacity-100"
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
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-fresh-sky-500 outline-none shadow-inner transition-all dark:text-foreground"
                />
                <button
                    type="submit"
                    disabled={!newKeyword.trim() || isUpdating || isPending}
                    className="shrink-0 w-10 h-10 bg-fresh-sky-600 dark:bg-fresh-sky-700 text-white rounded-xl hover:bg-fresh-sky-700 dark:hover:bg-fresh-sky-800 active:scale-95 transition-all flex items-center justify-center shadow-sm disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>
        </div>
        </>
    );
}
