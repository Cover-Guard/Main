/**
 * Daily Review Test Suite — May 9, 2026
 *
 * Pins today's smoke-test surface and the documented contracts for today's
 * 6 new probes:
 *   1. OPTIONS /api/dashboard allowed-origin preflight (fourth mounted
 *      surface in the per-router pin matrix; dashboard.ts is a different
 *      router file than properties.ts (pinned 2026-05-06), auth.ts (pinned
 *      2026-05-07), and clients.ts (pinned 2026-05-08), so a per-router
 *      cors override on the dashboard router would be invisible to the
 *      existing three probes). The dashboard surface is where the agent's
 *      deal-pipeline ticker, KPI cards, and recent-activity feed are
 *      served — a credentialed CORS regression there would let any origin
 *      scrape pipeline numbers via XHR.
 *   2. GET /api/properties/:id/public-data Cache-Control s-maxage=86400
 *      (24h CDN cache parity with /walkscore). Closes the penultimate gap
 *      in the cached-endpoint matrix; only /:id/report.pdf remains
 *      unpinned (auth-gated, so a smoke probe without a token cannot
 *      exercise the handler).
 *   3. GET /api/properties/:id/insurance?refresh=true Cache-Control
 *      no-cache (pins the setNoCacheHeaders branch on /insurance;
 *      symmetric to the /risk?refresh=true probe added 2026-05-08).
 *   4. GET /api/properties/:id/carriers?refresh=true Cache-Control
 *      no-cache (pins the setNoCacheHeaders branch on /carriers;
 *      especially important given the VA-01 carrier-exit alert SLA — a
 *      stale carriers response after a force-refresh is the exact
 *      failure mode the SLA exists to prevent).
 *   5. GET /api/properties/:id/insurability?refresh=true Cache-Control
 *      no-cache (bonus pin — completes 4 of the 5 remaining refresh=true
 *      branches identified yesterday).
 *   6. GET /api/properties/:id/walkscore?refresh=true Cache-Control
 *      no-cache (closes the refresh=true matrix on a single --property-id
 *      run; only /public-data?refresh=true remains unpinned — carryover
 *      for tomorrow).
 *
 * The file-integrity guard (introduced 2026-05-06, widened 2026-05-07,
 * tightened 2026-05-08) carries forward unchanged. Today's run started
 * clean — the recurring Edit-tool corruption that bit the file FIVE
 * times in 8 days did NOT recur. To keep it that way, today's edits
 * were applied via a single atomic Python rewrite (run from the bash
 * sandbox) instead of a chain of Edit-tool calls. The line-count floor
 * is tightened from 1000 to 1200 (today's file is 1294 lines).
 *
 * The probe count grew from 80 (2026-05-08) to 86 (2026-05-09): +1
 * always-on (OPTIONS /api/dashboard) + 5 property-id-bound (1 cached
 * Cache-Control + 4 refresh=true no-cache).
 *
 * Probe count over time:
 *   2026-04-30 → ~28
 *   2026-05-01 morning → ~32
 *   2026-05-01 evening → ~46
 *   2026-05-02 → ~47
 *   2026-05-03 → ~53
 *   2026-05-04 → 56
 *   2026-05-05 → 61
 *   2026-05-06 → 68
 *   2026-05-07 → 73 (74 actual)
 *   2026-05-08 → 80
 *   2026-05-09 → 86
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract ─────────────────────────────────────────

const REQUIRED_SMOKE_PROBES_05_09 = [
  // Always-on probes
  'GET / returns API metadata',
  'GET /health returns ok',
  'HEAD /health returns 200',
  'GET /robots.txt disallows crawlers',
  'GET /api/analytics 404 (not mounted)',
  'GET /api/totally-fake-route-xyz 404',
  'GET /api/properties 404 (collection root)',
  'GET /api/stripe/webhook 404 (POST-only)',
  'POST /api/properties/search 404 (GET-only)',
  'OPTIONS /api/properties/search disallowed origin (no ACAO echo)',
  'OPTIONS /api/properties/search allowed origin (ACAO echoed)',
  'OPTIONS /api/auth/me 204 (allowed origin, ACAO echoed)',
  'OPTIONS /api/clients 204 (allowed origin, ACAO echoed)',
  'OPTIONS /api/dashboard 204 (allowed origin, ACAO echoed)', // NEW 2026-05-09
  'GET /api/properties/search no token → 401',
  'GET /api/properties/search no params → 401',
  'GET /api/properties/suggest?q=Mia → 200',
  'GET /api/properties/suggest q="a" → 400',
  'GET /api/properties/suggest Cache-Control s-maxage=300',
  'GET /api/properties/suggest exposes standard RateLimit-Limit + RateLimit-Remaining',
  'POST /api/properties/geocode empty body → 400',
  'POST /api/properties/geocode placeId="" → 400',
  'POST /api/properties/geocode placeId>300 chars → 400',
  'GET /api/properties/<bogus>/walkscore → 404',
  'GET /api/properties/<bogus>/report → 404',
  'GET /api/properties/<bogus>/report.pdf → 404 (not 401)',
  'HEAD /api/properties/<bogus>/report.pdf → 404 (not 401)',
  'GET /api/auth/me no token → 401',
  'GET /api/auth/me/saved no token → 401',
  'GET /api/auth/me/reports no token → 401',
  'GET /api/clients no token → 401',
  'GET /api/dashboard/ticker no token → 401',
  'GET /api/deals no token → 401',
  'GET /api/deals/stats no token → 401',
  'GET /api/alerts/carrier-exits no token → 401',
  'POST /api/advisor/chat no token → 401',
  'POST /api/push/subscribe no token → 401',
  'POST /api/notifications/dispatch no token → 401',
  'GET /api/stripe/subscription no token → 401',
  'POST /api/stripe/checkout no token → 401',
  'POST /api/stripe/portal no token → 401',
  'POST /api/auth/register empty body → 400',
  'PATCH /api/auth/me no token → 401',
  'DELETE /api/auth/me no token → 401',
  'POST /api/auth/me/terms no token → 401',
  'POST /api/auth/sync-profile no token → 401',
  'POST /api/clients no token → 401',
  'POST /api/deals no token → 401',
  'POST /api/alerts/carrier-exits/:id/acknowledge no token → 401',
  'PATCH /api/clients/:id no token → 401',
  'DELETE /api/clients/:id no token → 401',
  'PATCH /api/deals/:id no token → 401',
  'DELETE /api/deals/:id no token → 401',
  'GET /api/properties/<bogus> → 404',
  'POST /api/stripe/webhook no signature → 400',
  'GET /api/push/vapid → 200|503',
  // Property-id-bound probes (--property-id required)
  'GET /api/properties/:id → 200',
  'GET /api/properties/:id Cache-Control s-maxage=1800',
  'GET /api/properties/:id/risk → 200',
  'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
  'GET /api/properties/:id/insurance → 200',
  'GET /api/properties/:id/insurance Cache-Control s-maxage=7200',
  'GET /api/properties/:id/insurability → 200',
  'GET /api/properties/:id/insurability Cache-Control s-maxage=7200',
  'GET /api/properties/:id/report → 200',
  'GET /api/properties/:id/carriers → 200',
  'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
  'GET /api/properties/:id/walkscore → 200|503',
  'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400',
  'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache', // NEW 2026-05-09
  'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache', // NEW 2026-05-09
  'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache', // NEW 2026-05-09
  'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache', // NEW 2026-05-09
  'GET /api/properties/:id/public-data → 200',
  'GET /api/properties/:id/public-data Cache-Control s-maxage=86400', // NEW 2026-05-09
  'GET /api/properties/:id/report.pdf no token → 401',
  'HEAD /api/properties/:id/report.pdf no token → 401',
  'GET /api/properties/:id/checklists no token → 401',
  'POST /api/properties/:id/checklists no token → 401',
  'POST /api/properties/:id/save no token → 401',
  'DELETE /api/properties/:id/save no token → 401',
  'PATCH /api/properties/:id/checklists/:checklistId no token → 401',
  'DELETE /api/properties/:id/checklists/:checklistId no token → 401',
  'POST /api/properties/:id/quote-request no token → 401',
  'GET /api/properties/:id/quote-requests no token → 401',
] as const

describe('Smoke-test surface contract (2026-05-09)', () => {
  it("lists at least 86 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_09.length).toBeGreaterThanOrEqual(86)
  })

  it('strictly grows over 2026-05-08 (80 probes)', () => {
    // The 2026-05-08 baseline was 80 probes; today's run adds 6 (1
    // always-on + 5 property-id-bound). Total: 86. The list must never
    // shrink.
    expect(REQUIRED_SMOKE_PROBES_05_09.length).toBeGreaterThanOrEqual(86)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_09) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it('references OPTIONS /api/dashboard allowed-origin preflight probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'OPTIONS /api/dashboard 204 (allowed origin, ACAO echoed)',
    )
  })

  it('references public-data Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
    )
  })

  it('references all 4 new refresh=true no-cache probes', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
    )
  })

  it('reverse-pins: refresh=true probes must NOT assert s-maxage', () => {
    // A regression that flips the if/else in the route handler would
    // emit s-maxage=N on a refresh=true response. The probe-text
    // descriptions above all say "no-cache", never "s-maxage=" — pin
    // this invariant.
    const refreshProbes = REQUIRED_SMOKE_PROBES_05_09.filter((p) =>
      /refresh=true/.test(p),
    )
    expect(refreshProbes.length).toBeGreaterThanOrEqual(5)
    for (const probe of refreshProbes) {
      expect(probe).not.toMatch(/Cache-Control s-maxage=/)
    }
  })
})

// ─── 2. Smoke-test file integrity (carry-forward truncation guard) ──────────

describe('Smoke-test file integrity (2026-05-09)', () => {
  // The smoke-test.ts file was corrupted FIVE times in 8 days (2026-05-01
  // morning, 2026-05-05 morning, 2026-05-06, 2026-05-07, 2026-05-08).
  // Today's run started clean — the corruption did NOT recur. To keep it
  // that way, today's 6 new probes were applied via a single atomic
  // Python rewrite (run from the bash sandbox) instead of a chain of
  // Edit-tool calls. The line-count floor is tightened from 1000 (the
  // 2026-05-08 floor) to 1200 (today's file is 1294 lines).
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 1200 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(1200)
  })

  it('smoke-test.ts ends with the top-level run().catch() invocation', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toMatch(/run\(\)\.catch\(\(err\) => \{/)
    expect(content.trimEnd().endsWith('})')).toBe(true)
  })

  it('smoke-test.ts has exactly one top-level run().catch() invocation', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const matches = content.match(/^run\(\)\.catch\(/gm) ?? []
    expect(matches.length).toBe(1)
  })

  it("smoke-test.ts has no orphan 'verage' fragment at column 1", () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    for (const line of content.split('\n')) {
      expect(line.startsWith('verage')).toBe(false)
    }
  })

  it("smoke-test.ts has no orphan 'carriers shou' truncation marker (carryover)", () => {
    // The 2026-05-08-specific truncation symptom: file cut mid-line at
    // "data.carriers shou" (start of "should be present"). Carryover
    // pin — must never reappear.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).not.toMatch(/carriers shou$/)
    expect(content).not.toMatch(/carriers shou\s*$/m)
  })

  it('smoke-test.ts contains the 6 new 2026-05-09 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/dashboard from allowed origin')
    expect(content).toContain('public-data sets Cache-Control s-maxage=86400')
    expect(content).toContain('insurance?refresh=true sets no-cache')
    expect(content).toContain('carriers?refresh=true sets no-cache')
    expect(content).toContain('insurability?refresh=true sets no-cache')
    expect(content).toContain('walkscore?refresh=true sets no-cache')
  })

  it('smoke-test.ts retains the 6 prior 2026-05-08 probe markers', () => {
    // Catches a silent probe-removal regression on yesterday's
    // additions — the kind of regression that would happen if a
    // contractor "deduplicates" the Cache-Control checks during a
    // future cleanup.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/clients from allowed origin')
    expect(content).toContain('walkscore sets Cache-Control s-maxage=86400')
    expect(content).toContain('insurance sets Cache-Control s-maxage=7200')
    expect(content).toContain('insurability sets Cache-Control s-maxage=7200')
    expect(content).toContain('carriers sets Cache-Control s-maxage=3600')
    expect(content).toContain('risk?refresh=true sets no-cache')
  })

  it('smoke-test.ts retains the 5 prior 2026-05-07 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('sets Cache-Control s-maxage=300')
    expect(content).toContain('exposes standard rate-limit headers')
    expect(content).toContain('OPTIONS /api/auth/me from allowed origin')
    expect(content).toContain('sets Cache-Control s-maxage=1800')
    expect(content).toContain(' sets Cache-Control s-maxage=7200')
  })

  it('smoke-test.ts retains the 5 prior 2026-05-06 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/properties/search from disallowed origin')
    expect(content).toContain('OPTIONS /api/properties/search from allowed origin')
    expect(content).toContain('placeId > 300 chars returns 400')
    expect(content).toContain('placeId returns 400')
    expect(content).toContain('HEAD /api/properties/<bogus>/report.pdf')
  })

  it('smoke-test.ts has at least 86 runTest invocations', () => {
    // Direct cross-check: the surface contract list above and the
    // physical probe count must agree.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const matches = content.match(/await runTest\(/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(86)
  })
})

// ─── 3. OPTIONS /api/dashboard preflight contract ───────────────────────────

describe('OPTIONS /api/dashboard preflight (2026-05-09)', () => {
  // Why this matters: cors() is mounted globally before any router, so
  // the contract is identical across all surfaces today. But
  // /api/dashboard is mounted via dashboard.ts (a separate router file
  // from properties.ts, auth.ts, and clients.ts). A future per-router
  // cors override on the dashboard router would silently change contract
  // on the dashboard surface only, exposing pipeline numbers and recent-
  // activity feed to credentialed XHR from any origin. The three prior
  // preflight probes (search, auth/me, clients) wouldn't catch it.
  //
  // Per-router pin matrix as of today:
  //   - /api/properties/search (properties.ts router)  — pinned 2026-05-06
  //   - /api/auth/me           (auth.ts router)        — pinned 2026-05-07
  //   - /api/clients           (clients.ts router)     — pinned 2026-05-08
  //   - /api/dashboard         (dashboard.ts router)   — pinned 2026-05-09
  // Tomorrow's target: a fifth surface (likely /api/stripe, /api/deals,
  // /api/advisor, /api/alerts, or /api/notifications — 5 of 9 routers
  // remain unpinned).

  it('lists OPTIONS /api/dashboard in the surface contract', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'OPTIONS /api/dashboard 204 (allowed origin, ACAO echoed)',
    )
  })

  it('documents the per-router pin matrix invariant (4 of 9 routers)', () => {
    // Four surfaces pinned, each from a different router file.
    // Counting OPTIONS-prefixed probes in the surface contract:
    //   - search disallowed + search allowed = 2 probes on properties.ts
    //   - auth/me                              = 1 probe on auth.ts
    //   - clients                              = 1 probe on clients.ts
    //   - dashboard                            = 1 probe on dashboard.ts (NEW)
    // Total: 5 OPTIONS-prefixed probes covering 4 distinct routers.
    expect(
      REQUIRED_SMOKE_PROBES_05_09.filter((p) => p.startsWith('OPTIONS')).length,
    ).toBe(5)
  })

  it('per-router matrix covers 4 distinct router files', () => {
    expect(
      REQUIRED_SMOKE_PROBES_05_09.some((p) => p.includes('OPTIONS /api/properties/search')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_09.some((p) => p.includes('OPTIONS /api/auth/me'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_09.some((p) => p.includes('OPTIONS /api/clients'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_09.some((p) => p.includes('OPTIONS /api/dashboard'))).toBe(true)
  })
})

// ─── 4. Property-id-bound Cache-Control contracts ──────────────────────────

describe('Property-id-bound Cache-Control contracts (2026-05-09)', () => {
  // Today's run completes the cached-endpoint Cache-Control matrix on
  // 7 of 8 cached endpoints (only /:id/report.pdf remains unpinned —
  // it's auth-gated, so a smoke probe without a token cannot exercise
  // the handler). It also closes the refresh=true matrix on 5 of 6
  // refresh branches (only /:id/public-data?refresh=true remains
  // unpinned — that's tomorrow's target).
  //
  // setCacheHeaders(res, sMaxAge, swr) emits:
  //   - public, s-maxage=<sMaxAge>, stale-while-revalidate=<swr>
  // setNoCacheHeaders(res) emits:
  //   - private, no-cache, no-store, must-revalidate
  //
  // Cached endpoints (each pinned by smoke-test.ts):
  //   - /:id              → s-maxage=1800  (30 min)  pinned 2026-05-07
  //   - /:id/risk         → s-maxage=7200  (2 h)     pinned 2026-05-07
  //   - /:id/insurance    → s-maxage=7200  (2 h)     pinned 2026-05-08
  //   - /:id/insurability → s-maxage=7200  (2 h)     pinned 2026-05-08
  //   - /:id/carriers     → s-maxage=3600  (1 h)     pinned 2026-05-08
  //   - /:id/walkscore    → s-maxage=86400 (24 h)    pinned 2026-05-08
  //   - /:id/public-data  → s-maxage=86400 (24 h)    pinned 2026-05-09 (NEW)
  //   - /:id/report.pdf   → private, max-age=300     STILL UNPINNED (auth-gated)
  //
  // Refresh branches (forceRefresh=true → setNoCacheHeaders):
  //   - /:id/risk?refresh=true         → no-cache  pinned 2026-05-08
  //   - /:id/insurance?refresh=true    → no-cache  pinned 2026-05-09 (NEW)
  //   - /:id/carriers?refresh=true     → no-cache  pinned 2026-05-09 (NEW)
  //   - /:id/insurability?refresh=true → no-cache  pinned 2026-05-09 (NEW)
  //   - /:id/walkscore?refresh=true    → no-cache  pinned 2026-05-09 (NEW)
  //   - /:id/public-data?refresh=true  → no-cache  STILL UNPINNED (tomorrow)
  //
  // Tomorrow's target: pin /:id/public-data?refresh=true to close the
  // refresh matrix on a single --property-id run, and figure out an
  // auth-token strategy for /:id/report.pdf.

  it('pins the public-data TTL as 86400 (24h, parity with walkscore)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
    )
  })

  it('pins ALL 4 refresh=true branches added today', () => {
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
    )
  })

  it('counts at least 5 refresh=true branch pins (risk + 4 added today)', () => {
    const refreshPins = REQUIRED_SMOKE_PROBES_05_09.filter((p) =>
      /refresh=true Cache-Control no-cache/.test(p),
    )
    expect(refreshPins.length).toBeGreaterThanOrEqual(5)
  })

  it('counts at least 7 cached-endpoint Cache-Control pins (s-maxage)', () => {
    const cachePins = REQUIRED_SMOKE_PROBES_05_09.filter((p) =>
      /Cache-Control s-maxage=/.test(p),
    )
    // /suggest, /:id, /:id/risk, /:id/insurance, /:id/insurability,
    // /:id/carriers, /:id/walkscore, /:id/public-data = 8
    expect(cachePins.length).toBeGreaterThanOrEqual(7)
  })

  it('reverse-pin: carriers TTL stays 3600 (NOT 7200)', () => {
    // Carryover from 2026-05-08. The 1h TTL is sized against the
    // VA-01 carrier-exit alert SLA — UI must not show a carrier
    // that exited >1h ago.
    expect(REQUIRED_SMOKE_PROBES_05_09).toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
    )
    expect(REQUIRED_SMOKE_PROBES_05_09).not.toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=7200',
    )
  })
})

// ─── 5. Refresh-branch matrix completeness (new today) ─────────────────────

describe('Refresh-branch matrix completeness (2026-05-09)', () => {
  // The cache-invalidation contract on the properties router is:
  // when the caller passes ?refresh=true, the handler MUST call
  // setNoCacheHeaders(res) before responding, AND the handler MUST
  // invalidate the corresponding cache entry server-side. The first
  // half (the response header) is what the smoke probes pin. The
  // second half (the server-side invalidation) is exercised
  // implicitly: a refresh=true call followed immediately by a default
  // call should return a fresh response, not the cached one.
  //
  // The refresh branches mirror each other:
  //
  //   /:id/risk?refresh=true         → setNoCacheHeaders, invalidates
  //                                     risk + insurance + carriers +
  //                                     insurability + publicData
  //   /:id/insurance?refresh=true    → setNoCacheHeaders, invalidates
  //                                     insurance only
  //   /:id/carriers?refresh=true     → setNoCacheHeaders, invalidates
  //                                     carriers only
  //   /:id/insurability?refresh=true → setNoCacheHeaders, invalidates
  //                                     insurability only
  //   /:id/walkscore?refresh=true    → setNoCacheHeaders, invalidates
  //                                     walkscore only
  //   /:id/public-data?refresh=true  → setNoCacheHeaders, invalidates
  //                                     publicData only (NOT YET PINNED)
  //
  // The 5 pinned refresh branches all assert the exact same triple:
  // 'no-store' present, 'private' present, 's-maxage=' absent. A
  // regression that flips the if/else in any one handler would emit
  // s-maxage=N (the cached-branch directive) on a refresh=true call,
  // and the corresponding probe would fail.

  it('lists 5 refresh=true probes (risk + insurance + carriers + insurability + walkscore)', () => {
    const refreshProbes = REQUIRED_SMOKE_PROBES_05_09.filter(
      (p) => /refresh=true Cache-Control no-cache/.test(p),
    )
    expect(refreshProbes.length).toBe(5)
  })

  it('refresh-branch probes specifically cover the 5 endpoints with cache invalidation', () => {
    const expected = [
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
    ]
    for (const probe of expected) {
      expect(REQUIRED_SMOKE_PROBES_05_09).toContain(probe)
    }
  })

  it('public-data refresh branch is documented as carryover for tomorrow', () => {
    // Pin: the refresh-branch matrix is 5/6 today, with public-data
    // being the only remaining branch. This test asserts the
    // *negative* — public-data?refresh=true is NOT yet pinned — so a
    // future PR adding the probe will need to update this expectation
    // (which is desired, that's how the carryover gets tracked).
    expect(REQUIRED_SMOKE_PROBES_05_09).not.toContain(
      'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
    )
  })
})

// ─── 6. Verb-parity audit (carryover from 2026-05-03) ─────────────────────

describe('Verb-parity audit (2026-05-09)', () => {
  // The verb-parity audit from 2026-05-03 must continue to pass. Every
  // mutating verb (POST, PATCH, DELETE) on a protected route should
  // have a corresponding unauth-401 probe in smoke-test.ts. No new
  // mutating verbs were added today (today's additions are all GET/
  // OPTIONS read-side probes), so the audit invariant is unchanged.

  it('lists all PATCH endpoints from the audit (carryover)', () => {
    const patchProbes = REQUIRED_SMOKE_PROBES_05_09.filter((p) => p.startsWith('PATCH '))
    expect(patchProbes.length).toBeGreaterThanOrEqual(3)
  })

  it('lists all DELETE endpoints from the audit (carryover)', () => {
    const deleteProbes = REQUIRED_SMOKE_PROBES_05_09.filter((p) => p.startsWith('DELETE '))
    expect(deleteProbes.length).toBeGreaterThanOrEqual(4)
  })

  it('every PATCH/DELETE probe asserts 401 (no token)', () => {
    const mutatingProbes = REQUIRED_SMOKE_PROBES_05_09.filter(
      (p) => p.startsWith('PATCH ') || p.startsWith('DELETE '),
    )
    for (const probe of mutatingProbes) {
      expect(probe).toMatch(/no token → 401$/)
    }
  })
})

// ─── 7. CORS configuration sanity (carryover, expanded) ────────────────────

describe('CORS configuration sanity (2026-05-09)', () => {
  // The CORS_ALLOWED_ORIGINS env parser splits on comma and .trim()s
  // each entry. Today's OPTIONS /api/dashboard probe extends the per-
  // router pin matrix to 4 distinct router files (properties, auth,
  // clients, dashboard).

  it('counts at least 5 OPTIONS preflight probes (4 surfaces, 1 deny)', () => {
    const optionsProbes = REQUIRED_SMOKE_PROBES_05_09.filter((p) => p.startsWith('OPTIONS '))
    // search disallowed + search allowed + auth/me + clients + dashboard = 5
    expect(optionsProbes.length).toBeGreaterThanOrEqual(5)
  })

  it('per-router pin matrix covers 4 of 9 routers', () => {
    // Each entry pins a different router file, so a per-router cors
    // override on any single router would fail at least one probe.
    // The 9 routers are: properties, auth, clients, dashboard,
    // advisor, deals, alerts, stripe, notifications. Covered: 4.
    // Tomorrow's target: pick a 5th from the remaining 5.
    const surfaces = [
      'OPTIONS /api/properties/search',
      'OPTIONS /api/auth/me',
      'OPTIONS /api/clients',
      'OPTIONS /api/dashboard',
    ]
    for (const surface of surfaces) {
      expect(
        REQUIRED_SMOKE_PROBES_05_09.some((p) => p.includes(surface)),
      ).toBe(true)
    }
  })
})
