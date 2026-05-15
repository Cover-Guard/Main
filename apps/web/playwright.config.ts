import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config (PR-D1).
 *
 * Covers the four critical flows in `e2e/`:
 *   - register-and-onboard
 *   - search-and-save
 *   - request-quote
 *   - pay-for-pro
 *
 * The harness is environment-driven. It targets whatever `E2E_BASE_URL`
 * points at — a Vercel preview deployment, staging, or a locally-running
 * `npm run dev`. When `E2E_BASE_URL` is unset every spec calls `test.skip()`
 * (see `e2e/README.md`), so the `e2e` workflow stays green until a seeded
 * environment is wired. Making the suite a required, merge-blocking check
 * is the D1.b follow-up.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  // One retry in CI absorbs the occasional cold-start flake on preview URLs.
  retries: process.env.CI ? 1 : 0,
  // Serial locally for easier debugging; parallel in CI for speed.
  workers: process.env.CI ? 2 : 1,
  // Fail the build if someone leaves `test.only` in a committed spec.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
