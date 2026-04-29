/**
 * plainLanguage helper tests (P0 #2 — Buyer-Friendly Report).
 *
 * The buyer view depends on these helpers being exhaustive across every
 * RiskLevel and CarrierWritingStatus value. If we add a new enum value and
 * forget to update plainLanguage, TypeScript catches it; these tests catch
 * regressions where the wording drifts from the spec.
 */

import {
  plainLanguageRiskLabel,
  plainLanguageRiskHeadline,
  plainLanguageCarrierStatus,
  shouldShowTechnicalDetailInBuyerView,
} from '../../utils/plainLanguage'
import type { RiskLevel } from '../../types/risk'
import type { CarrierWritingStatus } from '../../types/insurance'

const RISK_LEVELS: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME']
const CARRIER_STATUSES: CarrierWritingStatus[] = [
  'ACTIVELY_WRITING',
  'LIMITED',
  'SURPLUS_LINES',
  'NOT_WRITING',
]

describe('plainLanguageRiskLabel', () => {
  it('returns a non-empty string for every RiskLevel', () => {
    for (const level of RISK_LEVELS) {
      expect(plainLanguageRiskLabel(level)).toMatch(/\S/)
    }
  })

  it('returns distinct labels per level (no two levels collapse to the same wording)', () => {
    const labels = RISK_LEVELS.map(plainLanguageRiskLabel)
    expect(new Set(labels).size).toBe(RISK_LEVELS.length)
  })

  it('avoids the agent-facing "Very High" / "Extreme" jargon', () => {
    for (const level of RISK_LEVELS) {
      const label = plainLanguageRiskLabel(level)
      expect(label).not.toMatch(/very high/i)
      expect(label).not.toMatch(/extreme/i)
    }
  })
})

describe('plainLanguageRiskHeadline', () => {
  it('produces a sentence ending in punctuation for every level', () => {
    for (const level of RISK_LEVELS) {
      const headline = plainLanguageRiskHeadline(level, 'Flood')
      expect(headline).toMatch(/[.!?]$/)
    }
  })

  it('always mentions the peril name passed in', () => {
    expect(plainLanguageRiskHeadline('LOW', 'Wildfire')).toContain('Wildfire')
    expect(plainLanguageRiskHeadline('EXTREME', 'Earthquake')).toContain('Earthquake')
  })
})

describe('plainLanguageCarrierStatus', () => {
  it('returns a non-empty string for every CarrierWritingStatus', () => {
    for (const status of CARRIER_STATUSES) {
      expect(plainLanguageCarrierStatus(status)).toMatch(/\S/)
    }
  })

  it('avoids the SHOUTING_SNAKE_CASE source values', () => {
    for (const status of CARRIER_STATUSES) {
      const label = plainLanguageCarrierStatus(status)
      expect(label).not.toMatch(/_/)
      expect(label).not.toBe(label.toUpperCase())
    }
  })
})

describe('shouldShowTechnicalDetailInBuyerView', () => {
  it('hides FEMA / Cal Fire / ASCE jargon by key', () => {
    expect(shouldShowTechnicalDetailInBuyerView('firmPanelId')).toBe(false)
    expect(shouldShowTechnicalDetailInBuyerView('fireHazardSeverityZone')).toBe(false)
    expect(shouldShowTechnicalDetailInBuyerView('designWindSpeed')).toBe(false)
    expect(shouldShowTechnicalDetailInBuyerView('liquefactionPotential')).toBe(false)
  })

  it('keeps generally-understandable details', () => {
    expect(shouldShowTechnicalDetailInBuyerView('floodZone')).toBe(true)
    expect(shouldShowTechnicalDetailInBuyerView('nearestFireStation')).toBe(true)
    expect(shouldShowTechnicalDetailInBuyerView('annualChanceOfFlooding')).toBe(true)
  })
})
