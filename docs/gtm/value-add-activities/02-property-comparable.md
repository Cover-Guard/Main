# 02 — Property Comparable Insurability Score

**Priority:** P1
**Owner:** Risk Intelligence + Web Platform
**Effort:** M (4 weeks)

## 1. Summary

Let a realtor or buyer compare two (and up to four) properties side-by-side on a single CoverGuard surface, with a normalized insurability score, a peril-by-peril diff, and an expected-premium comparison. This turns CoverGuard from a one-property diagnostic into a decision tool for the buy-side.

## 2. Trigger

- Realtor adds a second address to an existing report.
- Buyer clicks "Compare with another property" from the freemium viewer.
- API consumer (MLS embed) passes a list of addresses.

## 3. Audience

- Primary: Realtors comparing listings for a client.
- Secondary: Buyers evaluating between homes.
- Tertiary: Commercial RE underwriters doing portfolio triage (bulk mode is a separate spec).

## 4. Data Sources

Existing per-property data stack:

- Peril scores (flood, fire, EQ, wind, crime)
- Carrier availability
- Indicative premium ranges (when computed)

New composite: a normalized 0–100 Comparable Insurability Score so two properties can be ranked.

## 5. UX Surface

- Split-screen or 2–4 column table view.
- Color-coded peril diff (green = better, red = worse).
- "Why this matters" plain-English explanation under each material difference.
- CTA: "Which do you want to run a full quote on?" → routes to the bind path.

## 6. Notification / Delivery Rules

- In-session only. No notifications — this is a tool, not an alert.
- Comparisons persist in the user's history for 30 days.

## 7. Success Metrics

- **Usage:** ≥15% of reports initiated become two-property comparisons.
- **Conversion:** Comparisons that produce a quote request at 2x the rate of single-property reports.
- **Share rate:** Realtor share-with-buyer click rate on comparison view.

## 8. Dependencies

- Composite insurability score model (new model work, needs calibration).
- UI framework for side-by-side view.

## 9. Out of Scope

- More than 4 properties — portfolio-scale is a separate CRE feature.
- Transaction-cost modeling (mortgage, tax) — out of CoverGuard's remit.

## 10. Open Questions

- How much weight does carrier availability get in the composite vs. raw peril scores?
- Do we show premium ranges before a full quote? What's the accuracy floor before we display?
