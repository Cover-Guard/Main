import { Router } from 'express'
import type { Request } from 'express'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import { getDashboardTicker } from '../services/dashboardActivityService'

export const dashboardRouter = Router()

dashboardRouter.get('/ticker', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDashboardTicker(userId)
    // Short cache so a refresh between polls is cheap, but live enough that
    // saving a property and reloading the dashboard reflects it within a minute.
    res.set('Cache-Control', 'private, max-age=30')
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})
