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
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing for search
CREATE INDEX idx_tenders_slug ON tenders(slug);
CREATE INDEX idx_tenders_bid_number ON tenders(bid_number);
CREATE INDEX idx_tenders_end_date ON tenders(end_date);
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
