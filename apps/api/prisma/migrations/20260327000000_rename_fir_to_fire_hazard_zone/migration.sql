-- Rename the typo column "firHazardZone" → "fireHazardZone" in risk_profiles.
-- Conditional: only renames when the old column exists (no-op on fresh databases
-- where the init migration already creates "fireHazardZone").

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'risk_profiles'
          AND column_name = 'firHazardZone'
    ) THEN
        ALTER TABLE "risk_profiles" RENAME COLUMN "firHazardZone" TO "fireHazardZone";
    END IF;
END $$;
