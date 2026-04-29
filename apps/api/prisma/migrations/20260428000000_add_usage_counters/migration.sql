-- Mirror of supabase/migrations/20260428000000_add_usage_counters.sql so Prisma
-- migrate stays in sync with the live schema. The Supabase migration is the
-- canonical one (RLS + RPC live there); Prisma owns the table for type
-- generation only.

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
