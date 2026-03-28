#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CoverGuard Production API Verification Script
#
# Tests all public and authenticated API endpoints on coverguard.io
#
# Usage:
#   # Public endpoints only:
#   ./scripts/test-production-api.sh
#
#   # All endpoints (including authenticated):
#   ./scripts/test-production-api.sh --token <SUPABASE_ACCESS_TOKEN>
#
# To get your access token:
#   1. Open coverguard.io in your browser
#   2. Open DevTools → Application → Local Storage
#   3. Find the Supabase auth key and copy the access_token value
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

API_BASE="https://api.coverguard.io"
WEB_BASE="https://coverguard.io"
TOKEN=""
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────────────

check_endpoint() {
  local method="$1"
  local url="$2"
  local expected_status="$3"
  local description="$4"
  local body="${5:-}"
  local auth_required="${6:-false}"

  if [[ "$auth_required" == "true" && -z "$TOKEN" ]]; then
    printf "  ${YELLOW}SKIP${NC}  %-6s %-55s (needs --token)\n" "$method" "$url"
    SKIP=$((SKIP + 1))
    RESULTS+=("SKIP|$method|$url|$description")
    return
  fi

  local curl_args=(-s -o /tmp/cg_response.json -w "%{http_code}" -X "$method")
  curl_args+=(-H "Content-Type: application/json")

  if [[ "$auth_required" == "true" && -n "$TOKEN" ]]; then
    curl_args+=(-H "Authorization: Bearer $TOKEN")
  fi

  if [[ -n "$body" ]]; then
    curl_args+=(-d "$body")
  fi

  curl_args+=("$url")

  local status
  status=$(curl "${curl_args[@]}" 2>/dev/null || echo "000")

  local response
  response=$(cat /tmp/cg_response.json 2>/dev/null || echo "{}")

  # Check if status matches expected (supports comma-separated expected codes)
  local matched=false
  IFS=',' read -ra EXPECTED <<< "$expected_status"
  for code in "${EXPECTED[@]}"; do
    if [[ "$status" == "$code" ]]; then
      matched=true
      break
    fi
  done

  if $matched; then
    printf "  ${GREEN}PASS${NC}  %-6s %-55s ${GREEN}%s${NC}\n" "$method" "$url" "$status"
    PASS=$((PASS + 1))
    RESULTS+=("PASS|$method|$url|$description|$status")
  else
    printf "  ${RED}FAIL${NC}  %-6s %-55s ${RED}%s${NC} (expected %s)\n" "$method" "$url" "$status" "$expected_status"
    # Show truncated response body for failures
    local body_preview
    body_preview=$(echo "$response" | head -c 200)
    printf "        └─ %s\n" "$body_preview"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL|$method|$url|$description|$status|expected $expected_status")
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  CoverGuard Production API Verification${NC}"
echo -e "${CYAN}  API:  ${API_BASE}${NC}"
echo -e "${CYAN}  Web:  ${WEB_BASE}${NC}"
echo -e "${CYAN}  Auth: ${TOKEN:+provided}${TOKEN:-not provided (pass --token to test authenticated endpoints)}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Health ───────────────────────────────────────────────────────────────────

echo -e "${CYAN}[1/8] Health Check${NC}"
check_endpoint "GET" "$API_BASE/health" "200" "Health endpoint"
echo ""

# ─── Public Property Endpoints ────────────────────────────────────────────────

echo -e "${CYAN}[2/8] Property Endpoints (public)${NC}"
check_endpoint "GET" "$API_BASE/api/properties/suggest?q=miami&limit=3" "200" "Typeahead suggestions"
check_endpoint "GET" "$API_BASE/api/properties/search?address=90210" "200" "Search by zip"
check_endpoint "GET" "$API_BASE/api/properties/search?city=Miami&state=FL" "200" "Search by city/state"
check_endpoint "GET" "$API_BASE/api/properties/search" "400" "Search without params (should 400)"

# Get a property ID from search results for subsequent tests
PROPERTY_ID=""
SEARCH_RESPONSE=$(curl -s "$API_BASE/api/properties/search?address=90210" 2>/dev/null || echo '{}')
PROPERTY_ID=$(echo "$SEARCH_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    props = d.get('data', {}).get('properties', d.get('data', {}).get('results', []))
    if isinstance(props, list) and len(props) > 0:
        print(props[0].get('id', ''))
except: pass
" 2>/dev/null || echo "")

if [[ -n "$PROPERTY_ID" ]]; then
  echo -e "  ${CYAN}INFO${NC}  Using property ID: $PROPERTY_ID"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID" "200" "Property detail"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/risk" "200" "Risk profile"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/insurance" "200" "Insurance estimate"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/insurability" "200" "Insurability status"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/carriers" "200" "Active carriers"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/report" "200" "Full report bundle"
else
  echo -e "  ${YELLOW}WARN${NC}  Could not extract property ID from search — skipping detail endpoints"
  SKIP=$((SKIP + 6))
fi

check_endpoint "GET" "$API_BASE/api/properties/nonexistent-id-12345" "404" "Property not found (should 404)"
echo ""

# ─── Auth Endpoints ───────────────────────────────────────────────────────────

echo -e "${CYAN}[3/8] Auth Endpoints${NC}"
check_endpoint "GET" "$API_BASE/api/auth/me" "401" "Get profile without token (should 401)"
check_endpoint "GET" "$API_BASE/api/auth/me" "200" "Get profile" "" "true"
check_endpoint "GET" "$API_BASE/api/auth/me/saved" "200" "Saved properties" "" "true"
check_endpoint "GET" "$API_BASE/api/auth/me/reports" "200" "User reports" "" "true"
check_endpoint "POST" "$API_BASE/api/auth/me/terms" "200" "Accept terms" "" "true"
echo ""

# ─── Client Endpoints ────────────────────────────────────────────────────────

echo -e "${CYAN}[4/8] Client Endpoints (authenticated)${NC}"
check_endpoint "GET" "$API_BASE/api/clients" "401" "List clients without token (should 401)"
check_endpoint "GET" "$API_BASE/api/clients" "200,403" "List clients" "" "true"

# Create a test client, then update and delete it
if [[ -n "$TOKEN" ]]; then
  CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/api/clients" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"firstName":"Test","lastName":"ApiCheck","email":"test-apicheck@example.com"}' 2>/dev/null || echo '{}')
  CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_BASE/api/clients" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"firstName":"Test2","lastName":"ApiCheck2","email":"test-apicheck2@example.com"}' 2>/dev/null || echo "000")

  CLIENT_ID=$(echo "$CREATE_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('data', {}).get('id', ''))
except: pass
" 2>/dev/null || echo "")

  if [[ "$CREATE_STATUS" == "201" || "$CREATE_STATUS" == "200" ]]; then
    printf "  ${GREEN}PASS${NC}  %-6s %-55s ${GREEN}%s${NC}\n" "POST" "$API_BASE/api/clients" "$CREATE_STATUS"
    PASS=$((PASS + 1))
  else
    printf "  ${RED}FAIL${NC}  %-6s %-55s ${RED}%s${NC} (expected 201)\n" "POST" "$API_BASE/api/clients" "$CREATE_STATUS"
    FAIL=$((FAIL + 1))
  fi

  if [[ -n "$CLIENT_ID" ]]; then
    check_endpoint "PATCH" "$API_BASE/api/clients/$CLIENT_ID" "200" "Update client" '{"notes":"API test"}' "true"
    check_endpoint "DELETE" "$API_BASE/api/clients/$CLIENT_ID" "200" "Delete client" "" "true"
  fi

  # Clean up second test client
  CLIENT_ID2=$(curl -s "$API_BASE/api/clients" \
    -H "Authorization: Bearer $TOKEN" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for c in d.get('data', []):
        if c.get('email') == 'test-apicheck2@example.com':
            print(c.get('id', '')); break
except: pass
" 2>/dev/null || echo "")
  if [[ -n "$CLIENT_ID2" ]]; then
    curl -s -X DELETE "$API_BASE/api/clients/$CLIENT_ID2" \
      -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 || true
  fi
else
  SKIP=$((SKIP + 3))
  echo -e "  ${YELLOW}SKIP${NC}  POST/PATCH/DELETE /api/clients (needs --token)"
fi
echo ""

# ─── Save / Unsave Property ──────────────────────────────────────────────────

echo -e "${CYAN}[5/8] Save Property Workflow (authenticated)${NC}"
if [[ -n "$PROPERTY_ID" ]]; then
  check_endpoint "POST" "$API_BASE/api/properties/$PROPERTY_ID/save" "200,201" "Save property" '{"notes":"API test","tags":["test"]}' "true"
  check_endpoint "DELETE" "$API_BASE/api/properties/$PROPERTY_ID/save" "200" "Unsave property" "" "true"
else
  echo -e "  ${YELLOW}SKIP${NC}  No property ID available"
  SKIP=$((SKIP + 2))
fi
echo ""

# ─── Quote Request ────────────────────────────────────────────────────────────

echo -e "${CYAN}[6/8] Quote Request Workflow (authenticated)${NC}"
if [[ -n "$PROPERTY_ID" ]]; then
  check_endpoint "POST" "$API_BASE/api/properties/$PROPERTY_ID/quote-request" "201" "Create quote request" \
    '{"carrierId":"carrier-test-001","coverageTypes":["HOMEOWNERS"],"notes":"API verification test"}' "true"
  check_endpoint "GET" "$API_BASE/api/properties/$PROPERTY_ID/quote-requests" "200" "List quote requests" "" "true"
else
  echo -e "  ${YELLOW}SKIP${NC}  No property ID available"
  SKIP=$((SKIP + 2))
fi
echo ""

# ─── Analytics ────────────────────────────────────────────────────────────────

echo -e "${CYAN}[7/8] Analytics & Advisor (authenticated)${NC}"
check_endpoint "GET" "$API_BASE/api/analytics" "200,403" "Analytics summary" "" "true"
echo ""

# ─── Stripe ───────────────────────────────────────────────────────────────────

echo -e "${CYAN}[8/8] Stripe Endpoints (authenticated)${NC}"
check_endpoint "GET" "$API_BASE/api/stripe/subscription" "200" "Subscription status" "" "true"
echo ""

# ─── Web Frontend Rewrite Proxy ───────────────────────────────────────────────

echo -e "${CYAN}[Bonus] Web Frontend Proxy (coverguard.io/api/*)${NC}"
check_endpoint "GET" "$WEB_BASE/api/properties/suggest?q=dallas&limit=2" "200" "Web proxy → suggest"
check_endpoint "GET" "$WEB_BASE/api/properties/search?address=10001" "200" "Web proxy → search"
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + SKIP))
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}SKIP: $SKIP${NC}  TOTAL: $TOTAL"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Clean up
rm -f /tmp/cg_response.json

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo -e "${RED}Some endpoints failed! Review the output above.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}All tested endpoints returned expected status codes.${NC}"
  exit 0
fi
