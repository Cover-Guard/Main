/**
 * pricingMath tests (P0 #5 — Public pricing + self-serve checkout).
 *
 * Pin the discount math, the rounding direction, and the
 * `computePlanPriceDisplay` integration so every plan card renders the
 * same shape regardless of monthly price.
 */

import {
  ANNUAL_DISCOUNT_RATE,
  computeAnnualPrice,
  computeAnnualMonthlyEquivalent,
  computeAnnualSavings,
  computePlanPriceDisplay,
  getStripePriceEnvKey,
  isAnnualEligible,
} from '../../utils/pricingMath'
import type { PlanPricing } from '../../types/pricing'

const PLAN: PlanPricing = {
  id: 'home-buyer-pro',
  name: 'Home Buyer Pro',
  tier: 'SELF_SERVE',
  monthlyUsd: 29,
  monthlyStripePriceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
  annualStripePriceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL_ANNUAL',
}

const FREE_PLAN: PlanPricing = {
  ...PLAN,
  id: 'home-buyer-free',
  monthlyUsd: 0,
  monthlyStripePriceEnvKey: '',
  annualStripePriceEnvKey: '',
}

const ENTERPRISE_PLAN: PlanPricing = {
  ...PLAN,
  id: 'enterprise',
  tier: 'ENTERPRISE',
  monthlyUsd: null,
  monthlyStripePriceEnvKey: '',
  annualStripePriceEnvKey: '',
}

describe('ANNUAL_DISCOUNT_RATE', () => {
  it('matches the spec (20%)', () => {
    expect(ANNUAL_DISCOUNT_RATE).toBe(0.20)
  })
})

describe('computeAnnualPrice', () => {
  it('applies 20% off and returns whole USD', () => {
    // $29/mo * 12 * 0.8 = $278.40 → 278
    expect(computeAnnualPrice(29)).toBe(278)
  })

  it('rounds to the nearest dollar', () => {
    // $19/mo * 12 * 0.8 = $182.40 → 182
    expect(computeAnnualPrice(19)).toBe(182)
    // $25/mo * 12 * 0.8 = $240.00 → 240
    expect(computeAnnualPrice(25)).toBe(240)
  })

  it('returns 0 when monthly is 0', () => {
    expect(computeAnnualPrice(0)).toBe(0)
  })

  it('throws on negative input', () => {
    expect(() => computeAnnualPrice(-1)).toThrow()
  })
})

describe('computeAnnualMonthlyEquivalent', () => {
  it('rounds *down* so we never overstate the savings', () => {
    // $29 * 0.8 = $23.20 → 23 (not 23.2 or 24)
    expect(computeAnnualMonthlyEquivalent(29)).toBe(23)
  })

  it('returns 0 when monthly is 0', () => {
    expect(computeAnnualMonthlyEquivalent(0)).toBe(0)
  })
})

describe('computeAnnualSavings', () => {
  it('matches monthly*12 - annualPrice', () => {
    // $29 * 12 - 278 = $348 - $278 = $70
    expect(computeAnnualSavings(29)).toBe(70)
  })

  it('is always non-negative', () => {
    for (const m of [0, 1, 7, 29, 199, 399, 999]) {
      expect(computeAnnualSavings(m)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('computePlanPriceDisplay', () => {
  it('returns monthly headline + zero savings for MONTHLY', () => {
    const d = computePlanPriceDisplay(PLAN, 'MONTHLY')
    expect(d.amountUsd).toBe(29)
    expect(d.caption).toBe('/mo')
    expect(d.annualSavingsUsd).toBe(0)
  })

  it('returns per-month-equivalent + caption + savings for ANNUAL', () => {
    const d = computePlanPriceDisplay(PLAN, 'ANNUAL')
    expect(d.amountUsd).toBe(23) // $29 * 0.8 floored
    expect(d.caption).toMatch(/billed annually/i)
    expect(d.annualSavingsUsd).toBe(70)
  })

  it('returns zero values for the Free plan in either period', () => {
    expect(computePlanPriceDisplay(FREE_PLAN, 'MONTHLY')).toEqual({
      amountUsd: 0, caption: '', annualSavingsUsd: 0,
    })
    expect(computePlanPriceDisplay(FREE_PLAN, 'ANNUAL')).toEqual({
      amountUsd: 0, caption: '', annualSavingsUsd: 0,
    })
  })

  it('returns zero values for Enterprise (custom-quoted)', () => {
    const d = computePlanPriceDisplay(ENTERPRISE_PLAN, 'MONTHLY')
    expect(d.amountUsd).toBe(0)
    expect(d.caption).toBe('')
  })
})

describe('getStripePriceEnvKey', () => {
  it('returns the right key per period', () => {
    expect(getStripePriceEnvKey(PLAN, 'MONTHLY')).toBe(
      'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
    )
    expect(getStripePriceEnvKey(PLAN, 'ANNUAL')).toBe(
      'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL_ANNUAL',
    )
  })

  it('returns null for Free / Enterprise (no Stripe checkout)', () => {
    expect(getStripePriceEnvKey(FREE_PLAN, 'MONTHLY')).toBeNull()
    expect(getStripePriceEnvKey(ENTERPRISE_PLAN, 'MONTHLY')).toBeNull()
  })

  it('returns null for ANNUAL when annual price-id is unconfigured', () => {
    const noAnnual: PlanPricing = { ...PLAN, annualStripePriceEnvKey: '' }
    expect(getStripePriceEnvKey(noAnnual, 'ANNUAL')).toBeNull()
    expect(getStripePriceEnvKey(noAnnual, 'MONTHLY')).toBe(
      'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
    )
  })
})

describe('isAnnualEligible', () => {
  it('is true when annual env key is configured', () => {
    expect(isAnnualEligible(PLAN)).toBe(true)
  })

  it('is false when annual env key is empty', () => {
    expect(isAnnualEligible({ ...PLAN, annualStripePriceEnvKey: '' })).toBe(false)
    expect(isAnnualEligible(ENTERPRISE_PLAN)).toBe(false)
  })
})
