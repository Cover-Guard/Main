import './config/env'
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
import { advisorRouter } from './routes/advisor'
import { stripeRouter, stripeWebhookRouter } from './routes/stripe'
import { dashboardRouter } from './routes/dashboard'
import { dealsRouter } from './routes/deals'
import { notificationsRouter } from './routes/notifications'
import { alertsRouter } from './routes/alerts'




// ─── Startup environment validation ────────────────────────────────────────
// config/env.ts (imported above) has already normalised prefixed Supabase vars
// and emitted soft warnings for optional keys (RENTCAST_API_KEY, FBI_UCR_API_KEY).
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




// ─── Security / middleware ──────────────────────────────────────────────────
app.set('trust proxy', 1) // trust X-Forwarded-For from load balancer / Vercel edge




const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'http://localhost:3000,https://coverguard.io,https://www.coverguard.io,https://api.coverguard.io'
)
  .split(',')
  .map((o) => o.trim())




/** Check if origin is allowed — supports exact match + known coverguard.io subdomains + Vercel previews. */
function isOriginAllowed(origin: string): boolean {
  if (origin.length > 256) return false
  if (allowedOrigins.includes(origin)) return true
  if (/^https:\/\/(www|api|app)\.coverguard\.io$/.test(origin)) return true
  if (/^https:\/\/[\w-]{1,52}-cover-guard\.vercel\.app$/.test(origin)) return true
  return false
}




const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true)
    if (isOriginAllowed(origin)) return callback(null, true)
    logger.warn(`CORS: blocked request from origin '${origin}'`)
    callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
}




app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(compression())




// ─── Rate limiting ──────────────────────────────────────────────────────────
// Factory to avoid repeating identical boilerplate across every limiter.
function makeLimiter(opts: { windowMs: number; max: number | string; message: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: typeof opts.max === 'string' ? parseInt(opts.max, 10) : opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip ?? 'unknown',
    message: { success: false, error: { code: 'RATE_LIMITED', message: opts.message } },
  })
}




// Three tiers:
// 1. Global safety net  — 500 req/min per IP (protects everything)
// 2. Unauthenticated search — 60 req/min per IP (prevents scraping)
// 3. External-data endpoints — 30 req/min per IP (risk/insurance/carriers)
// 4. Auth endpoints — 20 req per 15 min per IP
const globalLimiter = makeLimiter({
  windowMs: 60_000,
  max: process.env.RATE_LIMIT_GLOBAL ?? '500',
  message: 'Too many requests, please slow down.',
})
const searchLimiter = makeLimiter({
  windowMs: 60_000,
  max: process.env.RATE_LIMIT_SEARCH ?? '60',
  message: 'Search rate limit reached. Please wait a moment.',
})
const externalDataLimiter = makeLimiter({
  windowMs: 60_000,
  max: process.env.RATE_LIMIT_EXTERNAL ?? '30',
  message: 'Risk data rate limit reached. Please wait before fetching more reports.',
})
const authLimiter = makeLimiter({
  windowMs: 15 * 60_000,
  max: process.env.RATE_LIMIT_AUTH ?? '20',
  message: 'Too many auth attempts. Please try again later.',
})




// ─── Routes ─────────────────────────────────────────────────────────────────
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




app.get('/', (_req, res) => {
  res.json({
    name: 'CoverGuard API',
    version: '1.0.0',
    status: 'ok',
    endpoints: {
      health: '/health',
      properties: '/api/properties/search',
      auth: '/api/auth',
    },
  })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Static assets ────────────────────────────────────────────────────────────
// Prevent search engines from crawling the API
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n')
})




app.use('/api/auth', authLimiter, requestTimeout(40_000), authRouter)
app.use('/api/stripe', requestTimeout(40_000), stripeRouter)




// Search: moderate limit, fast timeout
app.use('/api/properties/search', searchLimiter, requestTimeout(40_000))




// External-data endpoints: stricter limit, longer timeout (upstream APIs can be slow)
app.use('/api/properties/:id/risk', externalDataLimiter, requestTimeout(45_000))
app.use('/api/properties/:id/insurance', externalDataLimiter, requestTimeout(45_000))
app.use('/api/properties/:id/carriers', externalDataLimiter, requestTimeout(40_000))
app.use('/api/properties/:id/insurability', externalDataLimiter, requestTimeout(40_000))




app.use('/api/properties', requestTimeout(45_000), propertiesRouter)
app.use('/api/clients', requestTimeout(40_000), clientsRouter)
app.use('/api/advisor', requestTimeout(40_000), advisorRouter)
app.use('/api/dashboard', requestTimeout(15_000), dashboardRouter)
app.use('/api/deals', requestTimeout(15_000), dealsRouter)
// Push subscription + notification dispatch (email + web push fan-out).
app.use('/api', requestTimeout(20_000), notificationsRouter)
app.use('/api/alerts', requestTimeout(15_000), alertsRouter)




// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})




// ─── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler)




// ─── Start (skip in serverless environments like Vercel) ────────────────────
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`CoverGuard API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
  })
}




export { app }
export default app
