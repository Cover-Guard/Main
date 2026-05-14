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
  DashboardKpisResponse,
  DashboardForecastResponse,
  DashboardRiskTrendResponse,
  DashboardPortfolioMixResponse,
  DashboardInsightsResponse,
  DashboardActiveCarriersResponse,
  DealStats,
  DealWithRelations,
  DealStage,
  DealFalloutReason,
  CarrierExitAlert,
  AdminStats,
  AdminUsersListQuery,
  AdminUsersListResponse,
  AdminRoleChangeRequest,
  AdminRoleChangeResponse,
} from '@coverguard/shared'
import type { CoverageType } from '@coverguard/shared'
import { createClient } from './supabase/client'
// ─── Server-safe base URL ──────────────────────────────────────────────────
// Client-side: use relative paths (same-origin, proxied by Next.js rewrites).
// Server-side (SSR / server components): Node.js fetch() requires an absolute
// URL — there is no `window.location.origin` to resolve against.  Fall back to
// env vars that Vercel & the dev server provide automatically.
function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '' // browser — relative works fine

  // Server-side — need an absolute URL for Node.js fetch()
  // On Vercel the Express API is co-deployed in the *same* deployment and
  // every /api/* path is rewritten to it by the root vercel.json, so the
  // running deployment's own origin is always the correct, self-consistent
  // target. Prefer it: API_REWRITE_URL is a local-dev convenience (it points
  // at the standalone API on :4000) and must not be relied on for server-side
  // fetches in production.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.API_REWRITE_URL) return process.env.API_REWRITE_URL
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  return 'http://localhost:3000'
}

const API_URL = getBaseUrl()

async function getAuthHeaders(accessToken?: string): Promise<Record<string, string>> {
  if (accessToken) return { Authorization: `Bearer ${accessToken}` }
  // SSR fallback: the browser-only Supabase client returns no session during SSR,
  // so server-side callers must pass an explicit access token via apiFetch options.
  if (typeof window === 'undefined') return {}
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) return {}
    return { Authorization: `Bearer ${data.session.access_token}` }
  } catch {
    return {}
  }
}

async function apiFetch<T>(path: string, options?: RequestInit & { accessToken?: string }): Promise<T> {
  const headers = await getAuthHeaders(options?.accessToken)

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
    const errorObj = json.error as { message?: string; code?: string; details?: unknown } | undefined
    const err = new Error(errorObj?.message ?? `Request failed (${res.status})`) as Error & {
      code?: string
      status?: number
      details?: unknown
    }
    err.code = errorObj?.code
    err.status = res.status
    err.details = errorObj?.details
    throw err
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

export async function searchProperties(
  params: PropertySearchParams,
  accessToken?: string,
): Promise<PropertySearchResult> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) query.set(k, String(v)) })
  return apiFetch<PropertySearchResult>(`/api/properties/search?${query}`, { accessToken })
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

// ─── Auth / User ────────────────────────────────────────────────────────────

export async function getMe(): Promise<User> {
  return apiFetch('/api/auth/me')
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/api/admin/stats')
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

/** Per-KPI detail (PR-B1.e). Powers the KPI panel modal. */
export async function getDashboardKpis(): Promise<DashboardKpisResponse> {
  return apiFetch<DashboardKpisResponse>('/api/dashboard/kpis')
}

/** 12-month premium / claims forecast (PR-B1.f). */
export async function getDashboardForecast(): Promise<DashboardForecastResponse> {
  return apiFetch<DashboardForecastResponse>('/api/dashboard/forecast')
}

/** 12-month average-risk-score trend + annotations (PR-B1.g). */
export async function getDashboardRiskTrend(): Promise<DashboardRiskTrendResponse> {
  return apiFetch<DashboardRiskTrendResponse>('/api/dashboard/risk-trend')
}

/** Saved-portfolio mix by category (PR-B1.h). */
export async function getDashboardPortfolioMix(): Promise<DashboardPortfolioMixResponse> {
  return apiFetch<DashboardPortfolioMixResponse>('/api/dashboard/portfolio-mix')
}

/** Insights feed (PR-B1.h). */
export async function getDashboardInsights(): Promise<DashboardInsightsResponse> {
  return apiFetch<DashboardInsightsResponse>('/api/dashboard/insights')
}

/** Active carriers across the saved portfolio (PR-B1.h). */
export async function getDashboardActiveCarriers(): Promise<DashboardActiveCarriersResponse> {
  return apiFetch<DashboardActiveCarriersResponse>('/api/dashboard/active-carriers')
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
): Promise<{
  text: string
  /** Free-tier usage state — only present for free accounts. */
  usage?: { count: number; limit: number; capability: 'ai_interaction' }
}> {
  return apiFetch('/api/advisor/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  })
}

// ─── Property Checklists ─────────────────────────────────────────────────

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

// ─── Alerts (VA-01 carrier exits) ─────────────────────────────────────────────

export async function getCarrierExitAlerts(params?: { severity?: 'INFO' | 'WARNING' | 'CRITICAL'; limit?: number }): Promise<CarrierExitAlert[]> {
  const qs = new URLSearchParams()
  if (params?.severity) qs.set('severity', params.severity)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch(`/api/alerts/carrier-exits${suffix}`)
}

export async function acknowledgeCarrierExitAlert(id: string): Promise<void> {
  await apiFetch(`/api/alerts/carrier-exits/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
  })
}

// ─── Admin user management (PR-B5.b) ────────────────────────────────────────

/** Paginated, searchable, filterable user list (PR-B5.b). Admin-only. */
export async function listAdminUsers(query: AdminUsersListQuery = {}): Promise<AdminUsersListResponse> {
  const qs = new URLSearchParams()
  if (query.page) qs.set('page', String(query.page))
  if (query.pageSize) qs.set('pageSize', String(query.pageSize))
  if (query.search) qs.set('search', query.search)
  if (query.role) qs.set('role', query.role)
  const q = qs.toString()
  return apiFetch<AdminUsersListResponse>(`/api/admin/users${q ? `?${q}` : ''}`)
}

/** Change a user's role (PR-B5.b). Admin-only; cannot promote/demote ADMINs or self. */
export async function changeAdminUserRole(
  userId: string,
  body: AdminRoleChangeRequest,
): Promise<AdminRoleChangeResponse> {
  return apiFetch<AdminRoleChangeResponse>(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
