/**
 * quoteStatusMachine tests (P0 #4 — Quote-request status feedback loop).
 *
 * What we pin:
 *   - Allowed transitions follow the documented graph.
 *   - Terminal states have no outgoing transitions.
 *   - Every status has a non-empty copy bundle.
 *   - Legacy → canonical mapping is exhaustive and stable.
 */

import {
  isValidQuoteStatusTransition,
  getNextValidQuoteStatuses,
  isTerminalQuoteStatus,
  quoteStatusCopy,
  mapLegacyToCanonicalStatus,
  CANONICAL_QUOTE_STATUSES,
} from '../../utils/quoteStatusMachine'
import type { CanonicalQuoteStatus } from '../../types/quoteStatus'

describe('isValidQuoteStatusTransition', () => {
  it('permits the happy path REQUESTED → RECEIVED → QUOTING → QUOTED → BOUND', () => {
    expect(isValidQuoteStatusTransition('REQUESTED', 'RECEIVED')).toBe(true)
    expect(isValidQuoteStatusTransition('RECEIVED',  'QUOTING')).toBe(true)
    expect(isValidQuoteStatusTransition('QUOTING',   'QUOTED')).toBe(true)
    expect(isValidQuoteStatusTransition('QUOTED',    'BOUND')).toBe(true)
  })

  it('permits DECLINED + CANCELLED off-ramps from any non-terminal state', () => {
    const nonTerminal: CanonicalQuoteStatus[] = ['REQUESTED', 'RECEIVED', 'QUOTING', 'QUOTED']
    for (const from of nonTerminal) {
      expect(isValidQuoteStatusTransition(from, 'DECLINED')).toBe(true)
      expect(isValidQuoteStatusTransition(from, 'CANCELLED')).toBe(true)
    }
  })

  it('rejects skipping ahead in the happy path', () => {
    expect(isValidQuoteStatusTransition('REQUESTED', 'QUOTING')).toBe(false)
    expect(isValidQuoteStatusTransition('REQUESTED', 'QUOTED')).toBe(false)
    expect(isValidQuoteStatusTransition('REQUESTED', 'BOUND')).toBe(false)
    expect(isValidQuoteStatusTransition('RECEIVED',  'QUOTED')).toBe(false)
    expect(isValidQuoteStatusTransition('QUOTING',   'BOUND')).toBe(false)
  })

  it('rejects backwards moves', () => {
    expect(isValidQuoteStatusTransition('RECEIVED', 'REQUESTED')).toBe(false)
    expect(isValidQuoteStatusTransition('QUOTING',  'RECEIVED')).toBe(false)
    expect(isValidQuoteStatusTransition('QUOTED',   'QUOTING')).toBe(false)
  })

  it('rejects all transitions out of terminal states', () => {
    const terminal: CanonicalQuoteStatus[] = ['BOUND', 'DECLINED', 'CANCELLED']
    for (const from of terminal) {
      for (const to of CANONICAL_QUOTE_STATUSES) {
        expect(isValidQuoteStatusTransition(from, to)).toBe(false)
      }
    }
  })

  it('rejects same-state transitions (no idempotent re-marking)', () => {
    for (const s of CANONICAL_QUOTE_STATUSES) {
      expect(isValidQuoteStatusTransition(s, s)).toBe(false)
    }
  })
})

describe('getNextValidQuoteStatuses', () => {
  it('matches isValidQuoteStatusTransition for every status', () => {
    for (const from of CANONICAL_QUOTE_STATUSES) {
      const next = getNextValidQuoteStatuses(from)
      for (const to of CANONICAL_QUOTE_STATUSES) {
        expect(isValidQuoteStatusTransition(from, to)).toBe(next.includes(to))
      }
    }
  })

  it('returns an empty list for terminal states', () => {
    expect(getNextValidQuoteStatuses('BOUND')).toEqual([])
    expect(getNextValidQuoteStatuses('DECLINED')).toEqual([])
    expect(getNextValidQuoteStatuses('CANCELLED')).toEqual([])
  })
})

describe('isTerminalQuoteStatus', () => {
  it('returns true for BOUND / DECLINED / CANCELLED, false otherwise', () => {
    const terminal = new Set(['BOUND', 'DECLINED', 'CANCELLED'])
    for (const s of CANONICAL_QUOTE_STATUSES) {
      expect(isTerminalQuoteStatus(s)).toBe(terminal.has(s))
    }
  })
})

describe('quoteStatusCopy', () => {
  it('returns a non-empty copy bundle for every status', () => {
    for (const s of CANONICAL_QUOTE_STATUSES) {
      const copy = quoteStatusCopy(s)
      expect(copy.label).toMatch(/\S/)
      expect(copy.description).toMatch(/\S/)
      expect(copy.variant).toMatch(/^(neutral|pending|progress|success|warning|danger)$/)
    }
  })

  it('uses distinct labels per status', () => {
    const labels = CANONICAL_QUOTE_STATUSES.map((s) => quoteStatusCopy(s).label)
    expect(new Set(labels).size).toBe(CANONICAL_QUOTE_STATUSES.length)
  })

  it('marks BOUND and QUOTED as success variants', () => {
    expect(quoteStatusCopy('BOUND').variant).toBe('success')
    expect(quoteStatusCopy('QUOTED').variant).toBe('success')
  })

  it('marks DECLINED as danger', () => {
    expect(quoteStatusCopy('DECLINED').variant).toBe('danger')
  })
})

describe('mapLegacyToCanonicalStatus', () => {
  it('maps every legacy state to a canonical state', () => {
    expect(mapLegacyToCanonicalStatus('PENDING')).toBe('REQUESTED')
    expect(mapLegacyToCanonicalStatus('SENT')).toBe('RECEIVED')
    expect(mapLegacyToCanonicalStatus('RESPONDED')).toBe('QUOTED')
    expect(mapLegacyToCanonicalStatus('DECLINED')).toBe('DECLINED')
  })
})
