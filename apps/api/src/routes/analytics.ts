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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Run all DB queries in parallel, each scoped and limited at DB level
    const [
      savedCount,
      clientCount,
      reportCount,
      totalSearchCount,
      // Searches per day — aggregated in DB, not in JS
      searchesByDayRaw,
      // Risk distribution — aggregated in DB via groupBy
      riskDistributionRaw,
      // Top states from saved properties — aggregated in DB
      topStatesRaw,
      // Recent activity: small slices of sorted tables
      recentSearches,
      recentSaved,
      recentReports,
    ] = await Promise.all([
      prisma.savedProperty.count({ where: { userId } }),
      prisma.client.count({ where: { agentId: userId } }),
      prisma.propertyReport.count({ where: { userId } }),
      prisma.searchHistory.count({ where: { userId } }),

      // Searches per day — raw SQL for date-trunc aggregation
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "searchedAt") AS day, COUNT(*) AS count
        FROM search_history
        WHERE "userId" = ${userId}
          AND "searchedAt" >= ${thirtyDaysAgo}
        GROUP BY 1
        ORDER BY 1
      `,

      // Risk level distribution across saved properties
      prisma.$queryRaw<Array<{ level: string; count: bigint }>>`
        SELECT rp."overallRiskLevel" AS level, COUNT(*) AS count
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        LEFT JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
        GROUP BY 1
        ORDER BY 1
      `,

      // Top states from saved properties
      prisma.$queryRaw<Array<{ state: string; count: bigint }>>`
        SELECT p.state, COUNT(*) AS count
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        WHERE sp."userId" = ${userId}
        GROUP BY p.state
        ORDER BY count DESC
        LIMIT 10
      `,

      prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { searchedAt: 'desc' },
        take: 5,
        select: { query: true, searchedAt: true },
      }),

      prisma.savedProperty.findMany({
        where: { userId },
        orderBy: { savedAt: 'desc' },
        take: 5,
        include: { property: { select: { address: true, city: true } } },
      }),

      prisma.propertyReport.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 3,
        select: { reportType: true, generatedAt: true },
      }),
    ])

    // Build searches-by-day map (fill gaps with 0)
    const byDay = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      byDay.set(d.toISOString().slice(0, 10), 0)
    }
    for (const row of searchesByDayRaw) {
      const day = new Date(row.day).toISOString().slice(0, 10)
      byDay.set(day, Number(row.count))
    }
    const searchesByDay = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }))

    // Risk distribution
    const riskOrder = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME']
    const riskDistribution = riskDistributionRaw
      .filter((r: { level: string | null; count: bigint }) => r.level && riskOrder.includes(r.level))
      .sort(
        (a: { level: string | null; count: bigint }, b: { level: string | null; count: bigint }) =>
          riskOrder.indexOf(a.level as string) - riskOrder.indexOf(b.level as string),
      )
      .map((r: { level: string | null; count: bigint }) => ({ level: r.level as string, count: Number(r.count) }))

    // Top states
    const topStates = topStatesRaw.map((r: { state: string; count: bigint }) => ({ state: r.state, count: Number(r.count) }))

    // Recent activity (merge and sort the three small slices)
    const recentActivity = [
      ...recentSearches.map((s: { query: string; searchedAt: Date }) => ({
        type: 'search',
        description: `Searched "${s.query}"`,
        timestamp: s.searchedAt.toISOString(),
      })),
      ...recentSaved.map(({ property, savedAt }: { property: { address: string; city: string }; savedAt: Date }) => ({
        type: 'save',
        description: `Saved ${property.address}, ${property.city}`,
        timestamp: savedAt.toISOString(),
      })),
      ...recentReports.map((r: { reportType: string; generatedAt: Date }) => ({
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
        totalSearches: totalSearchCount,
        totalSavedProperties: savedCount,
        totalClients: clientCount,
        totalReports: reportCount,
        searchesByDay,
        riskDistribution,
        topStates,
        recentActivity,
      },
    })
  } catch (err) {
    next(err)
  }
})
