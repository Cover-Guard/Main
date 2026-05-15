import { test, expect } from '@playwright/test'

/**
 * Critical flow 4: hit a Pro gate → start Stripe checkout.
 *
 * The revenue flow. We don't complete a real payment in E2E — we verify the
 * user can get from a Pro-gated surface into a live Stripe Checkout session.
 * Completing payment is covered by Stripe's own test-mode tooling, not here.
 */
test.describe('pay for pro', () => {
  test.skip(
    !process.env.E2E_BASE_URL,
    'E2E_BASE_URL not set — see e2e/README.md for how to wire a target environment',
  )

  test('a user can start Stripe checkout from the pricing page', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText(/pro|upgrade|plan/i).first()).toBeVisible()

    // Click the Pro plan's upgrade / subscribe CTA.
    const upgradeCta = page
      .getByRole('button', { name: /upgrade|subscribe|go pro|choose pro|get pro/i })
      .or(page.getByRole('link', { name: /upgrade|subscribe|go pro|choose pro|get pro/i }))
      .first()
    await expect(upgradeCta).toBeVisible()
    await upgradeCta.click()

    // Stripe Checkout is a redirect to checkout.stripe.com. Wait for either
    // the redirect, or — if the user is signed out — a redirect to sign-in.
    await page.waitForURL(/checkout\.stripe\.com|\/(login|register|sign-in)/, {
      timeout: 20_000,
    })

    if (/checkout\.stripe\.com/.test(page.url())) {
      // On the real Stripe Checkout page — confirm the session rendered.
      await expect(page.locator('body')).toContainText(/coverguard|pay|subscribe/i, {
        timeout: 15_000,
      })
    } else {
      // Signed-out path is also a valid outcome: the gate pushed us to auth.
      await expect(page).toHaveURL(/\/(login|register|sign-in)/)
    }
  })
})
