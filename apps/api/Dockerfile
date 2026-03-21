FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencies stage ───────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=@coverguard/api --workspace=@coverguard/shared

# ─── Build shared package ─────────────────────────────────────────────────────
FROM base AS build-shared
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@coverguard/shared

# ─── Build API ────────────────────────────────────────────────────────────────
FROM base AS build-api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@coverguard/api

# ─── Production stage ─────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser
USER apiuser

COPY --from=build-api --chown=apiuser:nodejs /app/apps/api/dist ./dist
COPY --from=build-api --chown=apiuser:nodejs /app/apps/api/prisma ./prisma
COPY --from=deps --chown=apiuser:nodejs /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/index.js"]
