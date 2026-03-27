-- Create the tenders table
CREATE TABLE tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_number TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    department TEXT, -- Primary display name (Organisation > Dept > Ministry)
    ministry_name TEXT,
    department_name TEXT,
    organisation_name TEXT,
    office_name TEXT,
    state TEXT,
    city TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    opening_date TIMESTAMPTZ,
    mse_relaxation TEXT,
    startup_relaxation TEXT,
    mse_turnover_relaxation TEXT,
    startup_turnover_relaxation TEXT,
    documents_required JSONB DEFAULT '[]'::jsonb,
    quantity NUMERIC DEFAULT 1,
    pdf_url TEXT,
    details_url TEXT NOT NULL,
    ai_summary TEXT,
    emd_amount NUMERIC,
    eligibility_msme BOOLEAN DEFAULT false,
    eligibility_mii BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMPTZ,
    notification_sent BOOLEAN DEFAULT false,
    ra_number TEXT DEFAULT NULL,        -- RA bid number (GEM/20xx/R/xxx) if this bid has an active Reverse Auction
    ra_end_date TIMESTAMPTZ DEFAULT NULL, -- RA closing deadline
    ra_notified BOOLEAN DEFAULT false,  -- whether RA-specific notification has been sent
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for search
CREATE INDEX idx_tenders_slug ON tenders(slug);
CREATE INDEX idx_tenders_bid_number ON tenders(bid_number);
CREATE INDEX idx_tenders_end_date ON tenders(end_date);
CREATE INDEX idx_tenders_archived_at ON tenders(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_tenders_state ON tenders(state);
CREATE INDEX idx_tenders_city ON tenders(city);

-- Create the saved_searches table
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- References auth.users(id)
    name TEXT NOT NULL,
    query_params JSONB NOT NULL,
    is_alert_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for saved searches
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);

-- Create the saved_tenders table
CREATE TABLE saved_tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tender_id)
);

-- Indexing for saved tenders
CREATE INDEX idx_saved_tenders_user_id ON saved_tenders(user_id);

-- Create the profiles table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    membership_plan TEXT DEFAULT 'free', -- 'free', 'starter', 'pro'
    subscription_status TEXT DEFAULT 'active',
    phone_number TEXT,
    keywords TEXT[],    -- For personalized alerts
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for profiles
CREATE INDEX idx_profiles_membership_plan ON profiles(membership_plan);

-- Create a trigger to automatically create a profile when a user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (new.id, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on core tables
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_tenders ENABLE ROW LEVEL SECURITY;

-- 1. Tenders Policy: Anyone can read, but only service role key (scraper) can modify.
CREATE POLICY "Allow public read access to tenders"
ON public.tenders 
FOR SELECT 
TO public 
USING (true);
-- (No INSERT/UPDATE/DELETE policies means these actions are completely restricted to bypassers like the Service Role key)

-- 2. Profiles Policy: Users can only read and update their own profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 3. Saved Searches Policy: Only authenticated users can manage their own queries
CREATE POLICY "Users can manage their own saved searches"
ON public.saved_searches
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Bookmarks (Saved Tenders) Policy: Authenticated user CRUD
CREATE POLICY "Users can manage their own bookmarked tenders"
ON public.saved_tenders
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- MIGRATIONS (run these on existing DB)
-- ==========================================
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ra_number TEXT DEFAULT NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ra_end_date TIMESTAMPTZ DEFAULT NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS ra_notified BOOLEAN DEFAULT false;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS enrichment_tried_at TIMESTAMPTZ DEFAULT NULL;
-- CREATE INDEX IF NOT EXISTS idx_tenders_enrichment_tried_at ON tenders(enrichment_tried_at) WHERE enrichment_tried_at IS NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS bid_type TEXT DEFAULT NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS procurement_type TEXT DEFAULT NULL;
-- ALTER TABLE tenders ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
-- CREATE INDEX IF NOT EXISTS idx_tenders_category ON tenders(category);
-- CREATE INDEX IF NOT EXISTS idx_tenders_bid_type ON tenders(bid_type);
