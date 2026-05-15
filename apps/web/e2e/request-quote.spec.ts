import { test, expect } from '@playwright/test'

/**
 * Critical flow 3: open a saved property → request a binding quote.
 *
 * The monetization-adjacent flow: from a saved property, an agent requests a
 * binding quote from a carrier. Assumes a signed-in session with at least one
 * saved property (seed data — see e2e/README.md).
 */
test.describe('request quote', () => {
  test.skip(
    !process.env.E2E_BASE_URL,
    'E2E_BASE_URL not set — see e2e/README.md for how to wire a target environment',
  )

  test('a user can request a binding quote from a saved property', async ({ page }) => {
    await page.goto('/dashboard')

    // Jump into the first saved property.
    const savedProperty = page
      .getByRole('link', { name: /view|open|details/i })
      .or(page.locator('[data-testid="saved-property-card"] a'))
      .first()
    await expect(savedProperty).toBeVisible({ timeout: 15_000 })
    await savedProperty.click()

    await page.waitForURL(/\/(properties|property)\//, { timeout: 15_000 })

    // Open the quote-request affordance.
    await page.getByRole('button', { name: /request.*quote|get a quote|quote/i }).first().click()

    // A quote-request form / modal should appear.
    const quoteForm = page.getByRole('dialog').or(page.locator('form'))
    await expect(quoteForm.first()).toBeVisible({ timeout: 10_000 })

    // Pick a carrier + coverage if the form exposes them, then submit.
    const carrierSelect = page.getByLabel(/carrier/i)
    if (await carrierSelect.count()) await carrierSelect.selectOption({ index: 1 }).catch(() => {})
    for (const box of await page.getByRole('checkbox').all()) {
      await box.check().catch(() => {})
    }

    await page.getByRole('button', { name: /submit|request|send/i }).first().click()

    // Confirmation that the request was logged.
    await expect(
      page.getByText(/quote requested|request (sent|submitted|received)/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
