-- Rename the typo column "firHazardZone" → "fireHazardZone" in risk_profiles.

ALTER TABLE "risk_profiles" RENAME COLUMN "firHazardZone" TO "fireHazardZone";
