-- Create table to track bid number reveals for daily/monthly limit enforcement
CREATE TABLE IF NOT EXISTS bid_reveals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    revealed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tender_id)  -- Prevent duplicate counts for same user+tender combo
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_bid_reveals_user_revealed_at 
ON bid_reveals(user_id, revealed_at);

-- Index for tender lookups
CREATE INDEX IF NOT EXISTS idx_bid_reveals_tender_id ON bid_reveals(tender_id);
