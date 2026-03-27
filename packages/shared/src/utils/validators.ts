import { US_STATES } from '../constants'

const US_STATE_CODES: Set<string> = new Set(US_STATES.map((s) => s.code))

export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidState(state: string): boolean {
  return US_STATE_CODES.has(state.toUpperCase())
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toUpperCase()
}
