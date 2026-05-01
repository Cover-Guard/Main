import { isDigestDueNow, localHourAndDate } from '../../services/digestTime'

describe('digestTime.localHourAndDate', () => {
  it('returns the correct UTC hour for a UTC timezone', () => {
    const r = localHourAndDate(new Date('2026-04-30T13:30:00Z'), 'UTC')
    expect(r.hour).toBe(13)
    expect(r.dateKey).toBe('2026-04-30')
  })

  it('shifts to a different wall-clock hour for non-UTC zones', () => {
    // 13:30 UTC = 09:30 EDT (-04:00) on 2026-04-30
    const r = localHourAndDate(new Date('2026-04-30T13:30:00Z'), 'America/New_York')
    expect(r.hour).toBe(9)
    expect(r.dateKey).toBe('2026-04-30')
  })

  it('rolls over the date key correctly across midnight', () => {
    // 02:30 UTC on May 1 = 22:30 EDT on Apr 30
    const r = localHourAndDate(new Date('2026-05-01T02:30:00Z'), 'America/New_York')
    expect(r.hour).toBe(22)
    expect(r.dateKey).toBe('2026-04-30')
  })
})

describe('digestTime.isDigestDueNow', () => {
  const baseUtc = new Date('2026-04-30T13:30:00Z') // 09:30 EDT, 13:30 UTC

  it('returns false when digest is disabled', () => {
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: false,
        digestHourLocal: 9,
        timezone: 'America/New_York',
        lastDigestSentAt: null,
      }),
    ).toBe(false)
  })

  it('returns true when local hour matches and no prior send', () => {
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: true,
        digestHourLocal: 9,
        timezone: 'America/New_York',
        lastDigestSentAt: null,
      }),
    ).toBe(true)
  })

  it('returns false when local hour does not match', () => {
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: true,
        digestHourLocal: 10,
        timezone: 'America/New_York',
        lastDigestSentAt: null,
      }),
    ).toBe(false)
  })

  it('dedupes when already sent the same local day', () => {
    const sentToday = '2026-04-30T13:00:00Z' // 09:00 EDT â same local day
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: true,
        digestHourLocal: 9,
        timezone: 'America/New_York',
        lastDigestSentAt: sentToday,
      }),
    ).toBe(false)
  })

  it('does not dedupe across local days', () => {
    const sentYesterday = '2026-04-29T13:00:00Z' // 09:00 EDT yesterday
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: true,
        digestHourLocal: 9,
        timezone: 'America/New_York',
        lastDigestSentAt: sentYesterday,
      }),
    ).toBe(true)
  })

  it('falls back to UTC when timezone is malformed', () => {
    // 13:30 UTC, hour=13 in fallback
    expect(
      isDigestDueNow(baseUtc, {
        digestEnabled: true,
        digestHourLocal: 13,
        timezone: 'Not/A_Real_Zone',
        lastDigestSentAt: null,
      }),
    ).toBe(true)
  })
})
