#!/usr/bin/env bash
# setup.sh — one-shot setup: load .env, export GITHUB_TOKEN, verify MCP connectivity
#
# Usage: source setup.sh   (recommended — exports vars into your current shell)
#        ./setup.sh        (runs in subshell — vars won't persist to parent)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { printf "${GREEN}  ✓${NC} %s\n" "$*"; }
fail() { printf "${RED}  ✗${NC} %s\n" "$*" >&2; }
warn() { printf "${YELLOW}  !${NC} %s\n" "$*"; }
info() { printf "  » %s\n" "$*"; }

echo ""
echo "  getGITfixed — setup"
echo "  ─────────────────────────────────────"

# ---------------------------------------------------------------------------
# 1. Locate .env
# ---------------------------------------------------------------------------
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    warn ".env not found — copying from .env.example"
    cp .env.example .env
    warn "Edit .env and set GITHUB_TOKEN, then re-run this script."
    echo ""
    exit 1
  else
    fail ".env not found and no .env.example to copy from."
    exit 1
  fi
fi
ok ".env found"

# ---------------------------------------------------------------------------
# 2. Parse and export vars from .env
# ---------------------------------------------------------------------------
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  # Only process KEY=VALUE lines
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    # Strip surrounding quotes if present
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  fi
done < .env
ok "Environment variables exported from .env"

# ---------------------------------------------------------------------------
# 3. Validate GITHUB_TOKEN
# ---------------------------------------------------------------------------
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  fail "GITHUB_TOKEN is not set in .env"
  warn "Add: GITHUB_TOKEN=ghp_your_token_here"
  exit 1
fi

masked="${GITHUB_TOKEN:0:4}$(printf '%*s' $((${#GITHUB_TOKEN} - 4)) '' | tr ' ' '*')"
ok "GITHUB_TOKEN loaded: ${masked}"

# ---------------------------------------------------------------------------
# 4. Check Node + kiro-cli
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install from https://nodejs.org"
  exit 1
fi
ok "node $(node --version)"

if ! command -v kiro-cli &>/dev/null; then
  fail "kiro-cli not found. Install: npm install -g @kirodotdev/cli"
  exit 1
fi
ok "kiro-cli $(kiro-cli --version 2>&1 | head -1)"

# ---------------------------------------------------------------------------
# 5. Run verify-mcp
# ---------------------------------------------------------------------------
echo ""
info "Running verify-mcp…"
echo "  ─────────────────────────────────────"

if npx tsx src/verify-mcp.ts; then
  echo "  ─────────────────────────────────────"
  echo ""
  ok "Setup complete. You're ready to run:"
  echo ""
  echo "    ./run.sh <issue-number>"
  echo "    e.g. ./run.sh 19"
  echo ""
else
  echo "  ─────────────────────────────────────"
  echo ""
  fail "verify-mcp failed. Check the output above."
  echo ""
  warn "Common fixes:"
  warn "  • Token expired → generate a new PAT at github.com/settings/tokens"
  warn "  • Token missing scopes → needs: repo, issues, pull_requests"
  warn "  • Docker not running → sudo systemctl start docker"
  exit 1
fi

# ---------------------------------------------------------------------------
# 6. Sourcing hint
# ---------------------------------------------------------------------------
# If run as a script (not sourced), remind the user to source it
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  warn "Tip: run 'source setup.sh' to keep GITHUB_TOKEN exported in this shell session."
fi
