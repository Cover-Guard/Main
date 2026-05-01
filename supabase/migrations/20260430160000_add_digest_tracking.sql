-- Digest send tracking (PR 10).
--
-- Adds `lastDigestSentAt` to `notification_preferences` so the digest worker
-- can dedupe sends. The worker runs every ~15 minutes (configurable per host)
-- and checks each user whose digest hour falls within the current cron window
-- in their timezone. Without this column, a worker that runs every 15 minutes
-- inside the user's "digest hour" would send 4 emails in an hour. With it, the
-- worker checks "have we already sent today?" and bails idempotently.
--
-- We also bump the touch trigger so updating just lastDigestSentAt doesn't
-- spuriously bump updatedAt â keeping updatedAt meaningful for "user changed
-- their preferences" auditing.

BEGIN;

ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "lastDigestSentAt" TIMESTAMPTZ;

-- Replace the touch trigger with one that ignores lastDigestSentAt-only writes,
-- so updatedAt stays a meaningful "user-driven last edit" timestamp.
CREATE OR REPLACE FUNCTION touch_notification_preferences_updated_at() RETURNS trigger AS $$
BEGIN
  -- If the only field changing is lastDigestSentAt, leave updatedAt alone.
  IF (
    NEW."channels" IS NOT DISTINCT FROM OLD."channels"
    AND NEW."digestEnabled" IS NOT DISTINCT FROM OLD."digestEnabled"
    AND NEW."digestHourLocal" IS NOT DISTINCT FROM OLD."digestHourLocal"
    AND NEW."quietHoursStart" IS NOT DISTINCT FROM OLD."quietHoursStart"
    AND NEW."quietHoursEnd" IS NOT DISTINCT FROM OLD."quietHoursEnd"
    AND NEW."timezone" IS NOT DISTINCT FROM OLD."timezone"
    AND NEW."lastDigestSentAt" IS DISTINCT FROM OLD."lastDigestSentAt"
  ) THEN
    RETURN NEW;
  END IF;
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Index supporting the digest worker's "users due now" query.
-- It scans by digestHourLocal, with a coarse filter on lastDigestSentAt.
CREATE INDEX IF NOT EXISTS "notification_preferences_digest_idx"
  ON "notification_preferences" ("digestHourLocal", "digestEnabled")
  WHERE "digestEnabled" = true;

COMMIT;
