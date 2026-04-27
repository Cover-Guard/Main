/**
 * Pricing math — annual discount, savings, and display formatting.
 *
 * Spec: docs/enhancements/p0/05-public-pricing-self-serve-checkout.md.
 *
 * One source of truth so every plan card on the pricing page applies the
 * same discount and rounds the same way. The page passes a `PlanPricing`
 * + `BillingPeriod` in and gets a `PlanPriceDisplay` back; no in-JSX math.
 */

import type {
  BillingPeriod,
  PlanPricing,
  PlanPriceDisplay,
} from '../types/pricing'

/** Annual pre-pay discount fraction (per spec: 20% off). */
export const ANNUAL_DISCOUNT_RATE = 0.20

/**
 * Compute the *total* annual price for a plan whose monthly list price is
 * `monthlyUsd`. Returns whole USD (rounded to nearest dollar) so the page
 * can render `$XXX/year` without trailing cents.
 *
 * Formula: `monthlyUsd * 12 * (1 - ANNUAL_DISCOUNT_RATE)`.
 */
export function computeAnnualPrice(monthlyUsd: number): number {
  if (monthlyUsd < 0) throw new Error('monthlyUsd must be non-negative')
  return Math.round(monthlyUsd * 12 * (1 - ANNUAL_DISCOUNT_RATE))
}

/**
 * Per-month equivalent on the annual plan. The pricing card shows this
 * as the headline number ("$23/mo billed annually") so the comparison
 * against the monthly plan is visually obvious.
 *
 * Returns whole USD; will round down so we never overstate the savings.
 */
export function computeAnnualMonthlyEquivalent(monthlyUsd: number): number {
  if (monthlyUsd < 0) throw new Error('monthlyUsd must be non-negative')
  return Math.floor(monthlyUsd * (1 - ANNUAL_DISCOUNT_RATE))
}

/**
 * Annual savings in whole USD vs paying monthly for a year. Used in the
 * "Save $XXX with annual" badge. Always >= 0.
 */
export function computeAnnualSavings(monthlyUsd: number): number {
  if (monthlyUsd < 0) throw new Error('monthlyUsd must be non-negative')
  return monthlyUsd * 12 - computeAnnualPrice(monthlyUsd)
}

/**
 * Compose the values a plan card renders, given a `PlanPricing` and the
 * currently-selected `BillingPeriod`. Returns sensible zero-values for
 * Free and Enterprise tiers (no checkout, nothing to compute).
 */
export function computePlanPriceDisplay(
  plan: PlanPricing,
  period: BillingPeriod,
): PlanPriceDisplay {
  if (plan.monthlyUsd == null || plan.monthlyUsd === 0) {
    return { amountUsd: 0, caption: '', annualSavingsUsd: 0 }
  }
  if (period === 'MONTHLY') {
    return {
      amountUsd: plan.monthlyUsd,
      caption: '/mo',
      annualSavingsUsd: 0,
    }
  }
  // ANNUAL
  return {
    amountUsd: computeAnnualMonthlyEquivalent(plan.monthlyUsd),
    caption: '/mo billed annually',
    annualSavingsUsd: computeAnnualSavings(plan.monthlyUsd),
  }
}

/**
 * The Stripe price-id env-key the checkout flow should use for this plan
 * + period. Returns null when the plan isn't checkout-eligible (Free /
 * Enterprise) OR when annual is selected but the plan hasn't contracted
 * an annual Stripe price yet.
 */
export function getStripePriceEnvKey(
  plan: PlanPricing,
  period: BillingPeriod,
): string | null {
  const key =
    period === 'ANNUAL'
      ? plan.annualStripePriceEnvKey
      : plan.monthlyStripePriceEnvKey
  return key.length > 0 ? key : null
}

/**
 * Whether the toggle should let the user pick ANNUAL for a given plan.
 * False when the plan has no annual Stripe price-id configured (we'd
 * crash at checkout) — the toggle UI greys those plans out instead.
 */
export function isAnnualEligible(plan: PlanPricing): boolean {
  return plan.annualStripePriceEnvKey.length > 0
}
