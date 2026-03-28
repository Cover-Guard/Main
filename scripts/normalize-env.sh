#!/bin/sh
# Supabase Vercel Integration prefixes env var names with the project label
# (e.g. COVERGUARD_2_POSTGRES_URL instead of POSTGRES_URL).
# This script copies prefixed/suffixed vars to their standard names so the
# app code works without hardcoding the label everywhere.
#
# POSIX sh compatible — Vercel build uses /bin/sh, not bash.
LABEL="${SUPABASE_ENV_LABEL:-COVERGUARD_2}"

for VAR in DATABASE_URL POSTGRES_URL POSTGRES_PRISMA_URL POSTGRES_URL_NON_POOLED \
           DIRECT_URL SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
           NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  eval "std_val=\"\${$VAR}\""
  if [ -n "$std_val" ]; then
    continue
  fi
  # Check prefix convention: LABEL_VARNAME (Vercel marketplace standard)
  PREFIXED="${LABEL}_${VAR}"
  eval "pre_val=\"\${$PREFIXED}\""
  if [ -n "$pre_val" ]; then
    export "$VAR=$pre_val"
    echo "normalize-env: ${VAR} <- ${PREFIXED}"
    continue
  fi
  # Check suffix convention: VARNAME_LABEL (some integrations)
  SUFFIXED="${VAR}_${LABEL}"
  eval "suf_val=\"\${$SUFFIXED}\""
  if [ -n "$suf_val" ]; then
    export "$VAR=$suf_val"
    echo "normalize-env: ${VAR} <- ${SUFFIXED}"
  fi
done
