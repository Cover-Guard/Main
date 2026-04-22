# 04 — Bind-Path Indicator (Green / Yellow / Red)

**Priority:** P0
**Owner:** Risk Intelligence + Carrier Data
**Effort:** S (1–2 weeks)

## 1. Summary

Every CoverGuard report shows a prominent Green / Yellow / Red "Bind Path" indicator at the top. It compresses the full carrier-availability + peril-profile picture into a single signal an agent or realtor can read in less than a second. The underlying data already exists — this is a UI surface and a classification rule.

## 2. Trigger

Computed on every report generation. Re-computed on any carrier appetite change for that ZIP.

## 3. Audience

- Every report viewer: Sales Agent, Realtor, Loan Officer, Buyer.

## 4. Data Sources

- Carrier availability by ZIP (existing)
- Peril score thresholds (existing)
- Historical bind success rate by ZIP and composite risk band (new rollup)

## 5. Classification Rule (v1)

| Color | Condition |
|---|---|
| 🟢 Green | ≥ 5 carriers currently open in the ZIP AND no peril score above "high" |
| 🟡 Yellow | 2–4 carriers open OR exactly one peril score above "high" |
| 🔴 Red | ≤ 1 carrier open OR ≥ 2 peril scores above "high" OR confirmed non-renewal pattern in ZIP |

Hysteresis built in: a property must meet the Yellow criteria for 3 consecutive days before downgrading from Green, to prevent flicker.

## 6. UX Surface

- Badge in the report header and in the PDF export.
- One-line explanation under the badge: "Yellow — 3 carriers open, fire score is Very High. Expect 1–2 re-quotes."
- Hover / tap reveals carriers driving the classification.

## 7. Success Metrics

- **Comprehension:** post-report survey — >85% of users correctly interpret the indicator on first view.
- **Trust:** agent complaint rate < 2% on "bind path was wrong."
- **Conversion:** Green reports produce a quote request at a materially higher rate than Red, without suppressing Red entirely (keep the transparency).

## 8. Dependencies

- Report rendering pipeline (must add badge component).
- PDF export (must include badge).
- Delta watch tie-in (see spec #01) so a Red → Green transition fires a re-notification.

## 9. Out of Scope

- Real-time underwriting-decision simulation — that's the long-term AI Bind Agent feature.
- Carrier-specific bind paths — v1 is single aggregated badge.

## 10. Open Questions

- Should a Red bind path auto-suggest the top-3 E&S markets?
- Do we expose the classification rule publicly, or keep it opaque?
