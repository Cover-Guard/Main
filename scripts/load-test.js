/**
 * CoverGuard API Performance & Load Test Suite
 *
 * Uses k6 to run load tests against all API endpoints.
 *
 * Installation:
 *   brew install k6          (macOS)
 *   choco install k6         (Windows)
 *   snap install k6          (Linux)
 *
 * Usage:
 *   # Smoke test (1 user, 30s)
 *   k6 run scripts/load-test.js
 *
 *   # Load test (50 users, 2min)
 *   k6 run --vus 50 --duration 2m scripts/load-test.js
 *
 *   # Stress test (100 users, 5min)
 *   k6 run --vus 100 --duration 5m scripts/load-test.js
 *
 *   # With custom base URL
 *   k6 run -e BASE_URL=https://api.coverguard.io scripts/load-test.js
 *
 *   # With auth token
 *   k6 run -e ACCESS_TOKEN=eyJ... scripts/load-test.js
 *
 *   # Output to JSON for analysis
 *   k6 run --out json=results.json scripts/load-test.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate, Counter } from 'k6/metrics'

// ─── Configuration ──────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'https://api.coverguard.io'
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN || ''

// ─── Custom metrics ─────────────────────────────────────────────────────────

const healthDuration = new Trend('health_duration', true)
const searchDuration = new Trend('search_duration', true)
const suggestDuration = new Trend('suggest_duration', true)
const propertyDetailDuration = new Trend('property_detail_duration', true)
const riskDuration = new Trend('risk_duration', true)
const insuranceDuration = new Trend('insurance_duration', true)
const insurabilityDuration = new Trend('insurability_duration', true)
const carriersDuration = new Trend('carriers_duration', true)
const reportDuration = new Trend('report_duration', true)
const authMeDuration = new Trend('auth_me_duration', true)
const savedPropertiesDuration = new Trend('saved_properties_duration', true)
const clientsDuration = new Trend('clients_duration', true)
const analyticsDuration = new Trend('analytics_duration', true)
const stripeDuration = new Trend('stripe_duration', true)

const apiErrors = Rate('api_errors')
const apiRequests = Counter('api_requests')

// ─── Thresholds ─────────────────────────────────────────────────────────────

export const options = {
  // Default: smoke test with 5 VUs for 30s
  vus: __ENV.VUS ? parseInt(__ENV.VUS) : 5,
  duration: __ENV.DURATION || '30s',

  thresholds: {
    // Global
    http_req_duration: ['p(95)<5000', 'p(99)<10000'],
    http_req_failed: ['rate<0.05'],

    // Per-endpoint (p95 targets)
    health_duration: ['p(95)<500'],
    search_duration: ['p(95)<3000'],
    suggest_duration: ['p(95)<1000'],
    property_detail_duration: ['p(95)<2000'],
    risk_duration: ['p(95)<5000'],
    insurance_duration: ['p(95)<5000'],
    insurability_duration: ['p(95)<3000'],
    carriers_duration: ['p(95)<3000'],
    report_duration: ['p(95)<8000'],
    auth_me_duration: ['p(95)<2000'],
    saved_properties_duration: ['p(95)<2000'],
    clients_duration: ['p(95)<2000'],
    analytics_duration: ['p(95)<10000'],
    stripe_duration: ['p(95)<2000'],

    // Error rate
    api_errors: ['rate<0.05'],
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
}

function authHeaders() {
  if (!ACCESS_TOKEN) return headers
  return { ...headers, Authorization: `Bearer ${ACCESS_TOKEN}` }
}

function checkResponse(res, name, expectedStatus = 200) {
  apiRequests.add(1)
  const passed = check(res, {
    [`${name}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name}: is JSON`]: (r) => {
      const ct = r.headers['Content-Type'] || ''
      return ct.includes('application/json')
    },
  })
  if (!passed) {
    apiErrors.add(1)
    console.warn(`FAIL ${name}: status=${res.status} body=${res.body.substring(0, 200)}`)
  } else {
    apiErrors.add(0)
  }
  return passed
}

// ─── Stored state (shared across iterations) ────────────────────────────────

let propertyId = ''

// ─── Main test function ─────────────────────────────────────────────────────

export default function () {
  // ── Health ──────────────────────────────────────────────────────────────
  group('Health', () => {
    const res = http.get(`${BASE_URL}/health`)
    healthDuration.add(res.timings.duration)
    checkResponse(res, 'health')
  })

  sleep(0.1)

  // ── Suggest ─────────────────────────────────────────────────────────────
  group('Suggest', () => {
    const res = http.get(`${BASE_URL}/api/properties/suggest?q=miami&limit=5`)
    suggestDuration.add(res.timings.duration)
    checkResponse(res, 'suggest')
  })

  sleep(0.1)

  // ── Search ──────────────────────────────────────────────────────────────
  group('Search', () => {
    const queries = [
      'address=90210',
      'city=Miami&state=FL',
      'address=10001',
      'city=Austin&state=TX',
      'address=77001',
    ]
    const q = queries[Math.floor(Math.random() * queries.length)]
    const res = http.get(`${BASE_URL}/api/properties/search?${q}`)
    searchDuration.add(res.timings.duration)
    checkResponse(res, 'search')

    // Extract property ID for downstream tests
    if (res.status === 200) {
      try {
        const json = JSON.parse(res.body)
        const props = json.data?.properties || json.data?.results || []
        if (props.length > 0 && props[0].id) {
          propertyId = props[0].id
        }
      } catch (e) { /* ignore parse errors */ }
    }
  })

  sleep(0.1)

  // ── Property Detail ─────────────────────────────────────────────────────
  if (propertyId) {
    group('Property Detail', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}`)
      propertyDetailDuration.add(res.timings.duration)
      checkResponse(res, 'property_detail')
    })

    sleep(0.1)

    // ── Risk Profile ────────────────────────────────────────────────────────
    group('Risk Profile', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}/risk`)
      riskDuration.add(res.timings.duration)
      checkResponse(res, 'risk')
    })

    sleep(0.1)

    // ── Insurance Estimate ──────────────────────────────────────────────────
    group('Insurance Estimate', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}/insurance`)
      insuranceDuration.add(res.timings.duration)
      checkResponse(res, 'insurance')
    })

    sleep(0.1)

    // ── Insurability ────────────────────────────────────────────────────────
    group('Insurability', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}/insurability`)
      insurabilityDuration.add(res.timings.duration)
      checkResponse(res, 'insurability')
    })

    sleep(0.1)

    // ── Carriers ────────────────────────────────────────────────────────────
    group('Carriers', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}/carriers`)
      carriersDuration.add(res.timings.duration)
      checkResponse(res, 'carriers')
    })

    sleep(0.1)

    // ── Full Report ─────────────────────────────────────────────────────────
    group('Full Report', () => {
      const res = http.get(`${BASE_URL}/api/properties/${propertyId}/report`)
      reportDuration.add(res.timings.duration)
      checkResponse(res, 'report')
    })
  }

  sleep(0.1)

  // ── Authenticated endpoints ────────────────────────────────────────────
  if (ACCESS_TOKEN) {
    // ── Auth Me ───────────────────────────────────────────────────────────
    group('Auth Me', () => {
      const res = http.get(`${BASE_URL}/api/auth/me`, { headers: authHeaders() })
      authMeDuration.add(res.timings.duration)
      checkResponse(res, 'auth_me')
    })

    sleep(0.1)

    // ── Saved Properties ─────────────────────────────────────────────────
    group('Saved Properties', () => {
      const res = http.get(`${BASE_URL}/api/auth/me/saved`, { headers: authHeaders() })
      savedPropertiesDuration.add(res.timings.duration)
      checkResponse(res, 'saved_properties')
    })

    sleep(0.1)

    // ── Clients List ─────────────────────────────────────────────────────
    group('Clients', () => {
      const res = http.get(`${BASE_URL}/api/clients`, { headers: authHeaders() })
      clientsDuration.add(res.timings.duration)
      // 200 or 403 (subscription required)
      const ok = res.status === 200 || res.status === 403
      check(res, { 'clients: status 200 or 403': () => ok })
      if (ok) apiErrors.add(0)
      else apiErrors.add(1)
      clientsDuration.add(res.timings.duration)
    })

    sleep(0.1)

    // ── Analytics ────────────────────────────────────────────────────────
    group('Analytics', () => {
      const res = http.get(`${BASE_URL}/api/analytics`, { headers: authHeaders() })
      analyticsDuration.add(res.timings.duration)
      const ok = res.status === 200 || res.status === 403
      check(res, { 'analytics: status 200 or 403': () => ok })
      if (ok) apiErrors.add(0)
      else apiErrors.add(1)
    })

    sleep(0.1)

    // ── Stripe Subscription ─────────────────────────────────────────────
    group('Stripe', () => {
      const res = http.get(`${BASE_URL}/api/stripe/subscription`, { headers: authHeaders() })
      stripeDuration.add(res.timings.duration)
      checkResponse(res, 'stripe')
    })
  }

  // Pacing: small pause between iterations to simulate realistic user behavior
  sleep(0.5)
}

// ─── Lifecycle hooks ────────────────────────────────────────────────────────

export function handleSummary(data) {
  // Print a summary table at the end
  const metrics = [
    ['Health', 'health_duration'],
    ['Suggest', 'suggest_duration'],
    ['Search', 'search_duration'],
    ['Property Detail', 'property_detail_duration'],
    ['Risk Profile', 'risk_duration'],
    ['Insurance', 'insurance_duration'],
    ['Insurability', 'insurability_duration'],
    ['Carriers', 'carriers_duration'],
    ['Full Report', 'report_duration'],
    ['Auth Me', 'auth_me_duration'],
    ['Saved Properties', 'saved_properties_duration'],
    ['Clients', 'clients_duration'],
    ['Analytics', 'analytics_duration'],
    ['Stripe', 'stripe_duration'],
  ]

  let table = '\n╔══════════════════════╦═════════╦═════════╦═════════╦═════════╦═══════╗\n'
  table += '║ Endpoint             ║  p50    ║  p90    ║  p95    ║  p99    ║ count ║\n'
  table += '╠══════════════════════╬═════════╬═════════╬═════════╬═════════╬═══════╣\n'

  for (const [name, key] of metrics) {
    const m = data.metrics[key]
    if (!m || !m.values) continue
    const v = m.values
    const p50 = (v['p(50)'] || 0).toFixed(0).padStart(5)
    const p90 = (v['p(90)'] || 0).toFixed(0).padStart(5)
    const p95 = (v['p(95)'] || 0).toFixed(0).padStart(5)
    const p99 = (v['p(99)'] || 0).toFixed(0).padStart(5)
    const count = (v.count || 0).toString().padStart(5)
    table += `║ ${name.padEnd(20)} ║ ${p50}ms ║ ${p90}ms ║ ${p95}ms ║ ${p99}ms ║ ${count} ║\n`
  }

  table += '╚══════════════════════╩═════════╩═════════╩═════════╩═════════╩═══════╝\n'

  const errors = data.metrics.api_errors?.values?.rate || 0
  const requests = data.metrics.api_requests?.values?.count || 0
  table += `\nTotal requests: ${requests}  |  Error rate: ${(errors * 100).toFixed(2)}%\n`

  return {
    stdout: table,
  }
}
