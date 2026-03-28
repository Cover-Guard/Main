import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use the direct (non-pooled) URL for CLI operations (db pull, generate, etc.)
    // Supabase Vercel Integration provides POSTGRES_URL_NON_POOLED / POSTGRES_URL
    // instead of DIRECT_URL / DATABASE_URL.
    url: process.env['DIRECT_URL']
      ?? process.env['POSTGRES_URL_NON_POOLED']
      ?? process.env['DATABASE_URL']
      ?? process.env['POSTGRES_PRISMA_URL']
      ?? process.env['POSTGRES_URL'],
  },
})
