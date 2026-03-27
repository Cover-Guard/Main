FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=@coverguard/web --workspace=@coverguard/shared

# ─── Build shared ─────────────────────────────────────────────────────────────
FROM base AS build-shared
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@coverguard/shared

# ─── Build Next.js ────────────────────────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Accept build-time public env vars (baked into the Next.js bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG API_REWRITE_URL=https://api.coverguard.io
ARG NEXT_PUBLIC_SITE_URL=https://coverguard.io
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV API_REWRITE_URL=$API_REWRITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@coverguard/web

# ─── Production runner ────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind to all interfaces — required for Railway (and any reverse-proxy / container platform)
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
