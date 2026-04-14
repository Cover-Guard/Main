import { NextResponse } from 'next/server'
import { SW_TEMPLATE } from '@/lib/sw-template'

/**
 * Dynamic service worker handler.
 *
 * The browser registers `/sw.js` (see ServiceWorkerRegistration.tsx), and
 * next.config.ts `beforeFiles` rewrites that path to `/sw`, which this
 * handler serves. We stamp the current build id into the SW script body
 * so each production release produces a byte-different SW, which:
 *
 *   1. Triggers the browser's normal SW update cycle (install → activate)
 *   2. Invalidates the prior cache keyed by `coverguard-<previous-build-id>`
 *   3. Broadcasts a `SW_UPDATED` message to open tabs (handled in
 *      ServiceWorkerRegistration.tsx) so they can soft-reload into the
 *      new build without the user having to clear cache or log out.
 *
 * This replaces the previous static public/sw.js which had a hardcoded
 * cache name and never invalidated across deploys — which was the primary
 * cause of users needing to clear their cache after each release.
 *
 * The build id comes from NEXT_PUBLIC_APP_VERSION, which is set in
 * next.config.ts from VERCEL_GIT_COMMIT_SHA.
 */

// Force dynamic rendering so `process.env.NEXT_PUBLIC_APP_VERSION` is read
// at server startup for each deployment rather than being statically
// inlined at build-time in a way Next might try to cache.
export const dynamic = 'force-dynamic'

const BUILD_ID = process.env.NEXT_PUBLIC_APP_VERSION || 'dev'

// Pre-compute the final SW body once per server process. Build id is fixed
// for the lifetime of a deployment, so there's no reason to re-substitute
// on every request.
const SW_BODY = SW_TEMPLATE.replace(/__BUILD_ID__/g, BUILD_ID)

export function GET() {
  return new NextResponse(SW_BODY, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  })
}
