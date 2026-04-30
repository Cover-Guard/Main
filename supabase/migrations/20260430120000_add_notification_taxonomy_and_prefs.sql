-- Notifications: taxonomy, mute, and preferences (PR 1 / Phase 1 foundations)
--
-- Goal: give the existing `notifications` table the structure it needs to
-- support a real product surface — categorised, prioritised, mutable, and
-- governed by per-user preferences — without breaking any existing writer.
--
-- Everything here is additive and backward compatible:
--   * New columns on `notifications` all have safe defaults.
--   * New `NotificationType` enum values are added; existing values untouched.
--   * Two new tables (`notification_preferences`, `notification_mutes`) with
--     RLS policies that mirror the pattern used by `deals` and `notifications`.
--
-- No trigger / writer changes are made in this migration. Those land in PR 2
-- (`feat(notifications): set category and severity at write time`).

BEGIN;

-- 1. Extend NotificationType enum -----------------------------------------
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INSIGHT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BILLING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LIFECYCLE';

-- 2. NotificationSeverity + NotificationCategory enums --------------------
DO $$ BEGIN
  CREATE TYPE "NotificationSeverity" AS ENUM ('info','actionable','urgent','blocking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationCategory" AS ENUM ('transactional','collaborative','insight','system','lifecycle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Extend `notifications` with new columns ------------------------------
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "severity"    "NotificationSeverity" NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "category"    "NotificationCategory" NOT NULL DEFAULT 'collaborative',
  ADD COLUMN IF NOT EXISTS "entityType"  TEXT,
  ADD COLUMN IF NOT EXISTS "entityId"    TEXT,
  ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "notifications_userId_actionable_idx"
  ON "notifications" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL
    AND "dismissedAt" IS NULL
    AND "severity" IN ('actionable','urgent','blocking');

CREATE INDEX IF NOT EXISTS "notifications_userId_category_createdAt_idx"
  ON "notifications" ("userId", "category", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "notifications_entity_idx"
  ON "notifications" ("entityType", "entityId")
  WHERE "entityType" IS NOT NULL AND "entityId" IS NOT NULL;

-- 4. notification_preferences ---------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "userId"          TEXT        NOT NULL,
  "channels"        JSONB       NOT NULL DEFAULT '{
    "transactional":  {"inApp": true,  "email": false, "push": false},
    "collaborative":  {"inApp": true,  "email": true,  "push": true},
    "insight":        {"inApp": true,  "email": true,  "push": false},
    "system":         {"inApp": true,  "email": true,  "push": true},
    "lifecycle":      {"inApp": true,  "email": true,  "push": false}
  }'::jsonb,
  "digestEnabled"   BOOLEAN     NOT NULL DEFAULT true,
  "digestHourLocal" SMALLINT    NOT NULL DEFAULT 9 CHECK ("digestHourLocal" BETWEEN 0 AND 23),
  "quietHoursStart" SMALLINT    CHECK ("quietHoursStart" IS NULL OR "quietHoursStart" BETWEEN 0 AND 23),
  "quietHoursEnd"   SMALLINT    CHECK ("quietHoursEnd"   IS NULL OR "quietHoursEnd"   BETWEEN 0 AND 23),
  "timezone"        TEXT        NOT NULL DEFAULT 'UTC',
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "notification_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. notification_mutes ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_mutes" (
  "id"          TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "userId"      TEXT        NOT NULL,
  "entityType"  TEXT        NOT NULL,
  "entityId"    TEXT        NOT NULL,
  "expiresAt"   TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notification_mutes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_mutes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_mutes_unique"
    UNIQUE ("userId","entityType","entityId")
);

CREATE INDEX IF NOT EXISTS "notification_mutes_userId_idx"
  ON "notification_mutes" ("userId");

CREATE INDEX IF NOT EXISTS "notification_mutes_entity_idx"
  ON "notification_mutes" ("entityType","entityId");

-- 6. updatedAt trigger for notification_preferences -----------------------
CREATE OR REPLACE FUNCTION touch_notification_preferences_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON "notification_preferences";
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON "notification_preferences"
FOR EACH ROW EXECUTE FUNCTION touch_notification_preferences_updated_at();

-- 7. RLS — mirrors the existing notifications policy pattern ------------
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "np: own select" ON "notification_preferences";
CREATE POLICY "np: own select" ON "notification_preferences"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "np: own insert" ON "notification_preferences";
CREATE POLICY "np: own insert" ON "notification_preferences"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "np: own update" ON "notification_preferences";
CREATE POLICY "np: own update" ON "notification_preferences"
  FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");

ALTER TABLE "notification_mutes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nm: own select" ON "notification_mutes";
CREATE POLICY "nm: own select" ON "notification_mutes"
  FOR SELECT USING (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "nm: own insert" ON "notification_mutes";
CREATE POLICY "nm: own insert" ON "notification_mutes"
  FOR INSERT WITH CHECK (auth.uid()::text = "userId");
DROP POLICY IF EXISTS "nm: own delete" ON "notification_mutes";
CREATE POLICY "nm: own delete" ON "notification_mutes"
  FOR DELETE USING (auth.uid()::text = "userId");

COMMIT;
