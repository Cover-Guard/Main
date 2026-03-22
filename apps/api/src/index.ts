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

const app = express()
const PORT = parseInt(process.env.PORT ?? '4000', 10)

// ─── Security / middleware ────────────────────────────────────────────────────

app.use(helmet())
app.set('trust proxy', 1) // trust X-Forwarded-For from load balancer / Vercel edge

const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'http://localhost:3000,https://coverguard.io,https://www.coverguard.io'
)
  .split(',')
  .map((o) => o.trim())

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`CORS: origin '${origin}' not allowed`))
    },
    credentials: true,
  }),
)
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }),
)

// ─── Rate limiting ────────────────────────────────────────────────────────────
//
// Three tiers:
//   1. Global safety net — 500 req/min per IP (protects everything)
//   2. Unauthenticated search — 30 req/min per IP (prevents scraping)
//   3. External-data endpoints — 20 req/min per IP (risk/insurance/carriers)
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

app.use('/api', globalLimiter)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', requestTimeout(15_000), authRouter)

// Search: moderate limit, fast timeout
app.use(
  '/api/properties/search',
  searchLimiter,
  requestTimeout(10_000),
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
  requestTimeout(30_000),
)
app.use(
  '/api/properties/:id/carriers',
  externalDataLimiter,
  requestTimeout(20_000),
)
app.use(
  '/api/properties/:id/insurability',
  externalDataLimiter,
  requestTimeout(20_000),
)

app.use('/api/properties', requestTimeout(30_000), propertiesRouter)
app.use('/api/clients', requestTimeout(15_000), clientsRouter)
app.use('/api/analytics', requestTimeout(20_000), analyticsRouter)

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
