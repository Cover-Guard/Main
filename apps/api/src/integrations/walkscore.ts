/**
 * WalkScore Integration
 *
 * Fetches Walk Score, Transit Score, and Bike Score from the WalkScore API.
 * API docs: https://www.walkscore.com/professional/api.php
 *
 * Coverage: US and Canada only.
 */

import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalkScoreAPIResponse {
    status: number
    walkscore?: number
    description?: string
    updated?: string
    ws_link?: string
    snapped_lat?: number
    snapped_lon?: number
    transit?: {
      score: number
      description: string
      summary: string
    }
    bike?: {
      score: number
      description: string
    }
}

export interface WalkScoreResult {
    walkScore: number | null
    walkScoreDescription: string | null
    transitScore: number | null
    transitScoreDescription: string | null
    bikeScore: number | null
    bikeScoreDescription: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WALKSCORE_BASE_URL = 'https://api.walkscore.com/score'
const FETCH_TIMEOUT_MS = 10_000

const STATUS_MESSAGES: Record<number, string> = {
    2: 'Walk Score is being calculated -- try again shortly',
    30: 'Invalid location coordinates',
    40: 'Invalid WalkScore API key',
    41: 'WalkScore daily API quota exceeded',
    42: 'IP address blocked by WalkScore',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
          return await fetch(url, { signal: controller.signal })
    } finally {
          clearTimeout(timer)
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches Walk Score, Transit Score, and Bike Score for a given location.
 *
 * @throws Error if the API key is missing, the request fails, or the API
 *         returns a non-success status code.
 */
export async function fetchWalkScore(
    lat: number,
    lng: number,
    address: string,
  ): Promise<WalkScoreResult> {
    const apiKey = process.env.WALKSCORE_API_KEY
    if (!apiKey) {
          throw new Error('WALKSCORE_API_KEY environment variable is not configured')
    }

  const encodedAddress = encodeURIComponent(address)
    const url =
          `${WALKSCORE_BASE_URL}?format=json` +
          `&address=${encodedAddress}` +
          `&lat=${lat}` +
          `&lon=${lng}` +
          `&transit=1` +
          `&bike=1` +
          `&wsapikey=${apiKey}`

  let response: Response
    try {
          response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
                  throw new Error('WalkScore API request timed out')
          }
          throw new Error('Failed to connect to WalkScore API')
    }

  if (!response.ok) {
        throw new Error(`WalkScore API returned HTTP ${response.status}`)
  }

  const data: WalkScoreAPIResponse = await response.json()

  if (data.status !== 1) {
        const message = STATUS_MESSAGES[data.status] || `WalkScore API error (status ${data.status})`
        logger.warn('WalkScore API non-success status', { status: data.status, lat, lng })
        throw new Error(message)
  }

  return {
        walkScore: data.walkscore ?? null,
        walkScoreDescription: data.description ?? null,
        transitScore: data.transit?.score ?? null,
        transitScoreDescription: data.transit?.description ?? null,
        bikeScore: data.bike?.score ?? null,
        bikeScoreDescription: data.bike?.description ?? null,
  }
}
