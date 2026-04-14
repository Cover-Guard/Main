import type { NextConfig } from 'next'
import path from 'path'

// ─── Build ID ─────────────────────────────────────────────────────────────
// Stable identifier for this deploy. Used for:
//   1. `generateBuildId` so Next.js's own chunk hashes align with our version
//   2. `env.NEXT_PUBLIC_APP_VERSION` so the client bundle knows which version
//      it was shipped as (used by Providers to detect version drift)
//   3. `x-app-version` response header so an already-loaded tab can discover
//      a new server version on focus and reload into it
//   4. The service worker route handler (/sw.js → /sw) which stamps this
//      into the cache name so each release invalidates prior SW caches
//
// Captured in a closure at config-load time — not re-evaluated per request —
// so all four usages agree on the same value for a given build.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.BUILD_ID ||
  `dev-${Date.now()}`

const nextConfig: NextConfig = {
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_APP_VERSION: buildId,
  },
  transpilePackages: ['@coverguard/shared'],
  webpack: (config) => {
    config.resolve.alias['@coverguard/shared'] = path.resolve(__dirname, '../../packages/shared/src')
    return config
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'coverguard.io' },
      { protocol: 'https', hostname: 'www.coverguard.io' },
    ],
  },
  async rewrites() {
    // Proxy /api/* requests to the API backend so the browser makes
    // same-origin calls and CORS is never needed.
    const apiUrl = process.env.API_REWRITE_URL ?? process.env.NEXT_PUBLIC_API_URL
    return {
      // beforeFiles: checked BEFORE Next.js hits the filesystem, so this
      // takes precedence over any legacy public/sw.js file and routes
      // /sw.js to our dynamic route handler that stamps the current
      // build id into the cache name.
      beforeFiles: [
        { source: '/sw.js', destination: '/sw' },
      ],
      afterFiles: apiUrl
        ? [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]
        : [],
      fallback: [],
    }
  },
  async headers() {
    return [
      // Service worker must be served from root scope with correct headers
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // Digital Asset Links for Android TWA verification
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Expose current server build id so clients can detect new
          // releases and soft-reload without users having to log out
          // or clear cache.
          { key: 'x-app-version', value: buildId },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} maps.googleapis.com *.gstatic.com *.supabase.co`,
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com maps.googleapis.com",
              "img-src 'self' data: blob: *.supabase.co maps.googleapis.com maps.gstatic.com *.google.com *.ggpht.com *.googleusercontent.com coverguard.io www.coverguard.io hazards.fema.gov apps.fs.usda.gov coast.noaa.gov *.arcgis.com earthquake.usgs.gov",
              "font-src 'self' fonts.gstatic.com",
              "connect-src 'self' *.supabase.co maps.googleapis.com *.googleapis.com *.gstatic.com *.googleusercontent.com hazards.fema.gov apps.fs.usda.gov coast.noaa.gov *.arcgis.com earthquake.usgs.gov",
              "frame-src 'self' accounts.google.com *.supabase.co",
              "worker-src 'self'",
              "manifest-src 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
