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
  QuoteRequest,
  PropertyActivityLogEntry,
  ClientPropertyRecommendation,
  SavedComparison,
  RiskWatchlistEntry,
  RiskChangeEvent,
  PaginatedResponse,
  ActivityType,
  RecommendationPriority,
  QuoteRequestStatus,
} from '@coverguard/shared'
import type { CoverageType } from '@coverguard/shared'
import { createClient } from './supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) return {}
  return { Authorization: `Bearer ${data.session.access_token}` }
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

// ─── Quote Requests (Enhancement 1) ─────────────────────────────────────────

export async function getQuoteRequests(params?: {
  status?: QuoteRequestStatus
  page?: number
  limit?: number
}): Promise<PaginatedResponse<QuoteRequest>> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  return apiFetch(`/api/quote-requests?${query}`)
}

export async function updateQuoteRequestStatus(
  id: string,
  status: QuoteRequestStatus,
  statusNote?: string,
): Promise<QuoteRequest> {
  return apiFetch(`/api/quote-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, statusNote }),
  })
}

// ─── Activity Log (Enhancement 2) ───────────────────────────────────────────

export async function getActivityLog(params?: {
  propertyId?: string
  clientId?: string
  activityType?: ActivityType
  page?: number
  limit?: number
}): Promise<PaginatedResponse<PropertyActivityLogEntry>> {
  const query = new URLSearchParams()
  if (params?.propertyId) query.set('propertyId', params.propertyId)
  if (params?.clientId) query.set('clientId', params.clientId)
  if (params?.activityType) query.set('activityType', params.activityType)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  return apiFetch(`/api/activity-log?${query}`)
}

export async function createActivityLogEntry(data: {
  propertyId: string
  clientId?: string
  activityType?: ActivityType
  title: string
  description?: string
}): Promise<PropertyActivityLogEntry> {
  return apiFetch('/api/activity-log', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteActivityLogEntry(id: string): Promise<void> {
  await apiFetch(`/api/activity-log/${id}`, { method: 'DELETE' })
}

// ─── Recommendations (Enhancement 3) ────────────────────────────────────────

export async function getRecommendations(params?: {
  clientId?: string
  status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<ClientPropertyRecommendation>> {
  const query = new URLSearchParams()
  if (params?.clientId) query.set('clientId', params.clientId)
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  return apiFetch(`/api/recommendations?${query}`)
}

export async function createRecommendation(data: {
  clientId: string
  propertyId: string
  priority?: RecommendationPriority
  notes?: string
}): Promise<ClientPropertyRecommendation> {
  return apiFetch('/api/recommendations', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateRecommendation(
  id: string,
  data: { priority?: RecommendationPriority; status?: string; notes?: string },
): Promise<ClientPropertyRecommendation> {
  return apiFetch(`/api/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteRecommendation(id: string): Promise<void> {
  await apiFetch(`/api/recommendations/${id}`, { method: 'DELETE' })
}

// ─── Saved Comparisons (Enhancement 4) ──────────────────────────────────────

export async function getSavedComparisons(): Promise<SavedComparison[]> {
  return apiFetch('/api/comparisons')
}

export async function createSavedComparison(data: {
  name: string
  propertyIds: string[]
  notes?: string
}): Promise<SavedComparison> {
  return apiFetch('/api/comparisons', { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteSavedComparison(id: string): Promise<void> {
  await apiFetch(`/api/comparisons/${id}`, { method: 'DELETE' })
}

// ─── Risk Watchlist (Enhancement 5) ─────────────────────────────────────────

export async function getRiskWatchlist(): Promise<RiskWatchlistEntry[]> {
  return apiFetch('/api/risk-watchlist')
}

export async function addToRiskWatchlist(propertyId: string): Promise<RiskWatchlistEntry> {
  return apiFetch('/api/risk-watchlist', { method: 'POST', body: JSON.stringify({ propertyId }) })
}

export async function checkRiskChanges(watchlistId: string): Promise<{
  changes: Array<{
    riskDimension: string
    previousScore: number
    newScore: number
    previousLevel: string
    newLevel: string
  }>
}> {
  return apiFetch(`/api/risk-watchlist/${watchlistId}/check`, { method: 'POST' })
}

export async function getRiskChangeEvents(): Promise<RiskChangeEvent[]> {
  return apiFetch('/api/risk-watchlist/changes')
}

export async function removeFromRiskWatchlist(id: string): Promise<void> {
  await apiFetch(`/api/risk-watchlist/${id}`, { method: 'DELETE' })
}
