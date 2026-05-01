# Notifications â extending the system

How to add new detectors, categories, or channels without breaking the
contracts the existing system relies on.

## Adding a new detector

Three steps. The runner + dedupe + observability are all generic â the
detector itself is the only new code.

### 1. Implement the detector

Create `apps/api/src/detectors/<yourDetector>.ts`. Conform to the
`Detector` interface:

```ts
import type { Detector, DetectorContext, Insight } from './types'
import { evaluateThreshold } from './evaluators'

export const yourDetector: Detector = {
  name: 'yourDetector',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { data, error } = await ctx.supabase
      .from('your_table')
      .select('id,relevant_fields')
      .eq('userId', ctx.userId)
    if (error || !data) return []

    return data
      .filter(/* whatever logic identifies an insight */)
      .map((row) => ({
        category: 'insight',
        severity: 'actionable',
        title: 'Human-readable title',
        body: 'Optional one-liner with detail',
        linkUrl: `/dashboard/your-feature/${row.id}`,
        payload: { rowId: row.id },
        entityType: 'your_table',
        entityId: row.id,
        dedupeKey: `your-detector:${row.id}`,
      }))
  },
}
```

Tips:

- **Always set `dedupeKey`**. Without it, the detector will fire on every
  worker run.
- **Pick a stable convention for `dedupeKey`**: `<detector>:<entityId>` is
  the standard. Per-event detectors can use `<detector>:<entityId>:<date>`
  if firing more than once per entity per day is correct.
- **Use the evaluators**: `evaluateThreshold`, `evaluateAnomaly`,
  `evaluateMilestone` from `./evaluators`. They keep the per-detector
  code thin and the unit tests trivial.
- **Use the `enabled` gate** for env-flagged or feature-flagged detectors.
  The runner records `status='skipped'` when `enabled` returns false, so
  you can tell "didn't run" from "ran and produced nothing" in
  `detector_runs`.

### 2. Wire it into `ALL_DETECTORS`

Edit `apps/api/src/detectors/index.ts`:

```ts
export { yourDetector } from './yourDetector'
import { yourDetector } from './yourDetector'

export const ALL_DETECTORS: ReadonlyArray<Detector> = [
  // ... existing entries
  yourDetector,
]
```

### 3. Write a test

Use the chainable supabase mock in
`apps/api/src/__tests__/detectors/fakeSupabase.ts`. Example structure
in any of the existing detector tests (e.g.
`dealStuckDetector.test.ts`).

Cover at minimum:

- Positive: detector fires when condition holds
- Negative: detector returns `[]` when condition doesn't hold
- Edge: any non-obvious filter rule (terminal stages, malformed JSONB, etc.)
- Error: supabase error returns `[]` rather than throwing
- Dedupe: `dedupeKey` shape is what the runner expects

That's it. The next worker run picks the detector up automatically; the
ops endpoints surface its health alongside the others.

## Adding a new category

This is rare â five categories cover most product surfaces. If you really
need one, three coordinated changes:

1. **Migration**: extend the `NotificationCategory` enum.
   ```sql
   ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'your_category';
   ```
2. **Defaults**: extend the `channels` JSONB default in
   `notification_preferences`. Existing rows aren't touched, but new
   users get the new toggle. For existing rows, decide whether to
   backfill or fall back at read time.
3. **UI**: add the category to:
   - `digestBuilder.CATEGORY_LABELS` and `CATEGORY_ORDER`
   - `NotificationBell` tabs (PR 4)
   - `NotificationPreferences` settings (PR 6)

The push and digest workers don't need changes â they read categories
generically from the JSONB.

## Adding a new channel

A new dispatch channel â Slack, SMS, mobile push â is one new worker plus
one new column on `notifications` for dedupe. The pattern is well-
established now; PR 11's push worker is the cleanest reference.

### 1. Migration

Add a `<channel>edAt TIMESTAMPTZ` column and a partial index for the
worker's "find unsent" query:

```sql
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "slackedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "notifications_unslacked_idx"
  ON "notifications" ("createdAt" DESC)
  WHERE "slackedAt" IS NULL AND "dismissedAt" IS NULL;
```

### 2. Three files (mirror the push pattern)

- `apps/api/src/services/<channel>Dispatcher.ts` â pure helpers:
  `shouldNotifyVia<Channel>`, `build<Channel>Payload`. Mirror PR 11's
  rules: severity actionable+ always passes, info respects per-category
  toggle, quiet hours suppress.
- `apps/api/src/services/<channel>Transport.ts` â I/O wrapper around
  the channel's SDK. Returns a normalised result shape.
- `apps/api/src/workers/<channel>Worker.ts` â cron entrypoint. Scan
  unsent, page prefs/destinations, dispatch, stamp.

### 3. Update preferences default

Add the new channel to the default `channels` JSONB:

```json
"insight": { "inApp": true, "email": true, "push": false, "slack": false }
```

And to the per-category toggles in `NotificationPreferences` settings.

### 4. Tests

Pure helpers test cleanly without mocking the SDK. The transport file is
the only place that imports the SDK; that pattern keeps the test
sandbox lightweight.

## Severity rule reminder

When deciding what severity to emit:

- **`info`**: nothing required. Awareness only.
- **`actionable`**: user follow-up needed. **Will push regardless of
  channel toggle**. Will appear in the digest regardless of email
  toggle. Use sparingly.
- **`urgent`**: same as actionable, plus **punches through quiet hours**.
- **`blocking`**: same as urgent, plus expectation that the app shows
  a modal or otherwise can't proceed without resolution.

The actionable+ override exists because users have one big reason to
turn off channels: noise. Critical items must not be hidden by that.
