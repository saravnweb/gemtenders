"use client";

import { useState, useTransition } from 'react';
import { Plus, Search, Loader2, X, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';



export default function AddMonitorForm({ userId, membershipPlan, totalKeywords }: { userId: string, membershipPlan: string, totalKeywords: number }) {
    const [isAdding, setIsAdding] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim()) {
            return;
        }

        setIsLoading(true);
        const newKeywordsCount = keyword.split(',').filter(k => k.trim()).length;
        if (membershipPlan === 'free' && totalKeywords + newKeywordsCount > 10) {
            if (confirm(`Free plan allows up to 10 keywords across all monitors. You already have ${totalKeywords} keywords.\n\nWould you like to upgrade your plan now to add more?`)) {
                router.push("/dashboard/subscriptions");
            }
            return;
        }

        const query_params: any = { q: keyword.trim() };

        const { error } = await supabase.from('saved_searches').insert({
            user_id: userId,
            name: `${keyword.trim()} Alert`,
            query_params,
            is_alert_enabled: true
        });

        if (!error) {
            startTransition(() => {
                router.refresh();
                setKeyword('');
                setIsAdding(false);
            });
        } else {
            console.error("Failed to add monitor", error);
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
            {isAdding && (
                <form 
                    onSubmit={handleSubmit} 
                    className="flex flex-col p-5 bg-white backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto max-w-sm sm:max-w-md w-[90vw] md:w-[450px]"
                >
                    <div className="flex items-center justify-between mb-1 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Plus className="w-4 h-4" />
                           </div>
                           <span className="text-sm font-bold uppercase tracking-widest text-slate-800">Advanced Alert</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setIsAdding(false)}
                            className="bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all text-slate-500 hover:text-slate-800"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                       <div>
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 block">Tender Keywords *</label>
                         <input
                             type="text"
                             value={keyword}
                             onChange={(e) => setKeyword(e.target.value)}
                             placeholder="E.g., Solar, Security, IT..."
                             className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none shadow-inner transition-all"
                             autoFocus
                         />
                       </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || isPending || !keyword.trim()}
                        className="w-full mt-2 px-6 py-3.5 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading || isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Monitor Setup</span>}
                    </button>
                </form>
            )}

            <button 
                onClick={() => {
                    setIsAdding(!isAdding);
                }}
                className={`w-14 h-14 bg-blue-600 text-white shrink-0 rounded-full hover:bg-blue-700 hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/40 transition-all flex items-center justify-center ${isAdding ? 'rotate-45 bg-slate-800 hover:bg-slate-900 shadow-slate-500/40' : ''}`}
                title={isAdding ? "Close" : "Add Advanced Monitor"}
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
}
