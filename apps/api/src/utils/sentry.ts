import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

let initialized = false

/**
 * Initialize Sentry on the API. Safe to call multiple times — only the first
 * call has effect. If SENTRY_DSN is not configured, this is a no-op so local
 * development without a Sentry project just works.
 *
 * Wiring:
 *   import { initSentry } from './utils/sentry'
 *   initSentry()  // call once, before Express, in apps/api/src/index.ts
 *
 * The errorHandler middleware (apps/api/src/middleware/errorHandler.ts) calls
 * Sentry.captureException on 5xx paths. 4xx errors (validation, conflicts,
 * not-found) are intentionally not captured — those are user errors, not
 * platform errors.
 */
export function initSentry(): void {
  if (initialized) return
  if (!process.env.SENTRY_DSN) {
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.GIT_SHA || undefined,
    // Conservative sampling: 10% in production, 100% in dev so local errors
    // surface immediately without a Sentry quota concern.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [nodeProfilingIntegration()],
    beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
      // PII scrubbing. Sentry breadcrumbs/contexts can carry the full request,
      // including Authorization headers, cookies, and POST bodies. Strip the
      // most common leak vectors before transmission. Defensive try/catch:
      // never throw from beforeSend, otherwise events stop being delivered.
      try {
        if (event.request?.headers) {
          const headers = event.request.headers as Record<string, unknown>
          delete headers.authorization
          delete headers.Authorization
          delete headers.cookie
          delete headers.Cookie
        }
        if (event.request?.data && typeof event.request.data === 'object') {
          const data = event.request.data as Record<string, unknown>
          if ('password' in data) data.password = '[REDACTED]'
          if ('email' in data) data.email = '[REDACTED]'
          if ('token' in data) data.token = '[REDACTED]'
        }
      } catch {
        // Swallow — better to ship a partially-scrubbed event than to drop it.
      }
      return event
    },
  })

  initialized = true
}

export { Sentry }
