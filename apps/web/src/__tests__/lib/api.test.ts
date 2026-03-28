import {
  searchProperties,
  getProperty,
  getPropertyRisk,
  getPropertyInsurance,
  saveProperty,
  unsaveProperty,
  requestBindingQuote,
  getMe,
  getClients,
} from '@/lib/api'

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

function mockSuccessResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data }),
  })
}

function mockErrorResponse(status: number, message: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ success: false, error: { message } }),
  })
}

describe('API client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('searchProperties sends correct query params', async () => {
    const mockResult = { properties: [], total: 0, page: 1, pageSize: 20 }
    mockSuccessResponse(mockResult)

    const result = await searchProperties({ query: '123 Main St', state: 'TX' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/search')
    expect(url).toContain('query=123+Main+St')
    expect(url).toContain('state=TX')
    expect(result).toEqual(mockResult)
  })

  it('getProperty fetches by ID', async () => {
    const mockProperty = { id: 'prop-1', address: '123 Main St' }
    mockSuccessResponse(mockProperty)

    const result = await getProperty('prop-1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1')
    expect(result).toEqual(mockProperty)
  })

  it('getPropertyRisk fetches risk endpoint', async () => {
    const mockRisk = { overallRiskLevel: 'MODERATE', floodRisk: {} }
    mockSuccessResponse(mockRisk)

    const result = await getPropertyRisk('prop-1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1/risk')
    expect(result).toEqual(mockRisk)
  })

  it('getPropertyInsurance fetches insurance endpoint', async () => {
    const mockInsurance = { estimatedPremium: 2500 }
    mockSuccessResponse(mockInsurance)

    const result = await getPropertyInsurance('prop-1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1/insurance')
    expect(result).toEqual(mockInsurance)
  })

  it('saveProperty sends POST with auth header', async () => {
    mockSuccessResponse(undefined)

    await saveProperty('prop-1', 'Great house', ['favorite'])

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1/save')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      notes: 'Great house',
      tags: ['favorite'],
    })
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })

  it('unsaveProperty sends DELETE with auth header', async () => {
    mockSuccessResponse(undefined)

    await unsaveProperty('prop-1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1/save')
    expect(options.headers.Authorization).toBe('Bearer test-token')
  })

  it('requestBindingQuote sends correct body', async () => {
    mockSuccessResponse({ quoteRequestId: 'qr-1' })

    const result = await requestBindingQuote(
      'prop-1',
      'state-farm',
      ['HOMEOWNERS', 'FLOOD'] as any,
      'Rush please'
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/properties/prop-1/quote-request')
    const body = JSON.parse(options.body)
    expect(body).toEqual({
      carrierId: 'state-farm',
      coverageTypes: ['HOMEOWNERS', 'FLOOD'],
      notes: 'Rush please',
    })
    expect(result).toEqual({ quoteRequestId: 'qr-1' })
  })

  it('getMe fetches current user', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com', role: 'CONSUMER' }
    mockSuccessResponse(mockUser)

    const result = await getMe()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/auth/me')
    expect(result).toEqual(mockUser)
  })

  it('getClients fetches clients list', async () => {
    const mockClients = [
      { id: 'c1', firstName: 'Alice', email: 'alice@test.com' },
      { id: 'c2', firstName: 'Bob', email: 'bob@test.com' },
    ]
    mockSuccessResponse(mockClients)

    const result = await getClients()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/clients')
    expect(result).toEqual(mockClients)
  })

  it('API client includes Bearer token in Authorization header', async () => {
    mockSuccessResponse({ id: 'prop-1' })

    await getProperty('prop-1')

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('handles API error responses', async () => {
    mockErrorResponse(404, 'Property not found')

    await expect(getProperty('nonexistent')).rejects.toThrow('Property not found')
  })
})
