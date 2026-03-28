-- Add optional client association to saved_properties so agents can
-- save properties on behalf of specific clients.

ALTER TABLE saved_properties
  ADD COLUMN "clientId" TEXT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX idx_saved_properties_client_id ON saved_properties ("clientId");
