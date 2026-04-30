import { Router } from 'express'
import { z } from 'zod'
import webpush, { type WebPushError } from 'web-push'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'

export const notificationsRouter = Router()

// ─── VAPID configuration ──────────────────────────────────────────────────
// The public key is exposed via /api/push/vapid so the browser can subscribe.
// The private key stays on the server. If either is missing we degrade
// gracefully — push just becomes a no-op.

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:notifications@coverguard.io'

let vapidConfigured = false
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    vapidConfigured = true
  } catch (err) {
    logger.warn('VAPID configuration invalid — push disabled', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── Schema ───────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(512).optional(),
})

const dispatchSchema = z.object({
  messageId: z.string().min(1),
})

const muteSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
  // ISO timestamp; omit for an indefinite mute.
  expiresAt: z.string().datetime().optional(),
})

const unmuteQuerySchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().min(1).max(128),
})

// Per-channel prefs for one category. Lives inside `channels` JSONB.
const channelPrefsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
})

const channelMatrixSchema = z.object({
  transactional: channelPrefsSchema,
  collaborative: channelPrefsSchema,
  insight:       channelPrefsSchema,
  system:        channelPrefsSchema,
  lifecycle:     channelPrefsSchema,
})

const updatePrefsSchema = z.object({
  channels:        channelMatrixSchema.optional(),
  digestEnabled:   z.boolean().optional(),
  digestHourLocal: z.number().int().min(0).max(23).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd:   z.number().int().min(0).max(23).nullable().optional(),
  timezone:        z.string().min(1).max(64).optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * Return the VAPID public key so the browser can register a subscription.
 * Unauthenticated — the public key is, well, public.
 */
notificationsRouter.get('/push/vapid', (_req, res) => {
  if (!vapidConfigured || !VAPID_PUBLIC_KEY) {
    res.status(503).json({
      success: false,
      error: { code: 'PUSH_DISABLED', message: 'Web push is not configured on this server.' },
    })
    return
  }
  res.json({ success: true, data: { publicKey: VAPID_PUBLIC_KEY }, publicKey: VAPID_PUBLIC_KEY })
})

/**
 * Upsert a browser push subscription for the current user. Keyed by endpoint
 * (unique), so re-subscribing the same browser just refreshes the record.
 */
notificationsRouter.post('/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid body' },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const { endpoint, keys, userAgent } = parsed.data

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        userId: authReq.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? null,
      },
      { onConflict: 'endpoint' },
    )

    if (error) {
      logger.error('Failed to upsert push subscription', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to save push subscription.' },
      })
      return
    }

    res.json({ success: true, data: { subscribed: true } })
  } catch (err) {
    next(err)
  }
})

/**
 * Dispatch a notification for a direct_message that was just sent.
 * Input: the senderId's bearer token + messageId they just created.
 *
 * We:
 *   1. Verify the caller is the sender of that message (prevents abuse).
 *   2. Look up the notification row the DB trigger already created.
 *   3. Fan out email (Resend) + web push to the recipient.
 *
 * This is idempotent — calling twice just re-sends; the recipient's email +
 * push providers will de-duplicate using their own message IDs. If email or
 * push is not configured the call still succeeds; the in-app notification is
 * already persisted by the trigger.
 */
