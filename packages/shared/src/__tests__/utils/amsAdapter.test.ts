/**
 * amsAdapter tests (P1 #6 — AMS integration foundation).
 */

import {
  amsProviderLabel,
  getAmsCapabilities,
  isAmsProviderAvailable,
  amsStatusCopy,
  nextAmsConnectionAction,
  isAmsConnectionPushable,
} from '../../utils/amsAdapter'
import type {
  AmsConnection,
  AmsConnectionStatus,
  AmsProvider,
} from '../../types/amsIntegration'

const ALL_PROVIDERS: AmsProvider[] = [
  'AGENCY_ZOOM',
  'SALESFORCE_FSC',
  'AMS360',
  'APPLIED_EPIC',
]
const ALL_STATUSES: AmsConnectionStatus[] = [
  'NOT_CONNECTED',
  'CONNECTING',
  'CONNECTED',
  'DEGRADED',
  'EXPIRED',
  'DISCONNECTED',
]

describe('amsProviderLabel', () => {
  it('returns a non-empty label for every provider', () => {
    for (const p of ALL_PROVIDERS) {
      expect(amsProviderLabel(p)).toMatch(/\S/)
    }
  })

  it('uses provider-specific marketing names', () => {
    expect(amsProviderLabel('AGENCY_ZOOM')).toBe('AgencyZoom')
    expect(amsProviderLabel('SALESFORCE_FSC')).toMatch(/Salesforce/)
    expect(amsProviderLabel('AMS360')).toMatch(/Vertafore/)
    expect(amsProviderLabel('APPLIED_EPIC')).toMatch(/Applied Epic/)
  })
})

describe('getAmsCapabilities', () => {
  it('AgencyZoom and Salesforce ship with the core capabilities', () => {
    expect(getAmsCapabilities('AGENCY_ZOOM').attachmentsApi).toBe(true)
    expect(getAmsCapabilities('AGENCY_ZOOM').contactSync).toBe(true)
    expect(getAmsCapabilities('SALESFORCE_FSC').attachmentsApi).toBe(true)
    expect(getAmsCapabilities('SALESFORCE_FSC').ssoTenantAuth).toBe(true)
  })

  it('legacy providers report no capabilities until adapters land', () => {
    expect(getAmsCapabilities('AMS360')).toEqual({
      attachmentsApi: false, contactSync: false, ssoTenantAuth: false,
    })
    expect(getAmsCapabilities('APPLIED_EPIC')).toEqual({
      attachmentsApi: false, contactSync: false, ssoTenantAuth: false,
    })
  })
})

describe('isAmsProviderAvailable', () => {
  it('exposes Phase-1 + Phase-2 providers and gates Phase-3', () => {
    expect(isAmsProviderAvailable('AGENCY_ZOOM')).toBe(true)
    expect(isAmsProviderAvailable('SALESFORCE_FSC')).toBe(true)
    expect(isAmsProviderAvailable('AMS360')).toBe(false)
    expect(isAmsProviderAvailable('APPLIED_EPIC')).toBe(false)
  })
})

describe('amsStatusCopy', () => {
  it('returns a non-empty copy bundle for every status', () => {
    for (const s of ALL_STATUSES) {
      const copy = amsStatusCopy(s)
      expect(copy.label).toMatch(/\S/)
      expect(copy.description).toMatch(/\S/)
      expect(copy.variant).toMatch(/^(neutral|progress|success|warning|danger)$/)
    }
  })

  it('marks CONNECTED as success', () => {
    expect(amsStatusCopy('CONNECTED').variant).toBe('success')
  })

  it('marks EXPIRED as danger and DEGRADED as warning', () => {
    expect(amsStatusCopy('EXPIRED').variant).toBe('danger')
    expect(amsStatusCopy('DEGRADED').variant).toBe('warning')
  })

  it('uses distinct labels per status', () => {
    const labels = ALL_STATUSES.map((s) => amsStatusCopy(s).label)
    expect(new Set(labels).size).toBe(ALL_STATUSES.length)
  })
})

describe('nextAmsConnectionAction', () => {
  it('returns the right action per status', () => {
    expect(nextAmsConnectionAction('NOT_CONNECTED')).toBe('CONNECT')
    expect(nextAmsConnectionAction('CONNECTING')).toBe('WAIT')
    expect(nextAmsConnectionAction('CONNECTED')).toBe('DISCONNECT')
    expect(nextAmsConnectionAction('DEGRADED')).toBe('RECONNECT')
    expect(nextAmsConnectionAction('EXPIRED')).toBe('RECONNECT')
    expect(nextAmsConnectionAction('DISCONNECTED')).toBe('CONNECT')
  })
})

describe('isAmsConnectionPushable', () => {
  function conn(status: AmsConnectionStatus): AmsConnection {
    return {
      id: 'c1',
      agencyId: 'a1',
      provider: 'AGENCY_ZOOM',
      status,
      connectedAt: '2026-01-01T00:00:00Z',
      updatedAt:   '2026-01-01T00:00:00Z',
    }
  }

  it('is true only when status is CONNECTED', () => {
    for (const s of ALL_STATUSES) {
      expect(isAmsConnectionPushable(conn(s))).toBe(s === 'CONNECTED')
    }
  })
})
