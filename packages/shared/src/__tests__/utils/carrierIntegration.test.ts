import {
  appetiteSourceLabel,
  countByStatus,
  countLiveIntegrations,
  integrationProgressForStatus,
  integrationStatusLabel,
  integrationStatusTone,
  nextMilestone,
  shouldRenderAppetiteUpdate,
  summarizeIntegrationProgress,
} from '../../utils/carrierIntegration'
import type {
  AppetiteSource,
  CarrierIntegrationRecord,
  CarrierIntegrationStatus,
} from '../../types/carrierIntegration'
import {
  CARRIER_MILESTONES,
  TARGET_TOP_25_P_AND_C,
} from '../../types/carrierIntegration'

const NOW = '2026-04-28T12:00:00Z'

function record(
  id: string,
  status: CarrierIntegrationStatus,
  carrierName: string = `${id}-carrier`,
): CarrierIntegrationRecord {
  return {
    id,
    carrierName,
    naicCode: null,
    status,
    contractSignedAt: status === 'PROSPECT' || status === 'IN_DISCUSSION' ? null : NOW,
    liveAt: status === 'LIVE' ? NOW : null,
    adapterVersion: null,
    lastSuccessfulCallAt: null,
    bdOwner: null,
    engOwner: null,
  }
}

describe('integrationStatusLabel', () => {
  it.each<[CarrierIntegrationStatus, string]>([
    ['PROSPECT', 'Prospect'],
    ['IN_DISCUSSION', 'In discussion'],
    ['CONTRACT_SIGNED', 'Contract signed'],
    ['INTEGRATION_IN_PROGRESS', 'Integration in progress'],
    ['PILOT', 'Pilot'],
    ['LIVE', 'Live'],
    ['DEPRECATED', 'Deprecated'],
  ])('%s -> %s', (status, label) => {
    expect(integrationStatusLabel(status)).toBe(label)
  })
})

describe('integrationProgressForStatus', () => {
  it('moves up the BD ladder', () => {
    expect(integrationProgressForStatus('PROSPECT')).toBe(0)
    expect(integrationProgressForStatus('PROSPECT')).toBeLessThan(
      integrationProgressForStatus('IN_DISCUSSION'),
    )
    expect(integrationProgressForStatus('IN_DISCUSSION')).toBeLessThan(
      integrationProgressForStatus('CONTRACT_SIGNED'),
    )
    expect(integrationProgressForStatus('CONTRACT_SIGNED')).toBeLessThan(
      integrationProgressForStatus('INTEGRATION_IN_PROGRESS'),
    )
    expect(integrationProgressForStatus('INTEGRATION_IN_PROGRESS')).toBeLessThan(
      integrationProgressForStatus('PILOT'),
    )
    expect(integrationProgressForStatus('PILOT')).toBeLessThan(
      integrationProgressForStatus('LIVE'),
    )
    expect(integrationProgressForStatus('LIVE')).toBe(100)
  })

  it('treats DEPRECATED as 0 (we walked away)', () => {
    expect(integrationProgressForStatus('DEPRECATED')).toBe(0)
  })
})

describe('integrationStatusTone', () => {
  it('classifies LIVE as success', () => {
    expect(integrationStatusTone('LIVE')).toBe('success')
  })

  it('classifies DEPRECATED as danger', () => {
    expect(integrationStatusTone('DEPRECATED')).toBe('danger')
  })

  it('classifies PROSPECT as neutral', () => {
    expect(integrationStatusTone('PROSPECT')).toBe('neutral')
  })

  it('classifies in-flight states as progress', () => {
    expect(integrationStatusTone('CONTRACT_SIGNED')).toBe('progress')
    expect(integrationStatusTone('PILOT')).toBe('progress')
    expect(integrationStatusTone('IN_DISCUSSION')).toBe('progress')
  })
})

