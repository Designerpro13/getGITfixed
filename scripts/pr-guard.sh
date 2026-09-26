#!/usr/bin/env bash
# pr-guard.sh
#
# Pre-PR gate script invoked by .kiro/hooks/pr-guard.json before
# the create_pull_request MCP tool fires.
#
# Behaviour (soft-warn): logs warnings but always exits 0 so the PR
# proceeds even if preconditions are not fully met. This is intentional
# for demo and CI contexts — set STRICT_PR_GUARD=1 to flip to hard-block.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

STRICT="${STRICT_PR_GUARD:-0}"
WARNINGS=0

log_info()  { echo "[getGITfixed:pr-guard] ℹ  $*"; }
log_warn()  { echo "[getGITfixed:pr-guard] ⚠  $*" >&2; WARNINGS=$((WARNINGS + 1)); }
log_ok()    { echo "[getGITfixed:pr-guard] ✓  $*"; }
log_error() { echo "[getGITfixed:pr-guard] ✗  $*" >&2; }

log_info "Running pre-PR checks…"

# ---------------------------------------------------------------------------
# Check 1: Spec files exist
# ---------------------------------------------------------------------------

SPEC_DIR="${PROJECT_ROOT}/.kiro/specs/issue-fix"

for f in requirements.md design.md tasks.md; do
  if [[ -f "${SPEC_DIR}/${f}" ]]; then
    log_ok "Spec file present: ${f}"
  else
    log_warn "Spec file missing: ${SPEC_DIR}/${f}"
    log_warn "Run: tsx src/spec-gen.ts <issue-number> to generate the spec first."
  fi
done

# ---------------------------------------------------------------------------
# Check 2: Test suite passes
# ---------------------------------------------------------------------------

log_info "Running test suite…"
if npm test --prefix "${PROJECT_ROOT}" 2>&1; then
  log_ok "All tests passed"
else
  log_warn "Test suite reported failures. Review test output before merging."
fi

# ---------------------------------------------------------------------------
# Check 3: No localStorage token patterns remain (if applicable)
# ---------------------------------------------------------------------------

TARGET_REPO="${PROJECT_ROOT}/hb-frontend"
if [[ -d "${TARGET_REPO}/frontend" ]]; then
  if grep -rq "localStorage\.setItem.*token\|localStorage\.getItem.*token" "${TARGET_REPO}/frontend/src/" 2>/dev/null; then
    log_warn "localStorage token patterns detected in frontend/src/ — verify the fix is complete."
  else
    log_ok "No localStorage token patterns detected in hb-frontend"
  fi
else
  log_info "hb-frontend clone not found at ${TARGET_REPO} — skipping localStorage check"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

if [[ "${WARNINGS}" -gt 0 ]]; then
  echo ""
  echo "[getGITfixed:pr-guard] ⚠  ${WARNINGS} warning(s) detected. Proceeding with PR (soft-warn mode)."
  echo "[getGITfixed:pr-guard]    Set STRICT_PR_GUARD=1 to block PRs when warnings are present."

  if [[ "${STRICT}" == "1" ]]; then
    log_error "STRICT_PR_GUARD=1 — blocking PR creation due to ${WARNINGS} warning(s)."
    exit 2  # exit 2 = block in Kiro's PreToolUse hook convention
  fi
else
  echo ""
  log_ok "All pre-PR checks passed. Proceeding with PR creation."
fi

exit 0
