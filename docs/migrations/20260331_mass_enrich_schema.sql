-- Migration: Mass Enrichment Schema Expansion
-- Adds columns to the 'tenders' table to store detailed SOLR-captured fields.
-- Run this in your Supabase SQL Editor.

ALTER TABLE tenders ADD COLUMN IF NOT EXISTS estimated_value      NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS epbg_percentage      NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS min_turnover_lakhs   NUMERIC;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_high_value        BOOLEAN DEFAULT FALSE;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_single_packet     BOOLEAN;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS is_bunch             BOOLEAN;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS pre_bid_date         TIMESTAMPTZ;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS delivery_days        INTEGER;

COMMENT ON COLUMN tenders.estimated_value IS 'Estimated Bid Value in Rs from SOLR/AI';
COMMENT ON COLUMN tenders.is_single_packet IS 'True if the bid is single-packet, from SOLR ba_is_single_packet';
COMMENT ON COLUMN tenders.is_high_value IS 'Flag from SOLR for high-value tenders';
