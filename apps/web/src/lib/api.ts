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
  SubscriptionState,
  PropertyChecklist,
  ChecklistType,
  ChecklistItem,
  LenderPortfolioSummary,
  LenderPropertyRow,
  RiskAlert,
  RiskAlertPreferences,
  SharedPropertyLink,
} from '@coverguard/shared'
import type { CoverageType, QuoteRequestDetail } from '@coverguard/shared'
import { createClient } from './supabase/client'

// Always use same-origin (relative) paths. In production, Next.js rewrites
// proxy /api/* to the API backend, eliminating CORS. In local dev, the rewrite
// forwards to http://localhost:4000 (set API_REWRITE_URL in .env.local).
const API_URL = ''

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

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options?.headers,
      },
    })
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : 'Network error. Please check your connection and try again.',
    )
  }

  let json: Record<string, unknown>
  try {
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new Error(
        res.status >= 500
          ? 'Service temporarily unavailable. Please try again in a moment.'
          : `Server returned an unexpected response (${res.status})`,
      )
    }
    json = await res.json()
  } catch (parseErr) {
    if (parseErr instanceof Error && parseErr.message.includes('Service temporarily')) throw parseErr
    if (parseErr instanceof Error && parseErr.message.includes('unexpected response')) throw parseErr
    throw new Error(`Server returned an invalid response (${res.status})`)
  }

  if (!res.ok || !json.success) {
    const errorObj = json.error as { message?: string } | undefined
    throw new Error(errorObj?.message ?? `Request failed (${res.status})`)
  }
  return (json as unknown as ApiResponse<T>).data
}

// ─── Properties ───────────────────────────────────────────────────────────────

export interface PropertySuggestion {
  id: string
  address: string
  city: string
  state: string
  zip: string
}

export async function suggestProperties(query: string, limit = 5): Promise<PropertySuggestion[]> {
  const q = new URLSearchParams({ q: query, limit: String(limit) })
  return apiFetch<PropertySuggestion[]>(`/api/properties/suggest?${q}`)
}

export async function searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) query.set(k, String(v)) })
  return apiFetch<PropertySearchResult>(`/api/properties/search?${query}`)
}

export async function getProperty(id: string): Promise<Property> {
  return apiFetch<Property>(`/api/properties/${id}`)
}

/** Resolve a Google Place ID into a validated property via server-side geocoding. */
export async function geocodeProperty(placeId: string): Promise<Property> {
  return apiFetch<Property>('/api/properties/geocode', {
    method: 'POST',
    body: JSON.stringify({ placeId }),
  })
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

export async function saveProperty(id: string, notes?: string, tags?: string[], clientId?: string | null): Promise<void> {
  await apiFetch(`/api/properties/${id}/save`, {
    method: 'POST',
    body: JSON.stringify({
      notes,
      tags: tags ?? [],
      ...(clientId !== undefined ? { clientId } : {}),
    }),
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

export async function getMyQuoteRequests(
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ requests: QuoteRequestDetail[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.set('status', status)
  return apiFetch(`/api/auth/me/quote-requests?${params}`)
}

// ─── Auth / User ─────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  return apiFetch('/api/auth/me')
}

export async function updateMe(data: Partial<Pick<User, 'firstName' | 'lastName' | 'company' | 'licenseNumber' | 'avatarUrl'>>): Promise<User> {
  return apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) })
}

export async function getSavedProperties(tag?: string): Promise<unknown[]> {
  const params = new URLSearchParams()
  if (tag) params.set('tag', tag)
  const qs = params.toString()
  return apiFetch<unknown[]>(`/api/auth/me/saved${qs ? `?${qs}` : ''}`)
}

export async function getSavedPropertyTags(): Promise<string[]> {
  return apiFetch<string[]>('/api/auth/me/saved/tags')
}

export async function deleteAccount(): Promise<void> {
  await apiFetch('/api/auth/me', { method: 'DELETE' })
}

// ─── Clients (agents) ────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  return apiFetch('/api/clients')
}

