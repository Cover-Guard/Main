#!/usr/bin/env bash
# =============================================================================
# get-base44-info.sh
#
# Queries the GitHub API to surface all Base44 connection info for this repo:
#   - Webhooks (Base44 registers a webhook; its URL contains the project/app ID)
#   - Actions secrets names (secret values are never exposed by GitHub API)
#   - Actions variables (names + values are readable)
#   - Repository environments
#   - Deploy keys
#   - Repository metadata (topics, homepage, description)
#
# Usage:
#   GITHUB_TOKEN=<your-pat> bash scripts/get-base44-info.sh
#
# Required token scopes (classic PAT):
#   repo  (or: read:repo_hook, secrets, variables, environments, admin:public_key)
#
# The GITHUB_TOKEN env var is automatically available inside GitHub Actions.
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO="Cover-Guard/Main"
API="https://api.github.com"
TOKEN="${GITHUB_TOKEN:-}"

# ── Helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

header()  { echo -e "\n${BOLD}${CYAN}══ $1 ══${RESET}"; }
ok()      { echo -e "  ${GREEN}✔${RESET}  $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET}   $1"; }
fail()    { echo -e "  ${RED}✖${RESET}  $1"; }
kv()      { printf "  %-28s %s\n" "${BOLD}$1${RESET}" "$2"; }

gh_api() {
  local path="$1"; shift
  local extra_args=("$@")
  curl -fsSL \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${extra_args[@]}" \
    "${API}${path}"
}

# ── Auth check ────────────────────────────────────────────────────────────────
if [[ -z "$TOKEN" ]]; then
  fail "GITHUB_TOKEN is not set."
  echo "    Export it before running:"
  echo "      export GITHUB_TOKEN=<your-personal-access-token>"
  echo "    Required scopes: repo (or read:repo_hook + secrets + variables)"
  exit 1
fi

echo -e "\n${BOLD}CoverGuard — Base44 Project & Account Info${RESET}"
echo    "  Repository : ${REPO}"
echo    "  API Base   : ${API}"

# ── 1. Repo metadata ──────────────────────────────────────────────────────────
header "Repository Metadata"
repo_json=$(gh_api "/repos/${REPO}" 2>/dev/null || echo "{}")
name=$(echo "$repo_json"        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('full_name','—'))" 2>/dev/null)
desc=$(echo "$repo_json"        | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('description') or '—')" 2>/dev/null)
homepage=$(echo "$repo_json"    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('homepage') or '—')" 2>/dev/null)
topics=$(echo "$repo_json"      | python3 -c "import sys,json; d=json.load(sys.stdin); print(', '.join(d.get('topics',[])) or '—')" 2>/dev/null)
default_branch=$(echo "$repo_json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('default_branch','main'))" 2>/dev/null)

kv "Full name:"     "$name"
kv "Description:"   "$desc"
kv "Homepage:"      "$homepage"
kv "Topics:"        "$topics"
kv "Default branch:" "$default_branch"

