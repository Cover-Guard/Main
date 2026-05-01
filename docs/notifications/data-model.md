# Notifications â data model

All migrations live in `supabase/migrations/`. They're additive across the
12-PR series; each PR's contribution is noted below.

## Tables

### `notifications` (PR 1 + PR 5 + PR 9 + PR 11)

The source of truth. Every channel reads from this.

| Column | Type | Source | Notes |
| --- | --- | --- | --- |
| `id` | TEXT | existing | UUID, default `gen_random_uuid()::text` |
| `userId` | TEXT FK | existing | FK to `users` |
| `type` | `NotificationType` | existing | Enum, extended in PR 1 |
| `title` | TEXT | existing | |
| `body` | TEXT | existing | |
| `linkUrl` | TEXT | existing | |
| `payload` | JSONB | existing | Includes `dedupeKey` for insights (PR 7) |
| `readAt` | TIMESTAMPTZ | existing | When user opened it |
| `createdAt` | TIMESTAMPTZ | existing | |
| `severity` | `NotificationSeverity` | **PR 1** | enum: info / actionable / urgent / blocking |
| `category` | `NotificationCategory` | **PR 1** | enum: transactional / collaborative / insight / system / lifecycle |
| `entityType` | TEXT | **PR 1** | For mute + push tag grouping |
| `entityId` | TEXT | **PR 1** | |
| `dismissedAt` | TIMESTAMPTZ | **PR 1** | Distinct from readAt â auto-archive on resolution |
| `pushedAt` | TIMESTAMPTZ | **PR 11** | Dedupe column for the push worker |

**Indexes:**

- `(userId, createdAt DESC) WHERE readAt IS NULL AND dismissedAt IS NULL AND severity IN ('actionable','urgent','blocking')` â bell badge query (PR 1)
- `(userId, category, createdAt DESC)` â inbox tabs (PR 1)
- `(entityType, entityId) WHERE entityType IS NOT NULL` â mute reconciliation (PR 1)
- `(createdAt DESC) WHERE pushedAt IS NULL AND dismissedAt IS NULL` â push worker scan (PR 11)

**Trigger:** PR 5 adds a BEFORE INSERT trigger that suppresses inserts
when an active row exists in `notification_mutes`. The DM trigger from
existing code was retrofitted in PR 2 to set `severity='actionable'` and
`category='collaborative'` on insert.

### `notification_preferences` (PR 1 + PR 10)

One row per user. Per-category Ã per-channel toggles plus digest config.

| Column | Type | Notes |
| --- | --- | --- |
| `userId` | TEXT PK FK | |
| `channels` | JSONB | `{ category: { inApp, email, push } }` for all 5 categories |
| `digestEnabled` | BOOLEAN | default true |
| `digestHourLocal` | SMALLINT | 0-23, default 9 |
| `quietHoursStart` | SMALLINT \| NULL | 0-23 or null |
| `quietHoursEnd` | SMALLINT \| NULL | 0-23 or null, supports wrap-around |
| `timezone` | TEXT | IANA name, default 'UTC' |
| `lastDigestSentAt` | TIMESTAMPTZ \| NULL | **PR 10** dedupe |
| `createdAt`, `updatedAt` | TIMESTAMPTZ | trigger keeps `updatedAt` user-scoped |

**Trigger** (PR 10 revision): `updatedAt` is bumped only when user-driven
fields change. Worker stamps to `lastDigestSentAt` don't touch
`updatedAt`, so the column stays a meaningful "user-changed-prefs" marker.

**Index:** `(digestHourLocal, digestEnabled) WHERE digestEnabled = true`
â digest worker's "due now" scan (PR 10).

### `notification_mutes` (PR 1)

Per-user, per-entity mute. UNIQUE on `(userId, entityType, entityId)`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | |
| `userId` | TEXT FK | |
| `entityType` | TEXT | e.g. 'thread', 'deal', 'property' |
| `entityId` | TEXT | |
| `expiresAt` | TIMESTAMPTZ \| NULL | NULL = mute indefinitely |
| `createdAt` | TIMESTAMPTZ | |

### `push_subscriptions` (existing + PR 11)

Browser push registration.

| Column | Type | Source | Notes |
| --- | --- | --- | --- |
| `id`, `userId`, `endpoint`, `p256dh`, `auth`, `userAgent` | â | existing | |
| `lastUsedAt` | TIMESTAMPTZ | **PR 11** | Set on successful push |
| `failedAt` | TIMESTAMPTZ | **PR 11** | Most recent transient failure |
| `failureReason` | TEXT | **PR 11** | First 200 chars of error |
| `consecutiveFailures` | INTEGER | **PR 11** | Drop subscription at threshold (default 5) |

### `detector_runs` (PR 9)

Per-detector Ã per-user evaluation log, plus end-of-batch summaries
keyed by `detectorName='__batch__'`, `'__digest__'`, `'__push__'`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | |
| `detectorName` | TEXT | Detector id, or `__digest__` / `__push__` for workers |
| `userId` | TEXT \| NULL FK | NULL for batch summaries |
| `status` | `DetectorRunStatus` | success / error / skipped |
| `startedAt`, `finishedAt` | TIMESTAMPTZ | |
| `durationMs` | INTEGER | Computed in JS to avoid clock skew |
| `emitted`, `inserted`, `skipped` | INTEGER | Counters |
| `errorMessage` | TEXT \| NULL | First 200 chars on failure |
| `createdAt` | TIMESTAMPTZ | |

**Indexes:**

- `(detectorName, startedAt DESC)` â recent runs by detector
- `(userId, startedAt DESC) WHERE userId IS NOT NULL` â per-user debug
- `(detectorName, startedAt DESC) WHERE status='error'` â alert rollup

**RLS:** SELECT restricted to users with `metadata.role='admin'`. Service
role writes; nobody else.

## Enums

| Enum | Values | Defined in |
| --- | --- | --- |
| `NotificationType` | (existing) + INSIGHT, BILLING, LIFECYCLE | PR 1 extends |
| `NotificationSeverity` | info, actionable, urgent, blocking | PR 1 |
| `NotificationCategory` | transactional, collaborative, insight, system, lifecycle | PR 1 |
| `DetectorRunStatus` | success, error, skipped | PR 9 |

## Defaults

The `channels` JSONB default in `notification_preferences` ships sensible
out-of-the-box behaviour:

```json
{
  "transactional":  { "inApp": true,  "email": false, "push": false },
  "collaborative":  { "inApp": true,  "email": true,  "push": true },
  "insight":        { "inApp": true,  "email": true,  "push": false },
  "system":         { "inApp": true,  "email": true,  "push": true  },
  "lifecycle":      { "inApp": true,  "email": true,  "push": false }
}
```

In-app is on for everything (the bell icon needs to work). Collaborative
gets the most aggressive treatment because DMs and mentions are the highest-
intent items. Insights default to in-app + email so users get the digest
but don't get pinged at 3 AM about a milestone.
