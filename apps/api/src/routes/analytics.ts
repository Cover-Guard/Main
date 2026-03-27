import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const analyticsRouter = Router()
analyticsRouter.use(requireAuth)
analyticsRouter.use(requireSubscription)

analyticsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    // Run all DB queries in parallel, each scoped and limited at DB level
    const [
      savedCount,
      clientCount,
      reportCount,
      totalSearchCount,
      searchesByDayRaw,
      riskDistributionRaw,
      topStatesRaw,
      recentSearches,
      recentSaved,
      recentReports,
      // New queries
      quoteRequestStats,
      clientPipelineRaw,
      regionalRiskRaw,
      searchesByMonthRaw,
      avgInsuranceCostRaw,
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

      // Quote request counts by status
      prisma.quoteRequest.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),

      // Client pipeline breakdown by status
      prisma.client.groupBy({
        by: ['status'],
        where: { agentId: userId },
        _count: { _all: true },
      }),

      // Regional risk data — avg scores per state across saved properties
      prisma.$queryRaw<
        Array<{
          state: string
          property_count: bigint
          avg_overall: number
          avg_flood: number
          avg_fire: number
          avg_wind: number
          avg_earthquake: number
          avg_crime: number
          dominant_level: string
        }>
      >`
        SELECT
          p.state,
          COUNT(DISTINCT p.id) AS property_count,
          ROUND(AVG(rp."overallRiskScore")::numeric, 1) AS avg_overall,
          ROUND(AVG(rp."floodRiskScore")::numeric, 1) AS avg_flood,
          ROUND(AVG(rp."fireRiskScore")::numeric, 1) AS avg_fire,
          ROUND(AVG(rp."windRiskScore")::numeric, 1) AS avg_wind,
          ROUND(AVG(rp."earthquakeRiskScore")::numeric, 1) AS avg_earthquake,
          ROUND(AVG(rp."crimeRiskScore")::numeric, 1) AS avg_crime,
          MODE() WITHIN GROUP (ORDER BY rp."overallRiskLevel") AS dominant_level
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
        GROUP BY p.state
        ORDER BY property_count DESC
        LIMIT 15
      `,

      // Searches by month (last 12 months)
      prisma.$queryRaw<Array<{ month: Date; count: bigint }>>`
        SELECT date_trunc('month', "searchedAt") AS month, COUNT(*) AS count
        FROM search_history
        WHERE "userId" = ${userId}
          AND "searchedAt" >= ${twelveMonthsAgo}
        GROUP BY 1
        ORDER BY 1
      `,

      // Average annual insurance cost across saved properties
      prisma.$queryRaw<Array<{ avg_cost: number | null }>>`
        SELECT ROUND(AVG(ie."estimatedAnnualTotal")::numeric) AS avg_cost
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        JOIN insurance_estimates ie ON ie."propertyId" = p.id
        WHERE sp."userId" = ${userId}
      `,
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
      .filter((r) => r.level && riskOrder.includes(r.level))
      .sort((a, b) => riskOrder.indexOf(a.level) - riskOrder.indexOf(b.level))
      .map((r) => ({ level: r.level, count: Number(r.count) }))

    // Top states
    const topStates = topStatesRaw.map((r) => ({ state: r.state, count: Number(r.count) }))

    // Recent activity (merge and sort the three small slices)
    const recentActivity = [
      ...recentSearches.map((s) => ({
        type: 'search',
        description: `Searched "${s.query}"`,
        timestamp: s.searchedAt.toISOString(),
      })),
      ...recentSaved.map(({ property, savedAt }) => ({
        type: 'save',
        description: `Saved ${property.address}, ${property.city}`,
        timestamp: savedAt.toISOString(),
      })),
      ...recentReports.map((r) => ({
        type: 'report',
        description: `Generated ${r.reportType.replace('_', ' ').toLowerCase()} report`,
        timestamp: r.generatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    // Quote request metrics
    const quoteStatusMap: Record<string, number> = {}
    for (const row of quoteRequestStats) {
      quoteStatusMap[row.status] = row._count._all
    }
    const quoteRequests = {
      total: Object.values(quoteStatusMap).reduce((s, c) => s + c, 0),
      pending: quoteStatusMap['PENDING'] ?? 0,
      sent: quoteStatusMap['SENT'] ?? 0,
      responded: quoteStatusMap['RESPONDED'] ?? 0,
      declined: quoteStatusMap['DECLINED'] ?? 0,
    }

    // Client pipeline
    const clientStatusMap: Record<string, number> = {}
    for (const row of clientPipelineRaw) {
      clientStatusMap[row.status] = row._count._all
    }
    const clientPipeline = {
      active: clientStatusMap['ACTIVE'] ?? 0,
      prospect: clientStatusMap['PROSPECT'] ?? 0,
      closed: clientStatusMap['CLOSED'] ?? 0,
      inactive: clientStatusMap['INACTIVE'] ?? 0,
    }

    // Regional risk
    const regionalRisk = regionalRiskRaw.map((r) => ({
      state: r.state,
      propertyCount: Number(r.property_count),
      avgOverallScore: Number(r.avg_overall),
      avgFloodScore: Number(r.avg_flood),
      avgFireScore: Number(r.avg_fire),
      avgWindScore: Number(r.avg_wind),
      avgEarthquakeScore: Number(r.avg_earthquake),
      avgCrimeScore: Number(r.avg_crime),
      dominantRiskLevel: r.dominant_level,
    }))

    // Searches by month (fill gaps for 12 months)
    const byMonth = new Map<string, number>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      byMonth.set(d.toISOString().slice(0, 7), 0)
    }
    for (const row of searchesByMonthRaw) {
      const month = new Date(row.month).toISOString().slice(0, 7)
      byMonth.set(month, Number(row.count))
    }
    const searchesByMonth = Array.from(byMonth.entries()).map(([month, count]) => ({ month, count }))

    // Avg insurance cost
    const avgInsuranceCost = avgInsuranceCostRaw[0]?.avg_cost
      ? Number(avgInsuranceCostRaw[0].avg_cost)
      : null

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
        quoteRequests,
        clientPipeline,
        regionalRisk,
        searchesByMonth,
        avgInsuranceCost,
      },
    })
  } catch (err) {
    next(err)
  }
})
