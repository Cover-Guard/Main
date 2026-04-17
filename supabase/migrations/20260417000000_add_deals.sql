-- Deals
-- Tracks pipeline deals for agents/lenders/users. When a deal closes lost
-- (FELL_OUT), `falloutReason` records the cause so we can analyze pipeline
-- leakage and surface it on the dashboard.

CREATE TYPE "DealStage" AS ENUM (
  'PROSPECT',
  'IN_PROGRESS',
  'UNDER_CONTRACT',
  'CLOSED_WON',
  'FELL_OUT'
);

CREATE TYPE "DealFalloutReason" AS ENUM (
  'INSURABILITY',
  'PRICING_TOO_HIGH',
  'CARRIER_DECLINED',
  'CLIENT_BACKED_OUT',
  'INSPECTION_ISSUES',
  'FINANCING_FELL_THROUGH',
  'APPRAISAL_LOW',
  'TITLE_ISSUES',
  'COMPETING_OFFER',
  'PROPERTY_CONDITION',
  'OTHER'
);

CREATE TABLE "deals" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "propertyId"    TEXT,
  "clientId"      TEXT,
  "title"         TEXT NOT NULL,
  "stage"         "DealStage" NOT NULL DEFAULT 'PROSPECT',
  "dealValue"     INTEGER,
  "carrierName"   TEXT,
  "falloutReason" "DealFalloutReason",
  "falloutNotes"  TEXT,
  "notes"         TEXT,
  "openedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"      TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "deals"
  ADD CONSTRAINT "deals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes (mirror the patterns used by the existing tables)
CREATE INDEX "deals_userId_stage_idx" ON "deals" ("userId", "stage");
CREATE INDEX "deals_userId_closedAt_idx" ON "deals" ("userId", "closedAt" DESC);
CREATE INDEX "deals_userId_createdAt_idx" ON "deals" ("userId", "createdAt" DESC);
CREATE INDEX "deals_propertyId_idx" ON "deals" ("propertyId");
CREATE INDEX "deals_clientId_idx" ON "deals" ("clientId");
CREATE INDEX "deals_falloutReason_idx" ON "deals" ("falloutReason");

-- Row-level security: a deal is readable / writable only by its owner.
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals: select own" ON "deals" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "deals: insert own" ON "deals" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "deals: update own" ON "deals" FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "deals: delete own" ON "deals" FOR DELETE USING (auth.uid()::text = "userId");
