-- Mirror of supabase/migrations/20260429000000_user_activity_tracking_spine.sql
-- so Prisma migrate stays in sync with the live schema. The Supabase migration
-- is the canonical one (triggers + RLS + the v_user_activity view live there);
-- Prisma owns the tables / enum for type generation only.
--
-- All statements use IF NOT EXISTS / DO blocks so this migration runs cleanly
-- on a database where the Supabase migration has already been applied.

-- ─── activity_event_type enum ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_event_type') THEN
    CREATE TYPE "activity_event_type" AS ENUM (
      'LOGIN','LOGOUT','SIGNUP',
      'PROFILE_UPDATED','CONSENT_ACCEPTED',
      'PROPERTY_VIEWED','PROPERTY_SAVED','PROPERTY_UNSAVED',
      'SEARCH_PERFORMED',
      'REPORT_GENERATED','REPORT_DOWNLOADED',
      'QUOTE_REQUESTED','QUOTE_STATUS_CHANGED',
      'CHECKLIST_CREATED','CHECKLIST_UPDATED',
      'AGENT_CHAT_SENT',
      'DIRECT_MESSAGE_SENT',
      'NOTIFICATION_READ',
      'SUBSCRIPTION_CHANGED',
      'ADMIN_ACTION'
    );
  END IF;
END $$;

-- ─── user_activity_events table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_activity_events" (
  "id"          UUID                  NOT NULL DEFAULT gen_random_uuid(),
  "userId"      TEXT                  NOT NULL,
  "eventType"   "activity_event_type" NOT NULL,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "metadata"    JSONB                 NOT NULL DEFAULT '{}',
  "ipAddress"   INET,
  "userAgent"   TEXT,
  "occurredAt"  TIMESTAMPTZ           NOT NULL DEFAULT now(),
  CONSTRAINT "user_activity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_activity_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_activity_events_userId_occurredAt_idx"
  ON "user_activity_events" ("userId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_events_eventType_occurredAt_idx"
  ON "user_activity_events" ("eventType", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "user_activity_events_entityType_entityId_idx"
  ON "user_activity_events" ("entityType", "entityId");

-- ─── property_checklists rename (idempotent) ─────────────────────────────────
-- Aligns the live DB columns with the camelCase fields already in
-- schema.prisma. Pre-existing drift surfaced by the user-activity audit.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'property_checklists'
      AND column_name  = 'user_id'
  ) THEN
    ALTER TABLE "property_checklists" RENAME COLUMN "user_id" TO "userId";
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'property_checklists'
      AND column_name  = 'property_id'
  ) THEN
    ALTER TABLE "property_checklists" RENAME COLUMN "property_id" TO "propertyId";
  END IF;
END $$;

-- ─── Indexes from the supabase migration (idempotent) ────────────────────────
CREATE INDEX IF NOT EXISTS "agent_chat_messages_userId_createdAt_idx"
  ON "agent_chat_messages" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_createdAt_idx"
  ON "direct_messages" ("senderId", "createdAt" DESC);

COMMENT ON TABLE "user_activity_events" IS
  'Append-only product-analytics activity log. Distinct from the regulatory hash-chained audit trail (packages/shared/src/utils/auditTrail.ts) which is for loan-file events only.';