describe('countByStatus / countLiveIntegrations', () => {
  it('counts only matching rows', () => {
    const records: CarrierIntegrationRecord[] = [
      record('a', 'LIVE'),
      record('b', 'LIVE'),
      record('c', 'PILOT'),
      record('d', 'DEPRECATED'),
    ]
    expect(countByStatus(records, 'LIVE')).toBe(2)
    expect(countByStatus(records, 'PILOT')).toBe(1)
    expect(countLiveIntegrations(records)).toBe(2)
  })
})

describe('summarizeIntegrationProgress', () => {
  it('rolls up live / pilot / contracted / deprecated counts', () => {
    const records: CarrierIntegrationRecord[] = [
      record('a', 'LIVE'),
      record('b', 'LIVE'),
      record('c', 'PILOT'),
      record('d', 'CONTRACT_SIGNED'),
      record('e', 'INTEGRATION_IN_PROGRESS'),
      record('f', 'DEPRECATED'),
    ]
    expect(summarizeIntegrationProgress(records)).toEqual({
      target: TARGET_TOP_25_P_AND_C,
      liveCount: 2,
      pilotCount: 1,
      contractedCount: 2,
      deprecatedCount: 1,
      progressToTarget: 2 / 25,
    })
  })

  it('clamps progressToTarget at 1', () => {
    const records = Array.from({ length: 30 }, (_, i) =>
      record(`r${i}`, 'LIVE'),
    )
    expect(summarizeIntegrationProgress(records).progressToTarget).toBe(1)
  })

  it('returns 0 when target is 0', () => {
    expect(
      summarizeIntegrationProgress([record('a', 'LIVE')], 0).progressToTarget,
    ).toBe(0)
  })
})

describe('nextMilestone', () => {
  it('returns the first uncleared milestone', () => {
    expect(nextMilestone(0)).toEqual(CARRIER_MILESTONES[0])
    expect(nextMilestone(4)).toEqual(CARRIER_MILESTONES[0])
    expect(nextMilestone(5)).toEqual(CARRIER_MILESTONES[1])
    expect(nextMilestone(14)).toEqual(CARRIER_MILESTONES[1])
    expect(nextMilestone(15)).toEqual(CARRIER_MILESTONES[2])
  })

  it('returns null once all milestones are cleared', () => {
    expect(nextMilestone(25)).toBeNull()
    expect(nextMilestone(99)).toBeNull()
  })

  it('exposes the spec milestones at 5/15/25', () => {
    expect(CARRIER_MILESTONES.map((m) => m.liveCount)).toEqual([5, 15, 25])
  })
})

describe('shouldRenderAppetiteUpdate', () => {
  it('always renders DIRECT_API regardless of confidence', () => {
    expect(shouldRenderAppetiteUpdate({ source: 'DIRECT_API', confidence: 0.1 })).toBe(true)
  })

  it('renders PARTNER_FEED above 0.7 confidence', () => {
    expect(shouldRenderAppetiteUpdate({ source: 'PARTNER_FEED', confidence: 0.7 })).toBe(true)
    expect(shouldRenderAppetiteUpdate({ source: 'PARTNER_FEED', confidence: 0.69 })).toBe(false)
  })

  it('requires 0.85+ for inferred / manual', () => {
    expect(shouldRenderAppetiteUpdate({ source: 'INFERRED_PUBLIC', confidence: 0.85 })).toBe(true)
    expect(shouldRenderAppetiteUpdate({ source: 'INFERRED_PUBLIC', confidence: 0.84 })).toBe(false)
    expect(shouldRenderAppetiteUpdate({ source: 'MANUAL', confidence: 0.9 })).toBe(true)
    expect(shouldRenderAppetiteUpdate({ source: 'MANUAL', confidence: 0.5 })).toBe(false)
  })
})

describe('appetiteSourceLabel', () => {
  it.each<[AppetiteSource, string]>([
    ['DIRECT_API', 'Direct carrier API'],
    ['PARTNER_FEED', 'Partner feed'],
    ['INFERRED_PUBLIC', 'Public sources'],
    ['MANUAL', 'Analyst review'],
  ])('%s -> %s', (source, label) => {
    expect(appetiteSourceLabel(source)).toBe(label)
  })
})
