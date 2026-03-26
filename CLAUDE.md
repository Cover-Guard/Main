# CLAUDE.md — AI Assistant Guide for CoverGuard

This file provides context and conventions for AI assistants (e.g., Claude Code) working in this repository. **Keep this file updated** as the project evolves.

---

## Project Overview

**CoverGuard** is a property insurability intelligence platform. It lets home buyers, real estate agents, and lenders instantly understand the flood, fire, earthquake, wind, and crime risks for any US property — see which insurance carriers are **actively writing and binding policies** — and **request a binding quote** directly from the platform.

| Detail | Value |
|---|---|
| Repository | `Cover-Guard/Main-Branch` |
| Package manager | npm workspaces (monorepo) |
| Languages | TypeScript everywhere |
| Node version | >= 20 |

---

## Core Product Objective

> Empower agents and consumers to know the insurability and carrier availability for any US property **before placing a bid**, then allow them to request a binding quote from an active carrier.

**Two user portals:**
- **Agent / Team Portal** (`/agents/login`, `/agents/register`) — full dashboard with client management, property comparison, analytics, binding quote requests
- **Consumer / Buyer Portal** (`/login`, `/register`) — simplified search, saved properties, quote requests

---

## Repository Structure

```
Main-Branch/
├── apps/
│   ├── web/                    # Next.js 15 frontend (http://localhost:3000)
│   │   └── src/
│   │       ├── app/            # Next.js App Router pages
│   │       │   ├── page.tsx                    # Landing with dual portal CTAs
│   │       │   ├── (auth)/login|register/      # Consumer auth (email + Google OAuth)
│   │       │   ├── agents/login|register/      # Agent portal auth (email + Google OAuth)
│   │       │   ├── onboarding/page.tsx          # Terms/disclosures acceptance (post-signup)
│   │       │   ├── search/page.tsx              # Split-view: results list + map with risk layers
│   │       │   ├── properties/[id]/             # Property detail: risk + insurability + carriers + quotes
│   │       │   ├── compare/page.tsx             # Side-by-side property comparison (up to 3)
│   │       │   ├── dashboard/page.tsx           # Agent dashboard OR consumer dashboard (role-based)
│   │       │   ├── analytics/page.tsx           # Analytics: searches, risk distribution, activity
│   │       │   ├── account/page.tsx             # Account & settings
│   │       │   └── api/auth/callback/           # Supabase OAuth callback + onboarding redirect
│   │       ├── components/
│   │       │   ├── layout/     # Navbar (sticky, with Search / Dashboard / Analytics / Account)
│   │       │   ├── search/     # SearchBar, SearchResults, PropertyCard (with compare toggle)
│   │       │   ├── property/   # RiskSummary, RiskBreakdown, InsuranceCostEstimate,
│   │       │   │               # InsurabilityPanel, ActiveCarriers, QuoteRequestModal
│   │       │   ├── map/        # PropertyMap (Google Maps + risk layer toggles), PropertyMapInline,
│   │       │   │               # SearchMapClient
│   │       │   ├── dashboard/  # AgentDashboard, ConsumerDashboard, ClientsPanel,
│   │       │   │               # SavedPropertiesPanel
│   │       │   ├── compare/    # CompareView
│   │       │   ├── analytics/  # AnalyticsDashboard
│   │       │   └── account/    # AccountSettings
│   │       └── lib/
│   │           ├── api.ts              # Typed API client
│   │           ├── utils.ts            # cn(), risk color helpers
│   │           ├── useCompare.ts       # localStorage-backed compare state (max 3)
│   │           └── supabase/           # Supabase client / server / middleware
│   │
│   └── api/                    # Express REST API (http://localhost:4000)
│       ├── src/
│       │   ├── index.ts                # Server entry point
│       │   ├── routes/
│       │   │   ├── properties.ts       # /api/properties/* including /insurability /carriers /quote-request
│       │   │   ├── auth.ts             # /api/auth/* + /me/terms
│       │   │   ├── clients.ts          # /api/clients/* (agent client management)
│       │   │   └── analytics.ts        # /api/analytics
│       │   ├── services/
│       │   │   ├── propertyService.ts  # DB + external search
│       │   │   ├── riskService.ts      # Risk scoring + caching
│       │   │   ├── insuranceService.ts # Premium estimation + caching
│       │   │   ├── carriersService.ts  # Active carriers by property/state/risk profile
│       │   │   └── insurabilityService.ts # Insurability assessment from risk profile
│       │   ├── integrations/
│       │   │   ├── propertyData.ts     # ATTOM API (with mock fallback)
│       │   │   └── riskData.ts         # FEMA NFHL, OpenFEMA claims, Cal Fire FHSZ,
│       │   │                           # USFS WUI, USGS Design Maps, NOAA SLOSH,
│       │   │                           # FBI CDE, ASCE 7 wind speed
│       │   ├── middleware/
│       │   │   ├── auth.ts             # Supabase JWT verification
│       │   │   └── errorHandler.ts     # Central error handler
│       │   └── utils/
│       │       ├── prisma.ts           # Singleton Prisma client
│       │       ├── supabaseAdmin.ts    # Service-role Supabase client
│       │       └── logger.ts           # Winston logger
│       └── prisma/
│           ├── schema.prisma           # DB schema (see models below)
│           └── seed.ts                 # Sample data seed
│
├── packages/
│   └── shared/                 # Internal package shared across apps/api and apps/web
│       └── src/
│           ├── types/
│           │   ├── property.ts     # Property, PropertyType, search params
│           │   ├── risk.ts         # PropertyRiskProfile, FloodRisk, FireRisk, etc.
│           │   ├── insurance.ts    # InsuranceCostEstimate, InsurabilityStatus,
│           │   │                   # Carrier, CarriersResult, CarrierWritingStatus, MarketCondition
│           │   ├── user.ts         # User, Client, ClientStatus, SavedProperty,
│           │   │                   # PropertyReport, AnalyticsSummary
│           │   └── api.ts          # ApiResponse
│           ├── utils/          # formatters.ts, validators.ts
│           └── constants/      # Risk thresholds, US states, cache TTLs
│
├── .github/workflows/
├── docker-compose.yml
├── turbo.json
├── .env.example
└── CLAUDE.md
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | Turborepo | Task caching and parallelism |
| Frontend | Next.js 15, TypeScript, Tailwind CSS | App Router, Server Components |
| Backend | Express 4, TypeScript, Node 20 | REST API |
| Database | Supabase (PostgreSQL) | Hosted; no local Postgres needed |
| Auth | Supabase Auth | Email/password + Google OAuth |
| ORM | Prisma 6 | Schema migrations + type-safe queries |
| Maps | Google Maps / @vis.gl/react-google-maps | Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Validation | Zod | API routes + frontend forms |
| HTTP client | `fetch` (native) | API integrations + web lib/api.ts |
| Logging | Winston | JSON in production, colorized in dev |

---

## Key DB Models

| Model | Purpose |
|---|---|
| `User` | Auth profile, role, `termsAcceptedAt` |
| `Property` | Property data (ATTOM or manual) |
| `RiskProfile` | Cached risk scores (flood/fire/wind/eq/crime) |
| `InsuranceEstimate` | Cached premium estimates |
| `SavedProperty` | User's saved properties with notes/tags |
| `Client` | Agent → client relationship |
| `QuoteRequest` | Binding quote request to a carrier |
| `PropertyReport` | Generated PDF reports |
| `SearchHistory` | Search audit trail |

---

## Authentication & Onboarding Flow

1. New user registers via `/register` (consumer) or `/agents/register` (agent) — email/password or Google OAuth
2. After registration → redirected to `/onboarding` — **must accept terms and disclosures** before using the platform
3. `termsAcceptedAt` stored in Supabase `user_metadata` AND in the `User.termsAcceptedAt` DB column (via `POST /api/auth/me/terms`)
4. For OAuth sign-ins: `api/auth/callback` route checks `user.user_metadata.termsAcceptedAt`; if absent → redirects to `/onboarding`
5. Returning users sign in via `/login` or `/agents/login` → skip onboarding
6. Middleware (in `lib/supabase/middleware.ts`) protects `/dashboard`, `/analytics`, `/account`, `/compare`

---

## API Endpoints

```
GET  /api/properties/search                 Search (address/zip/parcelId)
GET  /api/properties/:id                    Property detail
GET  /api/properties/:id/risk               Risk profile (FEMA/USGS/etc.)
GET  /api/properties/:id/insurance          Insurance cost estimate
GET  /api/properties/:id/insurability       Insurability assessment
GET  /api/properties/:id/carriers           Active carriers (by state + risk)
POST /api/properties/:id/save               Save property [auth]
DEL  /api/properties/:id/save               Unsave property [auth]
POST /api/properties/:id/quote-request      Request binding quote [auth]
GET  /api/properties/:id/quote-requests     List quote requests [auth]
GET  /api/properties/:id/report             Full report bundle

