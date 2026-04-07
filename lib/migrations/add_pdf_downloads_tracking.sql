-- Create table to track PDF downloads for daily limit enforcement
CREATE TABLE IF NOT EXISTS pdf_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tender_id)  -- Prevent duplicate counts for same user+tender combo
);

-- Index for efficient querying of today's downloads
CREATE INDEX IF NOT EXISTS idx_pdf_downloads_user_downloaded_at 
ON pdf_downloads(user_id, downloaded_at);

-- Index for tender lookups
CREATE INDEX IF NOT EXISTS idx_pdf_downloads_tender_id ON pdf_downloads(tender_id);
