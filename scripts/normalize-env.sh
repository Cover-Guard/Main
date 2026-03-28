#!/bin/bash
# Supabase Vercel Integration suffixes env var names with the project label
# (e.g. POSTGRES_URL_COVERGUARD_2 instead of POSTGRES_URL).
# This script copies suffixed vars to their standard names so the app code
# works without hardcoding the suffix everywhere.
LABEL="${SUPABASE_ENV_LABEL:-COVERGUARD_2}"

for VAR in DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL POSTGRES_URL_NON_POOLED \
           DIRECT_URL SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
           NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  SUFFIXED="${VAR}_${LABEL}"
  eval "std_val=\"\${$VAR}\""
  eval "suf_val=\"\${$SUFFIXED}\""
  if [ -z "$std_val" ] && [ -n "$suf_val" ]; then
    export "$VAR=$suf_val"
    echo "normalize-env: ${VAR} ← ${SUFFIXED}"
  fi
done
