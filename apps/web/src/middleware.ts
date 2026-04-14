import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (err) {
    // If the session check fails, allow the request to continue rather
    // than returning a 500 for every page load.
    console.error('Middleware session check failed:', err)
    const res = NextResponse.next({ request })

    // Self-heal from stale / incompatible Supabase cookies. After a
    // @supabase/ssr dependency bump or a token schema change, previously
    // issued cookies can become unparseable — without this, every request
    // would silently fail session lookup, making users feel "logged out"
    // and forcing them to manually clear cookies after a deploy.
    //
    // We only clear on errors that look like cookie/token format issues,
    // NOT on transient network errors (we don't want a briefly-unreachable
    // Supabase to force everyone to re-login).
    const msg = err instanceof Error ? err.message : ''
    const isCookieFormatError =
      err instanceof SyntaxError ||
      /cookie|token|jwt|parse|decode|base64|malformed/i.test(msg)
    if (isCookieFormatError) {
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith('sb-')) {
          res.cookies.delete(cookie.name)
        }
      }
    }
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static, _next/image (Next.js internals)
     *  - favicon.ico and common static file extensions
     *  - /api/* routes (proxied to Express API which has its own auth)
     *  - manifest.json, robots.txt, sitemap.xml (public static assets)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|api/|manifest\\.json|robots\\.txt|sitemap\\.xml|sw\\.js|offline\\.html|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)',
  ],
}
