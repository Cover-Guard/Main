/**
 * Digest worker entrypoint (PR 10).
 *
 * Designed to be invoked every 15 minutes by a cron / scheduled job. For
 * each user with `digestEnabled`:
 *   1. Check whether the worker run falls in their digest hour locally
 *      (via digestTime.isDigestDueNow).
 *   2. Pull their unread+undismissed notifications from the last 7 days.
 *   3. Build the digest content (digestBuilder.buildDigest).
 *   4. Render + send via Resend.
 *   5. Stamp `lastDigestSentAt` on success so we don't send twice today.
 *   6. Record the run in `detector_runs` (detectorName='__digest__') for
 *      ops visibility.
 *
 * Run with:
 *   tsx apps/api/src/workers/digestWorker.ts
 *
 * Production toggles:
 *   DIGEST_WORKER_BATCH_SIZE     (default 200) â users per page
 *   DIGEST_WORKER_MAX_USERS      (default 0=unlimited)
 *   DIGEST_WORKER_DRY_RUN=true   â build digests but don't send or stamp
 */

import { recordDetectorRun } from '../detectors/runLog'
import { logger } from '../utils/logger'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { buildDigest, type DigestNotification, type DigestPrefsForBuilder } from '../services/digestBuilder'
import { renderDigestEmail } from '../services/digestEmail'
import { isDigestDueNow, type DigestPreferences } from '../services/digestTime'

interface PrefsRow extends DigestPreferences {
  userId: string
  channels: DigestPrefsForBuilder['channels']
}

interface UserRow {
  id: string
  email: string | null
  firstName: string | null
}

const NOTIFICATIONS_LOOKBACK_DAYS = 7
const PUBLIC_APP_URL =
  process.env.APP_PUBLIC_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  'https://coverguard.io'

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<{ ok: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'not configured' }
  const from =
    process.env.RESEND_FROM_EMAIL ?? 'CoverGuard <notifications@coverguard.io>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: `resend ${res.status}: ${body.slice(0, 120)}` }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function runDigestForUser(
  userRow: UserRow,
  prefs: PrefsRow,
  now: Date,
  dryRun: boolean,
): Promise<{ status: 'sent' | 'skipped' | 'error'; reason?: string }> {
  if (!userRow.email) return { status: 'skipped', reason: 'no email' }

  const since = new Date(
    now.getTime() - NOTIFICATIONS_LOOKBACK_DAYS * 86400_000,
  ).toISOString()
  const { data: notifs, error } = await supabaseAdmin
    .from('notifications')
    .select('id,title,body,linkUrl,category,severity,createdAt')
    .eq('userId', userRow.id)
    .gte('createdAt', since)
    .is('readAt', null)
    .is('dismissedAt', null)
    .order('createdAt', { ascending: false })
    .limit(200)

  if (error) {
    return { status: 'error', reason: error.message }
  }

  const digest = buildDigest(
    (notifs ?? []) as DigestNotification[],
    { channels: prefs.channels },
  )
  if (!digest) return { status: 'skipped', reason: 'nothing to send' }

  const email = renderDigestEmail(digest, {
    greetingName: userRow.firstName ?? undefined,
    baseUrl: PUBLIC_APP_URL,
    preferencesUrl: `${PUBLIC_APP_URL}/dashboard/settings/notifications`,
  })

  if (dryRun) return { status: 'sent', reason: 'dry-run' }

  const dispatch = await sendEmail(userRow.email, email.subject, email.text, email.html)
  if (!dispatch.ok) return { status: 'error', reason: dispatch.reason }

  // Stamp lastDigestSentAt for dedupe.
  const { error: stampErr } = await supabaseAdmin
    .from('notification_preferences')
    .update({ lastDigestSentAt: now.toISOString() })
    .eq('userId', userRow.id)
  if (stampErr) {
    logger.warn('digest: lastDigestSentAt stamp failed', {
      userId: userRow.id,
      error: stampErr.message,
    })
  }

  return { status: 'sent' }
}

async function main(): Promise<void> {
  const batchSize = Number(process.env.DIGEST_WORKER_BATCH_SIZE ?? '200')
  const maxUsers = Number(process.env.DIGEST_WORKER_MAX_USERS ?? '0')
  const dryRun = process.env.DIGEST_WORKER_DRY_RUN === 'true'
  const startedAt = new Date()

  logger.info('Digest worker starting', { batchSize, maxUsers, dryRun })

  let offset = 0
  let dueCount = 0
  let sentCount = 0
  let errorCount = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select(
        'userId,channels,digestEnabled,digestHourLocal,timezone,lastDigestSentAt',
      )
      .eq('digestEnabled', true)
      .order('userId', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      logger.error('Digest worker: prefs fetch failed', { error: error.message })
      process.exit(1)
    }
    if (!data || data.length === 0) break

    // Filter to users due now.
    const due = (data as PrefsRow[]).filter((p) => isDigestDueNow(startedAt, p))
    if (due.length === 0) {
      offset += batchSize
      if (data.length < batchSize) break
      continue
    }

    // Resolve user emails in one query per page.
    const userIds = due.map((p) => p.userId)
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id,email,firstName')
      .in('id', userIds)
    const usersById = new Map((users ?? []).map((u) => [u.id, u as UserRow]))

    for (const prefs of due) {
      if (maxUsers > 0 && dueCount >= maxUsers) break
      dueCount++
      const userRow = usersById.get(prefs.userId)
      if (!userRow) continue

      const result = await runDigestForUser(userRow, prefs, startedAt, dryRun)
      if (result.status === 'sent') sentCount++
      else if (result.status === 'error') {
        errorCount++
        logger.warn('Digest send failed', {
          userId: prefs.userId,
          reason: result.reason,
        })
      }
    }

    if (data.length < batchSize) break
    if (maxUsers > 0 && dueCount >= maxUsers) break
    offset += batchSize
  }

  const finishedAt = new Date()
  await recordDetectorRun({
    detectorName: '__digest__',
    userId: null,
    status: errorCount > 0 ? 'error' : 'success',
    startedAt,
    finishedAt,
    emitted: dueCount,
    inserted: sentCount,
    skipped: dueCount - sentCount - errorCount,
    errorMessage:
      errorCount > 0 ? `${errorCount} digest send errors` : undefined,
  })

  logger.info('Digest worker complete', {
    dueCount,
    sentCount,
    errorCount,
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
  })
}

const invokedDirectly = process.argv[1]?.endsWith('digestWorker.ts')
if (invokedDirectly) {
  main().catch((err) => {
    logger.error('Digest worker crashed', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
}

export { main as runDigestWorker }
