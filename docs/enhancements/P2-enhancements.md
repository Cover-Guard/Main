# P2 Enhancements — CoverGuard Sales Agent Positioning

> Generated: 2026-04-27 by scheduled task `marketingsales-agents`.
> Branch: `feature/enhancements-p2`

Each section below is a discrete enhancement spec. Each spec maps to a
user gap from the marketing analysis (see `docs/product/user-gaps-and-needs.md`).

---

# P2 Enhancements — Ship Within a Year

Larger bets that depend on partnerships or organizational maturity. Sequenced
so each unlocks a new revenue line or persona that prior tiers prepared for.

| # | Feature | Effort | Closes |
|---|---|---|---|
| 12 | Direct carrier API integrations, top 25 P&C | XL (multi-quarter) | Carrier appetite depth |
| 13 | AMS360 + Applied Epic integrations | L (~2 quarters) | AMS gap (long tail) |
| 14 | Lender / LOS integration + audit trail | XL (multi-quarter) | Lender-LOS embedding |
| 15 | MLS / brokerage embeds | L (~2 quarters) | Real-estate-tech integration |
| 16 | Book-of-business / portfolio dashboard | M (~1 quarter) | Portfolio view |
| 17 | Disclosure-trail compliance for realtors | S (~1 sprint) | Auditable disclosure trail |
| 18 | Agent directory / referral handoff | S (~1 sprint) | Agent directory + lead-gen flywheel |

---

# P2 #12 — Direct Carrier API Integrations (Top 25 P&C)

**Effort:** XL — ongoing, multi-quarter, partnership-heavy.
**Closes gap:** Carrier appetite depth and provenance.
**Why P2:** The single largest moat-building investment on the roadmap.

## Problem

P0 #1 ships freshness + provenance over whatever sources are contracted today.
The strategic ceiling on the appetite signal is the percentage of the top 25
P&C carriers reachable via direct API. Inferred / scraped sources have a hard
quality ceiling.

## Proposed solution

- BD-led: contract with the top 25 P&C carriers in CoverGuard's target states.
- Engineering-led: per-carrier integration adapters following a shared interface.
- Per-carrier confidence + freshness already exposed via P0 #1 surface.

## Acceptance criteria (rolling)

- 5 direct integrations live by Q+2.
- 15 by Q+4.
- 25 by Q+6.

## Dependencies

- P0 #1 (freshness layer must exist first).
- BD / Partnerships staffing.

---

# P2 #13 — AMS360 + Applied Epic Integrations

