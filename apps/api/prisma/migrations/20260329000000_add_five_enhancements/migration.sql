-- Enhancement 1: Add user-level quote request listing (no new table needed,
-- but we add a status_note column for tracking status updates)
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "status_note" TEXT;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "carrier_name" TEXT;

-- Enhancement 2: Property Activity Log
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'VIEWING', 'QUOTE_SENT', 'FOLLOW_UP', 'STATUS_CHANGE');

CREATE TABLE "property_activity_log" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "clientId" TEXT,
  "activityType" "ActivityType" NOT NULL DEFAULT 'NOTE',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "property_activity_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "property_activity_log_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "property_activity_log_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "property_activity_log_userId_createdAt_idx" ON "property_activity_log"("userId", "createdAt" DESC);
CREATE INDEX "property_activity_log_propertyId_createdAt_idx" ON "property_activity_log"("propertyId", "createdAt" DESC);
CREATE INDEX "property_activity_log_clientId_idx" ON "property_activity_log"("clientId");

-- Enhancement 3: Client Property Recommendations
CREATE TYPE "RecommendationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'VIEWED', 'INTERESTED', 'NOT_INTERESTED', 'QUOTE_REQUESTED');

CREATE TABLE "client_property_recommendations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "agentId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "priority" "RecommendationPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "client_property_recommendations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_property_recommendations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_property_recommendations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "client_property_recommendations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "client_property_recommendations_clientId_propertyId_key" ON "client_property_recommendations"("clientId", "propertyId");
CREATE INDEX "client_property_recommendations_agentId_idx" ON "client_property_recommendations"("agentId");
CREATE INDEX "client_property_recommendations_clientId_status_idx" ON "client_property_recommendations"("clientId", "status");

-- Enhancement 4: Property Comparison History
CREATE TABLE "saved_comparisons" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "propertyIds" TEXT[] NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_comparisons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_comparisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "saved_comparisons_userId_createdAt_idx" ON "saved_comparisons"("userId", "createdAt" DESC);

-- Enhancement 5: Risk Watchlist with Change Tracking
CREATE TABLE "risk_watchlist" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "lastKnownOverallScore" INT,
  "lastKnownFloodScore" INT,
  "lastKnownFireScore" INT,
  "lastKnownWindScore" INT,
  "lastKnownEarthquakeScore" INT,
  "lastKnownCrimeScore" INT,
  "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMPTZ(3),

  CONSTRAINT "risk_watchlist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_watchlist_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "risk_watchlist_userId_propertyId_key" ON "risk_watchlist"("userId", "propertyId");
CREATE INDEX "risk_watchlist_userId_addedAt_idx" ON "risk_watchlist"("userId", "addedAt" DESC);

CREATE TABLE "risk_change_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "watchlistId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "riskDimension" TEXT NOT NULL,
  "previousScore" INT NOT NULL,
  "newScore" INT NOT NULL,
  "previousLevel" "RiskLevel" NOT NULL,
  "newLevel" "RiskLevel" NOT NULL,
  "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_change_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "risk_change_events_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "risk_watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_change_events_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "risk_change_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "risk_change_events_userId_detectedAt_idx" ON "risk_change_events"("userId", "detectedAt" DESC);
CREATE INDEX "risk_change_events_propertyId_idx" ON "risk_change_events"("propertyId");

-- RLS policies
ALTER TABLE "property_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_property_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_comparisons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_watchlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "risk_change_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activity log" ON "property_activity_log"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Agents can manage own recommendations" ON "client_property_recommendations"
  FOR ALL USING (auth.uid()::text = "agentId");

CREATE POLICY "Users can manage own comparisons" ON "saved_comparisons"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own watchlist" ON "risk_watchlist"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "Users can view own risk change events" ON "risk_change_events"
  FOR ALL USING (auth.uid()::text = "userId");
