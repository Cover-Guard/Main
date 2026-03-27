-- Rename the typo column "firHazardZone" → "fireHazardZone" in risk_profiles.
-- Safe: ALTER TABLE ... RENAME COLUMN is a metadata-only operation (no table rewrite).

ALTER TABLE "risk_profiles" RENAME COLUMN "firHazardZone" TO "fireHazardZone";