notificationsRouter.post('/notifications/dispatch', requireAuth, async (req, res, next) => {
  try {
    const parsed = dispatchSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid body' },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const { messageId } = parsed.data

    // Fetch the message and verify the caller is the sender.
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('direct_messages')
      .select('id,conversationId,senderId,recipientId,content,createdAt')
      .eq('id', messageId)
      .maybeSingle()

    if (msgErr) {
      logger.error('Dispatch: failed to look up message', { error: msgErr.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Lookup failed' },
      })
      return
    }
    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      })
      return
    }
    if (message.senderId !== authReq.userId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the sender can dispatch a notification.' },
      })
      return
    }

    // Look up recipient's email + push subscriptions.
    const [{ data: recipient }, { data: subs }, { data: sender }] = await Promise.all([
      supabaseAdmin.from('users').select('id,email,firstName,lastName').eq('id', message.recipientId).single(),
      supabaseAdmin.from('push_subscriptions').select('*').eq('userId', message.recipientId),
      supabaseAdmin.from('users').select('firstName,lastName,email').eq('id', message.senderId).single(),
    ])

    const senderName =
      sender && (sender.firstName || sender.lastName)
        ? `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim()
        : sender?.email ?? 'A teammate'

    const deepLink = `${publicAppUrl()}/dashboard?thread=${message.conversationId}`
    const title = `New message from ${senderName}`
    const body = message.content.slice(0, 200)

    const emailPromise = recipient?.email
      ? sendEmailViaResend({
          to: recipient.email,
          subject: title,
          text: `${body}\n\nOpen CoverGuard: ${deepLink}`,
          html: renderEmailHtml({
            senderName,
            snippet: body,
            deepLink,
          }),
        }).catch((err: unknown) => {
          logger.warn('Email dispatch failed', {
            error: err instanceof Error ? err.message : String(err),
          })
          return { ok: false }
        })
      : Promise.resolve({ ok: false, reason: 'no email' })

    const pushPromise = (async () => {
      if (!vapidConfigured || !subs || subs.length === 0) return { ok: false, sent: 0 }

      const payload = JSON.stringify({
        title: 'CoverGuard',
        body: `${senderName}: ${body}`,
        url: deepLink,
        tag: `dm-${message.conversationId}`,
      })

      let sent = 0
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
            sent++
          } catch (err) {
            const pushErr = err as WebPushError
            // 404/410 = endpoint gone — clean it up so we don't keep retrying.
            if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
              await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
            } else {
              logger.warn('Web push delivery failed', {
                statusCode: pushErr?.statusCode,
                message: pushErr?.message,
              })
            }
          }
        }),
      )
      return { ok: sent > 0, sent }
    })()

    const [emailResult, pushResult] = await Promise.all([emailPromise, pushPromise])

    logger.info('Notification dispatched', {
      messageId,
      recipientId: message.recipientId,
      email: emailResult,
      push: pushResult,
    })

    res.json({
      success: true,
      data: {
        email: emailResult,
        push: pushResult,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Mute notifications for a specific entity (e.g. a thread, a deal, a property).
 * Idempotent — re-muting refreshes `expiresAt`. Body validated against
 * `muteSchema`; the (entityType, entityId) tuple is upserted with the
 * unique constraint defined in 20260430120000_add_notification_taxonomy_and_prefs.sql.
 *
 * Used by PR 5's "Mute this thread" affordance in the bell. The DB-side
 * trigger short-circuits the insert when an active mute exists, so this
 * endpoint is the only client-side write needed to silence a thread.
 */
notificationsRouter.post('/notifications/mute', requireAuth, async (req, res, next) => {
  try {
    const parsed = muteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid body' },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const { entityType, entityId, expiresAt } = parsed.data

    const { error } = await supabaseAdmin
      .from('notification_mutes')
      .upsert(
        {
          userId: authReq.userId,
          entityType,
          entityId,
          expiresAt: expiresAt ?? null,
        },
        { onConflict: 'userId,entityType,entityId' },
      )

    if (error) {
      logger.error('Failed to upsert notification mute', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to save mute.' },
      })
      return
    }

    res.json({ success: true, data: { muted: true, entityType, entityId, expiresAt: expiresAt ?? null } })
  } catch (err) {
    next(err)
  }
})

/**
 * Unmute (delete the mute row) for a specific entity. Query params rather
 * than body because DELETE bodies are inconsistently supported across
 * proxies and the existing API conventions use query strings for filters.
 */
notificationsRouter.delete('/notifications/mute', requireAuth, async (req, res, next) => {
  try {
    const parsed = unmuteQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid query' },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const { entityType, entityId } = parsed.data

    const { error } = await supabaseAdmin
      .from('notification_mutes')
      .delete()
      .eq('userId', authReq.userId)
      .eq('entityType', entityType)
      .eq('entityId', entityId)

    if (error) {
      logger.error('Failed to delete notification mute', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to remove mute.' },
      })
      return
    }

    res.json({ success: true, data: { muted: false, entityType, entityId } })
  } catch (err) {
    next(err)
  }
})

/**
 * Default preferences returned when the user has no row in
 * `notification_preferences`. Matches the DEFAULT in the migration so
 * client and server agree on what "no row" means.
 */
const DEFAULT_PREFS = {
  channels: {
    transactional: { inApp: true,  email: false, push: false },
    collaborative: { inApp: true,  email: true,  push: true },
    insight:       { inApp: true,  email: true,  push: false },
    system:        { inApp: true,  email: true,  push: true },
    lifecycle:     { inApp: true,  email: true,  push: false },
  },
  digestEnabled: true,
  digestHourLocal: 9,
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  timezone: 'UTC',
}

/**
 * Read the caller's notification preferences. If they've never saved, returns
 * the defaults so the UI can render without a separate "first-load" branch.
 */
notificationsRouter.get('/notifications/preferences', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest

    const { data, error } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('userId', authReq.userId)
      .maybeSingle()

    if (error) {
      logger.error('Failed to read notification preferences', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to read preferences.' },
      })
      return
    }

    res.json({
      success: true,
      data: data ?? { userId: authReq.userId, ...DEFAULT_PREFS, createdAt: null, updatedAt: null },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * Update the caller's preferences. Partial updates supported — fields not in
 * the body are left as-is. Upsert ensures first-time savers create the row.
 */
notificationsRouter.put('/notifications/preferences', requireAuth, async (req, res, next) => {
  try {
    const parsed = updatePrefsSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message ?? 'Invalid body' },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const patch = parsed.data

    // Read current row (or defaults) so we can merge — JSONB upsert needs the
    // whole `channels` object to avoid wiping unspecified categories.
    const { data: existing } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('userId', authReq.userId)
      .maybeSingle()

    const next = {
      userId: authReq.userId,
      channels:        patch.channels        ?? existing?.channels        ?? DEFAULT_PREFS.channels,
      digestEnabled:   patch.digestEnabled   ?? existing?.digestEnabled   ?? DEFAULT_PREFS.digestEnabled,
      digestHourLocal: patch.digestHourLocal ?? existing?.digestHourLocal ?? DEFAULT_PREFS.digestHourLocal,
      quietHoursStart: patch.quietHoursStart === undefined ? (existing?.quietHoursStart ?? DEFAULT_PREFS.quietHoursStart) : patch.quietHoursStart,
      quietHoursEnd:   patch.quietHoursEnd   === undefined ? (existing?.quietHoursEnd   ?? DEFAULT_PREFS.quietHoursEnd)   : patch.quietHoursEnd,
      timezone:        patch.timezone        ?? existing?.timezone        ?? DEFAULT_PREFS.timezone,
    }

    const { error } = await supabaseAdmin
      .from('notification_preferences')
      .upsert(next, { onConflict: 'userId' })

    if (error) {
      logger.error('Failed to upsert notification preferences', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to save preferences.' },
      })
      return
    }

    res.json({ success: true, data: next })
  } catch (err) {
    next(err)
  }
})

/**
 * List the caller's active mutes. "Active" means not yet expired. Used by the
 * preferences page to render the mute list with an unmute button.
 */
notificationsRouter.get('/notifications/mutes', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest
    const nowIso = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('notification_mutes')
      .select('*')
      .eq('userId', authReq.userId)
      .or(`expiresAt.is.null,expiresAt.gt.${nowIso}`)
      .order('createdAt', { ascending: false })

    if (error) {
      logger.error('Failed to list notification mutes', { error: error.message })
      res.status(500).json({
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to list mutes.' },
      })
      return
    }

    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    next(err)
  }
})

function publicAppUrl(): string {
  return (
    process.env.APP_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://coverguard.io'
  )
}

async function sendEmailViaResend(input: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'not configured' }
  const from = process.env.RESEND_FROM_EMAIL ?? 'CoverGuard <notifications@coverguard.io>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Resend returned ${res.status}: ${txt.slice(0, 200)}`)
  }
  const json = (await res.json().catch(() => ({}))) as { id?: string }
  return { ok: true, id: json.id }
}

function renderEmailHtml(input: {
  senderName: string
  snippet: string
  deepLink: string
}): string {
  // Kept intentionally simple — clients render a tiny chrome of black text on white.
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  return `<!doctype html>
<html><body style="font-family: Helvetica, Arial, sans-serif; color:#0d1929; margin:0; padding:24px;">
  <div style="max-width: 480px; margin: 0 auto;">
    <h2 style="margin:0 0 12px 0; font-size: 18px;">New message on CoverGuard</h2>
    <p style="margin:0 0 8px 0;"><strong>${escapeHtml(input.senderName)}</strong> sent you a message:</p>
    <blockquote style="margin: 12px 0; padding: 10px 14px; background:#f2f4f7; border-left: 3px solid #6366f1; border-radius: 4px;">${escapeHtml(input.snippet)}</blockquote>
    <p style="margin: 16px 0;"><a href="${input.deepLink}" style="display:inline-block; padding:10px 16px; background:#6366f1; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">Open the conversation</a></p>
    <p style="margin: 24px 0 0 0; font-size: 12px; color: #6b7280;">Not you? Ignore this email — the sender won't see that you opened it.</p>
  </div>
</body></html>`
}
