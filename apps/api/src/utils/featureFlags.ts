/**
 * Feature flags — read from environment variables at runtime.
 * All flags default to OFF (false) unless explicitly set to "true".
 */

export const featureFlags = {
  /** When true, users must have an active Stripe subscription to use authenticated routes. */
  get stripeSubscriptionRequired(): boolean {
    return process.env.STRIPE_SUBSCRIPTION_REQUIRED === 'true'
  },
} as const
