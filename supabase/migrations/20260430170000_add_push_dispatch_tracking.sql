-- Push dispatch tracking (PR 11).
--
-- Up to now, web push delivery was inline-only: the DM endpoint fanned out
-- to push subscriptions immediately after writing a notification. That
-- works for DMs but doesn't help insights, lifecycle events, or anything
-- created via triggers.
--
-- This migration adds:
--   1. `notifications.pushedAt` â dedupe column so a worker-driven
--      dispatcher can find "unpushed" notifications and won't double-fire
--      against the DM endpoint's existing inline push.
--   2. `push_subscriptions.lastUsedAt` + `failedAt` + `failureReason` â
--      cleanup heuristics. We delete on 404/410 (endpoint gone), but
--      transient failures should be tracked so we can retire flaky
--      subscriptions before they pile up retries.
--
-- Indexes are intentionally narrow: the dispatcher's "unpushed in last
-- 24h" query is the hot path; everything else is occasional debugging.

BEGIN;

-- âââ notifications.pushedAt ââââââââââââââââââââââââââââââââââââââââââââââ
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "pushedAt" TIMESTAMPTZ;

-- Partial index for the worker's "find unpushed" query. We only care about
-- the last 24h â older notifications shouldn't be pushed (their moment has
-- passed) and the worker explicitly filters them out.
CREATE INDEX IF NOT EXISTS "notifications_unpushed_idx"
  ON "notifications" ("createdAt" DESC)
  WHERE "pushedAt" IS NULL AND "dismissedAt" IS NULL;

-- âââ push_subscriptions hardening ââââââââââââââââââââââââââââââââââââââââ
ALTER TABLE "push_subscriptions"
  ADD COLUMN IF NOT EXISTS "lastUsedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "failedAt"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "failureReason"  TEXT,
  ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- Worker drops subscriptions where consecutiveFailures crosses a threshold
-- without needing an extra index â the user-id lookup is already indexed.

COMMIT;
