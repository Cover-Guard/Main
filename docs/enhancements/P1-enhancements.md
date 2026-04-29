# P1 Enhancements — CoverGuard Sales Agent Positioning

> Generated: 2026-04-27 by scheduled task `marketingsales-agents`.
> Branch: `feature/enhancements-p1`

Each section below is a discrete enhancement spec. Each spec maps to a
user gap from the marketing analysis (see `docs/product/user-gaps-and-needs.md`).

---

# P1 Enhancements — Ship Within Two Quarters

Six features that compound the P0 work. AMS integration leads the list because
it is the single biggest unlock for producer retention and the most defensible
move against AgencyZoom-style downstream encroachment.

| # | Feature | Effort | Closes |
|---|---|---|---|
| 6 | AgencyZoom + Salesforce FSC integration | L (~2 quarters) | AMS integration gap |
| 7 | Mobile-first responsive overhaul + offline mode | M (~1 quarter) | Mobile UX gap |
| 8 | Property watchlist + change alerts | M (~1 quarter) | Monitoring / alerts gap |
| 9 | Plain-language risk narrative | M (~1 quarter) | Risk explainability gap |
| 10 | Comparison view | S (~1 sprint) | Buyer comparison gap |
| 11 | Public trust portal + SOC 2 Type II | L (~2 quarters) | Trust + compliance posture |

---

# P1 #6 — AgencyZoom + Salesforce FSC Integration

**Effort:** L (~2 quarters), phased.
**Closes gap:** AMS integration.
**Why P1:** This is what turns an individual agent's CoverGuard subscription
into an agency-wide one.

## Problem

The producer manually copies a CoverGuard report into the AMS to log activity
against a contact. Without integration, CoverGuard remains a side tool. With
integration, it becomes a standard step in the producer's workflow.

## Proposed solution (phased)

**Phase 1 — AgencyZoom (modern API, fastest path).**

- OAuth-based connection from CoverGuard to the agent's AgencyZoom account.
- Push the CoverGuard report (PDF + structured data) as an attachment on the
  contact / opportunity.
- Two-way sync: contact created in AgencyZoom appears in CoverGuard's recents.

**Phase 2 — Salesforce Financial Services Cloud.**

- Managed package on the AppExchange.
- Custom object for CoverGuard reports.
- Lightning component embedded on the Account / Property page layout.

**Phase 3 (P2) — AMS360 + Applied Epic.**

- See P2 #13. Lower priority because the buying process is slower and the API
  surface is narrower.

## Acceptance criteria (Phase 1)

- AgencyZoom connection completes in <2 minutes from settings.
- Pushed report visible in AgencyZoom within 30 seconds of generation.
- Disconnect / re-auth flows tested.

## Dependencies

- AgencyZoom partnership / app store listing.
- Salesforce ISV account for Phase 2.

---

# P1 #7 — Mobile-First Responsive Overhaul + Offline Mode

**Effort:** M (~1 quarter).
**Closes gap:** Mobile UX.
**Why P1:** The realtor persona cannot adopt without it. Open-house usage is
the main realtor entry point.

## Problem

Realtors will use this on a phone at an open house, often with poor signal.
A desktop-first SaaS with no offline behavior fails this use case.

## Proposed solution

- Mobile-first responsive overhaul of the report and search flows.
- Service worker caches the most recent 50 reports for offline lookup.
- Native-feel UX on mobile Safari and Chrome (no app required at this stage).
- iOS Add-to-Home-Screen story documented.

## Acceptance criteria

- Lighthouse mobile performance score >90 on the report page.
- Offline lookup returns the cached report with a "Last updated <time>" banner.
- Realtor user-test cohort completes a property check at an open house in
  under 90 seconds, on a phone, on cellular.

## Dependencies

- Existing report rendering must be refactored to be SSR/CSR-compatible.

---

# P1 #8 — Property Watchlist + Change Alerts

**Effort:** M (~1 quarter).
**Closes gap:** Monitoring / alerts.
**Why P1:** Turns CoverGuard from a transactional product into a recurring
engagement product, which is the precondition for lower churn.

## Problem

