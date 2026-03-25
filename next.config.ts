/**
 * Root-level Next.js config — used ONLY when running `next dev/build` from the
 * repo root (e.g. v0 sandbox previews).  Vercel production builds use the config
 * at apps/web/next.config.ts via `turbo run build --filter=@coverguard/web`.
 */
import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@coverguard/shared'],

  webpack: (config) => {
    config.resolve.alias['@coverguard/shared'] = path.resolve(__dirname, 'packages/shared/src')
    config.resolve.alias['@'] = path.resolve(__dirname, 'apps/web/src')
    return config
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'api.mapbox.com' },
    ],
  },
}

export default nextConfig
