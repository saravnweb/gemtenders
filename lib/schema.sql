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
