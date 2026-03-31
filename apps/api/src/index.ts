import './config/env'
import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import { rateLimit, type Options as RateLimitOptions } from 'express-rate-limit'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { requestTimeout } from './middleware/timeout'
import { propertiesRouter } from './routes/properties'
import { authRouter } from './routes/auth'
import { clientsRouter } from './routes/clients'
import { analyticsRouter } from './routes/analytics'
import { advisorRouter } from './routes/advisor'
import { stripeRouter, stripeWebhookRouter } from './routes/stripe'

// ─── Startup environment validation ────────────────────────────────────────
// config/env.ts (imported above) has already normalised prefixed Supabase vars
// and emitted soft warnings for optional keys (ATTOM_API_KEY, FBI_UCR_API_KEY).
const hasDbUrl = !!(
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL
)
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k])
if (!hasDbUrl) {
  missingEnv.unshift('DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL)')
}
if (missingEnv.length > 0) {
  const msg = `FATAL: Missing required environment variables: ${missingEnv.join(', ')}`
  if (process.env.VERCEL === '1') {
    // In serverless mode, let Express boot so routes return proper JSON errors
    // instead of crashing the function and serving an HTML 500 page.
