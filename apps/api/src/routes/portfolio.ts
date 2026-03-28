import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const portfolioRouter = Router()
portfolioRouter.use(requireAuth)
portfolioRouter.use(requireSubscription)

// ─── Lender Portfolio Summary ────────────────────────────────────────────────
// Aggregates risk, value, and insurance data across all saved properties for
// lenders (also available to agents and admins).

portfolioRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    // Verify user role allows portfolio access
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })
    if (!user || !['LENDER', 'AGENT', 'ADMIN'].includes(user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Portfolio dashboard requires a Lender, Agent, or Admin role' },
      })
      return
    }

    // Run all portfolio queries in parallel
    const [
      totalProperties,
      valueAndRisk,
      riskDistributionRaw,
      avgInsuranceCostRaw,
      highRiskPropertiesRaw,
      riskByPerilRaw,
      stateExposureRaw,
    ] = await Promise.all([
      // Total saved properties
      prisma.savedProperty.count({ where: { userId } }),

      // Aggregated value and risk
      prisma.$queryRaw<
        Array<{ total_value: number | null; avg_risk: number | null }>
      >`
        SELECT
          COALESCE(SUM(p."estimatedValue"), 0)::BIGINT AS total_value,
          ROUND(AVG(rp."overallRiskScore")::numeric, 1) AS avg_risk
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        LEFT JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
      `,

      // Risk distribution
      prisma.$queryRaw<Array<{ level: string; count: bigint }>>`
        SELECT rp."overallRiskLevel" AS level, COUNT(*) AS count
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
        GROUP BY 1
        ORDER BY 1
      `,

      // Average insurance cost
      prisma.$queryRaw<Array<{ avg_cost: number | null }>>`
        SELECT ROUND(AVG(ie."estimatedAnnualTotal")::numeric) AS avg_cost
        FROM saved_properties sp
        JOIN insurance_estimates ie ON ie."propertyId" = sp."propertyId"
        WHERE sp."userId" = ${userId}
      `,

      // Top high-risk properties
      prisma.$queryRaw<
        Array<{
          property_id: string
          address: string
          city: string
          state: string
          estimated_value: number | null
          overall_risk_score: number
          overall_risk_level: string
        }>
      >`
        SELECT
          p.id AS property_id,
          p.address,
          p.city,
          p.state,
          p."estimatedValue" AS estimated_value,
          rp."overallRiskScore" AS overall_risk_score,
          rp."overallRiskLevel" AS overall_risk_level
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
          AND rp."overallRiskLevel" IN ('HIGH', 'VERY_HIGH', 'EXTREME')
        ORDER BY rp."overallRiskScore" DESC
        LIMIT 20
      `,

      // Average risk score by peril
      prisma.$queryRaw<
        Array<{
          avg_flood: number
          avg_fire: number
          avg_wind: number
          avg_earthquake: number
          avg_crime: number
        }>
      >`
        SELECT
          ROUND(AVG(rp."floodRiskScore")::numeric, 1) AS avg_flood,
          ROUND(AVG(rp."fireRiskScore")::numeric, 1) AS avg_fire,
          ROUND(AVG(rp."windRiskScore")::numeric, 1) AS avg_wind,
          ROUND(AVG(rp."earthquakeRiskScore")::numeric, 1) AS avg_earthquake,
          ROUND(AVG(rp."crimeRiskScore")::numeric, 1) AS avg_crime
        FROM saved_properties sp
        JOIN risk_profiles rp ON rp."propertyId" = sp."propertyId"
        WHERE sp."userId" = ${userId}
      `,

      // State exposure breakdown
      prisma.$queryRaw<
        Array<{
          state: string
          count: bigint
          total_value: number | null
          avg_risk: number
        }>
      >`
        SELECT
          p.state,
          COUNT(DISTINCT p.id) AS count,
          COALESCE(SUM(p."estimatedValue"), 0)::BIGINT AS total_value,
          ROUND(AVG(rp."overallRiskScore")::numeric, 1) AS avg_risk
        FROM saved_properties sp
        JOIN properties p ON p.id = sp."propertyId"
        LEFT JOIN risk_profiles rp ON rp."propertyId" = p.id
        WHERE sp."userId" = ${userId}
        GROUP BY p.state
        ORDER BY count DESC
        LIMIT 20
      `,
    ])

    const summary = {
      totalProperties,
      totalEstimatedValue: Number(valueAndRisk[0]?.total_value ?? 0),
      avgOverallRiskScore: Number(valueAndRisk[0]?.avg_risk ?? 0),
      riskDistribution: riskDistributionRaw.map((r) => ({
        level: r.level,
        count: Number(r.count),
      })),
      avgInsuranceCost: avgInsuranceCostRaw[0]?.avg_cost
        ? Number(avgInsuranceCostRaw[0].avg_cost)
        : null,
      highRiskProperties: highRiskPropertiesRaw.map((r) => ({
        propertyId: r.property_id,
        address: r.address,
        city: r.city,
        state: r.state,
        estimatedValue: r.estimated_value ? Number(r.estimated_value) : null,
        overallRiskScore: Number(r.overall_risk_score),
        overallRiskLevel: r.overall_risk_level,
      })),
      riskByPeril: riskByPerilRaw[0]
        ? {
            avgFloodScore: Number(riskByPerilRaw[0].avg_flood ?? 0),
            avgFireScore: Number(riskByPerilRaw[0].avg_fire ?? 0),
            avgWindScore: Number(riskByPerilRaw[0].avg_wind ?? 0),
            avgEarthquakeScore: Number(riskByPerilRaw[0].avg_earthquake ?? 0),
            avgCrimeScore: Number(riskByPerilRaw[0].avg_crime ?? 0),
          }
        : {
            avgFloodScore: 0,
            avgFireScore: 0,
            avgWindScore: 0,
            avgEarthquakeScore: 0,
            avgCrimeScore: 0,
          },
      stateExposure: stateExposureRaw.map((r) => ({
        state: r.state,
        count: Number(r.count),
        totalValue: Number(r.total_value ?? 0),
        avgRiskScore: Number(r.avg_risk ?? 0),
      })),
    }

    res.json({ success: true, data: summary })
  } catch (err) {
    next(err)
  }
})
