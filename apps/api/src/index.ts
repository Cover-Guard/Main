import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'

import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { propertiesRouter } from './routes/properties'
import { authRouter } from './routes/auth'
import { clientsRouter } from './routes/clients'
import { analyticsRouter } from './routes/analytics'

const app = express()
const PORT = parseInt(process.env.PORT ?? '4000', 10)

// ─── Security / middleware ────────────────────────────────────────────────────

app.use(helmet())
const allowedOrigins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'http://localhost:3000,https://coverguard.io,https://www.coverguard.io'
).split(',').map((o) => o.trim())

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Vercel edge)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin '${origin}' not allowed`))
  },
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}))

// ─── Rate limiting ────────────────────────────────────────────────────────────

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
})
app.use('/api', limiter)

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/properties', propertiesRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/analytics', analyticsRouter)

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } })
})

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler)

// ─── Start (skip in serverless environments like Vercel) ─────────────────────

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`CoverGuard API running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`)
  })
}

export { app }
export default app
