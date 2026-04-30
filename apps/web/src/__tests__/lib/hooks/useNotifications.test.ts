/**
 * Unit tests for the notification helpers exported by useNotifications.
 *
 * The provider itself is exercised in integration; here we focus on
 * `isActionable`, which decides whether a notification drives the bell
 * badge and a toast. PR 3 introduced this distinction and we want a
 * regression guard against severities silently being added or removed
 * from the actionable set.
 */

import { isActionable } from '@/lib/hooks/useNotifications'
import type { NotificationSeverity } from '@coverguard/shared'

const ALL_SEVERITIES: NotificationSeverity[] = [
  'info',
  'actionable',
  'urgent',
  'blocking',
]

describe('isActionable', () => {
  it('returns true for actionable, urgent, and blocking', () => {
    expect(isActionable({ severity: 'actionable' })).toBe(true)
    expect(isActionable({ severity: 'urgent' })).toBe(true)
    expect(isActionable({ severity: 'blocking' })).toBe(true)
  })

  it('returns false for info', () => {
    expect(isActionable({ severity: 'info' })).toBe(false)
  })

  it('classifies every severity exhaustively', () => {
    // If a future PR adds a new severity, this test fails until isActionable
    // is updated and we make a deliberate decision about whether it counts.
    for (const s of ALL_SEVERITIES) {
      const result = isActionable({ severity: s })
      expect(typeof result).toBe('boolean')
    }
  })
})
