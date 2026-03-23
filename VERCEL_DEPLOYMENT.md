# Vercel Deployment Configuration for CoverGuard Monorepo

## Problem: 404 Error

You were getting a 404 error because Vercel was trying to serve from the repository root, but your Next.js app is located in `apps/web/`.

## Solution: vercel.json Configuration

I've created a `vercel.json` file that configures Vercel to properly route to your monorepo applications.

### Current Setup

**Repository Structure:**
```
coverguard/
├── apps/
│   ├── web/          # Next.js frontend (port 3000 in dev)
│   └── api/          # Node.js backend (port 4000 in dev)
├── packages/
│   └── shared/       # Shared utilities & types
├── package.json      # Root with Turborepo workspace config
└── vercel.json       # NEW: Vercel deployment config
```

## How It Works

### Production Deployment (via vercel.json)
- **Web App**: Built using Turborepo (`npx turbo run build --filter=@coverguard/web...`), which first compiles `@coverguard/shared` and then runs `next build` in `apps/web/`
- **Output**: Next.js app served from `apps/web/.next`
- **Note**: The API (`apps/api`) is deployed separately (e.g., via Docker/Railway) and is not part of the Vercel deployment

### Local Development (via turbo.json)
When you run `npm run dev`, Turborepo orchestrates:
1. Next.js dev server on port 3000 (`apps/web`)
2. Node.js API server on port 4000 (`apps/api`)

## Configuration Details

Two `vercel.json` files cover both Vercel project root configurations:

- **`/vercel.json`** — for projects where the repo root is the Vercel root directory
- **`/apps/web/vercel.json`** — for projects where `apps/web` is set as Vercel's root directory

Both use `buildCommand` with Turborepo's `--filter=@coverguard/web...` flag, ensuring `@coverguard/shared` is compiled before the Next.js build runs.

## Environment Variables

Make sure these are set in Vercel project settings:

**For the Web App** (`apps/web`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SITE_URL
```

**For the API** (`apps/api`):
```
DATABASE_URL
DIRECT_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
```

## Deployment Methods

### Method 1: Vercel (Recommended for v0 Preview)
1. The `vercel.json` file handles monorepo build order automatically via Turborepo
2. Push to main branch → Vercel builds `@coverguard/shared` then `@coverguard/web`
3. Web served at your Vercel domain

### Method 2: Docker (Current Production)
Your GitHub Actions workflow builds Docker images:
- `apps/api/Dockerfile` → API container
- `apps/web/Dockerfile` → Web container
- Runs on your hosting provider with webhook triggers

### Method 3: Local Development
```bash
npm run dev          # Starts both web and api with Turbo
npm run build        # Builds both apps
npm run test         # Tests all packages
```

## Next Steps

1. **Verify Vercel Settings**:
   - Go to your Vercel project dashboard
   - Confirm all environment variables are set
   - No need to set "Root Directory" - `vercel.json` handles it

2. **Test Deployment**:
   - Push changes to main branch
   - Vercel will build and deploy automatically
   - Check deployment logs for any errors

3. **Local Testing**:
   - Run `npm run dev`
   - Visit `http://localhost:3000` for frontend
   - API will be proxied from there

## Troubleshooting

**Still getting 404?**
- Verify `vercel.json` exists at repository root
- Check Vercel build logs (Settings → Deployments → Build Logs)
- Confirm environment variables are set
- Try redeploying from Vercel dashboard

**API requests failing?**
- Verify `NEXT_PUBLIC_API_URL` is set correctly and points to your deployed API
- Ensure backend environment variables are configured

**Local dev not working?**
- Run `npm ci` to install all dependencies
- Run `npm run build` to verify everything builds
- Run `npm run dev` to start dev servers
