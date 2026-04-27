/**
 * Pricing — billing-period + tier types shared between API and web.
 *
 * Spec: docs/enhancements/p0/05-public-pricing-self-serve-checkout.md
 * (PR #311 P0 #5).
 *
 * The existing `/pricing` page hard-codes monthly prices as display
 * strings. The spec calls for an annual-pre-pay discount (20% off) which
 * means the page needs to compute the annual price + per-month equivalent
 * + savings consistently across every plan card. This file defines the
 * shape; `pricingMath.ts` provides the math; the new `BillingPeriodToggle`
 * component drives the user-visible toggle.
 *
 * Kept independent of the existing `SubscriptionPlan` Prisma enum so the
 * page can adopt it incrementally without churning the DB schema.
 */

/** Whether the user is paying month-by-month or pre-paying for a year. */
export type BillingPeriod = 'MONTHLY' | 'ANNUAL'

/**
 * Pricing tier the spec calls for, independent of the per-segment plan
 * names ("Home Buyer Pro", "Agent Starter", etc.). Maps cleanly onto the
 * three buckets in the spec — Self-Serve / Team / Enterprise — so the
 * page can group plans by audience but still honor the same tier-level
 * messaging (no sales call for Self-Serve + Team, custom quote for
 * Enterprise).
 */
export type PricingTier = 'SELF_SERVE' | 'TEAM' | 'ENTERPRISE'

/**
 * Per-plan pricing we surface in the UI. `monthlyUsd` is the source of
 * truth; the annual price is *derived* from it via `computeAnnualPrice()`
 * so a single typo can't make the discount wrong on one plan.
 *
 * `enterprise` plans omit `monthlyUsd` because they're custom-quoted —
 * the page renders "Contact sales" instead of a price.
 */
export interface PlanPricing {
  /** Stable identifier used by analytics + the Stripe price-env mapping. */
  id: string
  /** Display name ("Home Buyer Pro"). */
  name: string
  /** Which tier this plan rolls up to. */
  tier: PricingTier
  /**
   * Monthly list price in whole USD. Source of truth — annual is computed.
   * `null` for ENTERPRISE tier (custom-quoted).
   */
  monthlyUsd: number | null
  /**
   * Stripe price-id env-key for monthly. Read at the page boundary.
   * Empty when this plan isn't checkout-eligible (Free / Enterprise).
   */
  monthlyStripePriceEnvKey: string
  /**
   * Stripe price-id env-key for annual. Empty when this plan isn't
   * checkout-eligible OR when annual isn't yet contracted with Stripe.
   * The toggle disables ANNUAL for plans where this is empty.
   */
  annualStripePriceEnvKey: string
}

/**
 * What `computePlanPriceForPeriod()` returns. Centralizes the small bundle
 * of values every plan card renders so the JSX doesn't have to do its own
 * math (and risk getting it wrong).
 */
export interface PlanPriceDisplay {
  /** Whole-USD value to render (monthly equivalent in both periods). */
  amountUsd: number
  /** "/mo" or "/mo billed annually" — drives the small caption under price. */
  caption: string
  /**
   * Annual savings in whole USD. Zero when period === 'MONTHLY' or the
   * plan doesn't support annual.
   */
  annualSavingsUsd: number
}
