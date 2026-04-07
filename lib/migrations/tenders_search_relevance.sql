-- Relevance-ranked tender search (same substring match semantics as the app ILIKE filters).
-- Apply in Supabase: SQL Editor → run this file, or: supabase db push (if using CLI migrations).
--
-- Weights: title & bid refs highest; long ai_summary text lowest so title matches surface first.

ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS category TEXT;

CREATE OR REPLACE FUNCTION public.tender_match_score_row(t tenders, terms text[])
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  s numeric := 0;
  term text;
  w_title int := 100;
  w_bid int := 90;
  w_ra int := 90;
  w_dept int := 48;
  w_min int := 48;
  w_org int := 48;
  w_state int := 28;
  w_city int := 28;
  w_ai int := 12;
BEGIN
  IF terms IS NULL OR coalesce(array_length(terms, 1), 0) = 0 THEN
    RETURN 0;
  END IF;
  FOREACH term IN ARRAY terms
  LOOP
    IF term IS NULL OR btrim(term) = '' THEN CONTINUE; END IF;
    IF strpos(lower(coalesce(t.title, '')), lower(term)) > 0 THEN s := s + w_title; END IF;
    IF strpos(lower(coalesce(t.bid_number, '')), lower(term)) > 0 THEN s := s + w_bid; END IF;
    IF strpos(lower(coalesce(t.ra_number, '')), lower(term)) > 0 THEN s := s + w_ra; END IF;
    IF strpos(lower(coalesce(t.department, '')), lower(term)) > 0 THEN s := s + w_dept; END IF;
    IF strpos(lower(coalesce(t.ministry_name, '')), lower(term)) > 0 THEN s := s + w_min; END IF;
    IF strpos(lower(coalesce(t.organisation_name, '')), lower(term)) > 0 THEN s := s + w_org; END IF;
    IF strpos(lower(coalesce(t.state, '')), lower(term)) > 0 THEN s := s + w_state; END IF;
    IF strpos(lower(coalesce(t.city, '')), lower(term)) > 0 THEN s := s + w_city; END IF;
    IF strpos(lower(coalesce(t.ai_summary, '')), lower(term)) > 0 THEN s := s + w_ai; END IF;
  END LOOP;
  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenders_search_relevance(
  p_q text,
  p_tab text,
  p_is_direct_gem boolean,
  p_states text[],
  p_cities text[],
  p_ministries text[],
  p_orgs text[],
  p_emd_filter text,
  p_date_filter text,
  p_msme_only boolean,
  p_mii_only boolean,
  p_category text,
  p_description text,
  p_limit int,
  p_offset int
)
RETURNS SETOF tenders
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  terms text[];
BEGIN
  terms := ARRAY(
    SELECT btrim(x)
    FROM unnest(string_to_array(coalesce(p_q, ''), ',')) AS x
    WHERE btrim(x) <> ''
  );

  IF coalesce(array_length(terms, 1), 0) = 0 THEN
    RETURN QUERY SELECT * FROM tenders WHERE false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.*
  FROM tenders t
  WHERE
    -- Active tab: "public listing ready" — PDF + state + city (see lib/tender-public-listing.ts)
    (p_is_direct_gem OR (
      CASE
        WHEN p_tab = 'archived' THEN t.end_date < now()
        ELSE t.end_date >= now() AND t.ai_summary IS NOT NULL
          AND t.pdf_url IS NOT NULL AND t.state IS NOT NULL AND t.city IS NOT NULL
      END
    ))
    AND (
      SELECT bool_or(
        strpos(lower(coalesce(t.title, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.bid_number, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.ra_number, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.department, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.ministry_name, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.organisation_name, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.state, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.city, '')), lower(term)) > 0 OR
        strpos(lower(coalesce(t.ai_summary, '')), lower(term)) > 0
      )
      FROM unnest(terms) AS u(term)
    )
    AND (
      p_states IS NULL OR coalesce(array_length(p_states, 1), 0) = 0 OR
      EXISTS (SELECT 1 FROM unnest(p_states) s WHERE t.state IS NOT NULL AND t.state ILIKE s)
    )
    AND (
      p_cities IS NULL OR coalesce(array_length(p_cities, 1), 0) = 0 OR
      EXISTS (SELECT 1 FROM unnest(p_cities) c WHERE t.city IS NOT NULL AND t.city ILIKE c)
    )
    AND (
      p_ministries IS NULL OR coalesce(array_length(p_ministries, 1), 0) = 0 OR
      EXISTS (SELECT 1 FROM unnest(p_ministries) m WHERE t.ministry_name IS NOT NULL AND t.ministry_name ILIKE m)
    )
    AND (
      p_orgs IS NULL OR coalesce(array_length(p_orgs, 1), 0) = 0 OR
      EXISTS (SELECT 1 FROM unnest(p_orgs) o WHERE t.organisation_name IS NOT NULL AND t.organisation_name ILIKE o)
    )
    AND (NOT p_msme_only OR t.eligibility_msme = true)
    AND (NOT p_mii_only OR t.eligibility_mii = true)
    AND (
      p_emd_filter IS NULL OR p_emd_filter = '' OR p_emd_filter = 'all' OR
      (p_emd_filter = 'free' AND coalesce(t.emd_amount, 0) = 0) OR
      (p_emd_filter = '<1L' AND t.emd_amount > 0 AND t.emd_amount < 100000) OR
      (p_emd_filter = '1-5L' AND t.emd_amount >= 100000 AND t.emd_amount <= 500000) OR
      (p_emd_filter = '>5L' AND t.emd_amount > 500000)
    )
    AND (p_category IS NULL OR btrim(p_category) = '' OR t.category = p_category)
    AND (
      p_description IS NULL OR btrim(p_description) = '' OR
      strpos(lower(coalesce(t.ai_summary, '')), lower(btrim(p_description))) > 0
    )
    AND (
      p_date_filter IS NULL OR p_date_filter = '' OR p_date_filter = 'all' OR
      (p_date_filter = 'today' AND t.end_date >= date_trunc('day', now()) AND t.end_date < date_trunc('day', now()) + interval '1 day') OR
      (p_date_filter = 'week' AND t.end_date >= now() AND t.end_date <= now() + interval '7 days')
    )
  ORDER BY public.tender_match_score_row(t, terms) DESC, t.id ASC
  LIMIT coalesce(p_limit, 21)
  OFFSET coalesce(p_offset, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tender_match_score_row(tenders, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tenders_search_relevance(text, text, boolean, text[], text[], text[], text[], text, text, boolean, boolean, text, text, int, int) TO anon, authenticated;
