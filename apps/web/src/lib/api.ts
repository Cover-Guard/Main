import type {
  Property,
  PropertySearchParams,
  PropertySearchResult,
  PropertyRiskProfile,
  InsuranceCostEstimate,
  InsurabilityStatus,
  CarriersResult,
  Client,
  AnalyticsSummary,
  ApiResponse,
  User,
} from '@coverguard/shared'
import type { CoverageType } from '@coverguard/shared'
import { createClient } from './supabase/client'

// In production (Vercel), API is same-origin — use empty string.
// In local dev, set NEXT_PUBLIC_API_URL=http://localhost:4000 in .env.local
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) return {}
    return { Authorization: `Bearer ${data.session.access_token}` }
  } catch {
    // Server-side render or missing session — return no auth headers.
    // Endpoints that don't require auth (e.g. search) still work fine.
    return {}
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...options?.headers,
    },
  })

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `API error ${res.status}`)
  }
  return (json as ApiResponse<T>).data
}

// ─── Properties ───────────────────────────────────────────────────────────────

export async function searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) query.set(k, String(v)) })
  return apiFetch<PropertySearchResult>(`/api/properties/search?${query}`)
}

export async function getProperty(id: string): Promise<Property> {
  return apiFetch<Property>(`/api/properties/${id}`)
}

export async function getPropertyRisk(id: string): Promise<PropertyRiskProfile> {
  return apiFetch<PropertyRiskProfile>(`/api/properties/${id}/risk`)
}

export async function getPropertyInsurance(id: string): Promise<InsuranceCostEstimate> {
  return apiFetch<InsuranceCostEstimate>(`/api/properties/${id}/insurance`)
}

export async function getPropertyInsurability(id: string): Promise<InsurabilityStatus> {
  return apiFetch<InsurabilityStatus>(`/api/properties/${id}/insurability`)
}

export async function getPropertyCarriers(id: string): Promise<CarriersResult> {
  return apiFetch<CarriersResult>(`/api/properties/${id}/carriers`)
}

export async function getPropertyReport(id: string): Promise<{
  property: Property
  risk: PropertyRiskProfile
  insurance: InsuranceCostEstimate
}> {
  return apiFetch(`/api/properties/${id}/report`)
}

export async function saveProperty(id: string, notes?: string, tags?: string[]): Promise<void> {
  await apiFetch(`/api/properties/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({ notes, tags: tags ?? [] }),
  })
}

export async function unsaveProperty(id: string): Promise<void> {
  await apiFetch(`/api/properties/${id}/save`, { method: 'DELETE' })
}

// ─── Quote Requests ────────────────────────────────────────────────────────────

export async function requestBindingQuote(
  propertyId: string,
  carrierId: string,
  coverageTypes: CoverageType[],
  notes?: string,
): Promise<{ quoteRequestId: string }> {
  return apiFetch(`/api/properties/${propertyId}/quote-request`, {
    method: 'POST',
    body: JSON.stringify({ carrierId, coverageTypes, notes }),
  })
}

// ─── Auth / User ─────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  return apiFetch('/api/auth/me')
}

export async function updateMe(data: Partial<Pick<User, 'firstName' | 'lastName' | 'company' | 'licenseNumber'>>): Promise<User> {
  return apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) })
}

export async function getSavedProperties() {
  return apiFetch('/api/auth/me/saved')
}

export async function deleteAccount(): Promise<void> {
  await apiFetch('/api/auth/me', { method: 'DELETE' })
}

// ─── Clients (agents) ────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  return apiFetch('/api/clients')
}

export async function createClient2(data: {
  firstName: string
  lastName: string
  email: string
  phone?: string
  notes?: string
}): Promise<Client> {
  return apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  return apiFetch(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteClient(id: string): Promise<void> {
  await apiFetch(`/api/clients/${id}`, { method: 'DELETE' })
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsSummary> {
  return apiFetch('/api/analytics')
}
