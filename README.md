# CoverGuard

**Property Insurability Intelligence Platform**

CoverGuard lets buyers, agents, and lenders instantly understand the true insurance cost of any US property before placing a bid. Enter an address and get a full risk profile — flood, fire, wind, earthquake, and crime — alongside detailed insurance cost estimates.

---

## Stack

| Layer | Technology |
|---|---|
| Monorepo | [Turborepo](https://turbo.build) |
| Frontend | [Next.js 15](https://nextjs.org) + TypeScript + Tailwind CSS |
| Backend API | Node.js + [Express](https://expressjs.com) + TypeScript |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Auth | Supabase Auth |
| ORM | [Prisma](https://prisma.io) |
| Shared Types | `packages/shared` internal package |
| Containerization | Docker + docker-compose |
| CI/CD | GitHub Actions |

---

## Project Structure

```
coverguard/
├── apps/
│   ├── web/              # Next.js 15 frontend (port 3000)
│   └── api/              # Express REST API (port 4000)
├── packages/
│   └── shared/           # Shared TypeScript types, utils, constants
├── .github/workflows/    # CI (typecheck, lint, test, build) + Deploy
├── docker-compose.yml    # Local dev stack
└── CLAUDE.md             # AI assistant guide
```

---

## Quick Start

### Prerequisites

- Node.js >= 20
- npm >= 10
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <repo-url>
cd coverguard
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase URL, anon key, service role key, and DATABASE_URL
```

### 3. Set up the database

```bash
# Push schema to Supabase
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Start development servers

```bash
npm run dev
# web -> http://localhost:3000
# api -> http://localhost:4000
```

Or with Docker:

```bash
docker compose up
```

---

## API Reference

Base URL: `http://localhost:4000`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | -- | Health check |
| `POST` | `/api/auth/register` | -- | Create user account |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `PATCH` | `/api/auth/me` | Bearer | Update profile |
| `GET` | `/api/auth/me/saved` | Bearer | Saved properties |
| `GET` | `/api/properties/search?address=...` | -- | Search properties |
| `GET` | `/api/properties/:id` | -- | Property detail |
| `GET` | `/api/properties/:id/risk` | -- | Risk profile |
| `GET` | `/api/properties/:id/insurance` | -- | Insurance estimate |
| `GET` | `/api/properties/:id/report` | -- | Full report (property + risk + insurance) |
| `POST` | `/api/properties/:id/save` | Bearer | Save property |
| `DELETE` | `/api/properties/:id/save` | Bearer | Unsave property |

Authentication uses **Supabase JWT access tokens** passed as `Authorization: Bearer <token>`.

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Copy the project URL and keys into `.env`
3. Set **two** database connection strings in `.env` (see `.env.example` for full format):
   - `DATABASE_URL` — the **Connection Pooler** URL (pgBouncer, Transaction Mode, port 6543).
     Used by the application at runtime for all database queries.
   - `DIRECT_URL` — the **Direct connection** URL (port 5432).
     Used by Prisma exclusively for migrations and schema introspection.
4. Run `npm run db:migrate` to push the Prisma schema

Required secrets in GitHub Actions:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL          # pgBouncer / Connection Pooler URL (production queries)
DIRECT_URL            # Direct PostgreSQL connection URL (migrations only)
```

---

## Risk Data Sources

| Risk Type | Source | Notes |
|---|---|---|
| Flood | FEMA NFHL | Public API |
| Fire | Cal Fire FHSZ | CA only; national data planned |
| Earthquake | USGS NSHM | ASCE 7-22 design values |
| Wind / Hurricane | ASCE 7 + NOAA | State-based heuristics |
| Crime | FBI UCR | Requires API registration |
| Property data | ATTOM | Commercial -- set ATTOM_API_KEY; mock data used if unset |

---

## Development Scripts

```bash
npm run dev          # Start all services
npm run build        # Build all packages
npm run test         # Run all tests
npm run lint         # Lint all packages
npm run typecheck    # TypeScript check all packages
npm run db:migrate   # Apply Prisma migrations
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio
```

---

## Contributing

1. Branch from `main` using the pattern `feature/<description>` or `fix/<description>`
2. Open a pull request against `main`
3. CI must pass (typecheck + lint + test + build)
4. At least one review required before merge

See [CLAUDE.md](./CLAUDE.md) for AI assistant guidelines.
