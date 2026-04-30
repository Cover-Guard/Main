import {
  NOTIFICATION_DEFAULTS,
  notificationMetaFor,
} from '../../utils/notificationDefaults'
import type { NotificationType } from '../../types/chat'

describe('notificationDefaults', () => {
  it('has an entry for every NotificationType', () => {
    // Static check + sanity guard against the enum drifting from the map.
    const required: NotificationType[] = [
      'DM',
      'AGENT_REPLY',
      'SYSTEM',
      'INSIGHT',
      'BILLING',
      'LIFECYCLE',
    ]
    for (const t of required) {
      expect(NOTIFICATION_DEFAULTS[t]).toBeDefined()
      expect(NOTIFICATION_DEFAULTS[t].category).toBeDefined()
      expect(NOTIFICATION_DEFAULTS[t].severity).toBeDefined()
    }
  })

  it('treats DMs as actionable + collaborative', () => {
    expect(NOTIFICATION_DEFAULTS.DM).toEqual({
      category: 'collaborative',
      severity: 'actionable',
    })
  })

  it('treats agent replies as info, not actionable', () => {
    // Surface in the inbox, do not light up the actionable badge.
    expect(NOTIFICATION_DEFAULTS.AGENT_REPLY.severity).toBe('info')
  })

  it('treats billing as actionable system', () => {
    expect(NOTIFICATION_DEFAULTS.BILLING).toEqual({
      category: 'system',
      severity: 'actionable',
    })
  })

  it('routes insights into their own category', () => {
    expect(NOTIFICATION_DEFAULTS.INSIGHT.category).toBe('insight')
  })

  describe('notificationMetaFor', () => {
    it('returns defaults when no overrides are given', () => {
      expect(notificationMetaFor('DM')).toEqual(NOTIFICATION_DEFAULTS.DM)
    })

    it('lets the caller override severity (e.g. urgent system alert)', () => {
      expect(notificationMetaFor('SYSTEM', { severity: 'urgent' })).toEqual({
        category: 'system',
        severity: 'urgent',
      })
    })

    it('lets the caller override category', () => {
      expect(
        notificationMetaFor('INSIGHT', { category: 'collaborative' }),
      ).toEqual({
        category: 'collaborative',
        severity: 'info',
      })
    })

    it('preserves the type-default fields not overridden', () => {
      expect(notificationMetaFor('LIFECYCLE', { severity: 'actionable' })).toEqual({
        category: 'lifecycle',
        severity: 'actionable',
      })
    })
  })
})
