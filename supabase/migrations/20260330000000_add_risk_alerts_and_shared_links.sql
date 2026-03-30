-- Migration: Add risk alerts and shared property links tables
-- Features: Property Risk Alerts (Enhancement 3) + Agent Client Property Sharing (Enhancement 4)

-- ─── Risk Alerts ─────────────────────────────────────────────────────────────
-- Tracks risk profile changes for saved properties and notifies users.

CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('RISK_INCREASED', 'RISK_DECREASED', 'NEW_RISK_FACTOR', 'ZONE_CHANGE')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  previous_risk_level TEXT,
  new_risk_level TEXT,
  risk_category TEXT CHECK (risk_category IN ('OVERALL', 'FLOOD', 'FIRE', 'WIND', 'EARTHQUAKE', 'CRIME')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_alerts_user_created ON risk_alerts (user_id, created_at DESC);
CREATE INDEX idx_risk_alerts_user_unread ON risk_alerts (user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_risk_alerts_property ON risk_alerts (property_id);

-- RLS for risk_alerts
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own risk alerts"
  ON risk_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own risk alerts"
  ON risk_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Shared Property Links ──────────────────────────────────────────────────
-- Agents can generate shareable links for clients to view property reports.

CREATE TABLE IF NOT EXISTS shared_property_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  access_token TEXT NOT NULL UNIQUE,
  include_risk BOOLEAN NOT NULL DEFAULT true,
  include_insurance BOOLEAN NOT NULL DEFAULT true,
  include_carriers BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  max_views INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_links_token ON shared_property_links (access_token) WHERE is_active = true;
CREATE INDEX idx_shared_links_agent ON shared_property_links (agent_id, created_at DESC);
CREATE INDEX idx_shared_links_property ON shared_property_links (property_id);

-- RLS for shared_property_links
ALTER TABLE shared_property_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can manage own shared links"
  ON shared_property_links FOR ALL
  USING (auth.uid() = agent_id);

-- Public read access via access_token is handled by the API (not RLS)
-- since the viewer won't be authenticated.

-- ─── Add risk_alert_preferences to users ────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_alert_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_alert_threshold TEXT NOT NULL DEFAULT 'MODERATE'
  CHECK (risk_alert_threshold IN ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'));
