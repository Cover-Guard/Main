import {
  searchProperties,
  getProperty,
  getPropertyRisk,
  saveProperty,
  unsaveProperty,
  requestBindingQuote,
  getMe,
  getClients,
  createClientProfile,
  deleteAccount,
} from '@/lib/api'

const mockGetSession = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}))

const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

function jsonResponse(data: any, status = 200, contentType = 'application/json') {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name === 'content-type' ? contentType : null),
    },
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({
    data: {
      session: { access_token: 'test-token-123' },
    },
  })
})

describe('API client', () => {
  // ─── Properties ──────────────────────────────────────────────────────

  it('searchProperties sends correct query params', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { properties: [], total: 0 } }),
    )
    await searchProperties({ query: '123 Main St', state: 'TX' })
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/search?')
    expect(url).toContain('query=123+Main+St')
    expect(url).toContain('state=TX')
    expect(options.method).toBeUndefined() // GET by default
  })

  it('getProperty sends GET to /api/properties/{id}', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { id: 'p1' } }),
    )
    await getProperty('p1')
    expect(mockFetch.mock.calls[0][0]).toBe('/api/properties/p1')
  })

  it('getPropertyRisk sends GET to /api/properties/{id}/risk', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { overallRiskScore: 45 } }),
    )
    await getPropertyRisk('p1')
    expect(mockFetch.mock.calls[0][0]).toBe('/api/properties/p1/risk')
  })

  it('saveProperty sends POST with body', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: null }))
    await saveProperty('p1', 'Great property', ['flood-ok'], 'client-1')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/properties/p1/save')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.notes).toBe('Great property')
    expect(body.tags).toEqual(['flood-ok'])
    expect(body.clientId).toBe('client-1')
  })

  it('unsaveProperty sends DELETE', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: null }))
    await unsaveProperty('p1')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/properties/p1/save')
    expect(options.method).toBe('DELETE')
  })

  it('requestBindingQuote sends POST with carrierId, coverageTypes, notes', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { quoteRequestId: 'qr-1' } }),
    )
    const result = await requestBindingQuote('p1', 'carrier-1', ['FLOOD', 'FIRE'] as any, 'urgent')
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/properties/p1/quote-request')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.carrierId).toBe('carrier-1')
    expect(body.coverageTypes).toEqual(['FLOOD', 'FIRE'])
    expect(body.notes).toBe('urgent')
    expect(result.quoteRequestId).toBe('qr-1')
  })

  it('getMe sends GET with auth header', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { id: 'u1', email: 'a@b.com' } }),
    )
    await getMe()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(options.headers.Authorization).toBe('Bearer test-token-123')
  })

  // ─── Auth ────────────────────────────────────────────────────────────

  it('includes Bearer token from session', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: {} }),
    )
    await getMe()
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer test-token-123')
  })

  it('works without session (no Authorization header)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { properties: [], total: 0 } }),
    )
    await searchProperties({ query: 'test' })
    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBeUndefined()
  })

  // ─── Error handling ──────────────────────────────────────────────────

  it('5xx returns "Service temporarily unavailable"', async () => {
    mockFetch.mockReturnValue(
      jsonResponse(null, 500, 'text/html'),
    )
    await expect(getProperty('p1')).rejects.toThrow(
      'Service temporarily unavailable',
    )
  })

  it('4xx extracts error message from JSON', async () => {
    mockFetch.mockReturnValue(
      jsonResponse(
        { success: false, error: { message: 'Property not found' } },
        404,
      ),
    )
    await expect(getProperty('p1')).rejects.toThrow('Property not found')
  })

  it('non-JSON response returns unexpected response message', async () => {
    mockFetch.mockReturnValue(
      jsonResponse(null, 200, 'text/html'),
    )
    await expect(getProperty('p1')).rejects.toThrow('unexpected response')
  })

  it('network error returns connection error message', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getProperty('p1')).rejects.toThrow(
      'Network error. Please check your connection and try again.',
    )
  })

  // ─── Clients ─────────────────────────────────────────────────────────

  it('getClients sends GET to /api/clients', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: [] }),
    )
    await getClients()
    expect(mockFetch.mock.calls[0][0]).toBe('/api/clients')
  })

  it('createClientProfile sends POST to /api/clients', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({ success: true, data: { id: 'c1' } }),
    )
    await createClientProfile({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-0100',
    })
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/clients')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.firstName).toBe('Jane')
    expect(body.email).toBe('jane@example.com')
  })

  // ─── Account ─────────────────────────────────────────────────────────

  it('deleteAccount sends DELETE to /api/auth/me', async () => {
    mockFetch.mockReturnValue(jsonResponse({ success: true, data: null }))
    await deleteAccount()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(options.method).toBe('DELETE')
  })
})
