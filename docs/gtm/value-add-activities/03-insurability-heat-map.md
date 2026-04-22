# 03 — Insurability Heat Map

**Priority:** P1
**Owner:** Web Platform + Geospatial Data
**Effort:** M (5 weeks)

## 1. Summary

A ZIP- or neighborhood-level heat map showing composite insurability at a glance — which areas are hardening, which carriers are pulling out, which are stable. Agents use this as a prospecting tool to identify realtors whose inventory is most at risk and therefore most receptive to a CoverGuard-powered partnership.

## 2. Trigger

User-initiated on the agent dashboard. Filters: metro area, peril focus (flood / fire / wind / all), time window (current / 90-day trend / 1-year trend).

## 3. Audience

- Primary: Sales Agents doing territory planning and realtor prospecting.
- Secondary: Marketing team producing local-SEO content ("Is 94611 insurable?").
- Tertiary: Investors and CRE buyers scanning markets.

## 4. Data Sources

- Carrier availability by ZIP (rollup)
- Peril score averages at ZIP / block-group level
- Time-series deltas (built on top of the #01 delta-detection job)

## 5. UX Surface

- Leaflet / Mapbox heat-map layer.
- Hover: ZIP-level tooltip with top 3 open carriers, top 3 departed carriers (if recent), average composite score.
- Click: drill into a ZIP profile page with trend charts and an agent-prospecting CTA ("10 realtors active in this ZIP — get outreach list").

## 6. Notification / Delivery Rules

- No notifications in v1 — this is an exploration tool.
- Future: weekly "hot markets" email digest powered by the same backing data.

## 7. Success Metrics

- **Engagement:** average session time on heat-map page > 4 minutes.
- **Funnel:** 10% of heat-map sessions produce a prospecting list export.
- **Acquisition:** ZIP-level SEO pages fed by heat-map data become a top-10 acquisition source.

## 8. Dependencies

- ZIP-level geometries (Census TIGER).
- Caching strategy — heat-map tiles pre-rendered nightly.
- Usage rate-limiting to protect backend.

## 9. Out of Scope

- Street-level granularity — privacy and data fidelity concerns.
- Predictive 5-year trend heat map — that's a separate long-bet feature.

## 10. Open Questions

- Do we publish a public version for SEO, or keep it gated behind auth?
- How often do ZIPs need to refresh — daily vs. weekly?
