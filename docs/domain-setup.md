# Domain Setup — coverguard.io (IONOS)

This document covers the exact DNS records to add in IONOS and the Vercel
project configuration needed to serve CoverGuard on `coverguard.io`.

---

## Architecture

```
coverguard.io          →  Vercel (apps/web  — Next.js frontend)
www.coverguard.io      →  Vercel (apps/web  — redirect to apex)
api.coverguard.io      →  Vercel (apps/api  — Express REST API)
```

---

## Step 1 — Create two Vercel projects

### 1a. Web project

```bash
cd apps/web
npx vercel link        # follow prompts; name it "coverguard-web"
```

### 1b. API project

```bash
cd apps/api
npx vercel link        # follow prompts; name it "coverguard-api"
```

Record the **Project IDs** shown after linking — you'll need them for GitHub Actions secrets.

---

## Step 2 — Add custom domains in Vercel

### Web project → coverguard.io

1. Open the Vercel dashboard → `coverguard-web` → **Settings → Domains**
2. Add `coverguard.io`
3. Add `www.coverguard.io` (Vercel will automatically redirect www → apex)
4. Vercel will show you the DNS records to create (see Step 3)

### API project → api.coverguard.io

1. Open the Vercel dashboard → `coverguard-api` → **Settings → Domains**
2. Add `api.coverguard.io`

---

## Step 3 — Add DNS records in IONOS

Log in at **my.ionos.com → Domains & SSL → coverguard.io → DNS**

Add the following records:

### Apex domain (coverguard.io → Vercel web)

| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| `A` | `@` | `76.76.21.21` | 3600 |
| `AAAA` | `@` | `2606:4700:3032::ac43:a0a9` | 3600 |

> Vercel's IP for apex domains. If Vercel gives you different IPs in their dashboard, use those.

### www subdomain

| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| `CNAME` | `www` | `cname.vercel-dns.com` | 3600 |

### API subdomain

| Type | Host | Points to | TTL |
|------|------|-----------|-----|
| `CNAME` | `api` | `cname.vercel-dns.com` | 3600 |

> DNS propagation typically takes 5–30 minutes with IONOS (max 24 hours).

---

## Step 4 — Add environment variables in Vercel

### coverguard-web project

In Vercel dashboard → `coverguard-web` → **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL        = https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon-key>
NEXT_PUBLIC_API_URL             = https://api.coverguard.io
NEXT_PUBLIC_MAPBOX_TOKEN        = <mapbox-token>
```

### coverguard-api project

In Vercel dashboard → `coverguard-api` → **Settings → Environment Variables**:

```
SUPABASE_URL                = https://<ref>.supabase.co
SUPABASE_ANON_KEY           = <anon-key>
SUPABASE_SERVICE_ROLE_KEY   = <service-role-key>
DATABASE_URL                = postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
JWT_SECRET                  = <long-random-secret>
CORS_ALLOWED_ORIGINS        = https://coverguard.io,https://www.coverguard.io
ATTOM_API_KEY               = <attom-key>           # optional
NODE_ENV                    = production
PORT                        = 3000                  # Vercel ignores PORT but keep it
```

---

## Step 5 — Add GitHub Actions secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**:

```
VERCEL_TOKEN              # Vercel account token (vercel.com → Settings → Tokens)
VERCEL_ORG_ID             # from .vercel/project.json after linking
VERCEL_WEB_PROJECT_ID     # Project ID for coverguard-web
VERCEL_API_PROJECT_ID     # Project ID for coverguard-api
DATABASE_URL              # Same as above
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Step 6 — Update Supabase allowed URLs

In **Supabase dashboard → Authentication → URL Configuration**:

```
Site URL:          https://coverguard.io
Redirect URLs:     https://coverguard.io/**
                   https://www.coverguard.io/**
                   http://localhost:3000/**        ← keep for local dev
```

---

## Step 7 — Verify

Once DNS has propagated:

```bash
# Check apex domain
curl -I https://coverguard.io

# Check API health
curl https://api.coverguard.io/health

# Check www redirect
curl -I https://www.coverguard.io   # should 308 → coverguard.io
```

---

## SSL / TLS

Vercel provisions and auto-renews Let's Encrypt certificates for all custom
domains automatically. No action required.

---

## Migrating from Base44

When the Base44 app is still live at `coverguard.io` during transition:

1. Deploy this codebase to Vercel with a **preview URL** (e.g. `coverguard-web.vercel.app`)
2. Test fully on the preview URL
3. Switch the IONOS DNS records (Step 3) to point to Vercel — this is the cutover
4. Verify everything works on `coverguard.io`
5. Delete or archive the Base44 project

DNS cutover takes effect within minutes once IONOS propagates the change.
