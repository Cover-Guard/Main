-- Property Report Checklists
-- Stores user-created checklists (inspection, new buyer, agent) per property

CREATE TYPE checklist_type AS ENUM ('INSPECTION', 'NEW_BUYER', 'AGENT');

CREATE TABLE property_checklists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  checklist_type checklist_type NOT NULL DEFAULT 'INSPECTION',
  title       TEXT NOT NULL,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_checklists_user ON property_checklists (user_id, updated_at DESC);
CREATE INDEX idx_property_checklists_property ON property_checklists (property_id);
CREATE UNIQUE INDEX idx_property_checklists_unique ON property_checklists (user_id, property_id, checklist_type);
