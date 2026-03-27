import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use the direct (non-pooled) URL for CLI operations (db pull, generate, etc.)
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
