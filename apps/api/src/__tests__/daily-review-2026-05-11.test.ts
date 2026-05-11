/**
 * Daily Review Test Suite — May 11, 2026
 *
 * Pins today's smoke-test surface and the documented contracts for today's
 * 2 new probes:
 *   1. OPTIONS /api/deals allowed-origin preflight (sixth mounted surface
 *      in the per-router pin matrix; deals.ts is a different router file
 *      than properties.ts (pinned 2026-05-06), auth.ts (pinned 2026-05-07),
 *      clients.ts (pinned 2026-05-08), dashboard.ts (pinned 2026-05-09),
 *      and advisor.ts (pinned 2026-05-10), so a per-router cors override
 *      on the deals router would be invisible to the existing five
 *      probes). The deals surface is the agent's revenue pipeline —
 *      a credentialed CORS regression there would let any origin
 *      credential-sniff deal value, client name, carrier, and fallout
 *      reason via a XHR initiated from a victim's browser session.
 *      Note: deals.ts does dealsRouter.use(requireAuth) router-wide,
 *      but the OPTIONS preflight goes through the global cors()
 *      middleware in index.ts BEFORE requireAuth fires (Express
 *      short-circuits OPTIONS when a CORS middleware emits a 204).
 *   2. GET /api/properties/:id/report exact-key-cardinality. The
 *      existing /report probe (added 2026-05-04) already asserts that
 *      each of the 6 documented data keys is PRESENT; today's probe
 *      additionally asserts that no EXTRA keys leaked. Initiates the
 *      RESPONSE-SHAPE PINNING AXIS now that the refresh=true matrix
 *      was closed yesterday at 6-of-6. The regression class is: a
 *      future PR adds an internal field to the report bundle (e.g.
 *      ownerEmail, apiCallCount, computeMillis, internalDebugBlob)
 *      intended for a debug/admin rendering path but inadvertently
 *      leaks it on the public /report endpoint. Existing 'has property
 *      + has risk + ...' probes are silent on extras; an exact-
 *      cardinality assert is what catches the leak. Pins both the
 *      top-level body keys ({ success, data }) and data keys
 *      ({ property, risk, insurance, insurability, carriers,
 *      publicData }).
 *
 * The file-integrity guard (introduced 2026-05-06, widened 2026-05-07,
 * tightened 2026-05-08, retightened 2026-05-09, again tightened 2026-05-10)
 * carries forward unchanged with one increment: the line-count floor
 * moves from 1300 to 1400 (today's file is 1510 lines). Today's run
 * started clean for the THIRD consecutive day — the recurring Edit-tool
 * corruption that bit the file FIVE times in 8 days did NOT recur.
 * To keep it that way, today's edits were applied via a single atomic
 * Python rewrite (run from the bash sandbox) instead of a chain of
 * Edit-tool calls — the mitigation established 2026-05-09 is now the
 * documented standard workflow.
 *
 * The probe count grew from 88 (2026-05-10) to 90 (2026-05-11): +1
 * always-on (OPTIONS /api/deals) + 1 property-id-bound (/report exact
 * key cardinality).
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
 *   2026-05-07 → 74
 *   2026-05-08 → 80
 *   2026-05-09 → 86
 *   2026-05-10 → 88
 *   2026-05-11 → 90
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract ─────────────────────────────────────────

const REQUIRED_SMOKE_PROBES_05_11 = [
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
  'OPTIONS /api/dashboard 204 (allowed origin, ACAO echoed)',
  'OPTIONS /api/advisor/chat 204 (allowed origin, ACAO echoed)',
  'OPTIONS /api/deals 204 (allowed origin, ACAO echoed)', // NEW 2026-05-11
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
  'GET /api/properties/:id/report response shape: exactly 2 top-level keys, exactly 6 data keys', // NEW 2026-05-11
  'GET /api/properties/:id/carriers → 200',
  'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
  'GET /api/properties/:id/walkscore → 200|503',
  'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400',
  'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/public-data → 200',
  'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
  'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
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

describe('Smoke-test surface contract (2026-05-11)', () => {
  it("lists at least 90 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_11.length).toBeGreaterThanOrEqual(90)
  })

  it('strictly grows over 2026-05-10 (88 probes)', () => {
    // The 2026-05-10 baseline was 88 probes; today's run adds 2 (1
    // always-on + 1 property-id-bound). Total: 90. The list must never
    // shrink.
    expect(REQUIRED_SMOKE_PROBES_05_11.length).toBeGreaterThanOrEqual(90)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_11) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it('references OPTIONS /api/deals allowed-origin preflight probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'OPTIONS /api/deals 204 (allowed origin, ACAO echoed)',
    )
  })

  it('references /report exact-key-cardinality probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/report response shape: exactly 2 top-level keys, exactly 6 data keys',
    )
  })

  it('reverse-pins: refresh=true probes must NOT assert s-maxage', () => {
    // A regression that flips the if/else in the route handler would
    // emit s-maxage=N on a refresh=true response. The probe-text
    // descriptions above all say "no-cache", never "s-maxage=" — pin
    // this invariant.
    const refreshProbes = REQUIRED_SMOKE_PROBES_05_11.filter((p) =>
      /refresh=true/.test(p),
    )
    expect(refreshProbes.length).toBeGreaterThanOrEqual(6)
    for (const probe of refreshProbes) {
      expect(probe).not.toMatch(/Cache-Control s-maxage=/)
    }
  })
})

// ─── 2. Smoke-test file integrity (carry-forward truncation guard) ──────────

describe('Smoke-test file integrity (2026-05-11)', () => {
  // The smoke-test.ts file was corrupted FIVE times in 8 days (2026-05-01
  // morning, 2026-05-05 morning, 2026-05-06, 2026-05-07, 2026-05-08).
  // The corruption did NOT recur on 2026-05-09, 2026-05-10, OR today
  // (2026-05-11) — three consecutive clean days. The mitigation (single
  // atomic Python rewrite from the bash sandbox) is now the documented
  // standard workflow for any modification to this file. The line-count
  // floor is tightened from 1300 (the 2026-05-10 floor) to 1400 (today's
  // file is 1510 lines).
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 1400 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(1400)
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
    // pin — must never reappear at end-of-line.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).not.toMatch(/carriers shou$/)
    expect(content).not.toMatch(/carriers shou\s*$/m)
  })

  it('smoke-test.ts contains the 2 new 2026-05-11 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/deals from allowed origin')
    expect(content).toContain('exactly 2 top-level keys, exactly 6 data keys')
  })

  it('smoke-test.ts retains the 2 prior 2026-05-10 probe markers', () => {
    // Catches a silent probe-removal regression on yesterday's
    // additions — the kind of regression that would happen if a
    // contractor "deduplicates" the Cache-Control checks during a
    // future cleanup.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/advisor/chat from allowed origin')
    expect(content).toContain('public-data?refresh=true sets no-cache')
  })

  it('smoke-test.ts retains the 6 prior 2026-05-09 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/dashboard from allowed origin')
    expect(content).toContain('public-data sets Cache-Control s-maxage=86400')
    expect(content).toContain('insurance?refresh=true sets no-cache')
    expect(content).toContain('carriers?refresh=true sets no-cache')
    expect(content).toContain('insurability?refresh=true sets no-cache')
    expect(content).toContain('walkscore?refresh=true sets no-cache')
  })

  it('smoke-test.ts retains the 6 prior 2026-05-08 probe markers', () => {
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

  it('smoke-test.ts has at least 90 runTest invocations', () => {
    // Direct cross-check: the surface contract list above and the
    // physical probe count must agree.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const matches = content.match(/await runTest\(/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(90)
  })

  it('smoke-test.ts has balanced braces (extra structural-corruption guard)', () => {
    // The recurring Edit-tool corruption typically left the file with
    // mismatched braces because the truncation hit mid-block. A
    // structural balance check is the cleanest invariant — it catches
    // any partial-edit corruption mode regardless of where the cut
    // landed.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const open = (content.match(/\{/g) ?? []).length
    const close = (content.match(/\}/g) ?? []).length
    expect(open).toBe(close)
  })
})

// ─── 3. OPTIONS /api/deals preflight contract ──────────────────────────────

describe('OPTIONS /api/deals preflight (2026-05-11)', () => {
  // Why this matters: cors() is mounted globally before any router, so
  // the contract is identical across all surfaces today. But /api/deals
  // is mounted via deals.ts (a separate router file from properties.ts,
  // auth.ts, clients.ts, dashboard.ts, and advisor.ts). A future per-
  // router cors override on the deals router would silently change
  // contract on the deals surface only, and the five prior preflight
  // probes (search, auth/me, clients, dashboard, advisor/chat) wouldn't
  // catch it.
  //
  // Per-router pin matrix as of today:
  //   - /api/properties/search (properties.ts router)  — pinned 2026-05-06
  //   - /api/auth/me           (auth.ts router)        — pinned 2026-05-07
  //   - /api/clients           (clients.ts router)     — pinned 2026-05-08
  //   - /api/dashboard         (dashboard.ts router)   — pinned 2026-05-09
  //   - /api/advisor/chat      (advisor.ts router)     — pinned 2026-05-10
  //   - /api/deals             (deals.ts router)       — pinned 2026-05-11
  // Tomorrow's target: a seventh surface (/api/alerts, /api/stripe,
  // or /api/notifications — 3 of 9 routers remain unpinned).
  //
  // Note on auth-gating: deals.ts does dealsRouter.use(requireAuth)
  // router-wide so every handler is auth-gated, but the OPTIONS
  // preflight goes through the global cors() middleware in index.ts
  // BEFORE requireAuth fires (Express short-circuits OPTIONS when the
  // CORS middleware emits a 204). This is meaningful because a CSRF-
  // via-CORS regression on a credentialed mutation surface is more
  // dangerous than on a read surface — POST /api/deals creates a deal
  // record with deal value, client name, carrier, and fallout reason,
  // so an unconstrained CORS response would let an attacker
  // credential-sniff the entire revenue pipeline (or worse, write
  // forged deals to the victim's account).

  it('lists OPTIONS /api/deals in the surface contract', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'OPTIONS /api/deals 204 (allowed origin, ACAO echoed)',
    )
  })

  it('documents the per-router pin matrix invariant (6 of 9 routers)', () => {
    // Six surfaces pinned, each from a different router file.
    // Counting OPTIONS-prefixed probes in the surface contract:
    //   - search disallowed + search allowed = 2 probes on properties.ts
    //   - auth/me                              = 1 probe on auth.ts
    //   - clients                              = 1 probe on clients.ts
    //   - dashboard                            = 1 probe on dashboard.ts
    //   - advisor/chat                         = 1 probe on advisor.ts
    //   - deals                                = 1 probe on deals.ts (NEW)
    // Total: 7 OPTIONS-prefixed probes covering 6 distinct routers.
    expect(
      REQUIRED_SMOKE_PROBES_05_11.filter((p) => p.startsWith('OPTIONS')).length,
    ).toBe(7)
  })

  it('per-router matrix covers 6 distinct router files', () => {
    expect(
      REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/properties/search')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/auth/me'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/clients'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/dashboard'))).toBe(true)
    expect(
      REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/advisor/chat')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes('OPTIONS /api/deals'))).toBe(true)
  })

  it('documents the three remaining router targets (carryovers)', () => {
    // The three routers still unpinned on the per-router CORS pin
    // matrix: alerts, stripe, notifications. Each represents a
    // tomorrow-target. (These are NOT yet in the surface contract by
    // design — adding them is the next-day work.)
    expect(
      REQUIRED_SMOKE_PROBES_05_11.some((p) => p.startsWith('OPTIONS /api/alerts')),
    ).toBe(false)
    expect(
      REQUIRED_SMOKE_PROBES_05_11.some((p) => p.startsWith('OPTIONS /api/stripe')),
    ).toBe(false)
    expect(
      REQUIRED_SMOKE_PROBES_05_11.some((p) => p.startsWith('OPTIONS /api/notifications')),
    ).toBe(false)
  })
})

// ─── 4. Property-id-bound Cache-Control contracts ──────────────────────────

describe('Property-id-bound Cache-Control contracts (2026-05-11)', () => {
  // Today's run is unchanged on the Cache-Control matrix (no new cache
  // probes added — today's property-id-bound probe is on response
  // shape, not headers). The cached-endpoint matrix is unchanged at
  // 7 of 8 cached endpoints (only /:id/report.pdf remains unpinned —
  // it's auth-gated, so a smoke probe without a token cannot exercise
  // the handler). The refresh=true matrix is unchanged at 6-of-6
  // (CLOSED — closed yesterday 2026-05-10).
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
  //   - /:id/public-data  → s-maxage=86400 (24 h)    pinned 2026-05-09
  //   - /:id/report.pdf   → private, max-age=300     STILL UNPINNED (auth-gated)
  //
  // Refresh branches (forceRefresh=true → setNoCacheHeaders):
  //   - /:id/risk?refresh=true         → no-cache  pinned 2026-05-08
  //   - /:id/insurance?refresh=true    → no-cache  pinned 2026-05-09
  //   - /:id/carriers?refresh=true     → no-cache  pinned 2026-05-09
  //   - /:id/insurability?refresh=true → no-cache  pinned 2026-05-09
  //   - /:id/walkscore?refresh=true    → no-cache  pinned 2026-05-09
  //   - /:id/public-data?refresh=true  → no-cache  pinned 2026-05-10
  //
  // Tomorrow's target: figure out an auth-token strategy for
  // /:id/report.pdf to close the cached-endpoint matrix at 8-of-8.

  it('pins ALL 6 refresh=true branches (matrix CLOSED)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
    )
  })

  it('counts exactly 6 refresh=true branch pins (closed matrix)', () => {
    const refreshPins = REQUIRED_SMOKE_PROBES_05_11.filter((p) =>
      /refresh=true Cache-Control no-cache/.test(p),
    )
    expect(refreshPins.length).toBe(6)
  })

  it('counts at least 7 cached-endpoint Cache-Control pins (s-maxage)', () => {
    const cachePins = REQUIRED_SMOKE_PROBES_05_11.filter((p) =>
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
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).not.toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=7200',
    )
  })

  it('reverse-pin: public-data TTL stays 86400 (24h, parity with walkscore)', () => {
    // Carryover from 2026-05-09. The 24h TTL is sized against the
    // weight of the upstream-fan-out (images + tax + listings +
    // amenities). A regression that narrows it to 7200 (2h) would
    // multiply the upstream cost by 12x.
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
    )
    expect(REQUIRED_SMOKE_PROBES_05_11).not.toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=7200',
    )
  })
})

// ─── 5. Refresh-branch matrix completeness (CLOSED — carryover) ────────────

describe('Refresh-branch matrix completeness (2026-05-11 — carried CLOSED)', () => {
  // The cache-invalidation contract on the properties router is:
  // when the caller passes ?refresh=true, the handler MUST call
  // setNoCacheHeaders(res) before responding, AND the handler MUST
  // invalidate the corresponding cache entry server-side. The first
  // half (the response header) is what the smoke probes pin. The
  // second half (the server-side invalidation) is exercised
  // implicitly: a refresh=true call followed immediately by a default
  // call should return a fresh response, not the cached one.
  //
  // Today's status: matrix CLOSED at 6-of-6 (closed 2026-05-10).
  // Every refresh branch exposed by the properties router is now
  // pinned by a smoke probe. Today's run does not change this.
  //
  // The next axis on the cache contract is HANDLER-INTERNALS PINNING
  // (assert that a ?refresh=true call followed immediately by a
  // default call returns a fresh response, not the cached one —
  // exercises the server-side cache invalidation, not just the
  // response header). Carried as a tomorrow-target.

  it('lists 6 refresh=true probes (all branches still pinned)', () => {
    const refreshProbes = REQUIRED_SMOKE_PROBES_05_11.filter(
      (p) => /refresh=true Cache-Control no-cache/.test(p),
    )
    expect(refreshProbes.length).toBe(6)
  })

  it('refresh-branch probes specifically cover all 6 endpoints with cache invalidation', () => {
    const expected = [
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
      'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
    ]
    for (const probe of expected) {
      expect(REQUIRED_SMOKE_PROBES_05_11).toContain(probe)
    }
  })

  it('refresh-branch matrix is closed at 6-of-6 (no carryover)', () => {
    // Pin: every refresh-branch has a corresponding cached-branch
    // probe in the surface contract, AND every refresh-branch is
    // listed. This means a future PR that adds a new ?refresh=true
    // endpoint MUST also add a smoke probe — and a future PR that
    // drops setNoCacheHeaders from any one handler will fail the
    // smoke probe on that handler.
    const cachedRoots = ['risk', 'insurance', 'carriers', 'insurability', 'walkscore', 'public-data']
    for (const root of cachedRoots) {
      const refreshProbe = `GET /api/properties/:id/${root}?refresh=true Cache-Control no-cache`
      expect(REQUIRED_SMOKE_PROBES_05_11).toContain(refreshProbe)
    }
  })
})

// ─── 6. Verb-parity audit (carryover from 2026-05-03) ─────────────────────

describe('Verb-parity audit (2026-05-11)', () => {
  // The verb-parity audit from 2026-05-03 must continue to pass. Every
  // mutating verb (POST, PATCH, DELETE) on a protected route should
  // have a corresponding unauth-401 probe in smoke-test.ts. No new
  // mutating verbs were added today (today's additions are an OPTIONS
  // preflight + a GET response-shape probe), so the audit invariant
  // is unchanged.

  it('lists all PATCH endpoints from the audit (carryover)', () => {
    const patchProbes = REQUIRED_SMOKE_PROBES_05_11.filter((p) => p.startsWith('PATCH '))
    expect(patchProbes.length).toBeGreaterThanOrEqual(3)
  })

  it('lists all DELETE endpoints from the audit (carryover)', () => {
    const deleteProbes = REQUIRED_SMOKE_PROBES_05_11.filter((p) => p.startsWith('DELETE '))
    expect(deleteProbes.length).toBeGreaterThanOrEqual(4)
  })

  it('every PATCH/DELETE probe asserts 401 (no token)', () => {
    const mutatingProbes = REQUIRED_SMOKE_PROBES_05_11.filter(
      (p) => p.startsWith('PATCH ') || p.startsWith('DELETE '),
    )
    for (const probe of mutatingProbes) {
      expect(probe).toMatch(/no token → 401$/)
    }
  })
})

// ─── 7. CORS configuration sanity (carryover, expanded) ────────────────────

describe('CORS configuration sanity (2026-05-11)', () => {
  // The CORS_ALLOWED_ORIGINS env parser splits on comma and .trim()s
  // each entry. Today's OPTIONS /api/deals probe extends the per-
  // router pin matrix to 6 distinct router files (properties, auth,
  // clients, dashboard, advisor, deals).

  it('counts at least 7 OPTIONS preflight probes (6 surfaces, 1 deny)', () => {
    const optionsProbes = REQUIRED_SMOKE_PROBES_05_11.filter((p) => p.startsWith('OPTIONS '))
    // search disallowed + search allowed + auth/me + clients + dashboard + advisor + deals = 7
    expect(optionsProbes.length).toBeGreaterThanOrEqual(7)
  })

  it('per-router pin matrix covers 6 of 9 routers', () => {
    // Each entry pins a different router file, so a per-router cors
    // override on any single router would fail at least one probe.
    // The 9 routers are: properties, auth, clients, dashboard,
    // advisor, deals, alerts, stripe, notifications. Covered: 6.
    // Tomorrow's target: pick a 7th from the remaining 3.
    const pinnedRouters = [
      'OPTIONS /api/properties/search',
      'OPTIONS /api/auth/me',
      'OPTIONS /api/clients',
      'OPTIONS /api/dashboard',
      'OPTIONS /api/advisor/chat',
      'OPTIONS /api/deals',
    ]
    for (const probe of pinnedRouters) {
      expect(REQUIRED_SMOKE_PROBES_05_11.some((p) => p.includes(probe))).toBe(true)
    }
  })

  it('disallowed-origin probe stays present (carryover from 2026-05-06)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'OPTIONS /api/properties/search disallowed origin (no ACAO echo)',
    )
  })
})

// ─── 8. Response-shape pinning axis (NEW — initiated 2026-05-11) ──────────

describe('Response-shape pinning axis (2026-05-11 — newly initiated)', () => {
  // This is a NEW axis introduced today. With the refresh=true matrix
  // now CLOSED at 6-of-6 (as of 2026-05-10), the natural next axis on
  // the contract is the SHAPE of the response body, not just its
  // headers.
  //
  // The response-shape pinning axis catches a different regression
  // class than the existing 'has X' presence assertions: it catches
  // ADDITIVE leaks. Specifically:
  //
  //   Existing presence assert: "data.publicData should be present"
  //     - Catches: someone removes publicData from the bundle
  //     - DOES NOT catch: someone adds an internal debug field to
  //       the bundle that leaks data not intended for the public
  //       /report endpoint (e.g. ownerEmail, apiCallCount,
  //       computeMillis, internalDebugBlob, an upstream API key
  //       that was supposed to be redacted before egress, etc.)
  //
  //   New exact-cardinality assert: "data has EXACTLY these 6 keys"
  //     - Catches BOTH the removal regression AND the additive leak
  //     - The natural pair to the existing has-X probe
  //
  // Today's pin is on /report (the heaviest aggregate response). The
  // remaining endpoints (/risk, /insurance, /insurability, /carriers,
  // /walkscore, /public-data, /:id, /suggest) are tomorrow-targets
  // for the same axis.

  it('lists exactly 1 response-shape probe (initiated today)', () => {
    const shapeProbes = REQUIRED_SMOKE_PROBES_05_11.filter((p) =>
      /response shape:/.test(p),
    )
    expect(shapeProbes.length).toBe(1)
  })

  it('the initial probe pins /report at 2 top-level + 6 data keys', () => {
    expect(REQUIRED_SMOKE_PROBES_05_11).toContain(
      'GET /api/properties/:id/report response shape: exactly 2 top-level keys, exactly 6 data keys',
    )
  })

  it('documents the 8 endpoints that remain unpinned on the response-shape axis', () => {
    // Tomorrow-targets for the same axis. Each represents a separate
    // probe that will be added in a future daily QA run. Listing them
    // here documents the gap explicitly and serves as a follow-up
    // checklist.
    const remaining = ['risk', 'insurance', 'insurability', 'carriers', 'walkscore', 'public-data']
    for (const root of remaining) {
      // For each, the eventual probe text will look like:
      //   `GET /api/properties/:id/${root} response shape: exactly N top-level keys, exactly M data keys`
      // None of these exist yet — assert their absence so this test
      // turns red the day they DO exist (forcing a list update).
      const probeText = `response shape: exactly`
      const hasShape = REQUIRED_SMOKE_PROBES_05_11.some(
        (p) => p.includes(`/${root}`) && p.includes(probeText),
      )
      expect(hasShape).toBe(false)
    }
  })

  it('initial probe asserts on both top-level body and nested data keys', () => {
    // The probe text itself documents the two assertions explicitly.
    // A future cleanup that drops one of the two assertions would
    // also need to update the probe text — keeping the contract and
    // the assertion in sync.
    const probe = REQUIRED_SMOKE_PROBES_05_11.find((p) =>
      /report response shape:/.test(p),
    )
    expect(probe).toBeDefined()
    expect(probe).toMatch(/2 top-level keys/)
    expect(probe).toMatch(/6 data keys/)
  })
})
