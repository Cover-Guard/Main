-- Rename the typo column "firHazardZone" → "fireHazardZone" in risk_profiles.
-- Safe on fresh databases: if the init migration already created "fireHazardZone",
-- the EXCEPTION handler swallows the undefined_column error silently.

DO $$
BEGIN
  ALTER TABLE "risk_profiles" RENAME COLUMN "firHazardZone" TO "fireHazardZone";
EXCEPTION
  WHEN undefined_column THEN
    -- Column "firHazardZone" does not exist (e.g. fresh init already uses "fireHazardZone"); no-op.
    NULL;
END;
$$;
