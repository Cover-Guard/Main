import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

/**
 * Simplified risk profile data for alert comparison.
 * This avoids coupling to the full Prisma/DTO types.
 */
export interface RiskProfileData {
  overallRiskLevel: string
  overallRiskScore: number
  floodRiskScore: number
  fireRiskScore: number
  windRiskScore: number
  earthquakeRiskScore: number
  crimeRiskScore: number
  floodRiskLevel: string
  fireRiskLevel: string
  windRiskLevel: string
  earthquakeRiskLevel: string
  crimeRiskLevel: string
}

type RiskCategory = 'OVERALL' | 'FLOOD' | 'FIRE' | 'WIND' | 'EARTHQUAKE' | 'CRIME'
type AlertType = 'RISK_INCREASED' | 'RISK_DECREASED' | 'ZONE_CHANGE'
type Severity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

/** Minimum score change (absolute) to trigger a per-category alert. */
const CATEGORY_THRESHOLD = 15

/** Map severity string to a numeric priority for threshold filtering. */
const SEVERITY_PRIORITY: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
}

function determineSeverity(scoreDelta: number, newLevel: string): Severity {
  if (newLevel === 'EXTREME' || Math.abs(scoreDelta) >= 40) return 'CRITICAL'
  if (newLevel === 'VERY_HIGH' || Math.abs(scoreDelta) >= 30) return 'HIGH'
  if (Math.abs(scoreDelta) >= 20) return 'MODERATE'
  return 'LOW'
}

interface PendingAlert {
  alertType: AlertType
  severity: Severity
  title: string
  message: string
  previousRiskLevel: string | null
  newRiskLevel: string | null
  riskCategory: RiskCategory
}

/**
 * Compare old and new risk profiles, then create alerts for every user who
 * saved this property and has alerting enabled at or above the severity threshold.
 */
export async function checkAndCreateAlerts(
  propertyId: string,
  oldProfile: RiskProfileData,
  newProfile: RiskProfileData,
): Promise<void> {
  try {
    const pendingAlerts: PendingAlert[] = []

    // Check overall risk level change
    if (oldProfile.overallRiskLevel !== newProfile.overallRiskLevel) {
      const delta = newProfile.overallRiskScore - oldProfile.overallRiskScore
      const increased = delta > 0
      pendingAlerts.push({
        alertType: increased ? 'RISK_INCREASED' : 'RISK_DECREASED',
        severity: determineSeverity(delta, newProfile.overallRiskLevel),
        title: `Overall risk ${increased ? 'increased' : 'decreased'} to ${newProfile.overallRiskLevel}`,
        message: `The overall risk level for this property changed from ${oldProfile.overallRiskLevel} to ${newProfile.overallRiskLevel} (score: ${oldProfile.overallRiskScore} -> ${newProfile.overallRiskScore}).`,
        previousRiskLevel: oldProfile.overallRiskLevel,
        newRiskLevel: newProfile.overallRiskLevel,
        riskCategory: 'OVERALL',
      })
    }

    // Check each individual category
    const categories: Array<{
      key: RiskCategory
      oldScore: number
      newScore: number
      oldLevel: string
      newLevel: string
      label: string
    }> = [
      { key: 'FLOOD', oldScore: oldProfile.floodRiskScore, newScore: newProfile.floodRiskScore, oldLevel: oldProfile.floodRiskLevel, newLevel: newProfile.floodRiskLevel, label: 'Flood' },
      { key: 'FIRE', oldScore: oldProfile.fireRiskScore, newScore: newProfile.fireRiskScore, oldLevel: oldProfile.fireRiskLevel, newLevel: newProfile.fireRiskLevel, label: 'Fire' },
      { key: 'WIND', oldScore: oldProfile.windRiskScore, newScore: newProfile.windRiskScore, oldLevel: oldProfile.windRiskLevel, newLevel: newProfile.windRiskLevel, label: 'Wind' },
      { key: 'EARTHQUAKE', oldScore: oldProfile.earthquakeRiskScore, newScore: newProfile.earthquakeRiskScore, oldLevel: oldProfile.earthquakeRiskLevel, newLevel: newProfile.earthquakeRiskLevel, label: 'Earthquake' },
      { key: 'CRIME', oldScore: oldProfile.crimeRiskScore, newScore: newProfile.crimeRiskScore, oldLevel: oldProfile.crimeRiskLevel, newLevel: newProfile.crimeRiskLevel, label: 'Crime' },
    ]

    for (const cat of categories) {
      const delta = cat.newScore - cat.oldScore
      if (Math.abs(delta) < CATEGORY_THRESHOLD) continue

      const increased = delta > 0
      pendingAlerts.push({
        alertType: increased ? 'RISK_INCREASED' : 'RISK_DECREASED',
        severity: determineSeverity(delta, cat.newLevel),
        title: `${cat.label} risk ${increased ? 'increased' : 'decreased'}`,
        message: `${cat.label} risk score changed from ${cat.oldScore} to ${cat.newScore} (${cat.oldLevel} -> ${cat.newLevel}).`,
        previousRiskLevel: cat.oldLevel,
        newRiskLevel: cat.newLevel,
        riskCategory: cat.key,
      })
    }

    if (pendingAlerts.length === 0) return

    // Find all users who saved this property and have alerts enabled
    const savedProperties = await prisma.savedProperty.findMany({
      where: { propertyId },
      select: {
        userId: true,
        user: {
          select: {
            riskAlertEnabled: true,
            riskAlertThreshold: true,
          },
        },
      },
    })

    if (savedProperties.length === 0) return

    // Build alert records for each eligible user
    const alertRecords: Array<{
      userId: string
      propertyId: string
      alertType: string
      severity: string
      title: string
      message: string
      previousRiskLevel: string | null
      newRiskLevel: string | null
      riskCategory: string | null
    }> = []

    for (const sp of savedProperties) {
      if (!sp.user.riskAlertEnabled) continue

      const thresholdPriority = SEVERITY_PRIORITY[sp.user.riskAlertThreshold] ?? 2

      for (const alert of pendingAlerts) {
        const alertPriority = SEVERITY_PRIORITY[alert.severity] ?? 1
        if (alertPriority < thresholdPriority) continue

        alertRecords.push({
          userId: sp.userId,
          propertyId,
          alertType: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          previousRiskLevel: alert.previousRiskLevel,
          newRiskLevel: alert.newRiskLevel,
          riskCategory: alert.riskCategory,
        })
      }
    }

    if (alertRecords.length === 0) return

    await prisma.riskAlert.createMany({ data: alertRecords })

    logger.info('Risk alerts created', {
      propertyId,
      alertCount: alertRecords.length,
      userCount: new Set(alertRecords.map((a) => a.userId)).size,
    })
  } catch (err) {
    // Alert creation is best-effort — never block the risk profile update
    logger.error('Failed to create risk alerts', {
      propertyId,
      error: err instanceof Error ? err.message : err,
    })
  }
}
