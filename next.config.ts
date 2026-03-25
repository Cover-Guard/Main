import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Point to apps/web/src as the source directory
  distDir: '.next',
  
  // Transpile the shared package
  transpilePackages: ['@coverguard/shared'],
  
  // Webpack alias for shared package
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
