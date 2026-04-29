# P0 Enhancements — CoverGuard Sales Agent Positioning

> Generated: 2026-04-27 by scheduled task `marketingsales-agents`.
> Branch: `feature/enhancements-p0`

Each section below is a discrete enhancement spec. Each spec maps to a
user gap from the marketing analysis (see `docs/product/user-gaps-and-needs.md`).

---

# P0 Enhancements — Ship This Quarter

These five features close the gaps that most directly reinforce the Sales Agent
positioning. Each one makes the talk-track in the marketing analysis more
credible. If P0 work slips, the positioning weakens.

| # | Feature | Effort | Closes |
|---|---|---|---|
| 1 | Carrier appetite freshness layer | M (~1 quarter) | Carrier appetite freshness and provenance gap |
| 2 | Buyer-friendly report PDF + share link | S (~1 sprint) | Shareable customer artifacts + explainability |
| 3 | Bulk address upload | S (~1 sprint) | Bulk processing gap |
| 4 | Quote-request status feedback | M (~1 quarter) | Binding-quote handoff feedback gap |
| 5 | Public pricing page + self-serve checkout | S (~1 sprint) | Pricing transparency gap |

If only one P0 must be sacrificed for capacity, sacrifice **#3 (bulk upload)**.
The other four are non-negotiable for credible Sales Agent positioning.

---

# P0 #1 — Carrier Appetite Freshness Layer

**Effort:** M (~1 quarter) — engineering only; partnership work parallel.
**Closes gap:** Carrier appetite freshness and provenance.
**Why P0:** The entire Sales Agent positioning depends on this signal being trusted.

## Problem

Today's appetite signal mixes inferred and scraped sources without surfacing
freshness or provenance. The first time a producer trusts the signal and a
carrier declines a property they were told would write, the producer never
trusts the signal again.

## Proposed solution

- Replace inferred/scraped logic with a tiered source pipeline:
  1. Direct carrier API (where contracted)
  2. MGA / aggregator feed
  3. Public filings as last resort
- Surface a per-row last-updated timestamp and a confidence band (High / Medium / Low).
- Show the source of each appetite row on hover (carrier API / aggregator / public).
- Backend: new `carrier_appetite_signals` table with `source`, `confidence`, `fetched_at`.

## Acceptance criteria

- Every appetite row in the UI shows source + freshness.
- A monitoring alert fires if any source is >24h stale.
- A producer dashboard widget shows aggregate freshness across the active state.
- Documentation page explains the freshness model in plain language.

## Out of scope (deferred to P2 #12)

- Securing direct carrier feeds for the top 25 P&C carriers. This feature
  ships with whatever sources are contracted today; #12 expands coverage.

---

# P0 #2 — Buyer-Friendly Report PDF + Share Link

**Effort:** S (~1 sprint).
**Closes gap:** Shareable customer artifacts; partial explainability.
**Why P0:** Directly enables the realtor and producer to use CoverGuard in the
buyer conversation, which is the highest-leverage moment in the workflow.

## Problem

The current PDF (inferred) is internal-facing. A producer cannot send it to a
prospective insured without manually rewriting the language. Realtors cannot
share it with a buyer without explaining what FEMA flood zone X means.

## Proposed solution

- A second view of the existing risk report with plain-language explanations,
  no jargon.
- Branded PDF export and a CoverGuard-hosted share link.
- Read-receipt analytics: when did the buyer open it, how long did they spend
  on each peril section.
- Optional: agent's contact info in the footer for follow-up.

## Acceptance criteria

- Toggle in the report UI: "Buyer view" / "Agent view."
- Share link is unique per send and expires after 30 days.
- PDF export is white-labelable on the Team plan.
- Read-receipt events visible in the agent's dashboard.

## Dependencies

None. Pure presentation layer over existing risk data.

---

# P0 #3 — Bulk Address Upload

**Effort:** S (~1 sprint).
**Closes gap:** Bulk processing.
**Why P0:** Unlocks the lender / brokerage / aggregator use case at trivial
engineering cost. **This is the only acceptable cut** if P0 capacity is tight.

## Problem

If a lender or realtor sends a producer ten properties to qualify, they run
them one at a time. Producers cannot batch-check insurability across a list
of leads.

## Proposed solution

- CSV upload (address, optional metadata).
- Background job runs each address through the standard report pipeline.
- Email notification when complete; results downloadable as CSV + bundled PDF.
- Up to 100 addresses per upload on the Team plan; 25 on Self-Serve.

## Acceptance criteria

- Upload UI accepts CSV with a documented schema.
- Job status visible in-product (queued / running / done / failed-rows).
- Failed rows reported with reason (invalid address, geocode miss, etc.).
- Output CSV preserves input row order.

## Dependencies

None.

---

# P0 #4 — Quote-Request Status Feedback Loop

**Effort:** M (~1 quarter) — most of the cost is per-carrier integration work.
**Closes gap:** Binding-quote handoff feedback.
**Why P0:** Converts the quote feature from "fire and forget" to a closed
loop, which is the difference between trial and renewal.

## Problem

A producer requests a binding quote through CoverGuard and then has to leave
the platform to find out whether the carrier received it, is quoting it,
declined it, or bound it. This trains them to use CoverGuard for the report
and use other channels for the quote, which kills our quote-rail upside.

## Proposed solution

- Status states: requested / received / quoting / quoted / declined / bound.
- Webhook integrations with each in-network carrier; polling fallback for
  carriers without webhook support.
- Email + SMS notification on state change.
- "Decline reason" captured when available — feeds the appetite-freshness
  signal as ground truth.

## Acceptance criteria

- Every quote request shows a current state visible in-product.
- State transitions logged with timestamp and source.
- Notification preferences configurable per agent.
- At least three carrier integrations live at GA (target list TBD by BD).

## Dependencies

- Carrier BD owns webhook contracts.
- Notification infra (likely SendGrid + Twilio) already in place.

---

# P0 #5 — Public Pricing Page + Self-Serve Checkout

**Effort:** S (~1 sprint).
**Closes gap:** Pricing transparency.
**Why P0:** Removes the largest friction at the top of the funnel; every
week without this is wasted top-of-funnel spend.

## Problem

Pricing is hidden behind a sales call. For an agent buying $49–$399/month,
that is a deal-killer. Competitors with public pricing capture the impulse
sign-ups that we lose.

## Proposed solution

- Public `/pricing` page with three tiers:
  - **Self-Serve** $49–$79/mo (capped at 50 reports/mo).
  - **Team** $199–$399/mo (up to 10 producers, unlimited reports, white-label PDFs).
  - **Enterprise** custom-quoted (lenders, large brokerages, API access).
- Stripe-backed checkout for Self-Serve and Team.
- Annual pre-pay discount of 20%.
- Self-serve account creation flow with verified email + state DOI license check.

## Acceptance criteria

- `/pricing` is publicly accessible, indexed, and ad-friendly.
- Stripe checkout completes in <90 seconds for Self-Serve.
- Team plan supports adding seats post-purchase.
- Receipts and invoices auto-emailed.

## Dependencies

- Pricing must be approved by leadership before publishing.
