import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'

import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { requestTimeout } from './middleware/timeout'
import { propertiesRouter } from './routes/properties'
import { authRouter } from './routes/auth'
import { clientsRouter } from './routes/clients'
import { analyticsRouter } from './routes/analytics'
import { advisorRouter } from './routes/advisor'
import { stripeRouter, stripeWebhookRouter } from './routes/stripe'

// ─── Runtime env var normalization ───────────────────────────────────────────
// The Supabase Vercel Integration names env vars with a project-specific prefix
// (e.g. COVERGUARD_2_SUPABASE_URL instead of SUPABASE_URL).
// scripts/normalize-env.sh handles this at build time, but serverless functions
// get the raw env vars at runtime. Mirror the same logic here.
{
  const label = process.env.SUPABASE_ENV_LABEL ?? 'COVERGUARD_2'
  const vars = [
    'DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLED',
    'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  ]
  for (const name of vars) {
    if (process.env[name]) continue
    // Check prefix convention: LABEL_VARNAME
    const prefixed = `${label}_${name}`
    if (process.env[prefixed]) {
      process.env[name] = process.env[prefixed]
      continue
    }
    // Check suffix convention: VARNAME_LABEL
    const suffixed = `${name}_${label}`
    if (process.env[suffixed]) {
      process.env[name] = process.env[suffixed]
    }
  }
}

// ─── Startup environment validation ──────────────────────────────────────────

// The Supabase Vercel Integration provides POSTGRES_PRISMA_URL / POSTGRES_URL
// instead of DATABASE_URL — accept any of them.
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
    console.error(msg)
  } else {
    console.error(msg)
    process.exit(1)
  }
}

const app = express()
const PORT = parseInt(process.env.PORT ?? '4000', 10)

// ─── Security / middleware ────────────────────────────────────────────────────

app.set('trust proxy', 1) // trust X-Forwarded-For from load balancer / Vercel edge

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'http://localhost:3000,https://coverguard.io,https://www.coverguard.io,https://api.coverguard.io'
)
  .split(',')
  .map((o) => o.trim())

/** Check if origin is allowed — supports exact match + *.coverguard.io subdomains. */
function isOriginAllowed(origin: string): boolean {
  if (origin.length > 256) return false
  if (allowedOrigins.includes(origin)) return true
  // Allow any *.coverguard.io subdomain (Vercel preview deploys, api subdomain, etc.)
  if (/^https:\/\/[\w-]{1,52}\.coverguard\.io$/.test(origin)) return true
  // Allow Vercel preview URLs for this project
  if (/^https:\/\/[\w-]{1,52}-cover-guard\.vercel\.app$/.test(origin)) return true
  return false
}

// CORS must run before helmet so preflight OPTIONS requests get headers
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true)
    if (isOriginAllowed(origin)) return callback(null, true)
    // Don't throw — log and reject without crashing the error handler
    logger.warn(`CORS: blocked request from origin '${origin}'`)
    callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // cache preflight for 24 hours
}

app.use(cors(corsOptions))

// Explicitly handle all OPTIONS preflight requests
app.options('*', cors(corsOptions))

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)
app.use(compression())

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// Three tiers:
//   1. Global safety net — 500 req/min per IP (protects everything)
//   2. Unauthenticated search — 60 req/min per IP (prevents scraping)
//   3. External-data endpoints — 30 req/min per IP (risk/insurance/carriers)
//      These trigger upstream API calls; limit them tightly.

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL ?? '500', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.' },
  },
})

// Apply global rate limit BEFORE any route handlers (including webhooks)
app.use('/api', globalLimiter)

// Stripe webhook must receive the raw body for signature verification —
// mount it AFTER the rate limiter but BEFORE the global express.json() parser.
app.use('/api/stripe', stripeWebhookRouter)

app.use(express.json({ limit: '1mb' }))
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
)

const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_SEARCH ?? '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Search rate limit reached. Please wait a moment.' },
  },
})

const externalDataLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_EXTERNAL ?? '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Risk data rate limit reached. Please wait before fetching more reports.',
    },
  },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH ?? '20', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many auth attempts. Please try again later.' },
  },
})

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authLimiter, requestTimeout(40_000), authRouter)
app.use('/api/stripe', requestTimeout(40_000), stripeRouter)

// Search: moderate limit, fast timeout
app.use(
  '/api/properties/search',
  searchLimiter,
  requestTimeout(40_000),
)

// External-data endpoints: stricter limit, longer timeout (upstream APIs can be slow)
app.use(
  '/api/properties/:id/risk',
  externalDataLimiter,
  requestTimeout(45_000),
)
app.use(
  '/api/properties/:id/insurance',
  externalDataLimiter,
  requestTimeout(45_000),
)
app.use(
  '/api/properties/:id/carriers',
  externalDataLimiter,
  requestTimeout(40_000),
)
app.use(
  '/api/properties/:id/insurability',
  externalDataLimiter,
  requestTimeout(40_000),
)

app.use('/api/properties', requestTimeout(45_000), propertiesRouter)
app.use('/api/clients', requestTimeout(40_000), clientsRouter)
app.use('/api/analytics', requestTimeout(40_000), analyticsRouter)
app.use('/api/advisor', requestTimeout(40_000), advisorRouter)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  })
})

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler)

// ─── Start (skip in serverless environments like Vercel) ─────────────────────

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(
      `CoverGuard API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`,
    )
  })
}

export { app }
export default app
