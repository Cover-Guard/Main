# Cross-Cutting Themes — Strategic Enhancement Initiatives

**Source:** `docs/user-gaps-and-needs.md` §2 "Cross-Cutting Themes"
**Purpose:** Three strategic initiatives that cut across personas and features, each anchored in one of the three systemic gaps surfaced in the user-gaps analysis.

Unlike the value-add activities (which are discrete, shippable features), the cross-cutting themes are multi-quarter product bets. Each has its own initiative doc that defines the thesis, the scope, the component workstreams, milestones, success criteria, risks, and dependencies.

## Index

| # | Theme | Initiative | File | Horizon |
|---|---|---|---|---|
| 1 | The data is good; the workflow is thin | **Workflow Fabric** | [`01-workflow-fabric.md`](01-workflow-fabric.md) | 2 quarters |
| 2 | Multi-stakeholder, single-tenant UX | **Role-Based Surfaces** | [`02-role-based-surfaces.md`](02-role-based-surfaces.md) | 2–3 quarters |
| 3 | Reactive, not predictive | **Predictive Intelligence** | [`03-predictive-intelligence.md`](03-predictive-intelligence.md) | 3–4 quarters |

## How this relates to the earlier PRs

The prior two PRs produced a competitor analysis, sales-agent playbook, user-gap map, 20-feature enhancement roadmap, and 8 value-add activity specs. Those are *feature-level* artifacts.

This PR zooms out. It treats the three cross-cutting themes as **investment theses** — each one is a lens through which to evaluate every item in the enhancement roadmap and every value-add activity, and each one gets its own program plan with multiple workstreams and gating milestones.

## Shared Initiative Template

Every cross-cutting initiative doc follows the same skeleton:

1. Thesis
2. Why this is cross-cutting
3. Scope and workstreams
4. Integration with existing roadmap items
5. Milestones
6. Success metrics
7. Risks and mitigations
8. Dependencies
9. Open questions

## Prioritization

The three initiatives are sequenced deliberately:

- **Workflow Fabric first** — without connective tissue, neither role-based surfaces nor predictive intelligence has a place to land.
- **Role-Based Surfaces second** — once the workflow backbone exists, each persona needs a tailored UI.
- **Predictive Intelligence third** — the models earn the right to ship only after the surfaces exist to deliver them without overwhelming the user.

These can overlap by a quarter each; they do not have to run strictly sequentially.
