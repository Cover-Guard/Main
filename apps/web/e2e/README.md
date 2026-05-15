# E2E test harness (PR-D1)

Playwright end-to-end coverage for the four critical user flows.

## Flows covered

| Spec | Flow |
|---|---|
| `register-and-onboard.spec.ts` | Sign up → land in onboarding → reach the dashboard |
| `search-and-save.spec.ts` | Search a property → open the report → save it |
| `request-quote.spec.ts` | Open a saved property → request a binding quote |
| `pay-for-pro.spec.ts` | Hit a Pro gate → start Stripe checkout |

## Running locally

```bash
# Against a local dev server
npm run dev                       # in one terminal (apps/web)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e

# Against a deployed preview / staging
E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e
```

First run also needs the browser binaries:

```bash
npx playwright install --with-deps chromium
```

## Why the specs skip when `E2E_BASE_URL` is unset

Every spec begins with `test.skip(!process.env.E2E_BASE_URL, ...)`. This is
deliberate: the harness ships *before* a fully-seeded staging environment is
wired, so the `e2e` workflow can run on every PR and stay green (all tests
skipped) without blocking merges.

## Making it merge-blocking (D1.b follow-up)

1. Stand up a seeded staging environment (or seed a preview deployment) with
   a known test user, a known property, and Stripe in test mode.
2. Set `E2E_BASE_URL` (plus any `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`) as
   repository **variables/secrets**.
3. Flip the specs from "skip when unset" to "fail when unset".
4. Add the `e2e` check to the branch protection required-status-checks list.
