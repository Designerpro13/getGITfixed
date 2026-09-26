#!/usr/bin/env bash
# run.sh — kiro-pr-bot entry point
#
# Usage: ./run.sh <issue-number>
# Example: ./run.sh 19
#
# This script:
#   1. Validates prerequisites (GITHUB_TOKEN, kiro-cli, Docker)
#   2. Loads .env if present
#   3. Runs tsx src/spec-gen.ts to write the 3 Kiro spec files
#   4. Hands off to kiro-cli chat --no-interactive with pr-agent
#      to implement the fix and open the PR
#
# Lesson 7 — CLI Headless: this is the single-command entry point that
# exercises kiro-cli in fully headless mode with --no-interactive.

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

log_info()  { echo -e "${BOLD}[kiro-pr-bot]${RESET} $*"; }
log_ok()    { echo -e "${GREEN}[kiro-pr-bot] ✓${RESET} $*"; }
log_warn()  { echo -e "${YELLOW}[kiro-pr-bot] ⚠${RESET} $*"; }
log_error() { echo -e "${RED}[kiro-pr-bot] ✗${RESET} $*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

ISSUE_NUMBER="${1:-}"

if [[ -z "${ISSUE_NUMBER}" ]]; then
  log_error "Usage: ./run.sh <issue-number>"
  log_error "Example: ./run.sh 19"
  exit 1
fi

if ! [[ "${ISSUE_NUMBER}" =~ ^[0-9]+$ ]] || [[ "${ISSUE_NUMBER}" -le 0 ]]; then
  log_error "Issue number must be a positive integer. Got: '${ISSUE_NUMBER}'"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------------------------------------------------------------------------
# Load .env if present
# ---------------------------------------------------------------------------

if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  log_info "Loading .env…"
  # Only export KEY=VALUE lines; skip comments and empty lines
  while IFS='=' read -r key value; do
    [[ "${key}" =~ ^#.*$ || -z "${key}" ]] && continue
    # Strip surrounding quotes from value
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "${key}=${value}"
  done < "${SCRIPT_DIR}/.env"
fi

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------

log_info "Checking prerequisites…"

# GITHUB_TOKEN
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  log_error "GITHUB_TOKEN environment variable is not set."
  log_error "Copy .env.example to .env and set your GitHub Personal Access Token."
  exit 1
fi
log_ok "GITHUB_TOKEN is set"

# kiro-cli
if ! command -v kiro-cli &>/dev/null; then
  log_error "kiro-cli is not installed or not in PATH."
  log_error "Install with: npm install -g @kiro/cli"
  exit 1
fi
KIRO_CLI_VERSION="$(kiro-cli --version 2>/dev/null || echo 'unknown')"
log_ok "kiro-cli found: ${KIRO_CLI_VERSION}"

# Docker (required for GitHub MCP server)
if ! command -v docker &>/dev/null; then
  log_warn "Docker not found — the GitHub MCP server requires Docker."
  log_warn "Install Docker from https://docs.docker.com/get-docker/"
fi
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  log_ok "Docker daemon is running"
else
  log_warn "Docker daemon is not running — start Docker before proceeding."
fi

# tsx
if ! command -v tsx &>/dev/null && ! [[ -f "${SCRIPT_DIR}/node_modules/.bin/tsx" ]]; then
  log_warn "tsx not found. Run: npm install first."
fi

# node_modules
if [[ ! -d "${SCRIPT_DIR}/node_modules" ]]; then
  log_info "node_modules not found — running npm install…"
  npm install --prefix "${SCRIPT_DIR}"
fi

echo ""

# ---------------------------------------------------------------------------
# Step 1: Generate spec files
# ---------------------------------------------------------------------------

log_info "Step 1/2 — Generating Kiro spec for issue #${ISSUE_NUMBER}…"

npx --prefix "${SCRIPT_DIR}" tsx "${SCRIPT_DIR}/src/spec-gen.ts" "${ISSUE_NUMBER}"

SPEC_DIR="${SCRIPT_DIR}/.kiro/specs/issue-fix"
for f in requirements.md design.md tasks.md; do
  if [[ ! -f "${SPEC_DIR}/${f}" ]]; then
    log_error "Expected spec file not found: ${SPEC_DIR}/${f}"
    exit 1
  fi
done

log_ok "Spec files written to .kiro/specs/issue-fix/"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Invoke kiro-cli --no-interactive
# ---------------------------------------------------------------------------

log_info "Step 2/2 — Invoking kiro-cli with pr-agent (headless)…"
echo ""

PROMPT="Issue #${ISSUE_NUMBER} in Designerpro13/hb-frontend has been specced in .kiro/specs/issue-fix/. \
Read the spec, clone the repo, implement the security fix following the steering docs and \
security-fix Power guidance, run the test suite, create a branch named fix/issue-${ISSUE_NUMBER}, \
push it, and open a PR referencing issue #${ISSUE_NUMBER}."

kiro-cli chat \
  --no-interactive \
  --agent pr-agent \
  --trust-tools=read,write,shell,grep \
  --output-format stream-json \
  "${PROMPT}" \
  | tee "${SCRIPT_DIR}/run-log.json"

EXIT_CODE="${PIPESTATUS[0]}"

echo ""
if [[ "${EXIT_CODE}" -eq 0 ]]; then
  log_ok "kiro-cli completed — check GitHub for the PR on Designerpro13/hb-frontend"
  log_info "Run log saved to: run-log.json"
else
  log_warn "kiro-cli exited with code ${EXIT_CODE}"
  log_warn "Check run-log.json for details. The PR may still have been opened."
fi

exit "${EXIT_CODE}"
