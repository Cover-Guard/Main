/**
 * Tests for pushDispatcher (PR 11).
 *
 * Pure-function tests â no jest.mock() needed because the helpers under test
 * don't call any I/O. The dispatchPush wrapper is exercised by the worker
 * tests (separate file) where we mock web-push.
 */

import {
  buildPushPayload,
  isInQuietHours,
  shouldPushNotification,
  type PushNotification,
  type PushPrefsForDispatcher,
} from '../../services/pushDispatcher'

const baseNotif = (over: Partial<PushNotification> = {}): PushNotification => ({
  id: 'n1',
  title: 'A title',
  body: 'A body',
  linkUrl: null,
  category: 'collaborative',
  severity: 'info',
  entityType: null,
  entityId: null,
  ...over,
})

const allOff: PushPrefsForDispatcher = {
  channels: {
    transactional: { push: false },
    collaborative: { push: false },
    insight: { push: false },
    system: { push: false },
    lifecycle: { push: false },
  },
}

const collabOn: PushPrefsForDispatcher = {
  channels: {
    transactional: { push: false },
    collaborative: { push: true },
    insight: { push: false },
    system: { push: false },
    lifecycle: { push: false },
  },
}

describe('shouldPushNotification', () => {
  it('always pushes actionable+ regardless of channel', () => {
    expect(
      shouldPushNotification(
        baseNotif({ category: 'insight', severity: 'actionable' }),
        allOff,
      ),
    ).toBe(true)
    expect(
      shouldPushNotification(
        baseNotif({ category: 'transactional', severity: 'urgent' }),
        allOff,
      ),
    ).toBe(true)
    expect(
      shouldPushNotification(
        baseNotif({ category: 'system', severity: 'blocking' }),
        allOff,
      ),
    ).toBe(true)
  })

  it('respects per-category push toggle for info-severity items', () => {
    expect(
      shouldPushNotification(
        baseNotif({ category: 'collaborative', severity: 'info' }),
        collabOn,
      ),
    ).toBe(true)
    expect(
      shouldPushNotification(
        baseNotif({ category: 'insight', severity: 'info' }),
        collabOn,
      ),
    ).toBe(false)
  })

  it('quiet hours suppress info and actionable but let urgent through', () => {
    const utcNoon = new Date('2026-04-30T12:00:00Z')
    const prefs: PushPrefsForDispatcher = {
      channels: { collaborative: { push: true } },
      quietHoursStart: 9,
      quietHoursEnd: 17,
      timezone: 'UTC',
    }
    expect(
      shouldPushNotification(
        baseNotif({ severity: 'info' }),
        prefs,
        utcNoon,
      ),
    ).toBe(false)
    expect(
      shouldPushNotification(
        baseNotif({ severity: 'actionable' }),
        prefs,
        utcNoon,
      ),
    ).toBe(false)
    expect(
      shouldPushNotification(
        baseNotif({ severity: 'urgent' }),
        prefs,
        utcNoon,
      ),
    ).toBe(true)
  })
})

describe('isInQuietHours', () => {
  const at = (utc: string): Date => new Date(utc)

  it('returns false when quiet hours are not configured', () => {
    expect(
      isInQuietHours(at('2026-04-30T12:00:00Z'), {
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: 'UTC',
      }),
    ).toBe(false)
  })

  it('handles a same-day window (9-17)', () => {
    const prefs = { quietHoursStart: 9, quietHoursEnd: 17, timezone: 'UTC' }
    expect(isInQuietHours(at('2026-04-30T08:30:00Z'), prefs)).toBe(false)
    expect(isInQuietHours(at('2026-04-30T09:00:00Z'), prefs)).toBe(true)
    expect(isInQuietHours(at('2026-04-30T16:59:00Z'), prefs)).toBe(true)
    expect(isInQuietHours(at('2026-04-30T17:00:00Z'), prefs)).toBe(false)
  })

  it('handles a wrap-around window (22-7)', () => {
    const prefs = { quietHoursStart: 22, quietHoursEnd: 7, timezone: 'UTC' }
    expect(isInQuietHours(at('2026-04-30T21:30:00Z'), prefs)).toBe(false)
    expect(isInQuietHours(at('2026-04-30T22:00:00Z'), prefs)).toBe(true)
    expect(isInQuietHours(at('2026-04-30T03:00:00Z'), prefs)).toBe(true)
    expect(isInQuietHours(at('2026-04-30T07:00:00Z'), prefs)).toBe(false)
  })

  it('respects timezone â 22-7 quiet in NY means 02-11 UTC', () => {
    // 02:30 UTC = 22:30 EDT â inside quiet hours
    expect(
      isInQuietHours(at('2026-04-30T02:30:00Z'), {
        quietHoursStart: 22,
        quietHoursEnd: 7,
        timezone: 'America/New_York',
      }),
    ).toBe(true)
  })
})

describe('buildPushPayload', () => {
  const baseUrl = 'https://app.example'

  it('uses linkUrl when present, falls back to deep link otherwise', () => {
    const a = buildPushPayload(
      baseNotif({ id: 'n1', linkUrl: 'https://app.example/deals/d1' }),
      baseUrl,
    )
    expect(a.url).toBe('https://app.example/deals/d1')

    const b = buildPushPayload(baseNotif({ id: 'n2', linkUrl: null }), baseUrl)
    expect(b.url).toBe('https://app.example/dashboard?notification=n2')
  })

  it('groups by entity tag when entity is present', () => {
    const p = buildPushPayload(
      baseNotif({ id: 'n1', entityType: 'deal', entityId: 'd1' }),
      baseUrl,
    )
    expect(p.tag).toBe('deal:d1')

    const noEntity = buildPushPayload(
      baseNotif({ id: 'n9', entityType: null, entityId: null }),
      baseUrl,
    )
    expect(noEntity.tag).toBe('notif:n9')
  })

  it('truncates body to lockscreen-friendly length', () => {
    const long = 'x'.repeat(500)
    const p = buildPushPayload(baseNotif({ body: long }), baseUrl)
    expect(p.body.length).toBe(200)
  })

  it('includes severity and category in payload for client-side rendering', () => {
    const p = buildPushPayload(
      baseNotif({ severity: 'urgent', category: 'transactional' }),
      baseUrl,
    )
    expect(p.severity).toBe('urgent')
    expect(p.category).toBe('transactional')
  })

  it('handles null body without crashing', () => {
    const p = buildPushPayload(baseNotif({ body: null }), baseUrl)
    expect(p.body).toBe('')
  })
})
