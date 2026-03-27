#!/usr/bin/env bash
# =============================================================================
# CoverGuard — Database Setup & Migration Script
# Handles both Prisma and Supabase CLI migration workflows.
#
# Usage:
#   ./scripts/db-setup.sh                 # Full setup (migrate + seed)
#   ./scripts/db-setup.sh migrate         # Run pending Prisma migrations
#   ./scripts/db-setup.sh migrate:dev     # Create + apply a new dev migration
#   ./scripts/db-setup.sh seed            # Seed the database
#   ./scripts/db-setup.sh reset           # Reset DB and re-apply all migrations
#   ./scripts/db-setup.sh push            # Push Supabase migrations (supabase db push)
#   ./scripts/db-setup.sh link            # Link to Supabase project
#   ./scripts/db-setup.sh status          # Show migration status
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

    log "Step 2/3: Deploying Prisma migrations..."
    npx --prefix apps/api prisma migrate deploy
    ok "Migrations applied"

    log "Step 3/3: Seeding database..."
    npm run db:seed --prefix apps/api || warn "Seed skipped (data may already exist)"
    ok "Database setup complete"
    ;;

  migrate)
    log "Deploying pending Prisma migrations..."
    npx --prefix apps/api prisma migrate deploy
    ok "Migrations deployed"
    ;;

  migrate:dev)
    MIGRATION_NAME="${2:-}"
    if [ -z "$MIGRATION_NAME" ]; then
      err "Usage: ./scripts/db-setup.sh migrate:dev <migration-name>"
      exit 1
    fi
    log "Creating new migration: $MIGRATION_NAME"
    npx --prefix apps/api prisma migrate dev --name "$MIGRATION_NAME"
    ok "Migration '$MIGRATION_NAME' created and applied"
    ;;

  seed)
    log "Seeding database..."
    npm run db:seed --prefix apps/api
    ok "Database seeded"
    ;;

  reset)
    warn "This will RESET the database and re-apply all migrations!"
    read -rp "Are you sure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      log "Resetting database..."
      npx --prefix apps/api prisma migrate reset
      ok "Database reset complete"
    else
      log "Cancelled."
    fi
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
    log "Prisma migration status:"
    npx --prefix apps/api prisma migrate status
    echo ""
    log "Supabase migration files:"
    ls -la supabase/migrations/ 2>/dev/null || warn "No Supabase migrations directory found"
    ;;

  *)
    err "Unknown command: $COMMAND"
    echo ""
    echo "Usage: ./scripts/db-setup.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup         Full setup: generate + migrate + seed (default)"
    echo "  migrate       Deploy pending Prisma migrations"
    echo "  migrate:dev   Create a new dev migration (requires name)"
    echo "  seed          Seed the database"
    echo "  reset         Reset DB and re-apply everything"
    echo "  push          Push Supabase migrations to remote"
    echo "  link          Link to a Supabase project (requires project-ref)"
    echo "  status        Show migration status"
    exit 1
    ;;
esac
