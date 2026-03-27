import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
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
    if (!apiUrl) return []
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' maps.googleapis.com *.supabase.co",
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "img-src 'self' data: blob: *.supabase.co maps.googleapis.com maps.gstatic.com *.google.com *.ggpht.com lh3.googleusercontent.com coverguard.io www.coverguard.io",
              "font-src 'self' fonts.gstatic.com",
              "connect-src 'self' *.supabase.co maps.googleapis.com *.googleapis.com",
              "frame-src 'self' accounts.google.com *.supabase.co",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
