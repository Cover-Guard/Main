import { cn, riskLevelClasses, riskScoreColor } from '../../lib/utils'
import type { RiskLevel } from '@coverguard/shared'

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('deduplicates conflicting Tailwind classes (tailwind-merge)', () => {
    // tailwind-merge should keep the last of two conflicting bg classes
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
  })

  it('handles conditional falsy values', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c')
  })

  it('returns empty string when no args', () => {
    expect(cn()).toBe('')
  })
})

describe('riskLevelClasses', () => {
  const cases: Array<[RiskLevel, string, string]> = [
    ['LOW',       'bg-green-100',  'text-green-800'],
    ['MODERATE',  'bg-yellow-100', 'text-yellow-800'],
    ['HIGH',      'bg-orange-100', 'text-orange-800'],
    ['VERY_HIGH', 'bg-red-100',    'text-red-800'],
    ['EXTREME',   'bg-red-900',    'text-red-100'],
  ]

  it.each(cases)('returns correct classes for %s', (level, bgClass, textClass) => {
    const result = riskLevelClasses(level)
    expect(result).toContain(bgClass)
    expect(result).toContain(textClass)
  })
})

describe('riskScoreColor', () => {
  it('returns green for score <= 25', () => {
    expect(riskScoreColor(0)).toBe('text-green-600')
    expect(riskScoreColor(25)).toBe('text-green-600')
  })

  it('returns yellow for score 26-50', () => {
    expect(riskScoreColor(26)).toBe('text-yellow-600')
    expect(riskScoreColor(50)).toBe('text-yellow-600')
  })

  it('returns orange for score 51-70', () => {
    expect(riskScoreColor(51)).toBe('text-orange-600')
    expect(riskScoreColor(70)).toBe('text-orange-600')
  })

  it('returns red-600 for score 71-85', () => {
    expect(riskScoreColor(71)).toBe('text-red-600')
    expect(riskScoreColor(85)).toBe('text-red-600')
  })

  it('returns red-900 for score > 85', () => {
    expect(riskScoreColor(86)).toBe('text-red-900')
    expect(riskScoreColor(100)).toBe('text-red-900')
  })
})
