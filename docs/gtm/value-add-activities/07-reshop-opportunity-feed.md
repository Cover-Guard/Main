# 07 — Re-Shop Opportunity Feed

**Priority:** P1
**Owner:** Agent Platform + Carrier Data
**Effort:** M (5 weeks)

## 1. Summary

A ranked feed, shown inside the agent dashboard, of policies in the agent's existing book of business most likely to benefit from a re-shop in the next 30–60 days. Each card explains *why* it was flagged and provides one-click actions to run a replacement quote.

## 2. Trigger

- Book-of-business upload or AMS sync.
- Nightly re-scoring job.
- Carrier appetite changes (from spec #01 pipeline) cause immediate promotions.

## 3. Audience

- Primary: Sales Agents with an active book.
- Secondary: Agency principals running retention-focused campaigns.

## 4. Data Sources

- Agent book of business (upload or AMS sync)
- Carrier-availability history (same pipeline as spec #01)
- Public rate-filing data (SERFF) to detect carrier-wide rate increases
- Policy renewal-date metadata (from the AMS)

## 5. Scoring Signals

| Signal | Weight |
|---|---|
| Current carrier partially or fully exited the ZIP | High |
| Carrier filed ≥ 10% rate increase affecting this ZIP | High |
| Policy renewal inside the next 45 days | Medium |
| Composite peril score worsened vs. when policy was written | Medium |
| Better-appetite carrier has newly opened in the ZIP | Medium |
| Time since last re-shop | Low |

Composite score produces a ranked list. Top N per agent displayed on the dashboard.

## 6. UX Surface

- "Re-shop opportunities" card on the agent dashboard.
- Each row: policyholder, current carrier, renewal date, reason chip(s), CTA "Run replacement quote."
- Export to CSV / campaign tool.

## 7. Success Metrics

- **Coverage:** ≥75% of uploaded policies get a score.
- **Conversion:** ≥10% of feed items produce a replacement quote within 30 days.
- **Retention lift:** measurable reduction in non-renewed policies for agents using the feed vs. those not.

## 8. Dependencies

- AMS sync connector (AMS360, QQCatalyst) — partial coverage acceptable for v1.
- SERFF data ingest (rate filings).
- Book-of-business import UX (already in the Tier-2 roadmap).

## 9. Out of Scope

- Auto-remarketing without agent consent.
- Cross-sell recommendations (auto, umbrella) — separate feature.

## 10. Open Questions

- How do we weight signals for renewal-heavy vs. non-renewal-heavy markets?
- Should the feed be collaborative at the agency level (principal can see everyone's feed) or strictly per-agent?
