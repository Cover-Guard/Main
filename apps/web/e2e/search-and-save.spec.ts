import { test, expect } from '@playwright/test'

/**
 * Critical flow 2: search a property → open the report → save it.
 *
 * The core "look up an address, get a risk report, keep it" loop. Assumes a
 * signed-in session (see the storageState note in e2e/README.md for the
 * D1.b wiring) or a public search surface.
 */
test.describe('search and save', () => {
  test.skip(
    !process.env.E2E_BASE_URL,
    'E2E_BASE_URL not set — see e2e/README.md for how to wire a target environment',
  )

  test('a user can search an address and save the property', async ({ page }) => {
    await page.goto('/search')

    const searchBox = page.getByPlaceholder(/address|search/i).first()
    await expect(searchBox).toBeVisible()
    await searchBox.fill('1600 Pennsylvania Ave')

    // Autocomplete suggestion, or a direct Search button — handle both.
    const suggestion = page.getByRole('option').first()
    if (await suggestion.count()) {
      await suggestion.click()
    } else {
      await page.getByRole('button', { name: /search/i }).first().click()
    }

    // We should reach a property report view.
    await page.waitForURL(/\/(properties|property|report)\//, { timeout: 20_000 })
    await expect(page.getByText(/risk|flood|fire|insurance/i).first()).toBeVisible()

    // Save it.
    const saveButton = page.getByRole('button', { name: /^save|save property|add to saved/i }).first()
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    // Confirmation: a toast, a "Saved" state, or an unsave affordance appears.
    await expect(
      page.getByText(/saved|added to your saved/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
