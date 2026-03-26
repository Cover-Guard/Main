# Vercel Deployment — CoverGuard Monorepo

## Architecture

CoverGuard runs as a **single Vercel project**. The Next.js frontend and Express API are deployed together — no cross-origin requests, no separate projects.

```
coverguard/
├── api/
│   └── index.js          # Vercel serverless entry → loads Express app
├── apps/
│   ├── web/              # Next.js 15 frontend (framework output)
│   └── api/              # Express API (bundled by tsup → dist/)
├── packages/
│   └── shared/           # Shared types & utilities
├── vercel.json           # Single unified config
└── turbo.json            # Monorepo build orchestration
```

## How It Works

1. **Build**: `turbo run build` builds all workspaces (shared → api → web)
2. **Prisma**: `prisma generate` runs before build to generate the client
3. **Next.js**: Deployed as the framework — serves all non-API routes
4. **Express API**: Bundled into `apps/api/dist/index.js` by tsup, loaded by the serverless function at `api/index.js`
5. **Routing**: Vercel rewrites forward `/api/*` and `/health` to the serverless function

## Production Branch

Only `main` triggers production deployments (configured in `vercel.json` → `git.deploymentEnabled`).

## Environment Variables

Set these in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase pooled connection (port 6543) |
| `DIRECT_URL` | Yes | Supabase direct connection (for Prisma migrations) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same as SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as SUPABASE_ANON_KEY |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox GL token |
| `NEXT_PUBLIC_SITE_URL` | Yes | e.g. `https://coverguard.io` |
| `ATTOM_API_KEY` | Optional | Property data (mock fallback if absent) |
| `FBI_CDE_KEY` | Optional | Crime data |

**Not needed in production:**
- `NEXT_PUBLIC_API_URL` — API is same-origin, no value needed
- `CORS_ALLOWED_ORIGINS` — same-origin, no CORS needed
- `PORT` — Vercel manages this

## Local Development

```bash
# .env.local (or .env)
NEXT_PUBLIC_API_URL=http://localhost:4000

npm run dev        # Next.js on :3000
npm run dev:all    # Next.js + Express API via Turbo
```

## Troubleshooting

**API routes returning 404?**
- Verify `api/index.js` exists at the repo root
- Check that `turbo run build` produces `apps/api/dist/index.js`
- Confirm Vercel rewrites in `vercel.json` are correct

**Prisma errors on deploy?**
- Ensure `DATABASE_URL` and `DIRECT_URL` are set in Vercel env vars
- The build command runs `prisma generate` before `turbo run build`

**CORS issues?**
- Should not happen — API is same-origin in production
- If using a custom domain, ensure `NEXT_PUBLIC_SITE_URL` matches
