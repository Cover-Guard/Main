-- =============================================================
-- Migration: Add WalkScore columns to risk_profiles
-- Status: ALREADY APPLIED to Supabase project vxrckdzbwhufghadfnsc
--
-- This file is included for documentation and version control.
-- Do NOT run again — the columns already exist.
-- =============================================================

ALTER TABLE risk_profiles
  ADD COLUMN IF NOT EXISTS "walkScore" integer,
  ADD COLUMN IF NOT EXISTS "walkScoreDescription" text,
  ADD COLUMN IF NOT EXISTS "transitScore" integer,
  ADD COLUMN IF NOT EXISTS "transitScoreDescription" text,
  ADD COLUMN IF NOT EXISTS "bikeScore" integer,
  ADD COLUMN IF NOT EXISTS "bikeScoreDescription" text,
  ADD COLUMN IF NOT EXISTS "walkScoreFetchedAt" timestamp without time zone;

-- Partial index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_risk_profiles_walkscore_fetched
  ON risk_profiles ("propertyId", "walkScoreFetchedAt")
  WHERE "walkScoreFetchedAt" IS NOT NULL;

COMMENT ON COLUMN risk_profiles."walkScore" IS 'Walk Score (0-100) from walkscore.com API';
COMMENT ON COLUMN risk_profiles."transitScore" IS 'Transit Score (0-100) from walkscore.com API';
COMMENT ON COLUMN risk_profiles."bikeScore" IS 'Bike Score (0-100) from walkscore.com API';
COMMENT ON COLUMN risk_profiles."walkScoreFetchedAt" IS 'Timestamp of last WalkScore API fetch (30-day cache TTL)';
