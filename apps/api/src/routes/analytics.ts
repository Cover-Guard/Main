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

    // Run ALL queries in a single Promise.all — Prisma queries + raw SQL UNION ALL
    // all execute concurrently instead of in two sequential batches.
    const [
      savedCount,
      clientCount,
      reportCount,
      totalSearchCount,
      recentSearches,
      recentSaved,
      recentReports,
      quoteRequestStats,
      clientPipelineRaw,
      combinedResults,
    ] = await Promise.all([
      prisma.savedProperty.count({ where: { userId } }),
      prisma.client.count({ where: { agentId: userId } }),
      prisma.propertyReport.count({ where: { userId } }),
      prisma.searchHistory.count({ where: { userId } }),

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
        select: { savedAt: true, property: { select: { address: true, city: true } } },
      }),

      prisma.propertyReport.findMany({
        where: { userId },
        orderBy: { generatedAt: 'desc' },
        take: 3,
        select: { reportType: true, generatedAt: true },
      }),

      prisma.quoteRequest.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),

      prisma.client.groupBy({
        by: ['status'],
        where: { agentId: userId },
        _count: { _all: true },
      }),

      // Raw SQL UNION ALL combining 6 analytical queries into 1 statement.
      // Each SELECT with ORDER BY / LIMIT is wrapped in a subquery so the
      // clauses apply to that SELECT only, not to the entire UNION ALL.
      prisma.$queryRaw<Array<Record<string, unknown>>>`
        -- searches_by_day
        SELECT 'searches_by_day' AS _query,
               date_trunc('day', "searchedAt")::text AS key1,
               NULL AS key2,
               COUNT(*)::int AS val,
               NULL::numeric AS n1, NULL::numeric AS n2, NULL::numeric AS n3,
               NULL::numeric AS n4, NULL::numeric AS n5, NULL::numeric AS n6,
               NULL AS s1
        FROM search_history
        WHERE "userId" = ${userId} AND "searchedAt" >= ${thirtyDaysAgo}
        GROUP BY 2

        UNION ALL

        -- searches_by_month
        SELECT 'searches_by_month',
               date_trunc('month', "searchedAt")::text, NULL,
               COUNT(*)::int, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM search_history
        WHERE "userId" = ${userId} AND "searchedAt" >= ${twelveMonthsAgo}
        GROUP BY 2

        UNION ALL

        -- risk_distribution
        SELECT 'risk_distribution',
               rp."overallRiskLevel", NULL,
               COUNT(*)::int, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        LEFT JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
        GROUP BY 2

        UNION ALL

        -- top_states (subquery so ORDER BY / LIMIT apply to this SELECT only)
        SELECT * FROM (
          SELECT 'top_states'::text,
                 p.state, NULL::text,
                 COUNT(*)::int, NULL::numeric, NULL::numeric, NULL::numeric,
                 NULL::numeric, NULL::numeric, NULL::numeric, NULL::text
          FROM saved_properties sp
          JOIN properties p ON p.id = sp."propertyId"
          WHERE sp."userId" = ${userId}
          GROUP BY 2
          ORDER BY 4 DESC
          LIMIT 10
        ) _top_states

        UNION ALL

        -- regional_risk (subquery so LIMIT applies to this SELECT only)
        SELECT * FROM (
          SELECT 'regional_risk'::text,
                 p.state, NULL::text,
                 COUNT(DISTINCT p.id)::int,
                 ROUND(AVG(rp."overallRiskScore")::numeric, 1),
                 ROUND(AVG(rp."floodRiskScore")::numeric, 1),
                 ROUND(AVG(rp."fireRiskScore")::numeric, 1),
                 ROUND(AVG(rp."windRiskScore")::numeric, 1),
                 ROUND(AVG(rp."earthquakeRiskScore")::numeric, 1),
                 ROUND(AVG(rp."crimeRiskScore")::numeric, 1),
                 MODE() WITHIN GROUP (ORDER BY rp."overallRiskLevel")
          FROM saved_properties sp
          JOIN properties p ON p.id = sp."propertyId"
          JOIN risk_profiles rp ON rp."propertyId" = p.id
          WHERE sp."userId" = ${userId}
          GROUP BY 2
          LIMIT 15
        ) _regional_risk

        UNION ALL

        -- avg_insurance_cost
        SELECT 'avg_insurance_cost',
               NULL, NULL,
               0,
               ROUND(AVG(ie."estimatedAnnualTotal")::numeric),
               NULL, NULL, NULL, NULL, NULL, NULL
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        JOIN insurance_estimates ie ON ie."propertyId" = p.id
        WHERE sp."userId" = ${userId}
      `,
    ])

    // Parse the combined results into separate datasets
    const searchesByDayRaw: Array<{ key1: string; val: number }> = []
    const searchesByMonthRaw: Array<{ key1: string; val: number }> = []
    const riskDistributionRaw: Array<{ key1: string; val: number }> = []
    const topStatesRaw: Array<{ key1: string; val: number }> = []
    const regionalRiskRaw: Array<Record<string, unknown>> = []
    let avgInsuranceCost: number | null = null

    for (const row of combinedResults) {
      const q = row._query as string
      // Skip rows with NULL keys (e.g. LEFT JOIN with no matching risk profile)
      if (q === 'searches_by_day' && row.key1) searchesByDayRaw.push({ key1: row.key1 as string, val: Number(row.val) || 0 })
      else if (q === 'searches_by_month' && row.key1) searchesByMonthRaw.push({ key1: row.key1 as string, val: Number(row.val) || 0 })
      else if (q === 'risk_distribution' && row.key1) riskDistributionRaw.push({ key1: row.key1 as string, val: Number(row.val) || 0 })
      else if (q === 'top_states' && row.key1) topStatesRaw.push({ key1: row.key1 as string, val: Number(row.val) || 0 })
      else if (q === 'regional_risk') regionalRiskRaw.push(row)
      else if (q === 'avg_insurance_cost') avgInsuranceCost = row.n1 ? Number(row.n1) : null
    }

    // Build searches-by-day map (fill gaps with 0)
    const byDay = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      byDay.set(d.toISOString().slice(0, 10), 0)
    }
    for (const row of searchesByDayRaw) {
      const d = new Date(row.key1)
      if (!isNaN(d.getTime())) byDay.set(d.toISOString().slice(0, 10), row.val)
    }
    const searchesByDay = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }))

    // Risk distribution
    const riskOrder = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME']
    const riskDistribution = riskDistributionRaw
      .filter((r) => r.key1 && riskOrder.includes(r.key1))
      .sort((a, b) => riskOrder.indexOf(a.key1) - riskOrder.indexOf(b.key1))
      .map((r) => ({ level: r.key1, count: r.val }))

    // Top states
    const topStates = topStatesRaw.map((r) => ({ state: r.key1, count: r.val }))

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

    // Regional risk — use || 0 to guard against NaN from NULL SQL values
    const regionalRisk = regionalRiskRaw.map((r) => ({
      state: r.key1 as string,
      propertyCount: Number(r.val) || 0,
      avgOverallScore: Number(r.n1) || 0,
      avgFloodScore: Number(r.n2) || 0,
      avgFireScore: Number(r.n3) || 0,
      avgWindScore: Number(r.n4) || 0,
      avgEarthquakeScore: Number(r.n5) || 0,
      avgCrimeScore: Number(r.n6) || 0,
      dominantRiskLevel: (r.s1 as string) ?? 'LOW',
    }))

    // Searches by month (fill gaps for 12 months)
    const byMonth = new Map<string, number>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(1) // Use 1st of month to avoid day-overflow when subtracting months
      d.setMonth(d.getMonth() - i)
      byMonth.set(d.toISOString().slice(0, 7), 0)
    }
    for (const row of searchesByMonthRaw) {
      const d = new Date(row.key1)
      if (!isNaN(d.getTime())) byMonth.set(d.toISOString().slice(0, 7), row.val)
    }
    const searchesByMonth = Array.from(byMonth.entries()).map(([month, count]) => ({ month, count }))

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
