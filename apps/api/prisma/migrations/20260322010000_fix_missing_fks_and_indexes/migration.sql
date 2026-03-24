-- ─── FK constraints missing from initial migration ───────────────────────────

-- quote_requests: userId → users (cascade delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_userId_fkey'
  ) THEN
    ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- quote_requests: propertyId → properties (cascade delete)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_requests_propertyId_fkey'
  ) THEN
    ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- search_history: userId → users (set null on delete — supports anonymous rows)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'search_history_userId_fkey'
  ) THEN
    ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── Missing indexes on properties ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "properties_createdAt_idx" ON "properties"("createdAt");

-- ─── Missing indexes on risk_profiles ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "risk_profiles_expiresAt_idx" ON "risk_profiles"("expiresAt");
CREATE INDEX IF NOT EXISTS "risk_profiles_overallRiskLevel_idx" ON "risk_profiles"("overallRiskLevel");

-- ─── Missing indexes on insurance_estimates ────────────────────────────────────

CREATE INDEX IF NOT EXISTS "insurance_estimates_expiresAt_idx" ON "insurance_estimates"("expiresAt");

-- ─── Missing indexes on saved_properties ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS "saved_properties_userId_savedAt_idx" ON "saved_properties"("userId", "savedAt" DESC);
CREATE INDEX IF NOT EXISTS "saved_properties_propertyId_idx" ON "saved_properties"("propertyId");

-- ─── Missing indexes on property_reports ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS "property_reports_userId_generatedAt_idx" ON "property_reports"("userId", "generatedAt" DESC);
CREATE INDEX IF NOT EXISTS "property_reports_propertyId_idx" ON "property_reports"("propertyId");

-- ─── Upgrade quote_requests indexes: single-column → composite ────────────────

DROP INDEX IF EXISTS "quote_requests_userId_idx";
DROP INDEX IF EXISTS "quote_requests_propertyId_idx";

CREATE INDEX IF NOT EXISTS "quote_requests_userId_submittedAt_idx" ON "quote_requests"("userId", "submittedAt" DESC);
CREATE INDEX IF NOT EXISTS "quote_requests_propertyId_submittedAt_idx" ON "quote_requests"("propertyId", "submittedAt" DESC);
CREATE INDEX IF NOT EXISTS "quote_requests_status_idx" ON "quote_requests"("status");

-- ─── Upgrade search_history indexes: single-column → composite + sorted ───────

DROP INDEX IF EXISTS "search_history_userId_idx";

CREATE INDEX IF NOT EXISTS "search_history_userId_searchedAt_idx" ON "search_history"("userId", "searchedAt" DESC);
CREATE INDEX IF NOT EXISTS "search_history_searchedAt_idx" ON "search_history"("searchedAt" DESC);
