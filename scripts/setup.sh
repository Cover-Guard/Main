#!/usr/bin/env bash
# =============================================================================
# CoverGuard — Project Setup Script
# Run this once after cloning the repo to set up your local environment.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()   { echo -e "${CYAN}[setup]${NC} $1"; }
ok()    { echo -e "${GREEN}[  ok ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn ]${NC} $1"; }
err()   { echo -e "${RED}[error]${NC} $1"; }

# ── Pre-flight checks ────────────────────────────────────────────────────────

log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  err "Node.js is not installed. Please install Node >= 20."
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node.js >= 20 required (found $(node -v)). Please upgrade."
  exit 1
fi
ok "Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
  err "npm is not installed."
  exit 1
fi
ok "npm $(npm -v)"

# ── Environment file ─────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    warn "Created .env from .env.example — fill in your values before running the app."
  else
    err "No .env.example found. Cannot create .env."
    exit 1
  fi
else
  ok ".env already exists"
fi

# ── Install dependencies ─────────────────────────────────────────────────────

log "Installing npm dependencies..."
npm install
ok "Dependencies installed"

# ── Generate Prisma client ───────────────────────────────────────────────────

log "Generating Prisma client..."
npm run db:generate --prefix apps/api
ok "Prisma client generated"

# ── Database migrations ──────────────────────────────────────────────────────

log "Checking database connection..."

# Verify DATABASE_URL is set
source .env 2>/dev/null || true
if [ -z "${DATABASE_URL:-}" ]; then
  warn "DATABASE_URL is not set in .env — skipping migrations."
  warn "Set DATABASE_URL and DIRECT_URL, then run: npm run db:generate"
else
  log "Generating Prisma client..."
  npm run db:generate
  ok "Prisma client generated"

  log "Seeding database..."
  npm run db:seed || warn "Seed failed (this is OK if data already exists)"
  ok "Database ready"
fi

# ── Build shared package ─────────────────────────────────────────────────────

log "Building shared package..."
npm run build --prefix packages/shared
ok "Shared package built"

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN} CoverGuard setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Fill in .env with your Supabase credentials"
echo "     (see .env.example for descriptions)"
echo ""
echo "  2. Link to Supabase (optional — for Supabase CLI workflows):"
echo "     npx supabase link --project-ref <your-project-ref>"
echo ""
echo "  3. Run the dev servers:"
echo "     npm run dev:all    # web :3000, api :4000"
echo ""
echo "  4. Other useful commands:"
echo "     npm run db:pull         # Sync schema from Supabase"
echo "     npm run db:studio       # Open Prisma Studio"
echo "     npm run db:push         # Push Supabase migrations"
echo "     npm run typecheck       # Type-check all packages"
echo "     npm run lint            # Lint all packages"
echo "     npm run test            # Run all tests"
echo ""