export async function createClientProfile(data: {
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

// ─── AI Advisor ──────────────────────────────────────────────────────────────

export async function chatWithAdvisor(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ text: string }> {
  return apiFetch('/api/advisor/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
}

// ─── Property Checklists ─────────────────────────────────────────────────────

export async function getPropertyChecklists(propertyId: string): Promise<PropertyChecklist[]> {
  return apiFetch<PropertyChecklist[]>(`/api/properties/${propertyId}/checklists`)
}

export async function createPropertyChecklist(
  propertyId: string,
  data: { checklistType: ChecklistType; title: string; items: ChecklistItem[] },
): Promise<PropertyChecklist> {
  return apiFetch(`/api/properties/${propertyId}/checklists`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePropertyChecklist(
  propertyId: string,
  checklistId: string,
  data: { title?: string; items?: ChecklistItem[] },
): Promise<PropertyChecklist> {
  return apiFetch(`/api/properties/${propertyId}/checklists/${checklistId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deletePropertyChecklist(propertyId: string, checklistId: string): Promise<void> {
  await apiFetch(`/api/properties/${propertyId}/checklists/${checklistId}`, { method: 'DELETE' })
}

// ─── Lender ─────────────────────────────────────────────────────────────────

export async function getLenderPortfolio(): Promise<LenderPortfolioSummary> {
  return apiFetch('/api/lender/portfolio')
}

export async function getLenderProperties(): Promise<LenderPropertyRow[]> {
  return apiFetch('/api/lender/properties')
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsSummary> {
  return apiFetch('/api/analytics')
}

// ─── Stripe / Subscriptions ──────────────────────────────────────────────────

export async function getSubscriptionState(): Promise<SubscriptionState> {
  return apiFetch('/api/stripe/subscription')
}

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  return apiFetch('/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({
      priceId,
      successUrl: `${window.location.origin}/dashboard?subscription=success`,
      cancelUrl: `${window.location.origin}/pricing?subscription=canceled`,
    }),
  })
}

export async function createPortalSession(): Promise<{ url: string }> {
  return apiFetch('/api/stripe/portal', {
    method: 'POST',
    body: JSON.stringify({ returnUrl: `${window.location.origin}/account` }),
  })
}

// ─── Risk Alerts ────────────────────────────────────────────────────────────

export async function getRiskAlerts(page = 1, limit = 20, unreadOnly = false): Promise<{ alerts: RiskAlert[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (unreadOnly) params.set('unreadOnly', 'true')
  return apiFetch(`/api/alerts?${params}`)
}

export async function getUnreadAlertCount(): Promise<{ count: number }> {
  return apiFetch('/api/alerts/unread-count')
}

export async function markAlertRead(id: string): Promise<void> {
  await apiFetch(`/api/alerts/${id}/read`, { method: 'PATCH' })
}

export async function markAllAlertsRead(): Promise<void> {
  await apiFetch('/api/alerts/read-all', { method: 'PATCH' })
}

export async function getAlertPreferences(): Promise<RiskAlertPreferences> {
  return apiFetch('/api/alerts/preferences')
}

export async function updateAlertPreferences(prefs: Partial<RiskAlertPreferences>): Promise<RiskAlertPreferences> {
  return apiFetch('/api/alerts/preferences', { method: 'PATCH', body: JSON.stringify(prefs) })
}

// ─── Shared Property Links ──────────────────────────────────────────────────

export async function createSharedLink(data: {
  propertyId: string
  clientId?: string
  includeRisk?: boolean
  includeInsurance?: boolean
  includeCarriers?: boolean
  expiresInDays?: number
  maxViews?: number
}): Promise<SharedPropertyLink & { shareUrl: string }> {
  return apiFetch('/api/sharing/links', { method: 'POST', body: JSON.stringify(data) })
}

export async function getSharedLinks(): Promise<SharedPropertyLink[]> {
  return apiFetch('/api/sharing/links')
}

export async function deactivateSharedLink(id: string): Promise<void> {
  await apiFetch(`/api/sharing/links/${id}`, { method: 'DELETE' })
}

export async function viewSharedProperty(token: string): Promise<{
  property: Property
  risk?: PropertyRiskProfile
  insurance?: InsuranceCostEstimate
  carriers?: CarriersResult
  sharedBy: { firstName: string; lastName: string; company: string | null }
}> {
  return apiFetch(`/api/sharing/view/${token}`)
}
