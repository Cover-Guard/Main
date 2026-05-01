-- Detector runs log (PR 9 / detector observability).
--
-- Goal: turn the insights worker from "fire and forget" into something we can
-- actually monitor â per-detector success rate, duration, last error, and
-- total insights produced over a window.
--
-- Schema choices:
--   â¢ One row per (detector, user) evaluation. The runner already iterates
--     this granularity, so emitting one row per result is essentially free.
--   â¢ A separate batch-level row (userId NULL) for end-of-worker summaries.
--   â¢ Indexed on (detectorName, startedAt DESC) so the ops view can pull
--     "recent runs by detector" cheaply.
--   â¢ Status is an enum to keep the column compact and to fail loudly on
--     misspellings at write time.
--
-- RLS: service role writes; admin users read. Regular users never see this
-- table â we don't want detector internals leaking through PostgREST.

BEGIN;

DO $$ BEGIN
  CREATE TYPE "DetectorRunStatus" AS ENUM ('success','error','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "detector_runs" (
  "id"             TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "detectorName"   TEXT        NOT NULL,
  -- Nullable because batch-level rows aren't tied to a user.
  "userId"         TEXT,
  "status"         "DetectorRunStatus" NOT NULL,
  "startedAt"      TIMESTAMPTZ NOT NULL,
  "finishedAt"     TIMESTAMPTZ NOT NULL,
  "durationMs"     INTEGER     NOT NULL,
  "emitted"        INTEGER     NOT NULL DEFAULT 0,
  "inserted"       INTEGER     NOT NULL DEFAULT 0,
  "skipped"        INTEGER     NOT NULL DEFAULT 0,
  "errorMessage"   TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "detector_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "detector_runs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Recent runs by detector: drives the ops view's "last 24h" query.
CREATE INDEX IF NOT EXISTS "detector_runs_name_started_idx"
  ON "detector_runs" ("detectorName", "startedAt" DESC);

-- Per-user lookup: drives "why didn't I get an insight" debugging.
CREATE INDEX IF NOT EXISTS "detector_runs_user_started_idx"
  ON "detector_runs" ("userId", "startedAt" DESC)
  WHERE "userId" IS NOT NULL;

-- Recent errors only: cheap partial index for the alert rollup.
CREATE INDEX IF NOT EXISTS "detector_runs_errors_idx"
  ON "detector_runs" ("detectorName", "startedAt" DESC)
  WHERE "status" = 'error';

-- âââ RLS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
ALTER TABLE "detector_runs" ENABLE ROW LEVEL SECURITY;

-- Read: only users flagged as admin in `users.metadata->>role = 'admin'`.
-- Service role bypasses RLS for writes.
DROP POLICY IF EXISTS "dr: admin select" ON "detector_runs";
CREATE POLICY "dr: admin select" ON "detector_runs"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "users" u
      WHERE u.id = auth.uid()::text
        AND (u.metadata->>'role') = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies â only the service role writes here.

COMMIT;
