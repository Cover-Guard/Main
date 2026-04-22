# 05 — Pre-Approval Gate PDF (Lender-Branded)

**Priority:** P0
**Owner:** Lender Partnerships + PDF Rendering
**Effort:** S-M (3 weeks)

## 1. Summary

A one-page, lender-branded CoverGuard PDF that a Loan Officer can drop into a borrower file during pre-approval. It answers one question: "Is this property insurable enough to underwrite the loan?" The document is self-contained, auditable, and formatted to match lender documentation standards.

## 2. Trigger

- LO requests a pre-approval packet by address.
- API call from an LOS integration (Encompass, Blend, ICE — see Tier-2 roadmap).
- Agent sends a pre-approval gate PDF as part of a co-marketing motion.

## 3. Audience

- Primary: Loan Officers and mortgage processors.
- Secondary: Underwriters reviewing the loan file.
- Tertiary: Borrowers reviewing their own file (pass-through).

## 4. Data Sources

- Same underlying CoverGuard report as the standard product
- Lender branding metadata (uploaded on lender onboarding)
- Report signing / timestamp / audit-trail metadata

## 5. UX Surface & Output

- One-page PDF, letter size, lender header + CoverGuard watermark.
- Fields:
  - Property address & assessor ID
  - Bind-path indicator (see spec #04)
  - Available carriers count + top 3 named
  - Indicative premium range
  - Issued timestamp, valid-for window (30 days)
  - Disclaimer block per state (see compliance note below)
  - QR code / URL to full report

## 6. Compliance Note

- State-aware disclaimer block — same engine as the enhancement roadmap's state-aware compliance layer.
- Does NOT constitute an insurance binder or commitment. The PDF must make that explicit.

## 7. Notification / Delivery Rules

- Generated on demand.
- Auto-regenerated if the underlying bind-path flips before the 30-day validity window closes, with a notification to the LO.

## 8. Success Metrics

- **Adoption:** ≥20 lenders enrolled in pilot within 90 days.
- **Volume:** ≥5 pre-approval PDFs / LO / month.
- **Downstream bind rate:** bind rate of properties in pre-approval PDFs vs. those without (target: 15–20% lift attributed to early insurability confirmation).

## 9. Dependencies

- Lender-branding onboarding flow (new UX).
- State-aware disclaimer engine (shared with compliance roadmap).
- PDF rendering pipeline upgrade (reuse the report engine).

## 10. Out of Scope

- Direct binder issuance from the PDF.
- Embedding inside the borrower's loan-doc e-signature package — that's LOS integration work.

## 11. Open Questions

- Do we offer co-branded (LO + Agent) versions or strictly lender-only?
- What's the pricing model — per-PDF, per-seat, or included in an agency SaaS tier?
