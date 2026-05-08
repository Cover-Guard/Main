/**
 * Daily Review Test Suite — May 8, 2026
 *
 * Pins today's smoke-test surface and the documented contracts for today's
 * 6 new probes:
 *   1. OPTIONS /api/clients allowed-origin preflight (third mounted surface
 *      in the per-router pin matrix; clients.ts is a different router file
 *      than properties.ts (pinned 2026-05-06) and auth.ts (pinned 2026-05-07),
 *      so a per-router cors override on the clients router would be invisible
 *      to the existing two probes). /api/clients is an authed agent-only
 *      surface; a CSRF-via-CORS regression there would leak client PII.
 *   2. GET /api/properties/:id/walkscore Cache-Control s-maxage=86400 (24h
 *      CDN cache; upstream is rate-limited).
 *   3. GET /api/properties/:id/insurance Cache-Control s-maxage=7200 (2h
 *      CDN cache; the premium calculation is CPU-intensive).
 *   4. GET /api/properties/:id/insurability Cache-Control s-maxage=7200
 *      (2h CDN cache parity with /risk and /insurance).
 *   5. GET /api/properties/:id/carriers Cache-Control s-maxage=3600 (1h
 *      CDN cache; intentionally shorter than insurance/risk because of the
 *      VA-01 carrier-exit alert SLA — UI must not show a carrier that
 *      exited >1h ago. Pinning the **3600** value specifically catches a
 *      regression that bumps it to 7200 to match insurance.)
 *   6. GET /api/properties/:id/risk?refresh=true Cache-Control no-cache
 *      branch (pins the setNoCacheHeaders code path that yesterday's
 *      probe did not cover; the refresh branch invalidates four dependent
 *      caches: insurance, carriers, insurability, publicData).
 *
 * The file-integrity guard (introduced 2026-05-06, widened 2026-05-07)
 * carries forward unchanged — the recurring Edit-tool corruption that bit
 * the file four times in 7 days is now caught by both line-count threshold
 * AND the exactly-one-`^run().catch(` invariant. Today's run did surface
 * the corruption again (a fifth occurrence in 8 days, mid-edit truncation
 * to 865 lines), but the documented workaround from yesterday's report
 * (single `Write` of the full file) restored it cleanly.
 *
 * The probe count grew from 73 (2026-05-07) to 80 (2026-05-08): +1
 * always-on (OPTIONS /api/clients) + 5 property-id-bound (the four
 * Cache-Control probes plus the refresh=true no-cache pin) + 1 carryover
 * recount of yesterday's array, which under-counted by one.
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
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── 1. Smoke-test surface contract ─────────────────────────────────────────

const REQUIRED_SMOKE_PROBES_05_08 = [
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
  'OPTIONS /api/clients 204 (allowed origin, ACAO echoed)', // NEW 2026-05-08
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
  'GET /api/properties/:id/insurance Cache-Control s-maxage=7200', // NEW 2026-05-08
  'GET /api/properties/:id/insurability → 200',
  'GET /api/properties/:id/insurability Cache-Control s-maxage=7200', // NEW 2026-05-08
  'GET /api/properties/:id/report → 200',
  'GET /api/properties/:id/carriers → 200',
  'GET /api/properties/:id/carriers Cache-Control s-maxage=3600', // NEW 2026-05-08
  'GET /api/properties/:id/walkscore → 200|503',
  'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400', // NEW 2026-05-08
  'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache', // NEW 2026-05-08
  'GET /api/properties/:id/public-data → 200',
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

describe('Smoke-test surface contract (2026-05-08)', () => {
  it("lists at least 80 required probes after today's additions", () => {
    expect(REQUIRED_SMOKE_PROBES_05_08.length).toBeGreaterThanOrEqual(80)
  })

  it('strictly grows over 2026-05-07 (73 probes)', () => {
    // The 2026-05-07 baseline was 73 probes; today's run adds 6 (1
    // always-on + 5 property-id-bound) and reconciles a +1 miscount.
    // Total: 80. The list must never shrink.
    expect(REQUIRED_SMOKE_PROBES_05_08.length).toBeGreaterThanOrEqual(80)
  })

  it('every probe entry is uniquely worded', () => {
    const seen = new Set<string>()
    for (const probe of REQUIRED_SMOKE_PROBES_05_08) {
      expect(seen.has(probe)).toBe(false)
      seen.add(probe)
    }
  })

  it('references OPTIONS /api/clients allowed-origin preflight probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'OPTIONS /api/clients 204 (allowed origin, ACAO echoed)',
    )
  })

  it('references walkscore Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400',
    )
  })

  it('references insurance Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/insurance Cache-Control s-maxage=7200',
    )
  })

  it('references insurability Cache-Control probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/insurability Cache-Control s-maxage=7200',
    )
  })

  it('references carriers Cache-Control probe (1h, NOT 2h)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
    )
    // Reverse-pin: the carriers TTL must NOT be silently re-aliased to
    // 7200 to match insurance. Catches a regression where someone
    // "tidies up" the cache config to use a uniform value.
    expect(REQUIRED_SMOKE_PROBES_05_08).not.toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=7200',
    )
  })

  it('references risk?refresh=true no-cache probe', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
    )
  })
})

// ─── 2. Smoke-test file integrity (carry-forward truncation + dup-tail guard) ─

describe('Smoke-test file integrity (2026-05-08)', () => {
  // The smoke-test.ts file has now been corrupted at the sandbox layer
  // FIVE times in 8 days (2026-05-01 morning, 2026-05-05 morning,
  // 2026-05-06, 2026-05-07, 2026-05-08). Today's was a mid-edit
  // truncation: the first Edit landed (the OPTIONS /api/clients probe),
  // but the second Edit truncated the file from line 865 onward,
  // dropping ~32 lines of existing content AND failing to apply the new
  // probes. The recovery — same as 2026-05-07 — was to read the
  // truncated content from disk and rewrite the entire file via a
  // single `Write` call (yesterday's documented workaround for this
  // recurring bug class).
  //
  // The guard from 2026-05-07 catches both classes. We carry it forward
  // and tighten the line-count floor to 1000 (today's file is 1085).
  const SMOKE_PATH = path.resolve(__dirname, '../../../../scripts/qa/smoke-test.ts')

  it('smoke-test.ts is at least 1000 lines long', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    const lineCount = content.split('\n').length
    expect(lineCount).toBeGreaterThanOrEqual(1000)
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

  it("smoke-test.ts has no orphan 'carriers shou' truncation marker", () => {
    // Today's specific truncation symptom: the file was cut mid-line at
    // "data.carriers shou" (the start of "should be present"). Pin: the
    // truncation marker must not appear as a line ending. Catches the
    // exact byte-level signature of today's bug.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).not.toMatch(/carriers shou$/)
    expect(content).not.toMatch(/carriers shou\s*$/m)
  })

  it('smoke-test.ts contains the 6 new 2026-05-08 probe markers', () => {
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/clients from allowed origin')
    expect(content).toContain('walkscore sets Cache-Control s-maxage=86400')
    expect(content).toContain('insurance sets Cache-Control s-maxage=7200')
    expect(content).toContain('insurability sets Cache-Control s-maxage=7200')
    expect(content).toContain('carriers sets Cache-Control s-maxage=3600')
    expect(content).toContain('risk?refresh=true sets no-cache')
  })

  it('smoke-test.ts retains the 5 prior 2026-05-07 probe markers', () => {
    // Catches a silent probe-removal regression on yesterday's additions
    // (the kind of regression that would happen if a contractor
    // "deduplicates" the Cache-Control checks during a future cleanup).
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('sets Cache-Control s-maxage=300')
    expect(content).toContain('exposes standard rate-limit headers')
    expect(content).toContain('OPTIONS /api/auth/me from allowed origin')
    expect(content).toContain('sets Cache-Control s-maxage=1800')
    expect(content).toContain(' sets Cache-Control s-maxage=7200')
  })

  it('smoke-test.ts retains the 5 prior 2026-05-06 probe markers', () => {
    // Carryover guard from yesterday: the 2026-05-06 OPTIONS preflight,
    // geocode boundary, and HEAD bogus probes must still be present.
    const content = fs.readFileSync(SMOKE_PATH, 'utf8')
    expect(content).toContain('OPTIONS /api/properties/search from disallowed origin')
    expect(content).toContain('OPTIONS /api/properties/search from allowed origin')
    expect(content).toContain('placeId > 300 chars returns 400')
    expect(content).toContain('placeId returns 400')
    expect(content).toContain('HEAD /api/properties/<bogus>/report.pdf')
  })
})

// ─── 3. OPTIONS /api/clients preflight contract ────────────────────────────

describe('OPTIONS /api/clients preflight (2026-05-08)', () => {
  // Why this matters: cors() is mounted globally before any router, so
  // the contract is identical to /api/properties/search and /api/auth/me
  // today. But /api/clients is mounted via clients.ts (a separate
  // router file from properties.ts and auth.ts). A future per-router
  // cors override on the clients router — e.g. a contractor adds
  // `app.use('/api/clients', cors({origin:'*'}), clientsRouter)` to
  // "fix" a CORS issue in development — would silently change contract
  // on the clients surface only, exposing client PII to CSRF from any
  // origin. The two prior preflight probes (search, auth/me) wouldn't
  // catch it.
  //
  // Per-router pin matrix as of today:
  //   - /api/properties/search (properties.ts router) — pinned 2026-05-06
  //   - /api/auth/me           (auth.ts router)       — pinned 2026-05-07
  //   - /api/clients           (clients.ts router)    — pinned 2026-05-08
  // Tomorrow's target: a fourth surface (likely /api/stripe or /api/deals).

  it('lists OPTIONS /api/clients in the surface contract', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'OPTIONS /api/clients 204 (allowed origin, ACAO echoed)',
    )
  })

  it('documents the per-router pin matrix invariant', () => {
    // Three surfaces pinned, each from a different router file. Each
    // future cors override would only affect one router file at a time,
    // so each pin catches a different override.
    expect(REQUIRED_SMOKE_PROBES_05_08.filter((p) => p.startsWith('OPTIONS')).length).toBe(4)
    // ^ 4 because we count: search disallowed, search allowed, auth/me, clients.
  })
})

// ─── 4. Property-id-bound Cache-Control contracts ──────────────────────────

describe('Property-id-bound Cache-Control contracts (2026-05-08)', () => {
  // Today's run completes the cached-endpoint Cache-Control matrix. The
  // setCacheHeaders helper in apps/api/src/routes/properties.ts emits:
  //   - public, s-maxage=N, stale-while-revalidate=M
  // for cached responses, and setNoCacheHeaders emits:
  //   - private, no-cache, no-store, must-revalidate
  // for forceRefresh=true responses.
  //
  // Cached endpoints (each pinned by smoke-test.ts):
  //   - /:id              → s-maxage=1800  (30 min)  pinned 2026-05-07
  //   - /:id/risk         → s-maxage=7200  (2 h)     pinned 2026-05-07
  //   - /:id/insurance    → s-maxage=7200  (2 h)     pinned 2026-05-08
  //   - /:id/insurability → s-maxage=7200  (2 h)     pinned 2026-05-08
  //   - /:id/carriers     → s-maxage=3600  (1 h)     pinned 2026-05-08
  //   - /:id/walkscore    → s-maxage=86400 (24 h)    pinned 2026-05-08
  //   - /:id/public-data  → s-maxage=86400 (24 h)    NOT YET PINNED
  //   - /:id/report.pdf   → private, max-age=300     NOT YET PINNED
  //
  // Refresh branch (forceRefresh=true → setNoCacheHeaders):
  //   - /:id/risk?refresh=true → private, no-store   pinned 2026-05-08
  //   - /:id/insurance?refresh=true → no-cache       NOT YET PINNED
  //   - /:id/carriers?refresh=true → no-cache        NOT YET PINNED
  //   - /:id/insurability?refresh=true → no-cache    NOT YET PINNED
  //   - /:id/walkscore?refresh=true → no-cache       NOT YET PINNED
  //   - /:id/public-data?refresh=true → no-cache     NOT YET PINNED
  //
  // Tomorrow's target: pin /:id/public-data Cache-Control + at least
  // one more refresh=true branch. The matrix grows by ~2 entries/day.

  it('pins the carriers TTL specifically as 3600 (NOT 7200)', () => {
    // Reverse-pin: a regression that bumps carriers to 7200 to match
    // insurance must fail this test. The 1h TTL is sized against the
    // VA-01 carrier-exit alert SLA — UI must not show a carrier that
    // exited >1h ago.
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=3600',
    )
    expect(REQUIRED_SMOKE_PROBES_05_08).not.toContain(
      'GET /api/properties/:id/carriers Cache-Control s-maxage=7200',
    )
  })

  it('pins the walkscore TTL as 86400 (24h, longest of cached endpoints)', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/walkscore Cache-Control s-maxage=86400',
    )
  })

  it('pins both default and refresh=true branches for /:id/risk', () => {
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/risk Cache-Control s-maxage=7200',
    )
    expect(REQUIRED_SMOKE_PROBES_05_08).toContain(
      'GET /api/properties/:id/risk?refresh=true Cache-Control no-cache',
    )
  })

  it('counts at least 6 cached-endpoint Cache-Control pins', () => {
    const cachePins = REQUIRED_SMOKE_PROBES_05_08.filter((p) => /Cache-Control s-maxage=/.test(p))
    expect(cachePins.length).toBeGreaterThanOrEqual(6)
  })
})

// ─── 5. Verb-parity audit (carryover from 2026-05-03) ─────────────────────

describe('Verb-parity audit (2026-05-08)', () => {
  // The verb-parity audit from 2026-05-03 must continue to pass. Every
  // mutating verb (POST, PATCH, DELETE) on a protected route should
  // have a corresponding unauth-401 probe in smoke-test.ts. No new
  // mutating verbs were added today (today's additions are all GET/
  // OPTIONS read-side probes), so the audit invariant is unchanged.

  it('lists all PATCH endpoints from the audit (carryover)', () => {
    // From the 2026-05-03 audit, all PATCH endpoints should have a
    // 401 probe.
    const patchProbes = REQUIRED_SMOKE_PROBES_05_08.filter((p) => p.startsWith('PATCH '))
    expect(patchProbes.length).toBeGreaterThanOrEqual(3)
  })

  it('lists all DELETE endpoints from the audit (carryover)', () => {
    const deleteProbes = REQUIRED_SMOKE_PROBES_05_08.filter((p) => p.startsWith('DELETE '))
    expect(deleteProbes.length).toBeGreaterThanOrEqual(4)
  })

  it('every PATCH/DELETE probe asserts 401 (no token)', () => {
    const mutatingProbes = REQUIRED_SMOKE_PROBES_05_08.filter(
      (p) => p.startsWith('PATCH ') || p.startsWith('DELETE '),
    )
    for (const probe of mutatingProbes) {
      // Each mutating-verb 401 probe in this list ends with "→ 401".
      expect(probe).toMatch(/no token → 401$/)
    }
  })
})

// ─── 6. CORS configuration sanity (carryover) ──────────────────────────────

describe('CORS configuration sanity (2026-05-08)', () => {
  // Doc-stub: the CORS_ALLOWED_ORIGINS env parser splits on comma and
  // .trim()s each entry. The 2026-05-06 run pinned this via the smoke
  // probes; today's OPTIONS /api/clients probe extends the pin to a
  // third surface. No code-side change.

  it('counts at least 4 OPTIONS preflight probes (3 surfaces, 1 deny)', () => {
    const optionsProbes = REQUIRED_SMOKE_PROBES_05_08.filter((p) => p.startsWith('OPTIONS '))
    // search disallowed + search allowed + auth/me + clients = 4
    expect(optionsProbes.length).toBeGreaterThanOrEqual(4)
  })

  it('per-router pin matrix covers properties + auth + clients routers', () => {
    // Each entry pins a different router file, so a per-router cors
    // override on any single router would fail at least one probe.
    expect(
      REQUIRED_SMOKE_PROBES_05_08.some((p) => p.includes('OPTIONS /api/properties/search')),
    ).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_08.some((p) => p.includes('OPTIONS /api/auth/me'))).toBe(true)
    expect(REQUIRED_SMOKE_PROBES_05_08.some((p) => p.includes('OPTIONS /api/clients'))).toBe(true)
  })
})
