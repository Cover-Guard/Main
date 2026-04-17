import type {
  Property,
  PropertySearchParams,
  PropertySearchResult,
  PropertyRiskProfile,
  InsuranceCostEstimate,
  InsurabilityStatus,
  CarriersResult,
  PropertyPublicData,
  Client,
  ApiResponse,
  User,
  SubscriptionState,
  PropertyChecklist,
  ChecklistType,
  ChecklistItem,
  SavedPropertyWithProperty,
  DashboardTicker,
  DealStats,
  DealWithRelations,
  DealStage,
  DealFalloutReason,
} from '@coverguard/shared'
import type { CoverageType } from '@coverguard/shared'
import { createClient } from './supabase/client'

// ─── Server-safe base URL ───────────────────────────────────────────────────
// Client-side: use relative paths (same-origin, proxied by Next.js rewrites).
// Server-side (SSR / server components): Node.js fetch() requires an absolute
// URL — there is no `window.location.origin` to resolve against.  Fall back to
// env vars that Vercel & the dev server provide automatically.
function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '' // browser — relative works fine

  // Server-side — need an absolute URL for Node.js fetch()
  if (process.env.API_REWRITE_URL) return process.env.API_REWRITE_URL
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  // VERCEL_URL is set automatically by Vercel on every deployment
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

const API_URL = getBaseUrl()

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

export interface PropertyReportBundle {
  property: Property
  // Risk is always computed; insurance / insurability / carriers can fail
  // independently and come back null without failing the whole request.
  risk: PropertyRiskProfile | null
  insurance: InsuranceCostEstimate | null
  insurability: InsurabilityStatus | null
  carriers: CarriersResult | null
  publicData: PropertyPublicData | null
}

export async function getPropertyReport(id: string): Promise<PropertyReportBundle> {
  return apiFetch<PropertyReportBundle>(`/api/properties/${id}/report`)
}

export async function getPropertyPublicData(id: string): Promise<PropertyPublicData> {
  return apiFetch<PropertyPublicData>(`/api/properties/${id}/public-data`)
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

// ─── Auth / User ─────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  return apiFetch('/api/auth/me')
}

export async function updateMe(data: Partial<Pick<User, 'firstName' | 'lastName' | 'company' | 'licenseNumber' | 'avatarUrl'>>): Promise<User> {
  return apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify(data) })
}

export async function getSavedProperties(): Promise<SavedPropertyWithProperty[]> {
  return apiFetch<SavedPropertyWithProperty[]>('/api/auth/me/saved')
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

// ─── PDF Download ────────────────────────────────────────────────────────────

/**
 * Fetch the property report as a PDF Blob. The endpoint is authenticated, so
 * we issue an authorized fetch and surface the response body as a Blob (rather
 * than just navigating the browser to a URL — that wouldn't carry the token).
 */
export async function downloadPropertyReportPdf(propertyId: string): Promise<{ blob: Blob; filename: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/properties/${propertyId}/report.pdf`, {
    headers: { ...headers },
  })
  if (!res.ok) {
    throw new Error(`Report download failed (${res.status})`)
  }
  const blob = await res.blob()
  // Pull filename from Content-Disposition (set by the API), fall back to a sensible default.
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  const filename = match?.[1] ?? `coverguard-report-${propertyId}.pdf`
  return { blob, filename }
}

// ─── Dashboard Ticker ────────────────────────────────────────────────────────

export async function getDashboardTicker(): Promise<DashboardTicker> {
  return apiFetch<DashboardTicker>('/api/dashboard/ticker')
}

// ─── Deals ───────────────────────────────────────────────────────────────────

export async function listDeals(): Promise<DealWithRelations[]> {
  return apiFetch<DealWithRelations[]>('/api/deals')
}

export async function getDealStats(): Promise<DealStats> {
  return apiFetch<DealStats>('/api/deals/stats')
}

export interface CreateDealPayload {
  title: string
  stage?: DealStage
  propertyId?: string | null
  clientId?: string | null
  dealValue?: number | null
  carrierName?: string | null
  notes?: string | null
}

export interface UpdateDealPayload {
  title?: string
  stage?: DealStage
  propertyId?: string | null
  clientId?: string | null
  dealValue?: number | null
  carrierName?: string | null
  falloutReason?: DealFalloutReason | null
  falloutNotes?: string | null
  notes?: string | null
}

export async function createDeal(payload: CreateDealPayload): Promise<DealWithRelations> {
  return apiFetch<DealWithRelations>('/api/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateDeal(id: string, payload: UpdateDealPayload): Promise<DealWithRelations> {
  return apiFetch<DealWithRelations>(`/api/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteDeal(id: string): Promise<void> {
  await apiFetch(`/api/deals/${id}`, { method: 'DELETE' })
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