# ── 2. Webhooks ───────────────────────────────────────────────────────────────
header "Webhooks  (Base44 registers a webhook — URL contains the app/project ID)"
hooks_json=$(gh_api "/repos/${REPO}/hooks" 2>/dev/null || echo "[]")
hook_count=$(echo "$hooks_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [[ "$hook_count" == "0" ]]; then
  warn "No webhooks found (token may lack read:repo_hook scope, or none registered)"
else
  echo "$hooks_json" | python3 - <<'PYEOF'
import sys, json

hooks = json.load(sys.stdin)
for h in hooks:
    url   = h.get("config", {}).get("url", "—")
    ctype = h.get("config", {}).get("content_type", "—")
    active = "active" if h.get("active") else "inactive"
    events = ", ".join(h.get("events", []))
    hid    = h.get("id", "—")
    created = h.get("created_at", "—")

    is_base44 = "base44" in url.lower()
    marker = "  ★ BASE44" if is_base44 else ""

    print(f"  {'─'*60}")
    print(f"  ID          : {hid}{marker}")
    print(f"  URL         : {url}")
    print(f"  Content type: {ctype}")
    print(f"  Events      : {events}")
    print(f"  Status      : {active}")
    print(f"  Created     : {created}")

    if is_base44:
        # Try to extract project/app ID from the URL
        import re
        # Common Base44 webhook URL patterns:
        # https://api.base44.com/webhooks/<project-id>/...
        # https://app.base44.com/api/github/webhook/<app-id>
        patterns = [
            r"base44\.com/(?:webhooks|api/github/webhook|hook)/([a-zA-Z0-9_-]+)",
            r"base44\.com/(?:projects?|apps?)/([a-zA-Z0-9_-]+)",
            r"/([a-f0-9\-]{36})",  # UUID-style IDs
        ]
        for pat in patterns:
            m = re.search(pat, url)
            if m:
                print(f"  Project/App ID (extracted): {m.group(1)}")
                break
PYEOF
fi

# ── 3. Actions secrets (names only) ──────────────────────────────────────────
header "Actions Secrets  (names only — values are never returned by the API)"
secrets_json=$(gh_api "/repos/${REPO}/actions/secrets" 2>/dev/null || echo '{"secrets":[]}')
echo "$secrets_json" | python3 - <<'PYEOF'
import sys, json
data = json.load(sys.stdin)
secrets = data.get("secrets", [])
if not secrets:
    print("  No secrets found (or token lacks secrets scope)")
else:
    for s in secrets:
        name = s.get("name","—")
        updated = s.get("updated_at","—")
        marker = "  ← possible Base44 key" if "BASE44" in name.upper() else ""
        print(f"  {name:<40} updated {updated}{marker}")
PYEOF

# ── 4. Actions variables ─────────────────────────────────────────────────────
header "Actions Variables  (names + values are readable)"
vars_json=$(gh_api "/repos/${REPO}/actions/variables" 2>/dev/null || echo '{"variables":[]}')
echo "$vars_json" | python3 - <<'PYEOF'
import sys, json
data = json.load(sys.stdin)
variables = data.get("variables", [])
if not variables:
    print("  No repository-level variables found")
else:
    for v in variables:
        name  = v.get("name","—")
        value = v.get("value","—")
        updated = v.get("updated_at","—")
        marker = "  ← possible Base44 config" if "BASE44" in name.upper() else ""
        print(f"  {name:<35} = {value}  (updated {updated}){marker}")
PYEOF

# ── 5. Environments ───────────────────────────────────────────────────────────
header "Environments"
envs_json=$(gh_api "/repos/${REPO}/environments" 2>/dev/null || echo '{"environments":[]}')
echo "$envs_json" | python3 - <<'PYEOF'
import sys, json
data = json.load(sys.stdin)
envs = data.get("environments", [])
if not envs:
    print("  No environments configured")
else:
    for e in envs:
        ename = e.get("name","—")
        url   = e.get("html_url","—")
        created = e.get("created_at","—")
        print(f"  {ename:<25} created {created}")
        print(f"  {'':25} {url}")
PYEOF

# ── Per-environment secrets & variables ──────────────────────────────────────
env_names=$(echo "$envs_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data.get('environments', []):
    print(e.get('name',''))
" 2>/dev/null || true)

for env_name in $env_names; do
  [[ -z "$env_name" ]] && continue
  echo -e "\n  ${BOLD}Environment: ${env_name}${RESET}"

  env_id=$(gh_api "/repos/${REPO}/environments/${env_name}" 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)

  # Secrets
  env_secrets=$(gh_api "/repos/${REPO}/environments/${env_name}/secrets" 2>/dev/null \
    || echo '{"secrets":[]}')
  echo "$env_secrets" | python3 - <<PYEOF
import sys, json
data = json.load(sys.stdin)
secrets = data.get("secrets", [])
if secrets:
    print("    Secrets:")
    for s in secrets:
        name = s.get("name","—")
        marker = "  ← possible Base44 key" if "BASE44" in name.upper() else ""
        print(f"      {name}{marker}")
else:
    print("    Secrets: none")
PYEOF

  # Variables
  env_vars=$(gh_api "/repos/${REPO}/environments/${env_name}/variables" 2>/dev/null \
    || echo '{"variables":[]}')
  echo "$env_vars" | python3 - <<PYEOF
import sys, json
data = json.load(sys.stdin)
variables = data.get("variables", [])
if variables:
    print("    Variables:")
    for v in variables:
        name  = v.get("name","—")
        value = v.get("value","—")
        marker = "  ← possible Base44 config" if "BASE44" in name.upper() else ""
        print(f"      {name} = {value}{marker}")
else:
    print("    Variables: none")
PYEOF
done

# ── 6. Deploy keys ────────────────────────────────────────────────────────────
header "Deploy Keys"
keys_json=$(gh_api "/repos/${REPO}/keys" 2>/dev/null || echo "[]")
echo "$keys_json" | python3 - <<'PYEOF'
import sys, json
keys = json.load(sys.stdin)
if not keys:
    print("  No deploy keys found")
else:
    for k in keys:
        kid     = k.get("id","—")
        title   = k.get("title","—")
        ro      = "read-only" if k.get("read_only") else "read/write"
        created = k.get("created_at","—")
        verified = "verified" if k.get("verified") else "unverified"
        marker = "  ← possible Base44 key" if "base44" in title.lower() else ""
        print(f"  [{kid}] {title:<35} {ro}, {verified}, created {created}{marker}")
PYEOF

# ── 7. Branches referencing base44 ───────────────────────────────────────────
header "Branches referencing 'base44'"
branches_json=$(gh_api "/repos/${REPO}/branches?per_page=100" 2>/dev/null || echo "[]")
echo "$branches_json" | python3 - <<'PYEOF'
import sys, json
branches = json.load(sys.stdin)
matches = [b for b in branches if "base44" in b.get("name","").lower()]
if not matches:
    print("  No branches with 'base44' in the name")
else:
    for b in matches:
        name = b.get("name","—")
        sha  = b.get("commit",{}).get("sha","—")[:12]
        print(f"  {name:<50} sha {sha}")
PYEOF

# ── Summary ───────────────────────────────────────────────────────────────────
header "Summary"
echo    "  To identify the exact Base44 app, check:"
echo    "  1. Webhooks above — Base44 registers a webhook whose URL contains"
echo    "     the project/app ID (look for ★ BASE44 markers above)"
echo    "  2. Actions secrets/variables named BASE44_APP_ID, BASE44_PROJECT_ID,"
echo    "     BASE44_TOKEN, etc."
echo    "  3. Your Base44 dashboard at https://app.base44.com — link a GitHub"
echo    "     repo and it shows which projects are connected."
echo    ""
echo -e "  ${GREEN}Done.${RESET}"
