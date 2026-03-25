import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Transpile the shared package when building from repo root (v0 / local dev)
  transpilePackages: ['@coverguard/shared'],

  // Webpack aliases so root-level app/ can import from the monorepo packages
  webpack: (config) => {
    config.resolve.alias['@coverguard/shared'] = path.resolve(__dirname, 'packages/shared/src')
    config.resolve.alias['@'] = path.resolve(__dirname, 'apps/web/src')
    return config
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
      },
    ],
  },
}

export default nextConfig
