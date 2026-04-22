# 06 — Mitigation Savings Calculator

**Priority:** P0
**Owner:** Risk Intelligence + Carrier Data
**Effort:** M (4 weeks)

## 1. Summary

An interactive calculator embedded in every report that tells the homeowner (and the agent) which mitigations could materially reduce the expected premium — e.g. "Install hurricane shutters → save an estimated $1,840/yr." The calculator creates a natural re-quote reason, drives buyer engagement, and gives the agent a reason to follow up.

## 2. Trigger

- Loaded on every report by default (minimized).
- User expands it to explore.
- Auto-expands on reports with Yellow / Red bind paths.

## 3. Audience

- Primary: Homeowner / Buyer — direct motivation to mitigate.
- Secondary: Agent — re-quote trigger.
- Tertiary: Realtor — enables "this home just needs X" conversation.

## 4. Data Sources

- FORTIFIED / IBHS mitigation discount catalog
- State-level mitigation credit programs (e.g. FL Hurricane Loss Mitigation program)
- Carrier-specific mitigation discount tables (where negotiated / public)
- Property attributes (roof type, year built, etc.) from the existing report

## 5. Calculator Logic

1. For each applicable mitigation action (shutters, roof strap, defensible space, etc.), look up the expected carrier discount band.
2. Intersect with carriers actually open for the ZIP.
3. Apply to the current expected premium range.
4. Return estimated annualized savings + one-time investment cost + payback window.

## 6. UX Surface

- Card on the report: "3 ways to lower this property's premium."
- Expanded view: toggle list of mitigations with estimated savings, investment cost, and payback in years.
- CTA: "Re-run the quote assuming these are installed."

## 7. Success Metrics

- **Engagement:** ≥40% of viewers expand the calculator on Yellow/Red reports.
- **Re-quote rate:** ≥15% of expanded-calculator sessions produce a re-quote within 30 days.
- **Agent follow-up:** tracked as outbound touches in agent dashboard.

## 8. Dependencies

- Mitigation-discount dataset (licensing or partner with FORTIFIED / IBHS).
- Carrier discount negotiations (ongoing, partial rollout acceptable).
- Report UI — new collapsible card component.

## 9. Out of Scope

- Connecting homeowner to a contractor / vendor marketplace (long-term add-on).
- Verifying mitigation work was actually completed (insurance-inspection territory).

## 10. Disclaimers

- Estimated savings are projections, not binding commitments.
- Actual premium reduction depends on carrier underwriting and inspection.
- Must carry a plain-English "estimate only" label.

## 11. Open Questions

- What's the minimum-accuracy bar we require before shipping a number?
- Do we surface the Tier 2 mitigation set (solar, reinforced roofs) in v1 or defer?
