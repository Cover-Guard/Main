#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CoverGuard API Performance Test
#
# Measures response time for every endpoint. No dependencies required.
#
# Usage:
#   ./scripts/perf-test.sh                                    # Public only
#   ./scripts/perf-test.sh --token <SUPABASE_ACCESS_TOKEN>    # All endpoints
#   ./scripts/perf-test.sh --base https://coverguard.io       # Custom base URL
#   ./scripts/perf-test.sh --iterations 5                     # Run 5 times each
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="https://api.coverguard.io"
TOKEN=""
ITERATIONS=3
PROPERTY_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --base) BASE_URL="$2"; shift 2 ;;
    --iterations) ITERATIONS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────────────

declare -A TIMINGS
declare -A STATUSES
declare -A COUNTS

measure() {
  local name="$1"
  local method="$2"
  local url="$3"
  local body="${4:-}"
  local auth="${5:-false}"

  if [[ "$auth" == "true" && -z "$TOKEN" ]]; then
    return
  fi

  local curl_args=(-s -o /tmp/cg_perf_body.txt -w '%{http_code}|%{time_total}' -X "$method")
  curl_args+=(-H "Content-Type: application/json")
  [[ "$auth" == "true" ]] && curl_args+=(-H "Authorization: Bearer $TOKEN")
  [[ -n "$body" ]] && curl_args+=(-d "$body")
  curl_args+=("$url")

  local result
  result=$(curl "${curl_args[@]}" 2>/dev/null || echo "000|0")
  local status="${result%%|*}"
  local time_s="${result##*|}"
  local time_ms
  time_ms=$(echo "$time_s * 1000" | bc 2>/dev/null || echo "0")
  time_ms="${time_ms%.*}"

  STATUSES[$name]="$status"

  if [[ -z "${TIMINGS[$name]:-}" ]]; then
    TIMINGS[$name]="$time_ms"
    COUNTS[$name]=1
  else
    TIMINGS[$name]="${TIMINGS[$name]},$time_ms"
    COUNTS[$name]=$(( ${COUNTS[$name]} + 1 ))
  fi
}

calc_stats() {
  local times="$1"
  # Sort and compute p50, p95, avg
  local sorted
  sorted=$(echo "$times" | tr ',' '\n' | sort -n)
  local count
  count=$(echo "$sorted" | wc -l)
  local sum=0
  local min=999999
  local max=0

  while IFS= read -r t; do
    sum=$((sum + t))
    [[ $t -lt $min ]] && min=$t
    [[ $t -gt $max ]] && max=$t
  done <<< "$sorted"

  local avg=$((sum / count))
  local p50_idx=$(( (count * 50 + 99) / 100 ))
  local p95_idx=$(( (count * 95 + 99) / 100 ))
  [[ $p50_idx -gt $count ]] && p50_idx=$count
  [[ $p95_idx -gt $count ]] && p95_idx=$count

  local p50
  p50=$(echo "$sorted" | sed -n "${p50_idx}p")
  local p95
  p95=$(echo "$sorted" | sed -n "${p95_idx}p")

  echo "${min}|${avg}|${p50}|${p95}|${max}"
}

# ─── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  CoverGuard API Performance Test${NC}"
echo -e "${CYAN}  Base URL:   ${BASE_URL}${NC}"
echo -e "${CYAN}  Auth:       ${TOKEN:+provided}${TOKEN:-not provided}${NC}"
echo -e "${CYAN}  Iterations: ${ITERATIONS}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Run tests ────────────────────────────────────────────────────────────────

