/**
 * Push dispatch worker (PR 11).
 *
 * Every minute, scans for notifications created in the last 24h with no
 * `pushedAt` stamp and pushes them via web push. Idempotent: stamping
 * `pushedAt` after dispatch (success or terminal failure) means the next
 * run won't re-process. The DM endpoint's existing inline push fan-out
 * also stamps `pushedAt`, so this worker complements rather than competes.
 *
 * Designed for cron schedules of every 1-5 minutes. The 24h window means
 * a 6-hour outage doesn't cause a thundering herd of stale pushes â the
 * worker recovers gradually.
 *
 * Run with:
 *   tsx apps/api/src/workers/pushWorker.ts
 *
 * Production toggles:
 *   PUSH_WORKER_BATCH_SIZE       (default 200) â notifications per scan
 *   PUSH_WORKER_MAX_PER_USER     (default 10) â cap per user per run, prevents
 *                                              single-user notification floods
 *   PUSH_WORKER_DRY_RUN=true     â read everything, push nothing, stamp nothing
 *   PUSH_WORKER_FAILURE_THRESHOLD (default 5) â drop a subscription after N
 *                                              consecutive non-410 failures
 */

import { recordDetectorRun } from '../detectors/runLog'
import { logger } from '../utils/logger'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import {
  buildPushPayload,
  shouldPushNotification,
  type PushNotification,
  type PushPrefsForDispatcher,
  type PushSubscription,
} from '../services/pushDispatcher'
import { dispatchPush } from '../services/pushTransport'

interface NotificationRow extends PushNotification {
  userId: string
  createdAt: string
}

interface PrefsRow extends PushPrefsForDispatcher {
  userId: string
}

const LOOKBACK_HOURS = 24
const PUBLIC_APP_URL =
  process.env.APP_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://coverguard.io'

/**
 * Stamp `pushedAt` on a notification â best-effort, non-blocking.
 */
async function stampPushed(notificationId: string, now: Date): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ pushedAt: now.toISOString() })
    .eq('id', notificationId)
  if (error) {
    logger.warn('push: pushedAt stamp failed', {
      notificationId,
      error: error.message,
    })
  }
}

/**
 * Update bookkeeping on a single subscription after a delivery attempt.
 *   â¢ success â clear failure counter, set lastUsedAt
 *   â¢ gone (404/410) â delete the subscription outright
 *   â¢ transient â increment counter; over threshold â delete; under â record reason
 */
async function updateSubscriptionAfterDispatch(
  sub: PushSubscription,
  result: { ok: boolean; gone?: boolean; reason?: string; statusCode?: number },
  now: Date,
  failureThreshold: number,
  currentFailures: number,
): Promise<void> {
  if (result.ok) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({
        lastUsedAt: now.toISOString(),
        consecutiveFailures: 0,
        failedAt: null,
        failureReason: null,
      })
      .eq('id', sub.id)
    return
  }
  if (result.gone) {
    await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    return
  }
  const next = currentFailures + 1
  if (next >= failureThreshold) {
    await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
    logger.warn('push: dropping subscription after threshold', {
      subscriptionId: sub.id,
      failures: next,
    })
    return
  }
  await supabaseAdmin
    .from('push_subscriptions')
    .update({
      consecutiveFailures: next,
      failedAt: now.toISOString(),
      failureReason: (result.reason ?? '').slice(0, 200),
    })
    .eq('id', sub.id)
}

/**
 * Process one notification: respect prefs, dispatch to all of the user's
 * subscriptions, and stamp `pushedAt`. Returns counters for reporting.
 */
export async function processNotification(
  n: NotificationRow,
  prefs: PrefsRow,
  subs: Array<PushSubscription & { consecutiveFailures: number }>,
  now: Date,
  dryRun: boolean,
  failureThreshold: number,
): Promise<{ status: 'sent' | 'skipped' | 'error'; sent: number; reason?: string }> {
  if (!shouldPushNotification(n, prefs, now)) {
    if (!dryRun) await stampPushed(n.id, now)
    return { status: 'skipped', sent: 0, reason: 'prefs' }
  }
  if (subs.length === 0) {
    if (!dryRun) await stampPushed(n.id, now)
    return { status: 'skipped', sent: 0, reason: 'no subscriptions' }
  }

  const payload = buildPushPayload(n, PUBLIC_APP_URL)

  let sent = 0
  let errors = 0
  await Promise.all(
    subs.map(async (sub) => {
      if (dryRun) return
      const result = await dispatchPush(sub, payload)
      if (result.ok) sent++
      else errors++
      await updateSubscriptionAfterDispatch(
        sub,
        result,
        now,
        failureThreshold,
        sub.consecutiveFailures,
      )
    }),
  )

  if (!dryRun) await stampPushed(n.id, now)

  if (errors > 0 && sent === 0) {
    return { status: 'error', sent, reason: 'all subscriptions failed' }
  }
  return { status: 'sent', sent }
}

