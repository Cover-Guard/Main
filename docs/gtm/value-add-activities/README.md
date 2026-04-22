# Value-Add Activities — Implementation Specs

**Source:** `docs/user-gaps-and-needs.md` §3 "Value-Add Activities to Surface in the Platform UI"
**Purpose:** Each of the eight value-add activities has a dedicated spec below describing the trigger, audience, data sources, UX surface, notification rules, success metrics, and open questions.

## Index

| # | Activity | Spec | Priority |
|---|---|---|---|
| 1 | Carrier just exited your ZIP — alert | [`01-carrier-exit-alert.md`](01-carrier-exit-alert.md) | P0 |
| 2 | Property comparable insurability score | [`02-property-comparable.md`](02-property-comparable.md) | P1 |
| 3 | Insurability heat map | [`03-insurability-heat-map.md`](03-insurability-heat-map.md) | P1 |
| 4 | Bind-path indicator | [`04-bind-path-indicator.md`](04-bind-path-indicator.md) | P0 |
| 5 | Pre-approval gate PDF | [`05-pre-approval-gate.md`](05-pre-approval-gate.md) | P0 |
| 6 | Mitigation savings calculator | [`06-mitigation-savings.md`](06-mitigation-savings.md) | P0 |
| 7 | Re-shop opportunity feed | [`07-reshop-opportunity-feed.md`](07-reshop-opportunity-feed.md) | P1 |
| 8 | Realtor leaderboard | [`08-realtor-leaderboard.md`](08-realtor-leaderboard.md) | P2 |

## Priority Legend

- **P0** — Ship in the next 30 days. Data already exists, UI surface only.
- **P1** — Ship in next 60–90 days. Requires new data joins or modeling.
- **P2** — Ship in next 120+ days. Depends on upstream CRM / book-of-business data.

## Spec Template

Every activity spec follows a common skeleton:

1. Summary
2. Trigger
3. Audience
4. Data sources
5. UX surface
6. Notification / delivery rules
7. Success metrics
8. Dependencies
9. Out of scope
10. Open questions
