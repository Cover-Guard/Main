'use client'

import type { BillingPeriod } from '@coverguard/shared'
import { ANNUAL_DISCOUNT_RATE } from '@coverguard/shared'

/**
 * Monthly / Annual segmented toggle for the public pricing page (P0 #5).
 *
 * Spec: docs/enhancements/p0/05-public-pricing-self-serve-checkout.md.
 *
 * The toggle is purely presentational — it owns no state. The pricing
 * page hoists `BillingPeriod` into URL state (so the choice survives a
 * refresh) and passes both the current value and the setter in.
 *
 * The "Save 20%" badge on the Annual button comes from the same
 * `ANNUAL_DISCOUNT_RATE` constant the math layer uses, so the badge can
 * never drift from the actual discount.
 */
export function BillingPeriodToggle({
  value,
  onChange,
}: {
  value: BillingPeriod
  onChange: (next: BillingPeriod) => void
}) {
  const discountPct = Math.round(ANNUAL_DISCOUNT_RATE * 100)
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-sm"
    >
      <button
        type="button"
        aria-pressed={value === 'MONTHLY'}
        onClick={() => onChange('MONTHLY')}
        className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
          value === 'MONTHLY'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        aria-pressed={value === 'ANNUAL'}
        onClick={() => onChange('ANNUAL')}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition-colors ${
          value === 'ANNUAL'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Annual
        <span
          className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
          aria-label={`Save ${discountPct} percent with annual billing`}
        >
          Save {discountPct}%
        </span>
      </button>
    </div>
  )
}
