import { buildDigest, shouldIncludeInDigest } from '../../services/digestBuilder'
import type { DigestNotification, DigestPrefsForBuilder } from '../../services/digestBuilder'

const makeNotif = (over: Partial<DigestNotification> & { id: string }): DigestNotification => ({
  title: 'Untitled',
  body: null,
  linkUrl: null,
  category: 'collaborative',
  severity: 'info',
  createdAt: '2026-04-30T12:00:00Z',
  ...over,
})

const allEmailOff: DigestPrefsForBuilder = {
  channels: {
    transactional: { email: false },
    collaborative: { email: false },
    insight: { email: false },
    system: { email: false },
    lifecycle: { email: false },
  },
}

const insightEmailOn: DigestPrefsForBuilder = {
  channels: {
    transactional: { email: false },
    collaborative: { email: false },
    insight: { email: true },
    system: { email: false },
    lifecycle: { email: false },
  },
}

describe('shouldIncludeInDigest', () => {
  it('always includes actionable+ regardless of channel', () => {
    expect(
      shouldIncludeInDigest({ category: 'transactional', severity: 'actionable' }, allEmailOff),
    ).toBe(true)
    expect(
      shouldIncludeInDigest({ category: 'transactional', severity: 'urgent' }, allEmailOff),
    ).toBe(true)
  })

  it('respects email channel for info-severity items', () => {
    expect(
      shouldIncludeInDigest({ category: 'insight', severity: 'info' }, insightEmailOn),
    ).toBe(true)
    expect(
      shouldIncludeInDigest({ category: 'collaborative', severity: 'info' }, insightEmailOn),
    ).toBe(false)
  })
})

describe('buildDigest', () => {
  it('returns null when nothing is eligible', () => {
    const notifs = [makeNotif({ id: '1', category: 'collaborative', severity: 'info' })]
    expect(buildDigest(notifs, allEmailOff)).toBeNull()
  })

  it('groups by category and respects per-section cap', () => {
    const notifs: DigestNotification[] = []
    for (let i = 0; i < 8; i++) {
      notifs.push(
        makeNotif({
          id: `i${i}`,
          category: 'insight',
          severity: 'info',
          createdAt: `2026-04-30T${String(8 + i).padStart(2, '0')}:00:00Z`,
        }),
      )
    }
    const digest = buildDigest(notifs, insightEmailOn)
    expect(digest).not.toBeNull()
    const insightSection = digest!.sections.find((s) => s.category === 'insight')!
    expect(insightSection.items).toHaveLength(5)
    expect(insightSection.truncated).toBe(3)
    // Most-recent first
    expect(insightSection.items[0].id).toBe('i7')
  })

  it('counts urgent and actionable correctly', () => {
    const notifs = [
      makeNotif({ id: 'u', category: 'system', severity: 'urgent' }),
      makeNotif({ id: 'a', category: 'transactional', severity: 'actionable' }),
      makeNotif({ id: 'i', category: 'insight', severity: 'info' }),
    ]
    const digest = buildDigest(notifs, insightEmailOn)
    expect(digest!.urgentCount).toBe(1)
    expect(digest!.actionableCount).toBe(2)
  })

  it('orders sections by category convention', () => {
    const notifs = [
      makeNotif({ id: '1', category: 'lifecycle', severity: 'urgent' }),
      makeNotif({ id: '2', category: 'transactional', severity: 'actionable' }),
      makeNotif({ id: '3', category: 'insight', severity: 'urgent' }),
    ]
    const digest = buildDigest(notifs, insightEmailOn)
    expect(digest!.sections.map((s) => s.category)).toEqual([
      'transactional',
      'insight',
      'lifecycle',
    ])
  })

  it('within a section, sorts by severity then recency', () => {
    const notifs = [
      makeNotif({
        id: 'a',
        category: 'insight',
        severity: 'info',
        createdAt: '2026-04-30T12:00:00Z',
      }),
      makeNotif({
        id: 'b',
        category: 'insight',
        severity: 'urgent',
        createdAt: '2026-04-30T08:00:00Z',
      }),
      makeNotif({
        id: 'c',
        category: 'insight',
        severity: 'info',
        createdAt: '2026-04-30T14:00:00Z',
      }),
    ]
    const digest = buildDigest(notifs, insightEmailOn)
    const section = digest!.sections.find((s) => s.category === 'insight')!
    expect(section.items.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })
})
