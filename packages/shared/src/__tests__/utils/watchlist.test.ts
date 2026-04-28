import {
  canAddToWatchlist,
  changeKindLabel,
  classifyPerilScoreDelta,
  defaultSeverityForChange,
  isWithinQuietHours,
  shouldNotify,
  watchlistTierLimit,
} from '../../utils/watchlist'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MATERIAL_PERIL_DELTA_THRESHOLD,
  type NotificationPreferences,
} from '../../types/watchlist'

describe('classifyPerilScoreDelta', () => {
  it('is MATERIAL when delta exceeds the threshold', () => {
    expect(classifyPerilScoreDelta(40, 60)).toBe('MATERIAL') // delta 20
  })

  it('is IMMATERIAL when delta is at or below the threshold', () => {
    expect(classifyPerilScoreDelta(40, 50)).toBe('IMMATERIAL') // exactly 10
    expect(classifyPerilScoreDelta(40, 45)).toBe('IMMATERIAL')
  })

  it('uses absolute value (drops are also material)', () => {
    expect(classifyPerilScoreDelta(80, 50)).toBe('MATERIAL')
  })

  it('treats null inputs as IMMATERIAL', () => {
    expect(classifyPerilScoreDelta(null, 50)).toBe('IMMATERIAL')
    expect(classifyPerilScoreDelta(50, null)).toBe('IMMATERIAL')
  })

  it('respects a custom threshold', () => {
    expect(classifyPerilScoreDelta(40, 45, 3)).toBe('MATERIAL')
    expect(classifyPerilScoreDelta(40, 42, 3)).toBe('IMMATERIAL')
  })

  it('uses the spec default threshold (10) when none is passed', () => {
    expect(MATERIAL_PERIL_DELTA_THRESHOLD).toBe(10)
  })
})

describe('defaultSeverityForChange', () => {
  it('returns HIGH for wildfire perimeter intersects', () => {
    expect(defaultSeverityForChange('WILDFIRE_PERIMETER_INTERSECT')).toBe('HIGH')
  })

  it('returns HIGH for FEMA zone changes', () => {
    expect(defaultSeverityForChange('FEMA_ZONE_CHANGE')).toBe('HIGH')
  })

  it('returns MEDIUM for carrier appetite changes', () => {
    expect(defaultSeverityForChange('CARRIER_APPETITE_CHANGE')).toBe('MEDIUM')
  })

  it('scales peril delta severity with magnitude', () => {
    expect(defaultSeverityForChange('PERIL_SCORE_DELTA', 25)).toBe('HIGH')
    expect(defaultSeverityForChange('PERIL_SCORE_DELTA', 12)).toBe('MEDIUM')
    expect(defaultSeverityForChange('PERIL_SCORE_DELTA', 5)).toBe('LOW')
  })

  it('handles missing delta as LOW', () => {
    expect(defaultSeverityForChange('PERIL_SCORE_DELTA')).toBe('LOW')
  })
})

describe('changeKindLabel', () => {
  it('returns a human-readable label for each kind', () => {
    expect(changeKindLabel('PERIL_SCORE_DELTA')).toBe('Peril score change')
    expect(changeKindLabel('FEMA_ZONE_CHANGE')).toBe('FEMA flood zone reclassified')
    expect(changeKindLabel('CARRIER_APPETITE_CHANGE')).toBe('Carrier appetite changed')
    expect(changeKindLabel('WILDFIRE_PERIMETER_INTERSECT')).toBe('Wildfire perimeter intersect')
  })
})

describe('isWithinQuietHours', () => {
  const standard: Pick<NotificationPreferences, 'quietHoursStart' | 'quietHoursEnd'> = {
    quietHoursStart: 21, // 9pm
    quietHoursEnd: 7,    // 7am
  }

  it('is true at midnight inside the wrap-around window', () => {
    expect(isWithinQuietHours(0, standard)).toBe(true)
  })

  it('is true at 22 inside the wrap-around window', () => {
    expect(isWithinQuietHours(22, standard)).toBe(true)
  })

  it('is true at 6 inside the wrap-around window', () => {
    expect(isWithinQuietHours(6, standard)).toBe(true)
  })

  it('is false at 7 (window end is exclusive)', () => {
    expect(isWithinQuietHours(7, standard)).toBe(false)
  })

  it('is false at noon outside the window', () => {
    expect(isWithinQuietHours(12, standard)).toBe(false)
  })

  it('handles a same-day window', () => {
    const sameDay = { quietHoursStart: 13, quietHoursEnd: 17 }
    expect(isWithinQuietHours(15, sameDay)).toBe(true)
    expect(isWithinQuietHours(13, sameDay)).toBe(true)
    expect(isWithinQuietHours(17, sameDay)).toBe(false)
    expect(isWithinQuietHours(12, sameDay)).toBe(false)
  })

  it('treats start === end as window disabled', () => {
    expect(isWithinQuietHours(0, { quietHoursStart: 9, quietHoursEnd: 9 })).toBe(false)
    expect(isWithinQuietHours(9, { quietHoursStart: 9, quietHoursEnd: 9 })).toBe(false)
  })
})

describe('shouldNotify', () => {
  const prefs: NotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    email: true,
    inApp: true,
  }

  it('returns false when channel is disabled', () => {
    expect(
      shouldNotify('email', { ...prefs, email: false }, 12),
    ).toBe(false)
    expect(
      shouldNotify('inApp', { ...prefs, inApp: false }, 12),
    ).toBe(false)
  })

  it('returns false during quiet hours', () => {
    // 23:00 falls inside default 21->7 quiet window
    expect(shouldNotify('email', prefs, 23)).toBe(false)
  })

  it('returns true when channel is on and clock is outside quiet hours', () => {
    expect(shouldNotify('email', prefs, 12)).toBe(true)
    expect(shouldNotify('inApp', prefs, 8)).toBe(true)
  })
})

describe('tier limits', () => {
  it('returns the documented limit for each tier', () => {
    expect(watchlistTierLimit('FREE')).toBe(3)
    expect(watchlistTierLimit('PRO')).toBe(25)
    expect(watchlistTierLimit('TEAM')).toBe(100)
    expect(watchlistTierLimit('ENTERPRISE')).toBe(Number.POSITIVE_INFINITY)
  })

  it('canAddToWatchlist guards against the cap', () => {
    expect(canAddToWatchlist(2, 'FREE')).toBe(true)
    expect(canAddToWatchlist(3, 'FREE')).toBe(false)
    expect(canAddToWatchlist(99, 'TEAM')).toBe(true)
    expect(canAddToWatchlist(100, 'TEAM')).toBe(false)
    expect(canAddToWatchlist(1_000_000, 'ENTERPRISE')).toBe(true)
  })
})
