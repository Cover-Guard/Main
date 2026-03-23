import {
  formatCurrency,
  formatAddress,
  riskLevelToLabel,
  riskLevelToColor,
  formatSquareFeet,
  formatAcres,
} from '../../utils/formatters'
import type { RiskLevel } from '../../types/risk'

describe('formatCurrency', () => {
  it('formats whole-dollar amounts with $ sign and commas', () => {
    expect(formatCurrency(1500)).toBe('$1,500')
    expect(formatCurrency(1_000_000)).toBe('$1,000,000')
  })

  it('rounds to zero decimal places by default', () => {
    expect(formatCurrency(1234.99)).toBe('$1,235')
  })

  it('accepts Intl options override', () => {
    const result = formatCurrency(1500, { maximumFractionDigits: 2 })
    expect(result).toMatch(/\$1,500\.00/)
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('handles negative amounts', () => {
    expect(formatCurrency(-250)).toMatch(/-?\$250|-250/)
  })
})

describe('formatAddress', () => {
  it('combines address parts into a formatted string', () => {
    const result = formatAddress({
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
    })
    expect(result).toBe('123 Main St, Springfield, IL 62701')
  })
})

describe('riskLevelToLabel', () => {
  const cases: Array<[RiskLevel, string]> = [
    ['LOW', 'Low'],
    ['MODERATE', 'Moderate'],
    ['HIGH', 'High'],
    ['VERY_HIGH', 'Very High'],
    ['EXTREME', 'Extreme'],
  ]

  it.each(cases)('maps %s → "%s"', (level, expected) => {
    expect(riskLevelToLabel(level)).toBe(expected)
  })
})

describe('riskLevelToColor', () => {
  it('returns green for LOW', () => {
    expect(riskLevelToColor('LOW')).toBe('green')
  })

  it('returns yellow for MODERATE', () => {
    expect(riskLevelToColor('MODERATE')).toBe('yellow')
  })

  it('returns orange for HIGH', () => {
    expect(riskLevelToColor('HIGH')).toBe('orange')
  })

  it('returns red for VERY_HIGH', () => {
    expect(riskLevelToColor('VERY_HIGH')).toBe('red')
  })

  it('returns red for EXTREME', () => {
    expect(riskLevelToColor('EXTREME')).toBe('red')
  })
})

describe('formatSquareFeet', () => {
  it('formats a valid sqft value with commas and unit', () => {
    expect(formatSquareFeet(2500)).toBe('2,500 sq ft')
    expect(formatSquareFeet(1200)).toBe('1,200 sq ft')
  })

  it('returns "Unknown" for null', () => {
    expect(formatSquareFeet(null)).toBe('Unknown')
  })

  it('returns "Unknown" for 0', () => {
    expect(formatSquareFeet(0)).toBe('Unknown')
  })
})

describe('formatAcres', () => {
  it('converts sqft to acres with 2 decimal places', () => {
    // 43560 sqft = 1 acre
    expect(formatAcres(43560)).toBe('1.00 acres')
    expect(formatAcres(21780)).toBe('0.50 acres')
  })

  it('returns "Unknown" for null', () => {
    expect(formatAcres(null)).toBe('Unknown')
  })

  it('returns "Unknown" for 0', () => {
    expect(formatAcres(0)).toBe('Unknown')
  })
})
