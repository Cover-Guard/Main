h/**
 * Property Data Integration
 *
 * Wraps external property data providers (RentCast, CoreLogic, etc.).
 * Swap the implementation here without touching business logic.
 */

import type { Property, PropertySearchParams, PropertySearchResult, PropertyType } from '@coverguard/shared'
import { logger } from '../utils/logger'
import { retryWithBackoff } from '../lib/retryWithBackoff'

const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1'

interface RentCastProperty {
  id: string
  formattedAddress: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  zipCode: string
  county?: stringh
  latitude?: number
  longitude?: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  lotSize?: number
  yearBuilt?: number
  lastSaleDate?: string
  lastSalePrice?: number
  taxAssessments?: Record<string, { value?: number; land?: number; improvements?: number }>
  features?: Record<string, unknown>
}

async function fetchRentCast<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) {
    throw new Error('RENTCAST_API_KEY not configured — property search unavailable')
  }

  try {
    const url = new URL(`${RENTCAST_BASE_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await retryWithBackoff(async () => {
      const r = await fetch(url.toString(), {
        headers: { accept: 'application/json', 'X-Api-Key': apiKey },
        signal: AbortSignal.timeout(8000),
      })
      if (r.status === 429) throw Object.assign(new Error('RentCast rate limited'), { status: 429 })
      return r
    })

    if (!res.ok) {
      logger.error(`RentCast API error ${res.status}: ${path}`)
      throw new Error(`RentCast API error ${res.status}`)
    }

    return (await res.json()) as T
  } catch (err) {
    logger.error('RentCast API request failed', { path, error: err instanceof Error ? err.message : err })
    throw err
  }
}

function mapRentCastToProperty(rc: RentCastProperty): Omit<Property, 'id' | 'createdAt' | 'updatedAt'> {
  // Get the most recent tax assessment value as estimated value
  const assessmentYears = rc.taxAssessments ? Object.keys(rc.taxAssessments).sort().reverse() : []
  const latestAssessment = assessmentYears.length > 0 ? rc.taxAssessments![assessmentYears[0]] : null

  return {
    address: rc.addressLine1,
    city: rc.city,
    state: rc.state,
    zip: rc.zipCode,
