# Notifications â operations

How to run, tune, and debug the notifications system in production.

## Cron schedule

Three cron-driven workers. Recommended cadences:

| Worker | Cadence | Why |
| --- | --- | --- |
| `pushWorker` | every 1-3 minutes | Latency-sensitive â users expect near-realtime push |
| `insightsWorker` | every 5-15 minutes | Detectors are read-heavy; this is a balance of freshness and DB load |
| `digestWorker` | every 15 minutes | Granularity needed to hit each user's `digestHourLocal` reliably |

Recommended Vercel `vercel.json` snippet:

```json
{
  "crons": [
    { "path": "/api/cron/push",    "schedule": "* * * * *" },
    { "path": "/api/cron/insights","schedule": "*/10 * * * *" },
    { "path": "/api/cron/digest",  "schedule": "*/15 * * * *" }
  ]
}
```

Recommended Railway / dedicated runner:

```bash
# Every minute â push worker
* * * * * cd /app && tsx apps/api/src/workers/pushWorker.ts

# Every 10 minutes â insights worker
*/10 * * * * cd /app && tsx apps/api/src/workers/insightsWorker.ts

# Every 15 minutes â digest worker
*/15 * * * * cd /app && tsx apps/api/src/workers/digestWorker.ts
```

Each worker is idempotent. Running them concurrently or with overlap is
safe â `pushedAt`, `lastDigestSentAt`, and the insight `dedupeKey` all
prevent double-fire.

## Environment variables

### Required

| Var | Purpose | Used by |
| --- | --- | --- |
| `SUPABASE_URL` | DB connection | all workers |
| `SUPABASE_SERVICE_ROLE_KEY` | DB connection (bypasses RLS) | all workers |
| `RESEND_API_KEY` | Email dispatch | digestWorker, DM endpoint |
| `VAPID_PUBLIC_KEY` | Web push | pushWorker, DM endpoint |
| `VAPID_PRIVATE_KEY` | Web push | pushWorker, DM endpoint |

### Recommended

| Var | Default | Purpose |
| --- | --- | --- |
| `APP_PUBLIC_URL` | `https://coverguard.io` | Used in deep links inside email + push |
| `RESEND_FROM_EMAIL` | `CoverGuard <notifications@coverguard.io>` | Email From header |
| `VAPID_SUBJECT` | `mailto:notifications@coverguard.io` | Required by VAPID spec |

### Worker tuning

| Var | Default | Purpose |
| --- | --- | --- |
| `INSIGHTS_WORKER_BATCH_SIZE` | 100 | Users per page |
| `INSIGHTS_WORKER_MAX_USERS` | 0 (unlimited) | Cap for canary rollouts |
| `DIGEST_WORKER_BATCH_SIZE` | 200 | Users per page |
| `DIGEST_WORKER_MAX_USERS` | 0 | Cap |
| `DIGEST_WORKER_DRY_RUN` | false | Build digests but don't send |
| `PUSH_WORKER_BATCH_SIZE` | 200 | Notifications per scan |
| `PUSH_WORKER_MAX_PER_USER` | 10 | Cap per user per run, prevents floods |
| `PUSH_WORKER_DRY_RUN` | false | Read everything, push nothing |
| `PUSH_WORKER_FAILURE_THRESHOLD` | 5 | Drop subscription after N consecutive non-410 fails |

## Health checks

The PR 9 ops endpoints surface worker health. Hit them with an admin
session:

```
GET /api/internal/detector-runs/summary
```

Returns last 24h rollup per detector (and per worker via the `__digest__`
/ `__push__` / `__batch__` synthetic names): success rate, average
duration, last error, totals.

```
GET /api/internal/detector-runs?detector=dealStuckDetector&limit=50
```

Drills into a specific detector or worker.

### Suggested alerts

Wire whichever monitoring stack you use (Datadog, Grafana, etc.) to:

1. **Last batch run age**: alert if no `__batch__` row inserted in the
   last 30 minutes â means insights worker has stopped.
2. **Push failure rate**: alert if `__push__` summary's `errors` field
   exceeds 5% of `emitted` for two consecutive runs.
3. **Detector error rate**: per detector, alert if success rate < 95%
   over the last 24h. Use the `summary` endpoint output.

## Debugging "user didn't get notified"

A reproducible debugging path through the system, in priority order:

1. **Did the writer fire?** Check `notifications` for a row matching
   `(userId, entityType?, entityId?, createdAt)`. If missing, the writer
   never ran â look upstream.

2. **Was it muted?** Query `notification_mutes` for the entity. The PR 5
   trigger silently drops inserts on active mutes.

3. **Channel preference?** Check `notification_preferences.channels` for
   the user. Note that **severity actionable+ ignores channel toggles**
   â if you expect this rule to apply, verify the row's `severity`.

4. **Push didn't arrive?** Check:
   - `notifications.pushedAt` â was the worker actually attempted?
   - `push_subscriptions.consecutiveFailures` â flaky subscription that
     might've been dropped?
   - `__push__` row in `detector_runs` â any errors in the recent run?
   - Quiet hours: was the user in a quiet-hour window when push
     dispatched? Check `quietHoursStart`/`End` + `timezone`.

5. **Email didn't arrive?** Check:
   - `notification_preferences.lastDigestSentAt` â already sent today?
   - The user's `digestHourLocal` + `timezone` â were we even due to
     send to them in the worker run window?
   - Resend dashboard for delivery status.

6. **Insight wasn't created?** Check:
   - `detector_runs` for that detector Ã user â did it run? what was the
     status?
   - The detector's `dedupeKey` query against `notifications.payload`
     for the last 30 days â already-dedup'd insights silently skip.

## Replays

All three workers are safe to re-run. Common replay scenarios:

- **Push outage recovery**: nothing needed â the worker's 24h lookback
  scans everything with `pushedAt IS NULL` from the last day.
- **Digest send failure for a single user**: clear their
  `lastDigestSentAt` (set to NULL) and the next worker pass will retry.
- **Detector emitted bad data**: delete the offending `notifications`
  rows; the detector's dedupe lookback will prevent re-emit unless the
  underlying signal still holds.

## Capacity

Order-of-magnitude guidance based on early measurements:

- **Insights worker**: ~50ms per detector per user with 6 detectors. At
  1k active users, full pass = ~300s. Run on every 10 minutes is safe;
  run on every 5 minutes if the user base stays under 5k.
- **Digest worker**: dominated by the Resend round-trip (~150ms per
  email). 1k digest-enabled users at the same digest hour = ~150s if
  serial, ~5s with the worker's per-page parallelism. Per-page batch
  size of 200 keeps memory bounded.
- **Push worker**: ~30ms per push. With per-user cap = 10 and 1k unique
  users with notifications in the last 24h, full pass = ~5 minutes.
  Lookback windowing means it self-recovers from a 6-hour outage in
  one extra run.
