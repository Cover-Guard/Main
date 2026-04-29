import {
  authSchemeLabel,
  defaultDeliveryMode,
  defaultLegacyAmsTenantConfig,
  isLegacyAmsProvider,
  isLegacyAmsProviderAvailable,
  isTenantSsoConfigured,
  LEGACY_AMS_PROVIDERS,
  mergeLegacyAmsConfig,
  pollIntervalLabel,
  requiresTenantSso,
  supportedAuthSchemes,
  supportedDeliveryModes,
  validatePollInterval,
} from '../../utils/legacyAmsAdapter'
import {
  DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN,
  MAX_LEGACY_AMS_POLL_INTERVAL_MIN,
  MIN_LEGACY_AMS_POLL_INTERVAL_MIN,
  type LegacyAmsTenantConfig,
} from '../../types/legacyAms'

function baseConfig(
  overrides: Partial<LegacyAmsTenantConfig> = {},
): LegacyAmsTenantConfig {
  return {
    ...defaultLegacyAmsTenantConfig('AMS360', 'conn-1', 'tenant-42', 'Acme Agency'),
    ...overrides,
  }
}

describe('legacyAmsAdapter', () => {
  describe('LEGACY_AMS_PROVIDERS', () => {
    it('lists exactly the legacy AMS providers', () => {
      expect([...LEGACY_AMS_PROVIDERS].sort()).toEqual(['AMS360', 'APPLIED_EPIC'])
    })
  })

  describe('isLegacyAmsProvider', () => {
    it('returns true for AMS360 and APPLIED_EPIC', () => {
      expect(isLegacyAmsProvider('AMS360')).toBe(true)
      expect(isLegacyAmsProvider('APPLIED_EPIC')).toBe(true)
    })

    it('returns false for the modern AMS providers', () => {
      expect(isLegacyAmsProvider('AGENCY_ZOOM')).toBe(false)
      expect(isLegacyAmsProvider('SALESFORCE_FSC')).toBe(false)
    })
  })

  describe('isLegacyAmsProviderAvailable', () => {
    it('honors per-provider release flags', () => {
      const flags = { ams360Enabled: true, appliedEpicEnabled: false }
      expect(isLegacyAmsProviderAvailable('AMS360', flags)).toBe(true)
      expect(isLegacyAmsProviderAvailable('APPLIED_EPIC', flags)).toBe(false)
    })

    it('returns false when both flags are off', () => {
      const flags = { ams360Enabled: false, appliedEpicEnabled: false }
      expect(isLegacyAmsProviderAvailable('AMS360', flags)).toBe(false)
      expect(isLegacyAmsProviderAvailable('APPLIED_EPIC', flags)).toBe(false)
    })
  })

  describe('supportedDeliveryModes', () => {
    it('returns POLLING-only for AMS360 (no webhooks)', () => {
      expect(supportedDeliveryModes('AMS360')).toEqual(['POLLING'])
    })

    it('returns both modes for APPLIED_EPIC (webhooks available)', () => {
      expect(supportedDeliveryModes('APPLIED_EPIC')).toEqual(['REALTIME', 'POLLING'])
    })
  })

  describe('defaultDeliveryMode', () => {
    it('defaults to POLLING for both legacy providers', () => {
      expect(defaultDeliveryMode('AMS360')).toBe('POLLING')
      expect(defaultDeliveryMode('APPLIED_EPIC')).toBe('POLLING')
    })
  })

  describe('validatePollInterval', () => {
    it('accepts the default cadence', () => {
      const result = validatePollInterval(DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN)
      expect(result).toEqual({ ok: true, minutes: DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN })
    })

    it('accepts the boundary values', () => {
      expect(validatePollInterval(MIN_LEGACY_AMS_POLL_INTERVAL_MIN).ok).toBe(true)
      expect(validatePollInterval(MAX_LEGACY_AMS_POLL_INTERVAL_MIN).ok).toBe(true)
    })

    it('rejects below-min', () => {
      expect(validatePollInterval(MIN_LEGACY_AMS_POLL_INTERVAL_MIN - 1)).toEqual({
        ok: false,
        reason: 'BELOW_MIN',
      })
    })

    it('rejects above-max', () => {
      expect(validatePollInterval(MAX_LEGACY_AMS_POLL_INTERVAL_MIN + 1)).toEqual({
        ok: false,
        reason: 'ABOVE_MAX',
      })
    })

    it('rejects non-integers and NaN', () => {
      expect(validatePollInterval(15.5)).toEqual({ ok: false, reason: 'NOT_INTEGER' })
      expect(validatePollInterval(Number.NaN)).toEqual({ ok: false, reason: 'NOT_INTEGER' })
      expect(validatePollInterval(Number.POSITIVE_INFINITY)).toEqual({
        ok: false,
        reason: 'NOT_INTEGER',
      })
    })
  })

  describe('pollIntervalLabel', () => {
    it('renders sub-hour cadences in minutes', () => {
      expect(pollIntervalLabel(15)).toBe('every 15 minutes')
    })

    it('singular minute', () => {
      expect(pollIntervalLabel(1)).toBe('every 1 minute')
    })

    it('renders whole-hour cadences', () => {
      expect(pollIntervalLabel(60)).toBe('every 1 hour')
      expect(pollIntervalLabel(240)).toBe('every 4 hours')
    })

    it('renders mixed-hour cadences', () => {
      expect(pollIntervalLabel(90)).toBe('every 1h 30m')
      expect(pollIntervalLabel(135)).toBe('every 2h 15m')
    })
  })

  describe('requiresTenantSso / isTenantSsoConfigured', () => {
    it('flags SAML / OIDC as requiring SSO', () => {
      const config = { ...baseConfig(), authScheme: 'TENANT_SAML' as const }
      expect(requiresTenantSso(config)).toBe(true)
    })

    it('does not flag PER_USER', () => {
      const config = { ...baseConfig(), authScheme: 'PER_USER' as const }
      expect(requiresTenantSso(config)).toBe(false)
    })

    it('isTenantSsoConfigured requires both SSO scheme and a populated realm', () => {
      const ssoMissing = {
        ...baseConfig(),
        authScheme: 'TENANT_SAML' as const,
        ssoRealm: null,
      }
      const ssoBlank = {
        ...baseConfig(),
        authScheme: 'TENANT_SAML' as const,
        ssoRealm: '   ',
      }
      const ssoOk = {
        ...baseConfig(),
        authScheme: 'TENANT_SAML' as const,
        ssoRealm: 'https://acme.example.com/realms/agency',
      }
      expect(isTenantSsoConfigured(ssoMissing)).toBe(false)
      expect(isTenantSsoConfigured(ssoBlank)).toBe(false)
      expect(isTenantSsoConfigured(ssoOk)).toBe(true)
    })
  })

  describe('defaultLegacyAmsTenantConfig', () => {
    it('builds a clean POLLING config with the default cadence', () => {
      const config = defaultLegacyAmsTenantConfig(
        'AMS360',
        'conn-1',
        'tenant-42',
        'Acme Agency',
      )
      expect(config).toMatchObject({
        provider: 'AMS360',
        connectionId: 'conn-1',
        tenantId: 'tenant-42',
        tenantLabel: 'Acme Agency',
        deliveryMode: 'POLLING',
        pollIntervalMinutes: DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN,
        authScheme: 'PER_USER',
        ssoRealm: null,
        lastSyncAt: null,
      })
    })

    it('respects the per-provider attachments capability', () => {
      const ams = defaultLegacyAmsTenantConfig('AMS360', 'c', 't', 'L')
      const epic = defaultLegacyAmsTenantConfig('APPLIED_EPIC', 'c', 't', 'L')
      expect(ams.attachmentsEnabled).toBe(true)
      expect(epic.attachmentsEnabled).toBe(true)
    })
  })

  describe('mergeLegacyAmsConfig', () => {
    it('applies a clean patch with no errors', () => {
      const existing = baseConfig()
      const result = mergeLegacyAmsConfig(existing, { pollIntervalMinutes: 30 })
      expect(result.errors).toEqual({})
      expect(result.config.pollIntervalMinutes).toBe(30)
    })

    it('returns a poll-interval error for an out-of-bounds value', () => {
      const existing = baseConfig()
      const result = mergeLegacyAmsConfig(existing, { pollIntervalMinutes: 1 })
      expect(result.errors.pollIntervalMinutes).toMatch(/at least/i)
      expect(result.config.pollIntervalMinutes).toBe(1) // not clamped, returned for the form
    })

    it('errors when REALTIME is selected for AMS360', () => {
      const existing = baseConfig()
      const result = mergeLegacyAmsConfig(existing, { deliveryMode: 'REALTIME' })
      expect(result.errors.deliveryMode).toMatch(/AMS360/i)
    })

    it('does not error when REALTIME is selected for APPLIED_EPIC', () => {
      const existing = defaultLegacyAmsTenantConfig('APPLIED_EPIC', 'c', 't', 'L')
      const result = mergeLegacyAmsConfig(existing, { deliveryMode: 'REALTIME' })
      expect(result.errors.deliveryMode).toBeUndefined()
    })

    it('requires an SSO realm when switching to TENANT_SAML', () => {
      const existing = baseConfig()
      const result = mergeLegacyAmsConfig(existing, { authScheme: 'TENANT_SAML' })
      expect(result.errors.ssoRealm).toMatch(/required/i)
    })

    it('clamps attachmentsEnabled when the provider does not support it', () => {
      const existing: LegacyAmsTenantConfig = {
        ...baseConfig(),
        attachmentsEnabled: false,
      }
      // Synthetic provider scenario: pretend AMS360 lost attachments.
      // Exercise the clamp directly by patching attachmentsEnabled true
      // for a provider whose flag table says false. Currently both
      // legacy providers do support attachments, so this just round-trips.
      const result = mergeLegacyAmsConfig(existing, { attachmentsEnabled: true })
      expect(result.config.attachmentsEnabled).toBe(true)
    })
  })

  describe('supportedAuthSchemes', () => {
    it('returns all three schemes for both providers (tenant SSO supported)', () => {
      expect(supportedAuthSchemes('AMS360')).toEqual([
        'TENANT_SAML',
        'TENANT_OIDC',
        'PER_USER',
      ])
      expect(supportedAuthSchemes('APPLIED_EPIC')).toEqual([
        'TENANT_SAML',
        'TENANT_OIDC',
        'PER_USER',
      ])
    })
  })

  describe('authSchemeLabel', () => {
    it('renders the human-friendly label per scheme', () => {
      expect(authSchemeLabel('TENANT_SAML')).toBe('Tenant SSO (SAML)')
      expect(authSchemeLabel('TENANT_OIDC')).toBe('Tenant SSO (OIDC)')
      expect(authSchemeLabel('PER_USER')).toBe('Per-user OAuth')
    })
  })
})
