import {
  CATEGORY_LABEL,
  CATEGORY_REASON,
  CATEGORY_DISPLAY_ORDER,
  SEVERITY_LABEL,
  severityDotClass,
} from '../../utils/notificationCopy'
import type {
  NotificationCategory,
  NotificationSeverity,
} from '../../types/chat'

const ALL_CATEGORIES: NotificationCategory[] = [
  'transactional',
  'collaborative',
  'insight',
  'system',
  'lifecycle',
]

const ALL_SEVERITIES: NotificationSeverity[] = [
  'info',
  'actionable',
  'urgent',
  'blocking',
]

describe('notificationCopy', () => {
  describe('CATEGORY_LABEL', () => {
    it('has a label for every category', () => {
      for (const c of ALL_CATEGORIES) {
        expect(typeof CATEGORY_LABEL[c]).toBe('string')
        expect(CATEGORY_LABEL[c].length).toBeGreaterThan(0)
      }
    })
  })

  describe('CATEGORY_REASON', () => {
    it('has a reason for every category', () => {
      for (const c of ALL_CATEGORIES) {
        expect(typeof CATEGORY_REASON[c]).toBe('string')
        expect(CATEGORY_REASON[c].length).toBeGreaterThan(20)
      }
    })
  })

  describe('CATEGORY_DISPLAY_ORDER', () => {
    it('contains every category exactly once', () => {
      const set = new Set(CATEGORY_DISPLAY_ORDER)
      expect(set.size).toBe(CATEGORY_DISPLAY_ORDER.length)
      expect(set.size).toBe(ALL_CATEGORIES.length)
      for (const c of ALL_CATEGORIES) {
        expect(set.has(c)).toBe(true)
      }
    })

    it('puts collaborative first', () => {
      expect(CATEGORY_DISPLAY_ORDER[0]).toBe('collaborative')
    })
  })

  describe('SEVERITY_LABEL', () => {
    it('has a label for every severity', () => {
      for (const s of ALL_SEVERITIES) {
        expect(typeof SEVERITY_LABEL[s]).toBe('string')
        expect(SEVERITY_LABEL[s].length).toBeGreaterThan(0)
      }
    })
  })

  describe('severityDotClass', () => {
    it('returns red for urgent and blocking', () => {
      expect(severityDotClass('urgent')).toContain('red')
      expect(severityDotClass('blocking')).toContain('red')
    })

    it('returns indigo for actionable', () => {
      expect(severityDotClass('actionable')).toContain('indigo')
    })

    it('returns a neutral colour for info', () => {
      expect(severityDotClass('info')).toContain('gray')
    })

    it('returns a tailwind class string for every severity', () => {
      for (const s of ALL_SEVERITIES) {
        const cls = severityDotClass(s)
        expect(typeof cls).toBe('string')
        expect(cls.startsWith('bg-')).toBe(true)
      }
    })
  })
})
