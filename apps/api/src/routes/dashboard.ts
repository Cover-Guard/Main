import { Router } from 'express'
import type { Request } from 'express'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { getDashboardTicker } from '../services/dashboardActivityService'
import { getDashboardKpis } from '../services/dashboardKpisService'
import { getDashboardForecast } from '../services/dashboardForecastService'
import { getDashboardRiskTrend } from '../services/dashboardRiskTrendService'
import {
  getDashboardActiveCarriers,
  getDashboardInsights,
  getDashboardPortfolioMix,
} from '../services/dashboardPanelsService'

export const dashboardRouter = Router()

dashboardRouter.get('/ticker', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardTicker(userId)
    res.set('Cache-Control', 'private, max-age=30')
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// PR-B1.e: per-KPI detail.
dashboardRouter.get('/kpis', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardKpis(userId)
    res.set('Cache-Control', 'private, max-age=60')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// PR-B1.f: 12-month premium / claims forecast.
dashboardRouter.get('/forecast', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardForecast(userId)
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// PR-B1.g: 12-month average-risk-score trend.
dashboardRouter.get('/risk-trend', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardRiskTrend(userId)
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// PR-B1.h: portfolio mix.
dashboardRouter.get('/portfolio-mix', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardPortfolioMix(userId)
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// PR-B1.h: insights feed.
dashboardRouter.get('/insights', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardInsights(userId)
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// PR-B1.h: active carriers.
dashboardRouter.get('/active-carriers', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardActiveCarriers(userId)
    res.set('Cache-Control', 'private, max-age=300')
    res.json({ success: true, data })
  } catch (err) { next(err) }
})
