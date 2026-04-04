-- Optimized indexes for mass tender enrichment
-- These indexes accelerate queries that look for "unenriched" data.

-- 1. Index for ai_summary (Track 2: Deep AI enrichment)
CREATE INDEX IF NOT EXISTS idx_tenders_ai_summary_null 
ON tenders (id) 
WHERE ai_summary IS NULL;

-- 2. Index for enrichment_tried_at (Overall progress tracking)
CREATE INDEX IF NOT EXISTS idx_tenders_enrichment_tried_null 
ON tenders (id) 
WHERE enrichment_tried_at IS NULL;

-- 3. Index for missing city/state (Track 1: SOLR & Location repair)
CREATE INDEX IF NOT EXISTS idx_tenders_missing_location 
ON tenders (id) 
WHERE state IS NULL OR city IS NULL;

-- 4. Index for active tender filtering (Standard search/enrichment)
CREATE INDEX IF NOT EXISTS idx_tenders_end_date_active 
ON tenders (end_date DESC);

-- 5. Index for ordering by creation (Used in both scripts)
CREATE INDEX IF NOT EXISTS idx_tenders_created_at_desc 
ON tenders (created_at DESC);
