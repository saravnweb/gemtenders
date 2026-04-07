"use client";

import { useState, useTransition, useEffect } from 'react';
import { Plus, X, ChevronRight, Zap, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCitiesForStates } from './actions';
import UpgradeModal, { type UpgradeReason } from '@/components/UpgradeModal';

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh", "Ladakh", "Jammu And Kashmir"
].sort();

const PLAN_LIMITS = {
  free:    { keywords: 5,        states: 1, cities: 1 },
  starter: { keywords: Infinity, states: 1, cities: Infinity },
  pro:     { keywords: Infinity, states: Infinity, cities: Infinity },
} as const;

function PlanBadge({ limit, planName }: { limit: number; planName: string }) {
  if (limit === Infinity) return null;
  return (
    <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
      {planName}: {limit} max
    </span>
  );
}

interface AlertSetupCardProps {
  search: {
    id: string;
    query_params: { q: string; states: string[]; cities: string[] };
  };
  membershipPlan: string;
}

export default function AlertSetupCard({ search, membershipPlan }: AlertSetupCardProps) {
  const router = useRouter();
  const plan = (membershipPlan as keyof typeof PLAN_LIMITS) in PLAN_LIMITS
    ? (membershipPlan as keyof typeof PLAN_LIMITS)
    : 'free';
  const limits = PLAN_LIMITS[plan];
  const planLabel = plan === 'free' ? 'Free' : plan === 'starter' ? 'Starter' : 'Pro';

  const [keywords, setKeywords] = useState<string[]>(
    search.query_params.q ? search.query_params.q.split(',').map(k => k.trim()).filter(Boolean) : []
  );
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedState, setSelectedState] = useState<string>(search.query_params.states?.[0] ?? '');
  const [selectedCity, setSelectedCity] = useState<string>(search.query_params.cities?.[0] ?? '');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [upgradeModal, setUpgradeModal] = useState<{ reason: UpgradeReason; currentCount: number; limitCount: number } | null>(null);

  useEffect(() => {
    if (!selectedState) {
      setAvailableCities([]);
      return;
    }
    getCitiesForStates([selectedState]).then(setAvailableCities).catch(console.error);
  }, [selectedState]);

  const persistChanges = async (nextKeywords: string[], nextState: string, nextCity: string) => {
    setIsUpdating(true);
    const { data: latest } = await supabase
      .from('saved_searches')
      .select('query_params')
      .eq('id', search.id)
      .single();
    const base = latest?.query_params ?? search.query_params;

    const { error } = await supabase.from('saved_searches').update({
      query_params: {
        ...base,
        q: nextKeywords.join(','),
        states: nextState ? [nextState] : [],
        cities: nextCity ? [nextCity] : [],
      }
    }).eq('id', search.id);

    if (!error) {
      startTransition(() => router.refresh());
    } else {
      console.error('Failed to save', error);
    }
    setIsUpdating(false);
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const parsed = newKeyword.split(',').map(k => k.trim()).filter(Boolean);
    const nextTotal = keywords.length + parsed.length;
    if (limits.keywords !== Infinity && nextTotal > limits.keywords) {
      setUpgradeModal({ reason: 'keywords', currentCount: keywords.length, limitCount: limits.keywords });
      return;
    }
    const next = Array.from(new Set([...keywords, ...parsed]));
    setKeywords(next);
    persistChanges(next, selectedState, selectedCity);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (idx: number) => {
    const next = keywords.filter((_, i) => i !== idx);
    setKeywords(next);
    persistChanges(next, selectedState, selectedCity);
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const state = e.target.value;
    setSelectedState(state);
    setSelectedCity('');
    persistChanges(keywords, state, '');
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setSelectedCity(city);
    persistChanges(keywords, selectedState, city);
  };

  const busy = isUpdating || isPending;

  const liveBidsUrl = `/?q=${encodeURIComponent(keywords.join(','))}${selectedState ? `&states=${encodeURIComponent(selectedState)}` : ''}${selectedCity ? `&cities=${encodeURIComponent(selectedCity)}` : ''}`;

  return (
    <>
      {upgradeModal && (
        <UpgradeModal
          isOpen={true}
          onClose={() => setUpgradeModal(null)}
          reason={upgradeModal.reason}
          currentPlan={plan}
          currentCount={upgradeModal.currentCount}
          limitCount={upgradeModal.limitCount}
        />
      )}

      <div className={`bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-sm transition-opacity ${busy ? 'opacity-60 pointer-events-none' : ''}`}>

        {/* Keywords */}
        <div className="p-6">
          <div className="flex items-center mb-3">
            <label className="text-sm font-bold text-slate-800 dark:text-foreground flex items-center">
              <Zap className="w-4 h-4 mr-1.5 text-fresh-sky-500" />
              Keywords
            </label>
            <PlanBadge limit={limits.keywords} planName={planLabel} />
          </div>
          <p className="text-xs text-slate-400 dark:text-muted-foreground mb-4">Products, services, or categories you want to track.</p>

          {keywords.length === 0 ? (
            <div className="mb-4 flex items-center justify-center py-5 rounded-lg border border-dashed border-slate-200 dark:border-border text-xs text-slate-400 dark:text-muted-foreground">
              No keywords yet — add one below
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mb-4">
              {keywords.map((kw, idx) => (
                <span key={idx} className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white">
                  {kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(idx)}
                    className="opacity-40 hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5 rounded-full transition-all"
                    aria-label={`Remove ${kw}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <form onSubmit={handleAddKeyword} className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="e.g. Solar, Security, Computers..."
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-fresh-sky-500 outline-none transition-all dark:text-foreground"
            />
            <button
              type="submit"
              disabled={!newKeyword.trim() || busy}
              className="shrink-0 w-10 h-10 bg-fresh-sky-600 dark:bg-fresh-sky-700 text-white rounded-xl hover:bg-fresh-sky-700 disabled:opacity-40 transition-all flex items-center justify-center"
              aria-label="Add keyword"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="border-t border-slate-100 dark:border-border" />

        {/* State */}
        <div className="p-6">
          <div className="flex items-center mb-3">
            <label htmlFor="state-select" className="text-sm font-bold text-slate-800 dark:text-foreground flex items-center">
              <MapPin className="w-4 h-4 mr-1.5 text-emerald-500" />
              State
            </label>
            <PlanBadge limit={limits.states} planName={planLabel} />
          </div>
          <p className="text-xs text-slate-400 dark:text-muted-foreground mb-4">Filter tenders to a specific state, or leave as All India.</p>
          <select
            id="state-select"
            value={selectedState}
            onChange={handleStateChange}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all appearance-none dark:text-foreground"
          >
            <option value="">All India (no filter)</option>
            {STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 dark:border-border" />

        {/* City */}
        <div className="p-6">
          <div className="flex items-center mb-3">
            <label htmlFor="city-select" className="text-sm font-bold text-slate-800 dark:text-foreground flex items-center">
              <MapPin className="w-4 h-4 mr-1.5 text-violet-500" />
              City
            </label>
            <PlanBadge limit={limits.cities} planName={planLabel} />
          </div>
          <p className="text-xs text-slate-400 dark:text-muted-foreground mb-4">Narrow down further to a specific city within the selected state.</p>
          <select
            id="city-select"
            value={selectedCity}
            onChange={handleCityChange}
            disabled={!selectedState || busy}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-background border border-slate-200 dark:border-border rounded-xl text-sm font-medium focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-violet-500 outline-none transition-all appearance-none dark:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {!selectedState ? 'Select a state first' : 'All cities in state'}
            </option>
            {availableCities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-100 dark:border-border" />

        {/* Footer */}
        <div className="px-6 py-4">
          <Link
            href={liveBidsUrl}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-fresh-sky-50 dark:bg-fresh-sky-900/20 text-fresh-sky-700 dark:text-fresh-sky-400 rounded-xl text-sm font-semibold hover:bg-fresh-sky-100 dark:hover:bg-fresh-sky-800/30 transition-all border border-fresh-sky-200 dark:border-fresh-sky-800"
          >
            <span>View Matching Bids</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
