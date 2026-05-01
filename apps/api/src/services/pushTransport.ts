/**
 * Web push transport â I/O wrapper around `web-push` (PR 11).
 *
 * Kept separate from `pushDispatcher.ts` so the pure helpers there can be
 * unit-tested without pulling `web-push` into the test runtime.
 *
 * `dispatchPush` returns a normalised `DispatchResult` so callers don't
 * have to reach into the WebPushError shape:
 *   â¢ `gone: true`     â 404/410 â caller should delete the subscription
 *   â¢ `ok: false` + statusCode â transient â caller should bump the failure counter
 *   â¢ `ok: true`       â caller should mark `lastUsedAt`
 */

import webpush, { type WebPushError } from 'web-push'
import type { PushPayload, PushSubscription } from './pushDispatcher'

export type DispatchResult =
  | { ok: true }
  | { ok: false; reason: string; statusCode?: number; gone?: boolean }

let vapidConfigured = false

/**
 * Configure VAPID once at boot. Idempotent â subsequent calls update the
 * keys in place. Returns `true` if VAPID is now usable.
 */
export function configureVapid(opts: {
  publicKey: string | undefined
  privateKey: string | undefined
  subject?: string
}): boolean {
  if (!opts.publicKey || !opts.privateKey) {
    vapidConfigured = false
    return false
  }
  try {
    webpush.setVapidDetails(
      opts.subject ?? 'mailto:notifications@coverguard.io',
      opts.publicKey,
      opts.privateKey,
    )
    vapidConfigured = true
  } catch {
    vapidConfigured = false
  }
  return vapidConfigured
}

export function isVapidConfigured(): boolean {
  return vapidConfigured
}

/**
 * Send one push to one subscription. Caller decides what to do with the
 * result; this function never throws.
 */
export async function dispatchPush(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<DispatchResult> {
  if (!vapidConfigured) {
    return { ok: false, reason: 'vapid not configured' }
  }
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    )
    return { ok: true }
  } catch (err) {
    const wpErr = err as WebPushError
    const status = wpErr?.statusCode
    const gone = status === 404 || status === 410
    return {
      ok: false,
      reason: wpErr?.message ?? String(err),
      statusCode: status,
      gone,
    }
  }
}

// Auto-configure on module load when env vars are present.
configureVapid({
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT,
})
