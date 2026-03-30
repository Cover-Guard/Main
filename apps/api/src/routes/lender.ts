import { Router } from 'express'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const lenderRouter = Router()

// ─── Role guard helper ───────────────────────────────────────────────────────

async function verifyLenderRole(req: Request): Promise<string | null> {
  const { userId } = req as AuthenticatedRequest
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (user?.role !== 'LENDER') return null
  return userId
}

// ─── Loan eligibility logic ──────────────────────────────────────────────────

function computeLoanEligibility(
  overallRiskScore: number | null,
  inSFHA: boolean,
): 'ELIGIBLE' | 'CONDITIONAL' | 'INELIGIBLE' {
  const score = overallRiskScore ?? 0
  if (score > 75) return 'INELIGIBLE'
  if (score >= 50 || inSFHA) return 'CONDITIONAL'
  return 'ELIGIBLE'
}

function computeFlags(risk: {
  inSFHA: boolean
  overallRiskScore: number
  overallRiskLevel: string
  floodZone: string | null
  hurricaneRisk: boolean
  wildlandUrbanInterface: boolean
  earthquakeRiskLevel: string
}): string[] {
  const flags: string[] = []
  if (risk.inSFHA) flags.push('In SFHA flood zone')
  if (risk.overallRiskScore > 75) flags.push('High overall risk')
  if (risk.hurricaneRisk) flags.push('Hurricane risk')
  if (risk.wildlandUrbanInterface) flags.push('Wildland-Urban Interface')
  if (risk.earthquakeRiskLevel === 'HIGH' || risk.earthquakeRiskLevel === 'VERY_HIGH' || risk.earthquakeRiskLevel === 'EXTREME') {
    flags.push('Seismic risk')
  }
  return flags
}

// ─── Portfolio summary ───────────────────────────────────────────────────────

lenderRouter.get('/portfolio', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const userId = await verifyLenderRole(req)
    if (!userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Lender access required' } })
      return
    }

    const saved = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        property: {
          select: {
            id: true,
            state: true,
            estimatedValue: true,
            riskProfile: {
              select: {
                overallRiskLevel: true,
                overallRiskScore: true,
                inSFHA: true,
              },
            },
            insuranceEstimate: {
              select: {
                estimatedAnnualTotal: true,
              },
            },
          },
        },
      },
    })

    const totalProperties = saved.length
    let totalRiskScore = 0
    let riskCount = 0
    let highRiskCount = 0
    let totalEstimatedValue = 0
    let totalInsuranceCost = 0
    let insuranceCount = 0
    let eligible = 0
    let conditional = 0
    let ineligible = 0

    const riskBuckets: Record<string, number> = {}
    const stateBuckets: Record<string, { count: number; totalRisk: number }> = {}

    for (const { property } of saved) {
      if (property.estimatedValue) totalEstimatedValue += property.estimatedValue

      const risk = property.riskProfile
      if (risk) {
        totalRiskScore += risk.overallRiskScore
        riskCount++
        const level = risk.overallRiskLevel
        riskBuckets[level] = (riskBuckets[level] ?? 0) + 1
        if (level === 'HIGH' || level === 'VERY_HIGH' || level === 'EXTREME') highRiskCount++

        const eligibility = computeLoanEligibility(risk.overallRiskScore, risk.inSFHA)
        if (eligibility === 'ELIGIBLE') eligible++
        else if (eligibility === 'CONDITIONAL') conditional++
        else ineligible++
      } else {
        // No risk profile — treat as conditional
        conditional++
      }

      const ins = property.insuranceEstimate
      if (ins) {
        totalInsuranceCost += ins.estimatedAnnualTotal
        insuranceCount++
      }

      const st = property.state
      if (!stateBuckets[st]) stateBuckets[st] = { count: 0, totalRisk: 0 }
      stateBuckets[st].count++
      if (risk) stateBuckets[st].totalRisk += risk.overallRiskScore
    }

    const riskDistribution = Object.entries(riskBuckets).map(([level, count]) => ({ level, count }))
    const propertiesByState = Object.entries(stateBuckets).map(([state, data]) => ({
      state,
      count: data.count,
      avgRisk: data.count > 0 ? Math.round(data.totalRisk / data.count) : 0,
    }))

    res.json({
      success: true,
      data: {
        totalProperties,
        avgRiskScore: riskCount > 0 ? Math.round(totalRiskScore / riskCount) : 0,
        highRiskCount,
        totalEstimatedValue,
        avgInsuranceCost: insuranceCount > 0 ? Math.round(totalInsuranceCost / insuranceCount) : null,
        riskDistribution,
        propertiesByState,
        loanEligibility: { eligible, conditional, ineligible },
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Properties list ─────────────────────────────────────────────────────────

lenderRouter.get('/properties', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const userId = await verifyLenderRole(req)
    if (!userId) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Lender access required' } })
      return
    }

    const saved = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        savedAt: true,
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            estimatedValue: true,
            riskProfile: {
              select: {
                overallRiskLevel: true,
                overallRiskScore: true,
                floodZone: true,
                inSFHA: true,
                hurricaneRisk: true,
                wildlandUrbanInterface: true,
                earthquakeRiskLevel: true,
                floodRiskLevel: true,
              },
            },
            insuranceEstimate: {
              select: {
                floodRequired: true,
                earthquakeRequired: true,
                fireRequired: true,
                windRequired: true,
              },
            },
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    })

    const rows = saved.map(({ savedAt, property }) => {
      const risk = property.riskProfile
      const ins = property.insuranceEstimate
      const inSFHA = risk?.inSFHA ?? false
      const insuranceRequired = !!(ins?.floodRequired || ins?.earthquakeRequired || ins?.fireRequired || ins?.windRequired)

      return {
        propertyId: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        estimatedValue: property.estimatedValue,
        overallRiskLevel: risk?.overallRiskLevel ?? null,
        overallRiskScore: risk?.overallRiskScore ?? null,
        floodZone: risk?.floodZone ?? null,
        inSFHA,
        insuranceRequired,
        loanEligibility: computeLoanEligibility(risk?.overallRiskScore ?? null, inSFHA),
        flags: risk
          ? computeFlags({
              inSFHA: risk.inSFHA,
              overallRiskScore: risk.overallRiskScore,
              overallRiskLevel: risk.overallRiskLevel,
              floodZone: risk.floodZone,
              hurricaneRisk: risk.hurricaneRisk,
              wildlandUrbanInterface: risk.wildlandUrbanInterface,
              earthquakeRiskLevel: risk.earthquakeRiskLevel,
            })
          : [],
        savedAt: savedAt.toISOString(),
      }
    })

    res.json({ success: true, data: rows })
  } catch (err) {
    next(err)
  }
})
