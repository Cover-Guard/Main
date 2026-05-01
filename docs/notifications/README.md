# Notifications system

The notifications system delivers structured, severity-scored, category-tagged
events to users across three channels: in-app, email, and web push. It's
designed to be a real product surface â readable, mutable, governed by
preferences â rather than a dumb event log.

This document is the entry point. For implementation detail, see:

- **[data-model.md](./data-model.md)** â tables, columns, indexes, RLS
- **[operations.md](./operations.md)** â cron config, debugging, alerting
- **[extending.md](./extending.md)** â adding detectors, categories, channels

## How a notification reaches a user

```
                     âââââââââââââââââââââââââââââââââââââââââââââââââ
                     â                                               â
   inserts ââââââââââºâ             notifications table              â
   (writers,         â   (severity, category, entityType/Id, body)  â
    triggers,        â                                               â
    detectors)       âââââââ¬ââââââââââââ¬ââââââââââââââââââââ¬ââââââââââ
                           â           â                   â
                           â LISTEN    â scan              â scan
                           â (Realtime)â unpushed          â unread by
                           â           â                   â digestHourLocal
                  ââââââââââ¼ââââââ âââââ¼âââââââââââ ââââââââ¼âââââââââââ
                  â  Web client  â â  pushWorker  â â  digestWorker   â
                  â  (in-app)    â â  (web push)  â â  (email)        â
                  ââââââââââââââââ ââââââââââââââââ âââââââââââââââââââ
                           â           â                   â
                           â           â¼                   â¼
                           â    ââââââââââââ         ââââââââââââ
                           â    â  Resend  â         â  Resend  â
                           â    â  / FCM   â         â  (email) â
                           â    ââââââââââââ         ââââââââââââ
                           â¼
                    User's bell icon
```

Three independent dispatch paths â one for each channel â reading from the
same `notifications` table. They share a common preferences shape so a user
who turns off `insight.email` in their settings affects the digest worker,
not the bell.

## Six core concepts

### 1. Severity

Four-level scale, ordered:

| Severity | When to use | Default UX |
| --- | --- | --- |
| `info` | Awareness only â nothing required | Silent in bell, eligible for digest |
| `actionable` | Requires user follow-up | Shows in actionable count, pushes regardless of channel toggle |
| `urgent` | Requires fast follow-up | Punches through quiet hours |
| `blocking` | App can't proceed without action | Same as urgent, plus modal if relevant |

The "actionable+ always pushes" rule is consistent across email digest and
push channels â see `pushDispatcher.shouldPushNotification` and
`digestBuilder.shouldIncludeInDigest`.

### 2. Category

Five categories drive the inbox tabs and per-category preference toggles:

| Category | Examples |
| --- | --- |
| `transactional` | Deal stuck, renewal due, signature requested |
| `collaborative` | DM, mention, comment |
| `insight` | Estimate ready, anomaly detected, milestone crossed |
| `system` | Maintenance, outage, version upgrade |
| `lifecycle` | Trial ending, plan upgraded, subscription paused |

### 3. Mute (entity-scoped)

Users can mute a specific `(entityType, entityId)` tuple. A server-side
trigger on the `notifications` table refuses to insert if the user has an
active mute on that entity. See PR 5 / migration
`20260430140000_suppress_muted_notifications.sql`.

### 4. Preferences

Stored in `notification_preferences`. Three knobs:

- `channels[category].{inApp,email,push}` â per-category Ã per-channel toggle (JSONB)
- `digestEnabled`, `digestHourLocal`, `timezone` â daily digest delivery
- `quietHoursStart`, `quietHoursEnd` â push suppression window

PR 6 ships the settings UI; PRs 10 and 11 read these on dispatch.

### 5. Detectors

Background workers that synthesise insights from product state. Each
detector is a pure function over a `DetectorContext`:

```ts
interface Detector {
  readonly name: string
  enabled?(ctx: DetectorContext): boolean | Promise<boolean>
  evaluate(ctx: DetectorContext): Promise<Insight[]>
}
```

The runner persists emitted insights as `notifications` rows with
`category='insight'` and dedupes via a stable `dedupeKey`. PR 7 ships the
framework, PR 8 ships five production detectors, PR 9 wraps each
evaluation with run logging.

### 6. Workers

Three cron-driven workers handle the slow paths:

| Worker | Cadence | What it does |
| --- | --- | --- |
| `insightsWorker` | every 5-15 min | Run `ALL_DETECTORS` against every active user |
| `digestWorker` | every 15 min | Send daily digest emails when each user's local hour matches |
| `pushWorker` | every 1-5 min | Push notifications to subscribed devices |

All three write a summary row to `detector_runs` so the ops view can show
push and digest health alongside detector health.

## End-to-end example: "deal stuck" insight reaching a user

1. **2:00 AM** â `insightsWorker` runs. `dealStuckDetector` sees a deal
   that hasn't moved in 7+ days. Emits an `Insight` with
   `severity: 'actionable'`, `category: 'insight'`,
   `dedupeKey: 'deal-stuck:abc'`.
2. The runner checks the last 30 days for that dedupeKey on this user, finds
   nothing, inserts a `notifications` row.
3. **2:01 AM** â `pushWorker` finds the unpushed row. The user has
   `insight.push: false` but `severity='actionable'` so the actionable+
   passthrough rule fires. Push is dispatched. `pushedAt` is stamped.
4. **9:00 AM** â `digestWorker` runs. The user's `digestHourLocal=9` and
   it's 9:00 in their timezone. The notification is still unread, so it
   shows up in the digest's "Action items" section.
5. The user opens the bell icon, the in-app surface shows the same row in
   the actionable count badge. They click through and the row gets
   `readAt` stamped.

## Why this design

**Server-side primary, channel fan-out secondary.** The `notifications`
table is the source of truth. Every channel reads from it; nobody short-
circuits. This means:

- Preferences are enforced once, at dispatch.
- A new channel (mobile push, Slack, SMS) is one new worker plus a per-
  channel toggle. No writer changes.
- Replays are trivial: re-run the worker with `pushedAt IS NULL` to recover
  from outages.

**Detectors are pure.** They don't write to the DB; they emit insights and
the runner decides whether to persist. This means:

- Detector tests are jest cases over a fake supabase, no DB needed.
- Adding a detector is a `Detector` export + one line in `ALL_DETECTORS`.
- Dedupe is centralised in the runner, not scattered across detector code.

**Severity is a tier, not a label.** `actionable+` carries product
guarantees: it pushes regardless of channel, it's never digested away. This
gives writers a clear contract for "this matters" without needing to know
which channels are on.
