import type { SupabaseClient } from "@supabase/supabase-js";

/** Mirrors `Filters` in TendersClient for relevance RPC args. */
export type TendersRelevanceFilters = {
  q: string;
  tab: "all" | "foryou" | "archived";
  states: string[];
  cities: string[];
  ministries: string[];
  orgs: string[];
  emdFilter: string;
  dateFilter: string;
  msmeOnly: boolean;
  miiOnly: boolean;
  category: string | null;
  descriptionQuery: string;
};

export async function fetchTendersByRelevance(
  supabase: SupabaseClient,
  filters: TendersRelevanceFilters,
  page: number,
  pageSize: number
) {
  const qTrim = filters.q.trim();
  if (!qTrim) {
    return { data: null as unknown[] | null, error: null };
  }

  return supabase.rpc("tenders_search_relevance", {
    p_q: filters.q,
    p_tab: filters.tab === "archived" ? "archived" : "active",
    p_is_direct_gem: qTrim.toUpperCase().includes("GEM/"),
    p_states: filters.states.length ? filters.states : null,
    p_cities: filters.cities.length ? filters.cities : null,
    p_ministries: filters.ministries.length ? filters.ministries : null,
    p_orgs: filters.orgs.length ? filters.orgs : null,
    p_emd_filter: filters.emdFilter,
    p_date_filter: filters.dateFilter,
    p_msme_only: filters.msmeOnly,
    p_mii_only: filters.miiOnly,
    p_category: filters.category?.trim() || null,
    p_description: filters.descriptionQuery.trim() || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
}
