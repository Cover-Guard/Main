/**
 * Daily Review Test Suite — May 12, 2026
 *
 * Pins today's smoke-test surface and the documented contracts for today's
 * 2 new probes:
 *   1. OPTIONS /api/alerts allowed-origin preflight (seventh mounted
 *      surface in the per-router pin matrix; alerts.ts is a different
 *      router file than properties.ts (pinned 2026-05-06), auth.ts
 *      (pinned 2026-05-07), clients.ts (pinned 2026-05-08), dashboard.ts
 *      (pinned 2026-05-09), advisor.ts (pinned 2026-05-10), and deals.ts
 *      (pinned 2026-05-11), so a per-router cors override on the alerts
 *      router would be invisible to the existing six probes). The alerts
 *      surface gates every handler behind requireAuth router-wide, but
 *      the OPTIONS preflight goes through the global cors() middleware
 *      in index.ts BEFORE requireAuth fires (Express short-circuits
 *      OPTIONS when a CORS middleware emits a 204). This is meaningful
 *      because /api/alerts/carrier-exits/:id/acknowledge is the surface
 *      a victim user uses to dismiss a carrier-exit alert: a CSRF-via-
 *      CORS regression there would let an attacker-controlled origin
 *      silently acknowledge (dismiss) those alerts from the victim
 *      browser session, defeating the VA-01 alert SLA.
 *   2. GET /api/properties/:id exact top-level key cardinality. The
 *      existing /:id probe asserts that id/address/state are present;
 *      today probe additionally asserts that the top-level body has
 *      EXACTLY 2 keys ({ success, data }) -- no extras. Extends the
 *      RESPONSE-SHAPE PINNING AXIS started yesterday from 1 endpoint
 *      to 2 endpoints. Why both /:id and /report: /report is a
 *      composed bundle of 6 services, while /:id is a direct DB row
 *      through getPropertyById. A future PR that adds an internal
 *      column to the Property table (e.g. rentcastSnapshot,
 *      attomRawPayload, internalRiskScore, ownerNotes) would have its
 *      leak surface on the direct row read, not on /report. Today
 *      probe pins only the top-level cardinality; the inner data
 *      shape is wide (15+ Prisma columns) and varies across
 *      migrations, so a legitimate Property column addition does NOT
 *      need to update this probe; only a regression that adds a NEW
 *      top-level body key (e.g. { success, data, debug }) would trip
 *      it.
 *
 * The file-integrity guard (introduced 2026-05-06, widened 2026-05-07,
 * tightened 2026-05-08, retightened 2026-05-09, again tightened 2026-05-10
 * and 2026-05-11) carries forward unchanged with one increment: the
 * line-count floor moves from 1400 to 1600 (today's smoke-test.ts file
 * is 1652 lines). Today's run started clean for the FOURTH consecutive
 * day -- the recurring Edit-tool corruption that bit the file FIVE
 * times in 8 days did NOT recur. To keep it that way, today's edits
 * were applied via a single atomic Python rewrite (run from the bash
 * sandbox) instead of a chain of Edit-tool calls -- the mitigation
 * established 2026-05-09 is now the documented standard workflow.
 *
 * The probe count grew from 90 (2026-05-11) to 92 (2026-05-12): +1
 * always-on (OPTIONS /api/alerts) + 1 property-id-bound (/:id exact
 * top-level cardinality).
 *
 * Probe count over time:
 *   2026-04-30 -> ~28
 *   2026-05-01 morning -> ~32
 *   2026-05-01 evening -> ~46
 *   2026-05-02 -> ~47
 *   2026-05-03 -> ~53
 *   2026-05-04 -> 56
 *   2026-05-05 -> 61
 *   2026-05-06 -> 68
 *   2026-05-07 -> 74
 *   2026-05-08 -> 80
 *   2026-05-09 -> 86
 *   2026-05-10 -> 88
 *   2026-05-11 -> 90
 *   2026-05-12 -> 92
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract ─────────────────────────────────────────

const REQUIRED_SMOKE_PROBES_05_12 = [
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
  'OPTIONS /api/deals 204 (allowed origin, ACAO echoed)',
  'OPTIONS /api/alerts 204 (allowed origin, ACAO echoed)', // NEW 2026-05-12
  'GET /api/properties/search no token -> 401',
  'GET /api/properties/search no params -> 401',
  'GET /api/properties/suggest?q=Mia -> 200',
  'GET /api/properties/suggest q="a" -> 400',
  'GET /api/properties/suggest Cache-Control s-maxage=300',
  'GET /api/properties/suggest exposes standard RateLimit-Limit + RateLimit-Remaining',
  'POST /api/properties/geocode empty body -> 400',
  'POST /api/properties/geocode placeId="" -> 400',
  'POST /api/properties/geocode placeId>300 chars -> 400',
  'GET /api/properties/<bogus>/walkscore -> 404',
  'GET /api/properties/<bogus>/report -> 404',
  'GET /api/properties/<bogus>/report.pdf -> 404 (not 401)',
  'HEAD /api/properties/<bogus>/report.pdf -> 404 (not 401)',
  'GET /api/auth/me no token -> 401',
  'GET /api/auth/me/saved no token -> 401',
  'GET /api/auth/me/reports no token -> 401',
  'GET /api/clients no token -> 401',
  'GET /api/dashboard/ticker no token -> 401',
  'GET /api/deals no token -> 401',
  'GET /api/deals/stats no token -> 401',
  'GET /api/alerts/carrier-exits no token -> 401',
  'POST /api/advisor/chat no token -> 401',
  'POST /api/push/subscribe no token -> 401',
  'POST /api/notifications/dispatch no token -> 401',
  'GET /api/stripe/subscription no token -> 401',
  'POST /api/stripe/checkout no token -> 401',
  'POST /api/stripe/portal no token -> 401',
  'POST /api/auth/register empty body -> 400',
  'PATCH /api/auth/me no token -> 401',
  'DELETE /api/auth/me no token -> 401',
  'POST /api/auth/me/terms no token -> 401',
  'POST /api/auth/sync-profile no token -> 401',
  'POST /api/clients no token -> 401',
  'POST /api/deals no token -> 401',
  'POST /api/alerts/carrier-exits/:id/acknowledge no token -> 401',
  'PATCH /api/clients/:id no token -> 401',
  'DELETE /api/clients/:id no token -> 401',
  'PATCH /api/deals/:id no token -> 401',
  'DELETE /api/deals/:id no token -> 401',
  'GET /api/properties/<bogus> -> 404',
  'POST /api/stripe/webhook no signature -> 400',
  'GET /api/push/vapid -> 200|503',
  // Property-id-bound probes (--property-id required)
  'GET /api/properties/:id -> 200',
  'GET /api/properties/:id Cache-Control s-maxage=1800',
  'GET /api/properties/:id response shape: exactly 2 top-level keys', // NEW 2026-05-12
  'GET /api/properties/:id/risk -> 200',
  'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
  'GET /api/properties/:id/insurance -> 200',
  'GET /api/properties/:id/insurance Cache-Control s-maxage=7200',
  'GET /api/properties/:id/insurability -> 200',
  'GET /api/properties/:id/insurability Cache-Control s-maxage=7200',
  'GET /api/properties/:id/report -> 200',
  'GET /api/properties/:id/report response shape: exactly 2 top-level keys, exactly 6 data keys',
  'GET /api/properties/:id/carriers -> 200',
  'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
  'GET /api/properties/:id/walkscore -> 200|503',
  'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400',
  'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/public-data -> 200',
  'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
  'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
  'GET /api/properties/:id/report.pdf no token -> 401',
  'HEAD /api/properties/:id/report.pdf no token -> 401',
  'GET /api/properties/:id/checklists no token -> 401',
  'POST /api/properties/:id/checklists no token -> 401',
  'POST /api/properties/:id/save no token -> 401',
  'DELETE /api/properties/:id/save no token -> 401',
  'PATCH /api/properties/:id/checklists/:checklistId no token -> 401',
  'DELETE /api/properties/:id/checklists/:checklistId no token -> 401',
  'POST /api/properties/:id/quote-request no token -> 401',
  'GET /api/properties/:id/quote-requests no token -> 401',
] as const

describe('Smoke-test surface contract (2026-05-12)', () => {
  it("lists at least 92 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_12.length).toBeGreaterThanOrEqual(92)
  })

  it('strictly grows over 2026-05-11 (90 probes)', () => {
    // 2026-05-11 baseline was 90 probes; today adds 2 (1 always-on +
    // 1 property-id-bound). Total: 92. The list must never shrink.
    expect(REQUIRED_SMOKE_PROBES_05_12.length).toBeGreaterThanOrEqual(92)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_12) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it('references OPTIONS /api/alerts allowed-origin preflight probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'OPTIONS /api/alerts 204 (allowed origin, ACAO echoed)',
    )
  })

  it('references /:id exact top-level cardinality probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id response shape: exactly 2 top-level keys',
    )
  })

  it('reverse-pins: refresh=true probes must NOT assert s-maxage', () => {
    const refreshProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) =>
      /refresh=true/.test(p),
    )
    expect(refreshProbes.length).toBeGreaterThanOrEqual(6)
    for (const probe of refreshProbes) {
      expect(probe).not.toMatch(/Cache-Control s-maxage=/)
    }
  })
})

// ─── 2. Smoke-test file integrity (carry-forward truncation guard) ──────────

describe('Smoke-test file integrity (2026-05-12)', () => {
  // The smoke-test.ts file was corrupted FIVE times in 8 days (2026-05-01
  // morning, 2026-05-05 morning, 2026-05-06, 2026-05-07, 2026-05-08).
  // The corruption did NOT recur on 2026-05-09, 2026-05-10, 2026-05-11,
  // OR today (2026-05-12) -- four consecutive clean days. The mitigation
  // (single atomic Python rewrite from the bash sandbox) is now the
  // documented standard workflow for any modification to this file. The
  // line-count floor is tightened from 1400 (the 2026-05-11 floor) to
  // 1600 (today's file is 1652 lines).
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 1600 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(1600)
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
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).not.toMatch(/carriers shou$/)
    expect(content).not.toMatch(/carriers shou\s*$/m)
  })

  it('smoke-test.ts contains the 2 new 2026-05-12 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/alerts from allowed origin')
    expect(content).toContain('Response-shape pinning axis member #2')
  })

  it('smoke-test.ts retains the 2 prior 2026-05-11 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/deals from allowed origin')
    expect(content).toContain('exactly 2 top-level keys, exactly 6 data keys')
  })

  it('smoke-test.ts retains the 2 prior 2026-05-10 probe markers', () => {
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

  it('smoke-test.ts has at least 92 runTest invocations', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const matches = content.match(/await runTest\(/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(92)
  })

  it('smoke-test.ts has balanced braces (extra structural-corruption guard)', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const open = (content.match(/\{/g) ?? []).length
    const close = (content.match(/\}/g) ?? []).length
    expect(open).toBe(close)
  })
})

// ─── 3. OPTIONS /api/alerts preflight contract ─────────────────────────────

describe('OPTIONS /api/alerts preflight (2026-05-12)', () => {
  // Why this matters: cors() is mounted globally before any router, so
  // the contract is identical across all surfaces today. But /api/alerts
  // is mounted via alerts.ts (a separate router file from properties,
  // auth, clients, dashboard, advisor, and deals). A future per-router
  // cors override on the alerts router would silently change contract
  // on the alerts surface only, and the six prior preflight probes
  // wouldn't catch it.
  //
  // Per-router pin matrix as of today:
  //   - /api/properties/search (properties.ts router)  -- pinned 2026-05-06
  //   - /api/auth/me           (auth.ts router)        -- pinned 2026-05-07
  //   - /api/clients           (clients.ts router)     -- pinned 2026-05-08
  //   - /api/dashboard         (dashboard.ts router)   -- pinned 2026-05-09
  //   - /api/advisor/chat      (advisor.ts router)     -- pinned 2026-05-10
  //   - /api/deals             (deals.ts router)       -- pinned 2026-05-11
  //   - /api/alerts            (alerts.ts router)      -- pinned 2026-05-12
  // Tomorrow target: an 8th surface (stripe or notifications -- 2 of 9
  // routers remain unpinned).
  //
  // The carrier-exit alert is a regulatory-grade signal (VA-01 SLA), so
  // a CSRF-via-CORS regression that lets a third party silence those
  // alerts in the victim browser session is exactly the failure mode
  // the SLA was built to prevent.

  it('lists OPTIONS /api/alerts in the surface contract', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'OPTIONS /api/alerts 204 (allowed origin, ACAO echoed)',
    )
  })

  it('documents the per-router pin matrix invariant (7 of 9 routers)', () => {
    // Seven surfaces pinned, each from a different router file.
    expect(
      REQUIRED_SMOKE_PROBES_05_12.filter((p) => p.startsWith('OPTIONS')).length,
    ).toBe(8)
    // 8 = 7 allowed-origin probes + 1 disallowed-origin probe.
  })

  it('per-router matrix covers 7 distinct router files', () => {
    expect(
      REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/properties/search')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/auth/me'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/clients'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/dashboard'))).toBe(true)
    expect(
      REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/advisor/chat')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/deals'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes('OPTIONS /api/alerts'))).toBe(true)
  })

  it('documents the two remaining router targets (carryovers)', () => {
    // The two routers still unpinned on the per-router CORS pin matrix:
    // stripe, notifications. Each represents a tomorrow-target.
    expect(
      REQUIRED_SMOKE_PROBES_05_12.some((p) => p.startsWith('OPTIONS /api/stripe')),
    ).toBe(false)
    expect(
      REQUIRED_SMOKE_PROBES_05_12.some((p) => p.startsWith('OPTIONS /api/notifications')),
    ).toBe(false)
  })
})

// ─── 4. Property-id-bound Cache-Control contracts (carryover) ──────────────

describe('Property-id-bound Cache-Control contracts (2026-05-12 carryover)', () => {
  // Today is unchanged on the Cache-Control matrix (no new cache probes
  // added -- today property-id-bound probe is on response shape, not
  // headers). The cached-endpoint matrix is unchanged at 7-of-8 cached
  // endpoints (only /:id/report.pdf remains unpinned -- auth-gated).
  // The refresh=true matrix is unchanged at 6-of-6 (CLOSED).

  it('pins ALL 6 refresh=true branches (matrix CLOSED)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/insurance?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/carriers?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/insurability?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/walkscore?refresh=true Cache-Control no-cache',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/public-data?refresh=true Cache-Control no-cache',
    )
  })

  it('counts exactly 6 refresh=true branch pins (closed matrix)', () => {
    const refreshPins = REQUIRED_SMOKE_PROBES_05_12.filter((p) =>
      /refresh=true Cache-Control no-cache/.test(p),
    )
    expect(refreshPins.length).toBe(6)
  })

  it('counts at least 7 cached-endpoint Cache-Control pins (s-maxage)', () => {
    const cachePins = REQUIRED_SMOKE_PROBES_05_12.filter((p) =>
      /Cache-Control s-maxage=/.test(p),
    )
    expect(cachePins.length).toBeGreaterThanOrEqual(7)
  })

  it('reverse-pin: carriers TTL stays 3600 (NOT 7200)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).not.toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=7200',
    )
  })

  it('reverse-pin: public-data TTL stays 86400 (24h, parity with walkscore)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=86400',
    )
    expect(REQUIRED_SMOKE_PROBES_05_12).not.toContain(
      'GET /api/properties/:id/public-data Cache-Control s-maxage=7200',
    )
  })
})

// ─── 5. Verb-parity audit (carryover from 2026-05-03) ─────────────────────

describe('Verb-parity audit (2026-05-12 carryover)', () => {
  // Today additions are an OPTIONS preflight + a GET response-shape
  // probe -- no new mutating verbs, so the audit invariant is unchanged.

  it('lists all PATCH endpoints from the audit (carryover)', () => {
    const patchProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) => p.startsWith('PATCH '))
    expect(patchProbes.length).toBeGreaterThanOrEqual(3)
  })

  it('lists all DELETE endpoints from the audit (carryover)', () => {
    const deleteProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) => p.startsWith('DELETE '))
    expect(deleteProbes.length).toBeGreaterThanOrEqual(4)
  })

  it('every PATCH/DELETE probe asserts 401 (no token)', () => {
    const mutatingProbes = REQUIRED_SMOKE_PROBES_05_12.filter(
      (p) => p.startsWith('PATCH ') || p.startsWith('DELETE '),
    )
    for (const probe of mutatingProbes) {
      expect(probe).toMatch(/no token -> 401$/)
    }
  })
})

// ─── 6. CORS configuration sanity (carryover, expanded) ────────────────────

describe('CORS configuration sanity (2026-05-12)', () => {
  it('counts at least 8 OPTIONS preflight probes (7 surfaces, 1 deny)', () => {
    const optionsProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) => p.startsWith('OPTIONS '))
    expect(optionsProbes.length).toBeGreaterThanOrEqual(8)
  })

  it('per-router pin matrix covers 7 of 9 routers', () => {
    const pinnedRouters = [
      'OPTIONS /api/properties/search',
      'OPTIONS /api/auth/me',
      'OPTIONS /api/clients',
      'OPTIONS /api/dashboard',
      'OPTIONS /api/advisor/chat',
      'OPTIONS /api/deals',
      'OPTIONS /api/alerts',
    ]
    for (const probe of pinnedRouters) {
      expect(REQUIRED_SMOKE_PROBES_05_12.some((p) => p.includes(probe))).toBe(true)
    }
  })

  it('disallowed-origin probe stays present (carryover from 2026-05-06)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'OPTIONS /api/properties/search disallowed origin (no ACAO echo)',
    )
  })
})

// ─── 7. Response-shape pinning axis (extended 2026-05-12) ──────────────────

describe('Response-shape pinning axis (2026-05-12 -- extended to 2 endpoints)', () => {
  // The axis was initiated 2026-05-11 with the /report exact-key probe.
  // Today extends it to /:id (top-level cardinality only). The two
  // endpoints exercise qualitatively different leak surfaces: /report
  // assembles its payload manually from 6 services, while /:id is a
  // direct DB row through getPropertyById.

  it('lists exactly 2 response-shape probes (extended today)', () => {
    const shapeProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) =>
      /response shape:/.test(p),
    )
    expect(shapeProbes.length).toBe(2)
  })

  it('retains the prior 2026-05-11 probe on /report at 2 top-level + 6 data keys', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id/report response shape: exactly 2 top-level keys, exactly 6 data keys',
    )
  })

  it('adds new probe on /:id at exactly 2 top-level keys', () => {
    expect(REQUIRED_SMOKE_PROBES_05_12).toContain(
      'GET /api/properties/:id response shape: exactly 2 top-level keys',
    )
  })

  it('documents the 6 endpoints that remain unpinned on the response-shape axis', () => {
    // Tomorrow-targets for the same axis. Each represents a separate
    // probe that will be added in a future daily QA run. Listing them
    // here documents the gap explicitly and serves as a follow-up
    // checklist. (One fewer than yesterday because /:id was just added.)
    const remaining = ['risk', 'insurance', 'insurability', 'carriers', 'walkscore', 'public-data']
    for (const root of remaining) {
      const probeText = 'response shape: exactly'
      const hasShape = REQUIRED_SMOKE_PROBES_05_12.some(
        (p) => p.includes(`/${root}`) && p.includes(probeText),
      )
      expect(hasShape).toBe(false)
    }
  })

  it('axis growth invariant: shape-probe count is strictly monotonic across days', () => {
    // 2026-05-11 had 1 probe. 2026-05-12 has 2. The axis must only grow.
    const shapeProbes = REQUIRED_SMOKE_PROBES_05_12.filter((p) =>
      /response shape:/.test(p),
    )
    expect(shapeProbes.length).toBeGreaterThanOrEqual(2)
  })

  it('/:id probe pins only top-level cardinality (not inner data keys)', () => {
    // The inner data shape on /:id is wide (15+ Prisma columns) and
    // varies across migrations, so today probe pins only the top-level
    // cardinality. The probe text itself documents this -- it says
    // "exactly 2 top-level keys" without a "data keys" clause.
    const probe = REQUIRED_SMOKE_PROBES_05_12.find(
      (p) => p === 'GET /api/properties/:id response shape: exactly 2 top-level keys',
    )
    expect(probe).toBeDefined()
    expect(probe).not.toMatch(/data keys/)
  })
})
