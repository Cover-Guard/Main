/**
 * WalkScore Service
 *
 * Orchestrates fetching and caching WalkScore data for a property.
 * Follows the same service-layer pattern as riskService and insuranceService.
 */

import { fetchWalkScore } from '../integrations/walkscore'
import type { WalkScoreResult } from '../integrations/walkscore'
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

const CACHE_TTL_DAYS = 30
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

export interface WalkScoreData extends WalkScoreResult {
    dataSource: string
    lastUpdated: string | null
    cacheTtlSeconds: number
}

/**
 * Returns cached WalkScore data if fresh, otherwise fetches from the API
 * and persists to the risk_profiles table.
 */
export async function getOrFetchWalkScore(
    propertyId: string,
    forceRefresh = false,
  ): Promise<WalkScoreData> {
    // 1. Look up the property for lat/lng/address
  const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, lat: true, lng: true, address: true, city: true, state: true, zip: true },
  })

  if (!property) {
        throw new Error('Property not found')
  }

  // 2. Check for cached data (unless force-refreshing)
  if (!forceRefresh) {
        const existing = await prisma.riskProfile.findFirst({
                where: { propertyId },
                select: {
                          walkScore: true,
                          walkScoreDescription: true,
                          transitScore: true,
                          transitScoreDescription: true,
                          bikeScore: true,
                          bikeScoreDescription: true,
                          walkScoreFetchedAt: true,
                },
        })

      if (existing?.walkScoreFetchedAt && existing.walkScore !== null) {
              const ageMs = Date.now() - new Date(existing.walkScoreFetchedAt).getTime()
              const remainingMs = CACHE_TTL_MS - ageMs

          if (remainingMs > 0) {
                    return {
                                walkScore: existing.walkScore,
                                walkScoreDescription: existing.walkScoreDescription,
                                transitScore: existing.transitScore,
                                transitScoreDescription: existing.transitScoreDescription,
                                bikeScore: existing.bikeScore,
                                bikeScoreDescription: existing.bikeScoreDescription,
                                dataSource: 'walkscore.com',
                                lastUpdated: existing.walkScoreFetchedAt.toISOString(),
                                cacheTtlSeconds: Math.floor(remainingMs / 1000),
                    }
          }
      }
  }

  // 3. Fetch from WalkScore API
  const fullAddress = [property.address, property.city, property.state, property.zip]
      .filter(Boolean)
      .join(' ')

  const scores = await fetchWalkScore(property.lat, property.lng, fullAddress)

  // 4. Persist to risk_profiles
  const now = new Date()
    try {
          await prisma.riskProfile.updateMany({
                  where: { propertyId },
                  data: {
                            walkScore: scores.walkScore,
                            walkScoreDescription: scores.walkScoreDescription,
                            transitScore: scores.transitScore,
                            transitScoreDescription: scores.transitScoreDescription,
                            bikeScore: scores.bikeScore,
                            bikeScoreDescription: scores.bikeScoreDescription,
                            walkScoreFetchedAt: now,
                  },
          })
    } catch (err) {
          // Log but don't fail -- the scores were fetched successfully
      logger.error('Failed to persist WalkScore data', {
              propertyId,
              error: err instanceof Error ? err.message : err,
      })
    }

  return {
        ...scores,
        dataSource: 'walkscore.com',
        lastUpdated: now.toISOString(),
        cacheTtlSeconds: CACHE_TTL_DAYS * 24 * 60 * 60,
  }
}
