describe('featureFlags', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.STRIPE_SUBSCRIPTION_REQUIRED
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('defaults to false when env var is not set', async () => {
    const { featureFlags } = await import('../../utils/featureFlags')
    expect(featureFlags.stripeSubscriptionRequired).toBe(false)
  })

  it('returns true when env var is "true"', async () => {
    process.env.STRIPE_SUBSCRIPTION_REQUIRED = 'true'
    const { featureFlags } = await import('../../utils/featureFlags')
    expect(featureFlags.stripeSubscriptionRequired).toBe(true)
  })

  it('returns true when env var is "TRUE" (case-insensitive)', async () => {
    process.env.STRIPE_SUBSCRIPTION_REQUIRED = 'TRUE'
    const { featureFlags } = await import('../../utils/featureFlags')
    expect(featureFlags.stripeSubscriptionRequired).toBe(true)
  })

  it('returns false when env var is "false"', async () => {
    process.env.STRIPE_SUBSCRIPTION_REQUIRED = 'false'
    const { featureFlags } = await import('../../utils/featureFlags')
    expect(featureFlags.stripeSubscriptionRequired).toBe(false)
  })

  it('returns false when env var is any other string (e.g., "yes", "1")', async () => {
    process.env.STRIPE_SUBSCRIPTION_REQUIRED = 'yes'
    const { featureFlags: flags1 } = await import('../../utils/featureFlags')
    expect(flags1.stripeSubscriptionRequired).toBe(false)

    jest.resetModules()
    process.env.STRIPE_SUBSCRIPTION_REQUIRED = '1'
    const { featureFlags: flags2 } = await import('../../utils/featureFlags')
    expect(flags2.stripeSubscriptionRequired).toBe(false)
  })
})
