"use client";

import { useState } from 'react';
import { Plus, Search, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AddMonitorForm({ userId }: { userId: string }) {
    const [isAdding, setIsAdding] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim()) {
            setIsAdding(false);
            return;
        }

        setIsLoading(true);
        const { error } = await supabase.from('saved_searches').insert({
            user_id: userId,
            name: `${keyword.trim()} Alert`,
            query_params: { q: keyword.trim() },
            is_alert_enabled: true
        });

        if (!error) {
            setKeyword('');
            setIsAdding(false);
            router.refresh();
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
                    className="flex flex-col p-4 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">New Keyword</span>
                        <button 
                            type="button" 
                            onClick={() => setIsAdding(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="E.g., Solar, Security..."
                        className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none w-64 md:w-80 shadow-inner"
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-6 py-3 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Keyword Monitor</span>}
                    </button>
                </form>
            )}

            <button 
                onClick={() => {
                    setIsAdding(!isAdding);
                    if (isAdding) setKeyword('');
                }}
                className={`w-14 h-14 bg-blue-600 text-white rounded-full hover:bg-blue-700 hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/40 transition-all flex items-center justify-center ${isAdding ? 'rotate-45 bg-slate-800 hover:bg-slate-900 shadow-slate-500/40' : ''}`}
                title={isAdding ? "Close" : "Add Keyword"}
            >
                <Plus className="w-6 h-6" />
            </button>
        </div>
    );
}
