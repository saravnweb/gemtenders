/**
 * **Public listing ready** (`public_listing_ready` in SQL comments) — tenders shown in
 * the live (non-archived) browse view must have PDF storage, state, and city so cards
 * are complete. Incomplete rows remain in the DB for pipelines but are omitted from this
 * view until enrichment finishes.
 */

/** Apply to Supabase `.from('tenders')` query builders (active / public browse only). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PostgREST builder chain
export function requirePublicListingReady(q: any): any {
  return q.not("pdf_url", "is", null).not("state", "is", null).not("city", "is", null);
}
