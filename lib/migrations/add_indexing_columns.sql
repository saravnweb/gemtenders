-- Add indexing columns to the tenders table
ALTER TABLE tenders 
ADD COLUMN IF NOT EXISTS is_indexed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL;

-- Create an index to speed up lookups for unindexed tenders
CREATE INDEX IF NOT EXISTS idx_tenders_is_indexed ON tenders(is_indexed) WHERE is_indexed = FALSE;
