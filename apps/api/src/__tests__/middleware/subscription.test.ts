/**
 * requireSubscription middleware tests
 *
 * The middleware is now synchronous — it reads `req.hasActiveSubscription`
 * (populated by requireAuth) instead of making its own DB query.
 *
 * Covers:
 *  - Feature flag off → middleware is no-op
 *  - Feature flag on + no userId → 401
 *  - Feature flag on + hasActiveSubscription=true → calls next()
 *  - Feature flag on + hasActiveSubscription=false → 403
 */

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: { stripeSubscriptionRequired: false },
}))

import type { Request, Response } from 'express'
import { featureFlags } from '../../utils/featureFlags'
import { requireSubscription } from '../../middleware/subscription'
import type { AuthenticatedRequest } from '../../middleware/auth'

function makeReq(userId?: string, hasActiveSub?: boolean): Request {
  const req = {} as AuthenticatedRequest
  if (userId) req.userId = userId
  if (hasActiveSub !== undefined) req.hasActiveSubscription = hasActiveSub
  return req as Request
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  return { res: { status } as unknown as Response, status, json }
}

function makeNext(): jest.Mock {
  return jest.fn()
}

describe('requireSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = false
  })

  describe('feature flag OFF', () => {
    it('calls next() without checking subscription', () => {
      const req = makeReq('user-1', false)
      const { res } = makeRes()
      const next = makeNext()

      requireSubscription(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('feature flag ON', () => {
    beforeEach(() => {
      ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = true
    })

    it('returns 401 when userId is not set', () => {
      const req = makeReq() // no userId
      const { res, status, json } = makeRes()
      const next = makeNext()

      requireSubscription(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when hasActiveSubscription is true', () => {
      const req = makeReq('user-1', true)
      const { res } = makeRes()
      const next = makeNext()

      requireSubscription(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('returns 403 when hasActiveSubscription is false', () => {
      const req = makeReq('user-2', false)
      const { res, status, json } = makeRes()
      const next = makeNext()

      requireSubscription(req, res, next)

      expect(status).toHaveBeenCalledWith(403)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 403 when hasActiveSubscription is undefined (not set by auth)', () => {
      const req = makeReq('user-3') // userId set but no hasActiveSubscription
      const { res, status, json } = makeRes()
      const next = makeNext()

      requireSubscription(req, res, next)

      expect(status).toHaveBeenCalledWith(403)
      expect(next).not.toHaveBeenCalled()
    })
  })
})
