import {
  buildAlert,
  classifyTransition,
  detectCarrierExits,
} from '../../utils/carrierExit'
import type {
  CarrierAvailabilityEntry,
  CarrierAvailabilitySnapshot,
} from '../../types/insurance'

function snapshot(zip: string, at: string, entries: CarrierAvailabilityEntry[]): CarrierAvailabilitySnapshot {
  return { zip, capturedAt: at, entries }
}

function entry(id: string, status: CarrierAvailabilityEntry['status'], name?: string): CarrierAvailabilityEntry {
  return { carrierId: id, carrierName: name ?? `Carrier ${id}`, status }
}

describe('classifyTransition', () => {
  it('returns null when status is unchanged', () => {
    expect(classifyTransition('ACTIVELY_WRITING', 'ACTIVELY_WRITING')).toBeNull()
    expect(classifyTransition('NOT_WRITING', 'NOT_WRITING')).toBeNull()
  })

  it('classifies ACTIVELY_WRITING → NOT_WRITING as EXIT', () => {
    expect(classifyTransition('ACTIVELY_WRITING', 'NOT_WRITING')).toBe('EXIT')
    expect(classifyTransition('ACTIVELY_WRITING', 'SURPLUS_LINES')).toBe('EXIT')
  })

  it('classifies ACTIVELY_WRITING → LIMITED as RESTRICT', () => {
    expect(classifyTransition('ACTIVELY_WRITING', 'LIMITED')).toBe('RESTRICT')
  })

  it('classifies closed → ACTIVELY_WRITING as REOPEN', () => {
    expect(classifyTransition('NOT_WRITING', 'ACTIVELY_WRITING')).toBe('REOPEN')
    expect(classifyTransition('SURPLUS_LINES', 'ACTIVELY_WRITING')).toBe('REOPEN')
  })

  it('classifies LIMITED → ACTIVELY_WRITING as LIFT_RESTRICTION', () => {
    expect(classifyTransition('LIMITED', 'ACTIVELY_WRITING')).toBe('LIFT_RESTRICTION')
  })

  it('ignores noisy transitions', () => {
    expect(classifyTransition('LIMITED', 'NOT_WRITING')).toBeNull()
    expect(classifyTransition('NOT_WRITING', 'LIMITED')).toBeNull()
  })
})

describe('detectCarrierExits', () => {
  const prev = snapshot('94103', '2026-04-20T00:00:00Z', [
    entry('c1', 'ACTIVELY_WRITING'),
    entry('c2', 'ACTIVELY_WRITING'),
    entry('c3', 'LIMITED'),
  ])

  it('returns EXIT when a carrier goes closed', () => {
    const curr = snapshot('94103', '2026-04-21T00:00:00Z', [
      entry('c1', 'NOT_WRITING'),
      entry('c2', 'ACTIVELY_WRITING'),
      entry('c3', 'LIMITED'),
    ])
    const events = detectCarrierExits(prev, curr)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('EXIT')
    expect(events[0].carrierId).toBe('c1')
  })

  it('returns REOPEN when a carrier comes back', () => {
    const curr = snapshot('94103', '2026-04-21T00:00:00Z', [
      entry('c1', 'ACTIVELY_WRITING'),
      entry('c2', 'ACTIVELY_WRITING'),
      entry('c3', 'ACTIVELY_WRITING'),
    ])
    const events = detectCarrierExits(prev, curr)
    expect(events.map((e) => e.kind).sort()).toEqual(['LIFT_RESTRICTION'])
  })

  it('treats a disappeared actively-writing carrier as an EXIT', () => {
    const curr = snapshot('94103', '2026-04-21T00:00:00Z', [
      entry('c2', 'ACTIVELY_WRITING'),
      entry('c3', 'LIMITED'),
    ])
    const events = detectCarrierExits(prev, curr)
    expect(events).toHaveLength(1)
    expect(events[0].carrierId).toBe('c1')
    expect(events[0].kind).toBe('EXIT')
  })

  it('ignores carriers that are new in the current snapshot', () => {
    const curr = snapshot('94103', '2026-04-21T00:00:00Z', [
      ...prev.entries,
      entry('c4', 'ACTIVELY_WRITING'),
    ])
    const events = detectCarrierExits(prev, curr)
    expect(events).toHaveLength(0)
  })

  it('throws if the two snapshots are for different ZIPs', () => {
    const curr = snapshot('94104', '2026-04-21T00:00:00Z', [])
    expect(() => detectCarrierExits(prev, curr)).toThrow(/same ZIP/)
  })
})

describe('buildAlert', () => {
  const exitEvent = {
    zip: '94103',
    carrierId: 'c1',
    carrierName: 'State Farm',
    kind: 'EXIT' as const,
    previousStatus: 'ACTIVELY_WRITING' as const,
    currentStatus: 'NOT_WRITING' as const,
    detectedAt: '2026-04-21T00:00:00Z',
  }

  it('composes a headline from the event', () => {
    const alert = buildAlert(exitEvent)
    expect(alert.headline).toBe('State Farm closed 94103')
  })

  it('escalates severity when the agent has affected policies', () => {
    const cold = buildAlert(exitEvent, { affectedPolicyCount: 0 })
    const hot = buildAlert(exitEvent, { affectedPolicyCount: 4 })
    expect(cold.severity).toBe('WARNING')
    expect(hot.severity).toBe('CRITICAL')
    expect(hot.callToAction).toMatch(/4 affected polic/)
  })

  it('uses INFO severity for benign reopens', () => {
    const alert = buildAlert({ ...exitEvent, kind: 'REOPEN' })
    expect(alert.severity).toBe('INFO')
  })
})
