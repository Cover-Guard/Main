import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  try {
    return await updateSession(request)
  } catch (err) {
    // If the session check fails (e.g. Supabase unreachable), allow the
    // request to continue rather than returning a 500 for every page load.
    console.error('Middleware session check failed:', err)
    return NextResponse.next({ request })
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