POST /api/auth/register                     Register
GET  /api/auth/me                           Current user [auth]
PATCH /api/auth/me                          Update profile [auth]
POST /api/auth/me/terms                     Accept terms [auth]
GET  /api/auth/me/saved                     Saved properties [auth]
GET  /api/auth/me/reports                   Reports [auth]

GET  /api/clients                           List clients [auth]
POST /api/clients                           Add client [auth]
PATCH /api/clients/:id                      Update client [auth]
DEL  /api/clients/:id                       Delete client [auth]

GET  /api/analytics                         Analytics summary [auth]
```

---

## Public Data Source Integrations

| Source | Data | Notes |
|---|---|---|
| FEMA NFHL | Flood zones, SFHA, BFE | `hazards.fema.gov/gis/nfhl` |
| OpenFEMA Claims | Historical flood claims by ZIP | `fema.gov/api/open/v2/nfipClaims` |
| Cal Fire FHSZ | CA fire hazard severity zones | `services1.arcgis.com` — CA only |
| USFS WUI | Wildland-Urban Interface (all states) | `apps.fs.usda.gov/arcx` |
| USGS Design Maps | Seismic (ASCE 7-22 spectral acceleration) | `earthquake.usgs.gov/ws/designmaps` |
| NOAA SLOSH | Hurricane surge zones | `coast.noaa.gov/arcgis` — coastal only |
| FBI CDE | Crime rates by agency/jurisdiction | `api.usa.gov/crime/fbi/cde` — needs `FBI_CDE_KEY` |
| ASCE 7 | Design wind speed | Computed from lat/state |

---

## Environment Variables

All in `.env.example`. Key additions:

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Web | Map in search and property pages |
| `FBI_CDE_KEY` | API | FBI Crime Data Explorer (optional) |
| `SUPABASE_URL` | API, Web | Supabase project URL |
| `SUPABASE_ANON_KEY` | API, Web | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | Never expose to browser |
| `DATABASE_URL` | API (Prisma) | Direct PostgreSQL connection |
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web | Same as anon key |
| `ATTOM_API_KEY` | API | Optional — mock data used if absent |

---

## Development Workflow

```bash
npm install
npm run dev            # web :3000, api :4000
npm run typecheck
npm run lint
npm run test

