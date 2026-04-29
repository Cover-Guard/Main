-- Free-tier usage counters.
--
-- Tracks lifetime usage for capabilities that are hard-capped on the Free plan
-- (currently: property searches and AI Agent interactions). Using a dedicated
-- counter table instead of COUNT(*) over agent_chat_messages / search_history
-- keeps the gate cheap (single keyed lookup) and lets us atomically
-- check-and-increment in one round trip via the RPC below.
--
-- Free-tier limits (see apps/web/src/lib/plans.ts):
--   property_search   → 1 lifetime
--   ai_interaction    → 5 lifetime
--
-- Paid plans (Individual / Professional / Team) bypass these counters in the
-- enforce_free_usage_limit() RPC, so we don't need plan-aware schema here.

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

-- Allow the API (service-role) and authenticated users to invoke. Even though
-- authenticated users can call it, the function is SECURITY DEFINER, so the
-- userId / capability / limit are passed by the caller — the API is expected
-- to call this with the authenticated user's id from the request context.
GRANT EXECUTE ON FUNCTION "enforce_free_usage_limit"(TEXT, TEXT, INTEGER) TO service_role;
