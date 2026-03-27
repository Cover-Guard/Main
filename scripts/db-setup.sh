#!/usr/bin/env bash
# =============================================================================
# CoverGuard — Database Setup Script
# DB migrations are managed by Supabase GitHub Integration.
# Prisma is used as ORM only — this script handles client generation and sync.
#
# Usage:
#   ./scripts/db-setup.sh                 # Full setup (pull + generate + seed)
#   ./scripts/db-setup.sh pull            # Introspect live DB → update schema.prisma
#   ./scripts/db-setup.sh generate        # Regenerate Prisma client
#   ./scripts/db-setup.sh seed            # Seed the database
#   ./scripts/db-setup.sh push            # Push Supabase migrations (supabase db push)
#   ./scripts/db-setup.sh link            # Link to Supabase project
#   ./scripts/db-setup.sh status          # Show Supabase migration files
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[db]${NC} $1"; }
ok()    { echo -e "${GREEN}[ok]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
err()   { echo -e "${RED}[error]${NC} $1"; }

COMMAND="${1:-setup}"

case "$COMMAND" in
  setup)
    log "Running full database setup..."
    log "Step 1/3: Generating Prisma client..."
    npx --prefix apps/api prisma generate
    ok "Prisma client generated"

    log "Step 2/3: Pulling schema from Supabase..."
    npx --prefix apps/api prisma db pull || warn "db pull skipped (check DATABASE_URL)"
    ok "Schema synced"

    log "Step 3/3: Seeding database..."
    npm run db:seed --prefix apps/api || warn "Seed skipped (data may already exist)"
    ok "Database setup complete"
    ;;

  pull)
    log "Pulling schema from Supabase (introspecting live DB)..."
    npx --prefix apps/api prisma db pull
    ok "schema.prisma updated from live database"
    log "Run 'npm run db:generate' to regenerate the Prisma client"
    ;;

  generate)
    log "Generating Prisma client..."
    npx --prefix apps/api prisma generate
    ok "Prisma client generated"
    ;;

  seed)
    log "Seeding database..."
    npm run db:seed --prefix apps/api
    ok "Database seeded"
    ;;

  push)
    log "Pushing Supabase migrations to remote..."
    if ! command -v supabase &>/dev/null && ! npx supabase --version &>/dev/null 2>&1; then
      err "Supabase CLI not found. Install it: https://supabase.com/docs/guides/cli"
      exit 1
    fi
    npx supabase db push
    ok "Supabase migrations pushed"
    ;;

  link)
    PROJECT_REF="${2:-}"
    if [ -z "$PROJECT_REF" ]; then
      err "Usage: ./scripts/db-setup.sh link <project-ref>"
      echo "  Find your project ref in Supabase Dashboard → Project Settings → General"
      exit 1
    fi
    log "Linking to Supabase project: $PROJECT_REF"
    npx supabase link --project-ref "$PROJECT_REF"
    ok "Linked to Supabase project"
    ;;

  status)
    log "Supabase migration files:"
    ls -la supabase/migrations/ 2>/dev/null || warn "No Supabase migrations directory found"
    ;;

  *)
    err "Unknown command: $COMMAND"
    echo ""
    echo "Usage: ./scripts/db-setup.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup         Full setup: generate + pull + seed (default)"
    echo "  pull          Introspect live DB → update schema.prisma"
    echo "  generate      Regenerate Prisma client from schema.prisma"
    echo "  seed          Seed the database"
    echo "  push          Push Supabase migrations to remote"
    echo "  link          Link to a Supabase project (requires project-ref)"
    echo "  status        Show Supabase migration files"
    exit 1
    ;;
esac