# After schema.prisma changes (Client, QuoteRequest, User.termsAcceptedAt added):
npm run db:migrate:dev -- --name add-clients-quotes-terms
npm run db:seed
npm run db:studio      # Prisma Studio GUI
```

---

## Git Conventions

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready |
| `claude/<desc>-<sessionId>` | AI-generated branches |
| `feature/<desc>` | Human feature branches |

- **Never push to `main` or `master`**
- Commits are **SSH-signed** — never pass `--no-gpg-sign`
- AI assistants must work on their designated `claude/` branch

---

## Notes for AI Assistants

1. **Read before editing.** Always read a file before modifying it.
2. **Minimal changes.** Only change what is requested; avoid refactoring unrelated code.
3. **Stay in shared types.** New data shapes go in `packages/shared/src/types/`.
4. **Supabase admin is server-only.** Never import `supabaseAdmin` from frontend code.
5. **Check your branch.** Work on the designated `claude/` branch.
6. **No secrets.** Never commit `.env` files or API keys.
7. **DB migrations needed.** After any `schema.prisma` change, run `db:migrate:dev`.
8. **Two portals.** Agent flows use `/agents/*`; consumer flows use `/(auth)/*`.
9. **Onboarding required.** New users must accept terms at `/onboarding` before accessing the app.
10. **Keep this file updated.** After adding routes, models, or patterns, update the relevant section.
