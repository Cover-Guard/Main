/**
 * Web-push subscription management (browser side).
 *
 * Flow:
 *  1. On first load (after the user has authenticated), we check whether the
 *     browser supports Push, a SW is already registered, and the user has
 *     previously granted notification permission.
 *  2. If so, we make sure there's an active PushSubscription and persist its
 *     endpoint + keys to `push_subscriptions` via the `/api/push/subscribe`
 *     route.  That table is read by the server to fan out notifications.
 *
 * We don't prompt for permission automatically — that's a conscious UX call.
 * The NotificationBell has a "Enable push notifications" button that calls
 * `requestPushPermission()` below.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  // Explicit ArrayBuffer backing — Web Push requires `BufferSource`, which in
  // TS 5.7+ narrows ArrayBufferLike and excludes SharedArrayBuffer.
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid', { cache: 'no-store' })
    if (!res.ok) return null
    const json = (await res.json()) as { publicKey?: string }
    return json.publicKey ?? null
  } catch {
    return null
  }
}

/**
 * Register the browser with the push service + persist the subscription on the
 * server. Safe to call repeatedly — the server upserts on endpoint.
 *
 * Only runs if permission has already been granted; to prompt, call
 * `requestPushPermission()` first.
 */
export async function ensurePushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (Notification.permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()

  if (!sub) {
    const publicKey = await getVapidPublicKey()
    if (!publicKey) return false
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    } catch {
      return false
    }
  }

  // Persist to server (requires auth — server will validate).
  try {
    const token = await getAccessToken()
    if (!token) return false
    const subJson = sub.toJSON()
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
        userAgent: navigator.userAgent,
      }),
    })
    return true
  } catch {
    return false
  }
}

/**
 * Prompt the user to grant notification permission and, if granted, register
 * a push subscription. Returns true if the browser is now fully subscribed.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return false

  return ensurePushSubscription()
}

async function getAccessToken(): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/client')
  try {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}