for i in $(seq 1 "$ITERATIONS"); do
  echo -e "${DIM}Iteration $i/$ITERATIONS...${NC}"

  measure "Health"        GET  "$BASE_URL/health"
  measure "Suggest"       GET  "$BASE_URL/api/properties/suggest?q=miami&limit=5"
  measure "Search"        GET  "$BASE_URL/api/properties/search?address=90210"

  # Extract property ID from first iteration
  if [[ $i -eq 1 && -z "$PROPERTY_ID" ]]; then
    PROPERTY_ID=$(python3 -c "
import json, sys
try:
    d = json.load(open('/tmp/cg_perf_body.txt'))
    props = d.get('data',{}).get('properties', d.get('data',{}).get('results',[]))
    if props: print(props[0]['id'])
except: pass
" 2>/dev/null || echo "")
    [[ -n "$PROPERTY_ID" ]] && echo -e "  ${DIM}property_id = $PROPERTY_ID${NC}"
  fi

  if [[ -n "$PROPERTY_ID" ]]; then
    measure "Detail"        GET  "$BASE_URL/api/properties/$PROPERTY_ID"
    measure "Risk"          GET  "$BASE_URL/api/properties/$PROPERTY_ID/risk"
    measure "Insurance"     GET  "$BASE_URL/api/properties/$PROPERTY_ID/insurance"
    measure "Insurability"  GET  "$BASE_URL/api/properties/$PROPERTY_ID/insurability"
    measure "Carriers"      GET  "$BASE_URL/api/properties/$PROPERTY_ID/carriers"
    measure "Report"        GET  "$BASE_URL/api/properties/$PROPERTY_ID/report"
  fi

  measure "Auth Me"       GET  "$BASE_URL/api/auth/me" "" "true"
  measure "Saved Props"   GET  "$BASE_URL/api/auth/me/saved" "" "true"
  measure "Reports"       GET  "$BASE_URL/api/auth/me/reports" "" "true"
  measure "Clients"       GET  "$BASE_URL/api/clients" "" "true"
  measure "Analytics"     GET  "$BASE_URL/api/analytics" "" "true"
  measure "Subscription"  GET  "$BASE_URL/api/stripe/subscription" "" "true"

  sleep 0.2
done

# ─── Results ──────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}┌──────────────────┬────────┬─────────┬─────────┬─────────┬─────────┬────────┐${NC}"
echo -e "${CYAN}│ Endpoint         │ Status │  Min    │  Avg    │  p50    │  p95    │  Max   │${NC}"
echo -e "${CYAN}├──────────────────┼────────┼─────────┼─────────┼─────────┼─────────┼────────┤${NC}"

ENDPOINTS=(
  "Health" "Suggest" "Search" "Detail" "Risk" "Insurance"
  "Insurability" "Carriers" "Report" "Auth Me" "Saved Props"
  "Reports" "Clients" "Analytics" "Subscription"
)

SLOW=0
FAST=0

for name in "${ENDPOINTS[@]}"; do
  [[ -z "${TIMINGS[$name]:-}" ]] && continue

  local_stats=$(calc_stats "${TIMINGS[$name]}")
  IFS='|' read -r smin savg sp50 sp95 smax <<< "$local_stats"
  status="${STATUSES[$name]}"

  # Color based on p95
  if [[ $sp95 -gt 5000 ]]; then
    color="$RED"
    SLOW=$((SLOW + 1))
  elif [[ $sp95 -gt 2000 ]]; then
    color="$YELLOW"
  else
    color="$GREEN"
    FAST=$((FAST + 1))
  fi

  status_color="$GREEN"
  [[ "$status" != "200" && "$status" != "201" && "$status" != "403" ]] && status_color="$RED"

  printf "${CYAN}│${NC} %-16s ${CYAN}│${NC} ${status_color}%6s${NC} ${CYAN}│${NC} ${color}%5sms${NC} ${CYAN}│${NC} ${color}%5sms${NC} ${CYAN}│${NC} ${color}%5sms${NC} ${CYAN}│${NC} ${color}%5sms${NC} ${CYAN}│${NC} ${color}%4sms${NC} ${CYAN}│${NC}\n" \
    "$name" "$status" "$smin" "$savg" "$sp50" "$sp95" "$smax"
done

echo -e "${CYAN}└──────────────────┴────────┴─────────┴─────────┴─────────┴─────────┴────────┘${NC}"
echo ""
echo -e "  ${GREEN}Fast (p95 < 2s): $FAST${NC}  ${YELLOW}│${NC}  ${RED}Slow (p95 > 5s): $SLOW${NC}"
echo ""

# Cleanup
rm -f /tmp/cg_perf_body.txt