Risk profiles change: wildfire perimeters expand, FEMA maps update, carriers
withdraw from a market. Today the producer or homeowner only sees the change
if they re-run the report. There is no mechanism to surface a material change
on a property they care about.

## Proposed solution

- Save a property to a watchlist (per-user, capped per plan tier).
- Background job re-evaluates watchlisted properties on a schedule (default
  weekly, configurable).
- Email or in-product notification on material change. "Material" defined as:
  peril score change of >10 points, FEMA flood-zone change, carrier appetite
  change, or new wildfire perimeter intersect.

## Acceptance criteria

- Watchlist add/remove from any report in one click.
- Notification preferences configurable.
- Email digest format approved by marketing.
- Quiet-hours respected; no notifications outside the user's local 7am–9pm.

## Dependencies

- Notification infra (shared with P0 #4).

---

# P1 #9 — Plain-Language Risk Narrative

**Effort:** M (~1 quarter).
**Closes gap:** Risk explainability.
**Why P1:** Reduces "I don't understand this report" support load and makes
the buyer-friendly PDF (P0 #2) actually friendly.

## Problem

A peril score of 7/10 means nothing without a story behind it. Agents cannot
answer the buyer's "why is this rated high wind?" question without leaving
the report.

## Proposed solution

- LLM-generated paragraph for each peril, explaining the score, the inputs
  driving it, and what the user should know (action / context).
- Hand-tuned prompts per peril type.
- Eval suite: a labeled dataset of property × peril × expected-narrative
  examples; CI eval threshold before deploys.
- Fallback to template language when the model fails or the inputs are out
  of distribution.
- Human review queue for narratives flagged low-confidence.

## Acceptance criteria

- Every peril section in the report shows a narrative or template.
- Eval pass rate >90% on the labeled set, with PRs blocked below threshold.
- No model output ever shipped without either eval-pass or template fallback.

## Dependencies

- LLM provider chosen and contracted (model + safety).
- Labeled eval dataset (~200 examples to start).

---

# P1 #10 — Comparison View

**Effort:** S (~1 sprint).
**Closes gap:** Buyer comparison.
**Why P1:** Makes the buyer flow more useful and is a near-trivial
engineering lift.

## Problem

A buyer evaluating 2–3 candidate properties cannot easily compare them.
A realtor cannot show "Property A vs. Property B" side-by-side at the
kitchen table.

## Proposed solution

- Pick 2–3 properties from history or watchlist.
- Side-by-side report layout: peril scores, carrier appetite, headline
  insurability summary.
- Mobile-friendly (works with P1 #7 overhaul).
- Exportable as a single PDF.

## Acceptance criteria

- "Compare" CTA visible on report and dashboard.
- Comparison renders in <1.5 seconds for three properties.
- PDF export preserves the side-by-side layout.

## Dependencies

- Existing report data model (no new fetches required).

---

# P1 #11 — Public Trust Portal + SOC 2 Type II

**Effort:** L (~2 quarters), runs in parallel to other P1 work.
**Closes gap:** Trust and compliance posture.
**Why P1:** Prerequisite for selling to lenders, brokerages, and large
agencies. Without this, CoverGuard cannot move upmarket.

## Problem

Property insurance touches PII (addresses, sometimes names, sometimes
financial info). Agents will not send a buyer's data through a vendor that
cannot speak credibly to SOC 2, state insurance privacy law, and DOI
compliance. The gap is the trust posture itself, not just the security work
behind it.

## Proposed solution

- `trust.coverguard.io` style page with: current SOC 2 status, subprocessors
  list, data-handling policy, state-DOI privacy posture, and a clear
  "what we do with your data" statement.
- Pursue SOC 2 Type II audit in parallel; portal updates as the audit progresses.
- Public security.txt and disclosure policy.

## Acceptance criteria

- Trust portal live and indexed.
- SOC 2 Type II audit kicked off; readiness checklist tracked.
- Subprocessor changes auto-trigger a portal update + email to enterprise
  customers (when those customers exist).

## Dependencies

- Compliance vendor selected (Vanta / Drata / Secureframe).
- Outside auditor engaged for SOC 2 Type II.