async function main(): Promise<void> {
  const batchSize = Number(process.env.PUSH_WORKER_BATCH_SIZE ?? '200')
  const maxPerUser = Number(process.env.PUSH_WORKER_MAX_PER_USER ?? '10')
  const dryRun = process.env.PUSH_WORKER_DRY_RUN === 'true'
  const failureThreshold = Number(
    process.env.PUSH_WORKER_FAILURE_THRESHOLD ?? '5',
  )
  const startedAt = new Date()

  logger.info('Push worker starting', {
    batchSize,
    maxPerUser,
    dryRun,
    failureThreshold,
  })

  const since = new Date(
    startedAt.getTime() - LOOKBACK_HOURS * 3600_000,
  ).toISOString()

  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select(
      'id,userId,title,body,linkUrl,category,severity,entityType,entityId,createdAt',
    )
    .is('pushedAt', null)
    .is('dismissedAt', null)
    .gte('createdAt', since)
    .order('createdAt', { ascending: true })
    .limit(batchSize)

  if (error) {
    logger.error('Push worker: scan failed', { error: error.message })
    process.exit(1)
  }

  const rows = (notifs ?? []) as NotificationRow[]
  if (rows.length === 0) {
    logger.info('Push worker: nothing to do')
    return
  }

  // Cap per user â protects against single-user floods.
  const perUserCount = new Map<string, number>()
  const eligible: NotificationRow[] = []
  for (const r of rows) {
    const c = perUserCount.get(r.userId) ?? 0
    if (c >= maxPerUser) continue
    perUserCount.set(r.userId, c + 1)
    eligible.push(r)
  }

  // Resolve all distinct users' prefs + subscriptions in two queries.
  const userIds = Array.from(new Set(eligible.map((r) => r.userId)))
  const [{ data: prefsRows }, { data: subRows }] = await Promise.all([
    supabaseAdmin
      .from('notification_preferences')
      .select('userId,channels,quietHoursStart,quietHoursEnd,timezone')
      .in('userId', userIds),
    supabaseAdmin
      .from('push_subscriptions')
      .select('id,userId,endpoint,p256dh,auth,consecutiveFailures')
      .in('userId', userIds),
  ])

  const prefsById = new Map<string, PrefsRow>(
    (prefsRows ?? []).map((p) => [p.userId, p as PrefsRow]),
  )
  const subsByUser = new Map<
    string,
    Array<PushSubscription & { consecutiveFailures: number }>
  >()
  for (const s of subRows ?? []) {
    const arr = subsByUser.get(s.userId) ?? []
    arr.push(s as PushSubscription & { consecutiveFailures: number })
    subsByUser.set(s.userId, arr)
  }

  let sent = 0
  let skipped = 0
  let errored = 0

  for (const n of eligible) {
    const prefs =
      prefsById.get(n.userId) ??
      // Sensible default: all channels off, no quiet hours.
      ({
        userId: n.userId,
        channels: {},
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: 'UTC',
      } as PrefsRow)
    const subs = subsByUser.get(n.userId) ?? []
    const result = await processNotification(
      n,
      prefs,
      subs,
      startedAt,
      dryRun,
      failureThreshold,
    )
    if (result.status === 'sent') sent += result.sent
    else if (result.status === 'skipped') skipped++
    else errored++
  }

  const finishedAt = new Date()
  await recordDetectorRun({
    detectorName: '__push__',
    userId: null,
    status: errored > 0 ? 'error' : 'success',
    startedAt,
    finishedAt,
    emitted: eligible.length,
    inserted: sent,
    skipped,
    errorMessage: errored > 0 ? `${errored} push errors` : undefined,
  })

  logger.info('Push worker complete', {
    eligible: eligible.length,
    sent,
    skipped,
    errored,
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
  })
}

const invokedDirectly = process.argv[1]?.endsWith('pushWorker.ts')
if (invokedDirectly) {
  main().catch((err) => {
    logger.error('Push worker crashed', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
}

export { main as runPushWorker }
