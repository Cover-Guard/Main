'use client'

import { ShieldCheck, CreditCard, Lock, RefreshCcw } from 'lucide-react'

/**
 * Trust pills displayed under the pricing-tier table on the public
 * pricing page (P0 #5).
 *
 * Spec: docs/enhancements/p0/05-public-pricing-self-serve-checkout.md.
 *
 * The spec's framing is "removes the largest friction at the top of the
 * funnel". Every signal here addresses one specific objection a buyer
 * has at this exact moment of the funnel:
 *
 *   - "Do I have to talk to sales?"   → No sales call required
 *   - "Am I locked into a contract?"  → Cancel anytime
 *   - "Is my card data safe?"          → PCI-compliant via Stripe
 *   - "What if I change my mind?"      → 30-day refund
 *
 * Hard-coded copy in the component on purpose — these strings are the
 * same in every locale (until we localize) and the component should not
 * need a CMS plumbing change to render its own labels.
 */
export function TrustSignals() {
  return (
    <ul
      aria-label="Pricing trust signals"
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-gray-600"
    >
      {SIGNALS.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}

const SIGNALS = [
  { icon: ShieldCheck, label: 'No sales call required' },
  { icon: RefreshCcw,  label: 'Cancel anytime' },
  { icon: Lock,        label: 'PCI-compliant checkout via Stripe' },
  { icon: CreditCard,  label: '30-day money-back guarantee' },
] as const
