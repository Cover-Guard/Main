import { prisma } from '../utils/prisma'
import { fetchFloodRisk, fetchFireRisk, fetchEarthquakeRisk, fetchWindRisk, fetchCrimeRisk } from '../integrations/riskData'
import type { PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import { RISK_CACHE_TTL_SECONDS, RISK_SCORE_THRESHOLDS } from '@coverguard/shared'
import { RiskLevel as PrismaRiskLevel } from '@prisma/client'

function scoreToLevel(score: number): PrismaRiskLevel {
  if (score <= RISK_SCORE_THRESHOLDS.LOW) return 'LOW'
  if (score <= RISK_SCORE_THRESHOLDS.MODERATE) return 'MODERATE'
  if (score <= RISK_SCORE_THRESHOLDS.HIGH) return 'HIGH'
  if (score <= RISK_SCORE_THRESHOLDS.VERY_HIGH) return 'VERY_HIGH'
  return 'EXTREME'
}

function computeFloodScore(floodZone: string | undefined, inSFHA: boolean): number {
  if (!floodZone) return 20
  if (floodZone.startsWith('V')) return 95
  if (floodZone === 'AE' || floodZone === 'AH') return 80
  if (floodZone.startsWith('A')) return inSFHA ? 75 : 60
  if (floodZone === 'X') return 10
  return 20
}

function computeFireScore(hazZone: string | null, wui: boolean): number {
  let score = wui ? 40 : 15
  if (hazZone === 'EXTREME') score = 90
  else if (hazZone === 'VERY HIGH') score = 75
  else if (hazZone === 'HIGH') score = 55
  return score
}

function computeWindScore(hurricaneRisk: boolean, tornadoRisk: boolean, hailRisk: boolean): number {
  let score = 10
  if (hurricaneRisk) score = Math.max(score, 70)
  if (tornadoRisk) score = Math.max(score, 55)
  if (hailRisk) score = Math.max(score, 40)
  return score
}

function computeEarthquakeScore(seismicZone: string | undefined): number {
  const zoneScores: Record<string, number> = { D: 80, C: 55, B: 30, A: 10 }
  return zoneScores[seismicZone ?? 'A'] ?? 15
}

function computeCrimeScore(violentIndex: number, propertyIndex: number): number {
  // FBI UCR national average: violent ~380, property ~2110
  const violentNorm = Math.min((violentIndex / 760) * 50, 50)
  const propertyNorm = Math.min((propertyIndex / 4220) * 50, 50)
  return Math.round(violentNorm + propertyNorm)
}

export async function getOrComputeRiskProfile(propertyId: string): Promise<PropertyRiskProfile> {
  const property = await prisma.property.findUniqueOrThrow({ where: { id: propertyId } })

  // Return cached profile if not expired
  const cached = await prisma.riskProfile.findUnique({ where: { propertyId } })
  if (cached && cached.expiresAt > new Date()) {
    return prismaProfileToDto(cached, propertyId)
  }

  // Fetch risk data in parallel
  const [floodData, fireData, earthquakeData, windData, crimeData] = await Promise.all([
    fetchFloodRisk(property.lat, property.lng, property.zip ?? ''),
    fetchFireRisk(property.lat, property.lng, property.state),
    fetchEarthquakeRisk(property.lat, property.lng),
    fetchWindRisk(property.lat, property.lng, property.state),
    fetchCrimeRisk(property.lat, property.lng, property.zip ?? ''),
  ])

  // Compute scores
  const floodScore = computeFloodScore(floodData.floodZone, floodData.inSpecialFloodHazardArea ?? false)
  const fireScore = computeFireScore(fireData.firHazardSeverityZone ?? null, fireData.wildlandUrbanInterface ?? false)
  const windScore = computeWindScore(windData.hurricaneRisk ?? false, windData.tornadoRisk ?? false, windData.hailRisk ?? false)
  const earthquakeScore = computeEarthquakeScore(earthquakeData.seismicZone ?? undefined)
  const crimeScore = computeCrimeScore(crimeData.violentCrimeIndex ?? 380, crimeData.propertyCrimeIndex ?? 2110)

  // Overall = weighted average
  const overallScore = Math.round(
    floodScore * 0.30 +
    fireScore * 0.25 +
    windScore * 0.20 +
    earthquakeScore * 0.15 +
    crimeScore * 0.10
  )

  const expiresAt = new Date(Date.now() + RISK_CACHE_TTL_SECONDS * 1000)

  const profile = await prisma.riskProfile.upsert({
    where: { propertyId },
    update: {
      overallRiskLevel: scoreToLevel(overallScore),
      overallRiskScore: overallScore,
      floodRiskLevel: scoreToLevel(floodScore),
      floodRiskScore: floodScore,
      floodZone: floodData.floodZone ?? null,
      floodFirmPanelId: floodData.firmPanelId ?? null,
      floodBaseElevation: floodData.baseFloodElevation ?? null,
      inSFHA: floodData.inSpecialFloodHazardArea ?? false,
      floodAnnualChance: floodData.annualChanceOfFlooding ?? null,
      fireRiskLevel: scoreToLevel(fireScore),
      fireRiskScore: fireScore,
      firHazardZone: fireData.firHazardSeverityZone ?? null,
      wildlandUrbanInterface: fireData.wildlandUrbanInterface ?? false,
      windRiskLevel: scoreToLevel(windScore),
      windRiskScore: windScore,
      hurricaneRisk: windData.hurricaneRisk ?? false,
      tornadoRisk: windData.tornadoRisk ?? false,
      hailRisk: windData.hailRisk ?? false,
      designWindSpeed: windData.designWindSpeed ?? null,
      earthquakeRiskLevel: scoreToLevel(earthquakeScore),
      earthquakeRiskScore: earthquakeScore,
      seismicZone: earthquakeData.seismicZone ?? null,
      crimeRiskLevel: scoreToLevel(crimeScore),
      crimeRiskScore: crimeScore,
      violentCrimeIndex: crimeData.violentCrimeIndex ?? 380,
      propertyCrimeIndex: crimeData.propertyCrimeIndex ?? 2110,
      nationalAvgDiff: crimeData.nationalAverageDiff ?? 0,
      expiresAt,
    },
    create: {
      propertyId,
      overallRiskLevel: scoreToLevel(overallScore),
      overallRiskScore: overallScore,
      floodRiskLevel: scoreToLevel(floodScore),
      floodRiskScore: floodScore,
      floodZone: floodData.floodZone ?? null,
      floodFirmPanelId: floodData.firmPanelId ?? null,
      floodBaseElevation: floodData.baseFloodElevation ?? null,
      inSFHA: floodData.inSpecialFloodHazardArea ?? false,
      floodAnnualChance: floodData.annualChanceOfFlooding ?? null,
      fireRiskLevel: scoreToLevel(fireScore),
      fireRiskScore: fireScore,
      firHazardZone: fireData.firHazardSeverityZone ?? null,
      wildlandUrbanInterface: fireData.wildlandUrbanInterface ?? false,
      windRiskLevel: scoreToLevel(windScore),
      windRiskScore: windScore,
      hurricaneRisk: windData.hurricaneRisk ?? false,
      tornadoRisk: windData.tornadoRisk ?? false,
      hailRisk: windData.hailRisk ?? false,
      designWindSpeed: windData.designWindSpeed ?? null,
      earthquakeRiskLevel: scoreToLevel(earthquakeScore),
      earthquakeRiskScore: earthquakeScore,
      seismicZone: earthquakeData.seismicZone ?? null,
      crimeRiskLevel: scoreToLevel(crimeScore),
      crimeRiskScore: crimeScore,
      violentCrimeIndex: crimeData.violentCrimeIndex ?? 380,
      propertyCrimeIndex: crimeData.propertyCrimeIndex ?? 2110,
      nationalAvgDiff: crimeData.nationalAverageDiff ?? 0,
      expiresAt,
    },
  })

  return prismaProfileToDto(profile, propertyId)
}

function prismaProfileToDto(p: Awaited<ReturnType<typeof prisma.riskProfile.findUniqueOrThrow>>, propertyId: string): PropertyRiskProfile {
  const now = new Date().toISOString()
  return {
    propertyId,
    overallRiskLevel: p.overallRiskLevel as RiskLevel,
    overallRiskScore: p.overallRiskScore,
    flood: {
      level: p.floodRiskLevel as RiskLevel,
      score: p.floodRiskScore,
      trend: 'STABLE',
      description: 'Flood risk based on FEMA National Flood Hazard Layer',
      details: [`Flood zone: ${p.floodZone ?? 'Unknown'}`, p.inSFHA ? 'Property is in a Special Flood Hazard Area' : 'Not in SFHA'],
      dataSource: 'FEMA NFHL',
      lastUpdated: now,
      floodZone: p.floodZone ?? 'UNKNOWN',
      firmPanelId: p.floodFirmPanelId,
      baseFloodElevation: p.floodBaseElevation,
      inSpecialFloodHazardArea: p.inSFHA,
      annualChanceOfFlooding: p.floodAnnualChance,
    },
    fire: {
      level: p.fireRiskLevel as RiskLevel,
      score: p.fireRiskScore,
      trend: 'STABLE',
      description: 'Wildfire risk based on Cal Fire and USFS hazard zones',
      details: [p.firHazardZone ? `Hazard zone: ${p.firHazardZone}` : 'No state hazard zone data', p.wildlandUrbanInterface ? 'In Wildland-Urban Interface' : 'Not in WUI'],
      dataSource: 'Cal Fire / USFS',
      lastUpdated: now,
      firHazardSeverityZone: p.firHazardZone,
      wildlandUrbanInterface: p.wildlandUrbanInterface,
      nearestFireStation: p.nearestFireStation,
      vegetationDensity: null,
    },
    wind: {
      level: p.windRiskLevel as RiskLevel,
      score: p.windRiskScore,
      trend: 'STABLE',
      description: 'Wind hazard based on ASCE 7 design wind speeds and historical storm tracks',
      details: [
        p.hurricaneRisk ? 'Hurricane risk area' : '',
        p.tornadoRisk ? 'Tornado risk area' : '',
        p.hailRisk ? 'Hail risk area' : '',
      ].filter(Boolean),
      dataSource: 'ASCE 7 / NOAA',
      lastUpdated: now,
      designWindSpeed: p.designWindSpeed,
      hurricaneRisk: p.hurricaneRisk,
      tornadoRisk: p.tornadoRisk,
      hailRisk: p.hailRisk,
    },
    earthquake: {
      level: p.earthquakeRiskLevel as RiskLevel,
      score: p.earthquakeRiskScore,
      trend: 'STABLE',
      description: 'Seismic risk based on USGS National Seismic Hazard Map',
      details: [p.seismicZone ? `Seismic design category: ${p.seismicZone}` : 'Seismic data unavailable'],
      dataSource: 'USGS NSHM',
      lastUpdated: now,
      seismicZone: p.seismicZone,
      nearestFaultLine: p.nearestFaultLine,
      soilType: null,
      liquidationPotential: null,
    },
    crime: {
      level: p.crimeRiskLevel as RiskLevel,
      score: p.crimeRiskScore,
      trend: 'STABLE',
      description: 'Crime index based on FBI Uniform Crime Reporting data',
      details: [`Violent crime index: ${p.violentCrimeIndex}`, `Property crime index: ${p.propertyCrimeIndex}`],
      dataSource: 'FBI UCR',
      lastUpdated: now,
      violentCrimeIndex: p.violentCrimeIndex,
      propertyCrimeIndex: p.propertyCrimeIndex,
      nationalAverageDiff: p.nationalAvgDiff,
    },
    generatedAt: p.generatedAt.toISOString(),
    cacheTtlSeconds: RISK_CACHE_TTL_SECONDS,
  }
}