**Effort:** L (~2 quarters).
**Closes gap:** AMS integration (long tail).
**Why P2:** Lower-priority than AgencyZoom (P1 #6) because the buying process
is slower and the API surface narrower, but a must-have for top-100 agency
adoption.

## Problem

The legacy AMS systems run the largest agencies. CoverGuard cannot move
upmarket without integration here.

## Proposed solution

- AMS360: integration via Vertafore's published APIs.
- Applied Epic: integration via Applied API.
- Same payload shape as the AgencyZoom integration to minimize maintenance.

## Acceptance criteria

- AMS360: report attaches to the policy / contact record.
- Applied Epic: same.
- Both integrations work with single-sign-on at the agency tenant level.

## Dependencies

- P1 #6 (data shape and shared adapter pattern).
- Vertafore developer-program approval.
- Applied developer-program approval.

---

# P2 #14 — Lender / LOS Integration + Audit Trail

**Effort:** XL.
**Closes gap:** Lender-LOS embedding plus regulatory-grade audit trail.
**Why P2:** Unlocks the lender persona and a separate enterprise revenue line.
Depends on prior P0/P1 trust posture being in place.

## Problem

Lenders need an audit trail showing the property was insurable at origination,
embedded in the LOS workflow they already use (Encompass, BytePro, etc.).

## Proposed solution

- Encompass partner integration: CoverGuard report attached to the loan file
  with tamper-evident audit metadata (who ran it, when, what data sources).
- BytePro integration as second wedge.
- Separate enterprise SKU (volume-based pricing).
- Audit log designed to satisfy regulatory examination — immutable storage,
  signed timestamps, exportable.

## Acceptance criteria

- Encompass integration GA with at least one reference customer.
- Audit-log export passes a third-party compliance review.
- Enterprise SKU pricing model approved.

## Dependencies

- P1 #11 (trust portal + SOC 2 Type II).
- Sales motion staffed for enterprise.

---

# P2 #15 — MLS / Brokerage Embeds (kvCORE, Compass, Follow Up Boss)

**Effort:** L (~2 quarters).
**Closes gap:** Real-estate-tech integration.
**Why P2:** Turns the realtor adoption motion from outbound to embedded.

## Problem

Realtors live inside their MLS / CRM. CoverGuard is a separate tab and
therefore optional. Embedding makes it a default field alongside square
footage and HOA dues.

## Proposed solution

- kvCORE app/widget: a CoverGuard component that renders on the property card.
- Compass partner integration via their plugin program.
- Follow Up Boss: native or zap-style integration depending on their API maturity.

## Acceptance criteria

- At least one embed live with a brokerage reference customer.
- Embed loads in <1 second on the property card.
- Realtor can deep-link from the embed to the full CoverGuard report.

## Dependencies

- P0 #2 (buyer-friendly view) — embeds default to that view.
- P1 #7 (mobile-first).

---

# P2 #16 — Book-of-Business / Portfolio Dashboard

**Effort:** M (~1 quarter).
**Closes gap:** Portfolio view.
**Why P2:** The long-arc agency-revenue product, but only valuable after
watchlist / alerts (P1 #8) and AMS integration (P1 #6) land first.

## Problem

Producers, realtors, and lenders all eventually have a portfolio of
properties they care about. CoverGuard is a single-property tool today.

## Proposed solution

- Producer / agency-level dashboard:
  - Insurability scores across all in-force policies (sourced from AMS).
  - Change alerts at the portfolio level.
  - Retention-risk indicators (carrier withdrawals, peril score changes that
    suggest non-renewal).
- Filter by state, peril, carrier, producer.

## Acceptance criteria

- Dashboard loads <2 seconds for portfolios up to 5,000 policies.
- Daily change-alerts batch with delta summary.
- Producer can drill from a portfolio row to the full report.

## Dependencies

- P1 #6 (AMS integration is the data source).
- P1 #8 (alerts mechanics).

---

# P2 #17 — Disclosure-Trail Compliance Feature for Realtors

**Effort:** S (~1 sprint).
**Closes gap:** Auditable disclosure trail.
**Why P2:** Sells to brokerage compliance teams; small engineering effort,
big legal-credibility lift.

## Problem

A realtor's brokerage may want compliance — proof that the realtor disclosed
insurability risk to the buyer at offer time. This reduces E&O exposure for
the brokerage and de-risks high-peril-state transactions.

## Proposed solution

- A buyer-signed acknowledgment ("I was shown a CoverGuard insurability
  report on [property] on [date]") generated from the share-link flow (P0 #2).
- E-signature via existing share-link UX (DocuSign-style, lightweight).
- Storage in CoverGuard with audit trail.

## Acceptance criteria

- Buyer can sign in <30 seconds from the share-link email.
- Realtor / brokerage can pull a disclosure log per property.
- Signed acknowledgment exportable as PDF.

## Dependencies

- P0 #2 (share link).
- P1 #11 (trust portal — disclosure storage policy).

---

# P2 #18 — Agent Directory / Referral Handoff

**Effort:** S (~1 sprint).
**Closes gap:** Agent directory + lead-gen flywheel.
**Why P2:** Paid producers' demand for leads becomes a revenue stream and
a producer acquisition channel.

## Problem

A buyer who runs a free check on a property has nowhere to go inside
CoverGuard to find an agent who can quote them. The intent is wasted.

## Proposed solution

- Opt-in directory of CoverGuard-using producers, filtered by state and
  property type.
- Referral handoff flow: buyer requests a quote → CoverGuard matches a
  producer → producer pays per qualified lead.
- Quality controls: producer rating, lead acceptance rate, refund policy
  for bad leads.

## Acceptance criteria

- Producer can opt in and configure coverage states / lead caps.
- Buyer match completes in <5 seconds.
- Referral pricing transparent to both sides.

## Dependencies

- P0 #5 (self-serve checkout — billing infra).
