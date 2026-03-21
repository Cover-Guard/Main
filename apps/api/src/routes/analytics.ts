import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const analyticsRouter = Router()
analyticsRouter.use(requireAuth)

analyticsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const [
      savedProperties,
      clients,
      reports,
      searches,
    ] = await Promise.all([
      prisma.savedProperty.findMany({
        where: { userId },
        include: { property: { include: { riskProfile: true } } },
        orderBy: { savedAt: 'desc' },
      }),
      prisma.client.findMany({ where: { agentId: userId } }),
      prisma.propertyReport.findMany({ where: { userId } }),
      prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { searchedAt: 'desc' },
        take: 500,
      }),
    ])

    // Searches by day (last 30 days)
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const recentSearches = searches.filter((s) => s.searchedAt.getTime() > thirtyDaysAgo)

    const byDay = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000)
      byDay.set(d.toISOString().slice(0, 10), 0)
    }
    recentSearches.forEach((s) => {
      const day = s.searchedAt.toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    })

    const searchesByDay = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }))

    // Risk distribution
    const riskCounts = new Map<string, number>()
    savedProperties.forEach(({ property }) => {
      const level = property.riskProfile?.overallRiskLevel ?? 'UNKNOWN'
      riskCounts.set(level, (riskCounts.get(level) ?? 0) + 1)
    })
    const riskOrder = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME']
    const riskDistribution = riskOrder
      .filter((l) => riskCounts.has(l))
      .map((level) => ({ level, count: riskCounts.get(level)! }))

    // Top states
    const stateCounts = new Map<string, number>()
    savedProperties.forEach(({ property }) => {
      const s = property.state
      stateCounts.set(s, (stateCounts.get(s) ?? 0) + 1)
    })
    searches.slice(0, 200).forEach((s) => {
      const stateMatch = s.query.match(/,\s*([A-Z]{2})\s*/)?.[1]
      if (stateMatch) stateCounts.set(stateMatch, (stateCounts.get(stateMatch) ?? 0) + 1)
    })
    const topStates = Array.from(stateCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([state, count]) => ({ state, count }))

    // Recent activity
    const recentActivity = [
      ...searches.slice(0, 5).map((s) => ({
        type: 'search',
        description: `Searched "${s.query}"`,
        timestamp: s.searchedAt.toISOString(),
      })),
      ...savedProperties.slice(0, 5).map(({ property, savedAt }) => ({
        type: 'save',
        description: `Saved ${property.address}, ${property.city}`,
        timestamp: savedAt.toISOString(),
      })),
      ...reports.slice(0, 3).map((r) => ({
        type: 'report',
        description: `Generated ${r.reportType.replace('_', ' ').toLowerCase()} report`,
        timestamp: r.generatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    res.json({
      success: true,
      data: {
        totalSearches: searches.length,
        totalSavedProperties: savedProperties.length,
        totalClients: clients.length,
        totalReports: reports.length,
        searchesByDay,
        riskDistribution,
        topStates,
        recentActivity,
      },
    })
  } catch (err) { next(err) }
})
