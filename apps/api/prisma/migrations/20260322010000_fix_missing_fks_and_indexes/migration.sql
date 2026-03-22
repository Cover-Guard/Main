-- ─── FK constraints missing from initial migration ───────────────────────────

-- quote_requests: userId → users (cascade delete)
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quote_requests: propertyId → properties (cascade delete)
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- search_history: userId → users (set null on delete — supports anonymous rows)
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Missing indexes on properties ────────────────────────────────────────────

CREATE INDEX "properties_state_idx" ON "properties"("state");
CREATE INDEX "properties_createdAt_idx" ON "properties"("createdAt");

-- ─── Missing indexes on risk_profiles ─────────────────────────────────────────

CREATE INDEX "risk_profiles_expiresAt_idx" ON "risk_profiles"("expiresAt");
CREATE INDEX "risk_profiles_overallRiskLevel_idx" ON "risk_profiles"("overallRiskLevel");

-- ─── Missing indexes on insurance_estimates ────────────────────────────────────

CREATE INDEX "insurance_estimates_expiresAt_idx" ON "insurance_estimates"("expiresAt");

-- ─── Missing indexes on saved_properties ──────────────────────────────────────

CREATE INDEX "saved_properties_userId_savedAt_idx" ON "saved_properties"("userId", "savedAt" DESC);
CREATE INDEX "saved_properties_propertyId_idx" ON "saved_properties"("propertyId");

-- ─── Missing indexes on property_reports ──────────────────────────────────────

CREATE INDEX "property_reports_userId_generatedAt_idx" ON "property_reports"("userId", "generatedAt" DESC);
CREATE INDEX "property_reports_propertyId_idx" ON "property_reports"("propertyId");

-- ─── Upgrade quote_requests indexes: single-column → composite ────────────────

DROP INDEX "quote_requests_userId_idx";
DROP INDEX "quote_requests_propertyId_idx";

CREATE INDEX "quote_requests_userId_submittedAt_idx" ON "quote_requests"("userId", "submittedAt" DESC);
CREATE INDEX "quote_requests_propertyId_submittedAt_idx" ON "quote_requests"("propertyId", "submittedAt" DESC);
CREATE INDEX "quote_requests_status_idx" ON "quote_requests"("status");

-- ─── Upgrade search_history indexes: single-column → composite + sorted ───────

DROP INDEX "search_history_userId_idx";

CREATE INDEX "search_history_userId_searchedAt_idx" ON "search_history"("userId", "searchedAt" DESC);
CREATE INDEX "search_history_searchedAt_idx" ON "search_history"("searchedAt" DESC);
