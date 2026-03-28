/**
 * requireSubscription middleware tests
 *
 * Covers:
 *  - Feature flag off → middleware is no-op
 *  - Feature flag on + no userId → 401
 *  - Feature flag on + active subscription → calls next()
 *  - Feature flag on + no active subscription → 403
 */

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: { stripeSubscriptionRequired: false },
}))
jest.mock('../../services/stripeService', () => ({
  hasActiveSubscription: jest.fn(),
}))

import type { Request, Response, NextFunction } from 'express'
import { featureFlags } from '../../utils/featureFlags'
import { hasActiveSubscription } from '../../services/stripeService'
import { requireSubscription } from '../../middleware/subscription'
import type { AuthenticatedRequest } from '../../middleware/auth'

const mockHasActive = hasActiveSubscription as jest.Mock

function makeReq(userId?: string): Request {
  const req = {} as AuthenticatedRequest
  if (userId) req.userId = userId
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
    // Default: flag OFF
    ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = false
  })

  describe('feature flag OFF', () => {
    it('calls next() without checking subscription', async () => {
      const req = makeReq('user-1')
      const { res } = makeRes()
      const next = makeNext()

      await requireSubscription(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(mockHasActive).not.toHaveBeenCalled()
    })
  })

  describe('feature flag ON', () => {
    beforeEach(() => {
      ;(featureFlags as { stripeSubscriptionRequired: boolean }).stripeSubscriptionRequired = true
    })

    it('returns 401 when userId is not set', async () => {
      const req = makeReq() // no userId
      const { res, status, json } = makeRes()
      const next = makeNext()

      await requireSubscription(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when user has active subscription', async () => {
      mockHasActive.mockResolvedValue(true)
      const req = makeReq('user-1')
      const { res } = makeRes()
      const next = makeNext()

      await requireSubscription(req, res, next)

      expect(mockHasActive).toHaveBeenCalledWith('user-1')
      expect(next).toHaveBeenCalled()
    })

    it('returns 403 when user has no active subscription', async () => {
      mockHasActive.mockResolvedValue(false)
      const req = makeReq('user-2')
      const { res, status, json } = makeRes()
      const next = makeNext()

      await requireSubscription(req, res, next)

      expect(status).toHaveBeenCalledWith(403)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }),
        }),
      )
      expect(next).not.toHaveBeenCalled()
    })
  })
})
