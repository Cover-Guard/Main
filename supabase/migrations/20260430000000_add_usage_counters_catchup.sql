-- Catch-up migration for usage_counters.
--
-- The original migration file `20260428000000_add_usage_counters.sql` has a
-- timestamp earlier than the most recent applied migration on production
-- (`20260429190118 user_activity_tracking_spine`). Sequential migration
-- runners therefore skip it on subsequent applies, so production is missing:
--   - public.usage_counters table
--   - public.enforce_free_usage_limit(text, text, integer) function
--
-- Effect: every call to POST /api/advisor/chat by a free-tier user hits
-- enforceFreeUsageLimit -> supabaseAdmin.rpc('enforce_free_usage_limit') ->
-- Postgres returns 42883 ("function ... does not exist") -> the middleware
-- maps the non-P0001 error to a 500 USAGE_CHECK_FAILED.
--
-- This migration uses a fresh timestamp so it WILL run on the next deploy,
-- and is fully idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS) so it is safe to apply where the original already ran.
--
-- Free-tier limits (see apps/web/src/lib/plans.ts):
--   property_search   → 1 lifetime
--   ai_interaction    → 5 lifetime

-- 1. Counter table — one row per (user, capability), upserted lazily on first use.
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "userId"     TEXT        NOT NULL,
  "capability" TEXT        NOT NULL,
  "count"      INTEGER     NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("userId", "capability"),
  CONSTRAINT "usage_counters_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "usage_counters_capability_check"
    CHECK ("capability" IN ('property_search', 'ai_interaction'))
);

CREATE INDEX IF NOT EXISTS "usage_counters_userId_idx"
  ON "usage_counters" ("userId");

-- 2. RLS — users can read their own usage; only service-role can write.
ALTER TABLE "usage_counters" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_counters_select_own" ON "usage_counters";
CREATE POLICY "usage_counters_select_own"
  ON "usage_counters"
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- No INSERT/UPDATE/DELETE policies — these are intentional. Counter writes
-- happen via the API server (service-role key) inside enforce_free_usage_limit
-- so that the increment is authoritative and not bypassable from the client.

-- 3. RPC — atomic check-and-increment. Returns the post-increment count when
--    allowed, or raises an exception (caught by the API as 402 PAYMENT_REQUIRED)
--    when the user is on the free plan and would exceed the cap.
CREATE OR REPLACE FUNCTION "enforce_free_usage_limit"(
  p_user_id    TEXT,
  p_capability TEXT,
  p_limit      INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  IF p_capability NOT IN ('property_search', 'ai_interaction') THEN
    RAISE EXCEPTION 'invalid capability: %', p_capability USING ERRCODE = '22023';
  END IF;

  -- Atomically increment. If we'd exceed the limit, roll back via RAISE.
  INSERT INTO "usage_counters" AS uc ("userId", "capability", "count", "updatedAt")
  VALUES (p_user_id, p_capability, 1, now())
  ON CONFLICT ("userId", "capability") DO UPDATE
    SET "count"     = uc."count" + 1,
        "updatedAt" = now()
  RETURNING "count" INTO v_new_count;

  IF v_new_count > p_limit THEN
    -- Roll back the increment we just made.
    UPDATE "usage_counters"
       SET "count" = "count" - 1
     WHERE "userId" = p_user_id AND "capability" = p_capability;

    RAISE EXCEPTION 'free tier limit exceeded for %', p_capability
      USING ERRCODE = 'P0001',
            HINT   = 'upgrade required';
  END IF;

  RETURN v_new_count;
END;
$$;

-- Allow the API (service-role) to invoke. The function is SECURITY DEFINER, so
-- the userId / capability / limit are passed by the caller — the API is
-- expected to call this with the authenticated user's id from the request
-- context.
GRANT EXECUTE ON FUNCTION "enforce_free_usage_limit"(TEXT, TEXT, INTEGER) TO service_role;
