import { test, expect } from '@playwright/test'

/**
 * Critical flow 1: register → onboarding → dashboard.
 *
 * A brand-new user signs up, lands in the onboarding flow, completes it, and
 * reaches the dashboard. This is the activation funnel's first mile — if it
 * breaks, no new user can ever reach value.
 */
test.describe('register and onboard', () => {
  test.skip(
    !process.env.E2E_BASE_URL,
    'E2E_BASE_URL not set — see e2e/README.md for how to wire a target environment',
  )

  test('a new user can sign up and reach the dashboard', async ({ page }) => {
    // Unique email per run so the test is idempotent against a shared env.
    const email = `e2e+${Date.now()}@coverguard-test.dev`
    const password = 'E2e-Test-Pass-2026!'

    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /create.*account|sign up/i })).toBeVisible()

    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('Tester')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/^password/i).fill(password)

    // Role + agreement checkboxes vary by build — fill them defensively.
    const roleSelect = page.getByLabel(/role/i)
    if (await roleSelect.count()) await roleSelect.selectOption({ index: 1 }).catch(() => {})
    for (const box of await page.getByRole('checkbox').all()) {
      await box.check().catch(() => {})
    }

    await page.getByRole('button', { name: /create account|sign up|get started/i }).click()

    // Either we land directly on the dashboard, or we pass through onboarding.
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 20_000 })

    if (page.url().includes('/onboarding')) {
      // Walk the onboarding steps: click whatever advances us until we exit.
      for (let step = 0; step < 6 && page.url().includes('/onboarding'); step++) {
        const next = page.getByRole('button', { name: /next|continue|finish|done|skip/i }).first()
        if (!(await next.count())) break
        await next.click()
        await page.waitForTimeout(500)
      }
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    }

    await expect(page).toHaveURL(/\/dashboard/)
    // The dashboard shell should render some recognizable chrome.
    await expect(page.getByText(/dashboard|portfolio|saved/i).first()).toBeVisible()
  })
})
