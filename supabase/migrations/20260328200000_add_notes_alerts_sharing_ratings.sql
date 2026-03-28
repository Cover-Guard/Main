-- Migration: Add Property Notes, Risk Alerts, Shared Reports, and Rating/Priority
-- Features: notes timeline, risk alerts, agent sharing, lender portfolio, property ratings

-- ─── 1. Property Notes Timeline ─────────────────────────────────────────────
-- Allows all users to log multiple timestamped notes per property.

CREATE TABLE IF NOT EXISTS property_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) <= 2000),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_notes_user_property ON property_notes ("userId", "propertyId", "createdAt" DESC);
CREATE INDEX idx_property_notes_property ON property_notes ("propertyId");

ALTER TABLE property_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own property notes"
  ON property_notes FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can insert own property notes"
  ON property_notes FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own property notes"
  ON property_notes FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete own property notes"
  ON property_notes FOR DELETE
  USING (auth.uid() = "userId");

-- Auto-update updatedAt trigger
CREATE TRIGGER set_property_notes_updated_at
  BEFORE UPDATE ON property_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. Risk Alerts ─────────────────────────────────────────────────────────
-- Users subscribe to risk-change notifications for specific properties.

CREATE TYPE alert_frequency AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY');

CREATE TABLE IF NOT EXISTS risk_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "propertyId"  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  frequency     alert_frequency NOT NULL DEFAULT 'WEEKLY',
  "riskTypes"   TEXT[] NOT NULL DEFAULT ARRAY['FLOOD','FIRE','WIND','EARTHQUAKE','CRIME']::TEXT[],
  "lastNotifiedAt" TIMESTAMPTZ,
  "lastRiskScore"  INT,  -- snapshot of overall risk score at last notification
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", "propertyId")
);

CREATE INDEX idx_risk_alerts_user ON risk_alerts ("userId", "createdAt" DESC);
CREATE INDEX idx_risk_alerts_property ON risk_alerts ("propertyId");
CREATE INDEX idx_risk_alerts_enabled ON risk_alerts (enabled) WHERE enabled = true;

ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk alerts"
  ON risk_alerts FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "Users can insert own risk alerts"
  ON risk_alerts FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can update own risk alerts"
  ON risk_alerts FOR UPDATE
  USING (auth.uid() = "userId");

CREATE POLICY "Users can delete own risk alerts"
  ON risk_alerts FOR DELETE
  USING (auth.uid() = "userId");

CREATE TRIGGER set_risk_alerts_updated_at
  BEFORE UPDATE ON risk_alerts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 3. Shared Reports (Agent → Client sharing) ─────────────────────────────
-- Agents can generate shareable links for property reports.

CREATE TABLE IF NOT EXISTS shared_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agentId"     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "propertyId"  UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "clientId"    UUID REFERENCES clients(id) ON DELETE SET NULL,
  "shareToken"  TEXT NOT NULL UNIQUE,  -- URL-safe token for public access
  "recipientEmail" TEXT,
  "recipientName"  TEXT,
  message       TEXT CHECK (char_length(message) <= 1000),
  "includeRisk"       BOOLEAN NOT NULL DEFAULT true,
  "includeInsurance"  BOOLEAN NOT NULL DEFAULT true,
  "includeCarriers"   BOOLEAN NOT NULL DEFAULT true,
  "viewCount"   INT NOT NULL DEFAULT 0,
  "expiresAt"   TIMESTAMPTZ,  -- NULL = never expires
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_reports_agent ON shared_reports ("agentId", "createdAt" DESC);
CREATE INDEX idx_shared_reports_token ON shared_reports ("shareToken");
CREATE INDEX idx_shared_reports_property ON shared_reports ("propertyId");

ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own shared reports"
  ON shared_reports FOR SELECT
  USING (auth.uid() = "agentId");

CREATE POLICY "Agents can insert own shared reports"
  ON shared_reports FOR INSERT
  WITH CHECK (auth.uid() = "agentId");

CREATE POLICY "Agents can delete own shared reports"
  ON shared_reports FOR DELETE
  USING (auth.uid() = "agentId");

-- ─── 4. Rating & Priority on Saved Properties ───────────────────────────────
-- Add star rating (1-5) and priority level to saved_properties.

ALTER TABLE saved_properties
  ADD COLUMN IF NOT EXISTS rating    SMALLINT CHECK (rating >= 1 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS priority  TEXT CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')) DEFAULT NULL;
