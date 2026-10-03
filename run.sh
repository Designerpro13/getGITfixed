#!/usr/bin/env bash
# run.sh — headless entry point for getGITfixed
#
# Usage: ./run.sh <issue-number>
# Example: ./run.sh 19
#
# Shows a live progress bar on stdout; all raw output goes to logs/run-<N>-<ts>.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Log file setup
# ---------------------------------------------------------------------------
mkdir -p logs
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
if [[ $# -ne 1 ]]; then
  echo "[getGITfixed] Usage: ./run.sh <issue-number>"
  echo "  Example: ./run.sh 19"
  exit 1
fi

ISSUE_NUMBER="$1"

if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "[getGITfixed] Error: Issue number must be numeric (e.g., 19)"
  exit 1
fi

LOG_FILE="logs/run-${ISSUE_NUMBER}-${TIMESTAMP}.log"

# ---------------------------------------------------------------------------
# Progress bar helpers
# ---------------------------------------------------------------------------
COLS="${COLUMNS:-80}"
BAR_WIDTH=$(( COLS - 30 ))
[[ $BAR_WIDTH -lt 20 ]] && BAR_WIDTH=20

# Stages: label + weight (weights must sum to 100)
STAGE_LABELS=("Preflight" "Docker" "Spec gen" "Agent" "Done")
STAGE_WEIGHTS=(5 10 20 60 5)
CURRENT_STAGE=0
CURRENT_PCT=0

_bar() {
  local pct=$1
  local label=$2
  local filled=$(( pct * BAR_WIDTH / 100 ))
  local empty=$(( BAR_WIDTH - filled ))
  local bar
  bar="$(printf '%*s' "$filled" '' | tr ' ' '█')$(printf '%*s' "$empty" '' | tr ' ' '░')"
  printf "\r\033[K  [%s] %3d%%  %s" "$bar" "$pct" "$label"
}

_advance() {
  # advance to stage index $1
  local target=$1
  local label="${STAGE_LABELS[$target]}"
  # sum weights up to and including target
  local sum=0
  for (( i=0; i<=target; i++ )); do
    sum=$(( sum + STAGE_WEIGHTS[i] ))
  done
  CURRENT_PCT=$sum
  CURRENT_STAGE=$target
  _bar "$CURRENT_PCT" "$label"
}

_spinner_pid=""
_start_spinner() {
  local label="$1"
  local pct="$2"
  ( local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local i=0
    while true; do
      printf "\r\033[K  ${frames[$i]}  %3d%%  %s" "$pct" "$label"
      i=$(( (i+1) % ${#frames[@]} ))
      sleep 0.1
    done
  ) &
  _spinner_pid=$!
}

_stop_spinner() {
  if [[ -n "$_spinner_pid" ]]; then
    kill "$_spinner_pid" 2>/dev/null || true
    wait "$_spinner_pid" 2>/dev/null || true
    _spinner_pid=""
  fi
}

# ---------------------------------------------------------------------------
# Logging: stderr goes to terminal, all raw output to log file
# ---------------------------------------------------------------------------
log() {
  local msg="[getGITfixed] $*"
  echo "$msg" >> "$LOG_FILE"
}

err() {
  _stop_spinner
  echo ""
  echo "[getGITfixed] ✗ $*" >&2
  echo "[getGITfixed] ✗ $*" >> "$LOG_FILE"
}

# trap to clean up spinner on exit
trap '_stop_spinner; echo ""' EXIT

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
printf "\n  getGITfixed — issue #%s\n" "$ISSUE_NUMBER"
printf "  Log → %s\n\n" "$LOG_FILE"

# ---------------------------------------------------------------------------
# Stage 0: Preflight
# ---------------------------------------------------------------------------
_start_spinner "Preflight checks…" 0
{
  log "=== Run started at $(date -Iseconds) ==="
  log "Issue: #${ISSUE_NUMBER}"

  # Node
  if ! command -v node &>/dev/null; then
    err "Node.js is required but not installed."
    exit 1
  fi
  log "node: $(node --version)"

  # kiro-cli
  if ! command -v kiro-cli &>/dev/null; then
    err "kiro-cli is required. Install: npm install -g @kirodotdev/cli"
    exit 1
  fi
  log "kiro-cli: $(kiro-cli --version 2>&1 | head -1)"

  # Docker installed?
  if ! command -v docker &>/dev/null; then
    err "Docker is required but not installed."
    exit 1
  fi

  # GITHUB_TOKEN
  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    err "GITHUB_TOKEN not set. Run: export \$(cat .env | xargs)"
    exit 1
  fi
  log "GITHUB_TOKEN: ${GITHUB_TOKEN:0:4}****"

  # spec-gen.ts
  if [[ ! -f "src/spec-gen.ts" ]]; then
    err "src/spec-gen.ts not found."
    exit 1
  fi
} >> "$LOG_FILE" 2>&1
_stop_spinner
_advance 0

# ---------------------------------------------------------------------------
# Stage 1: Docker
# ---------------------------------------------------------------------------
_start_spinner "Checking Docker…" "$CURRENT_PCT"
{
  log "=== Docker ==="
  if docker info &>/dev/null 2>&1; then
    log "Docker already running."
  else
    log "Docker not running — starting in background with sudo…"
    sudo systemctl start docker &>/dev/null 2>&1 &
    DOCKER_START_PID=$!
    # Poll up to 15s without blocking the spinner
    DOCKER_READY=0
    for i in {1..15}; do
      sleep 1
      if docker info &>/dev/null 2>&1; then
        DOCKER_READY=1
        break
      fi
    done
    wait "$DOCKER_START_PID" 2>/dev/null || true
    if [[ $DOCKER_READY -eq 0 ]]; then
      log "Docker not ready after 15s — trying sudo docker info as fallback…"
      if sudo docker info &>/dev/null 2>&1; then
        log "Docker available via sudo. Continuing."
      else
        err "Docker daemon did not start. Run: sudo systemctl start docker"
        exit 1
      fi
    else
      log "Docker daemon ready."
    fi
  fi
} >> "$LOG_FILE" 2>&1
_stop_spinner
_advance 1

# ---------------------------------------------------------------------------
# Stage 2: Spec generation
# ---------------------------------------------------------------------------
_start_spinner "Generating spec for issue #${ISSUE_NUMBER}…" "$CURRENT_PCT"
{
  log "=== Spec generation ==="
  npx tsx src/spec-gen.ts "$ISSUE_NUMBER"
} >> "$LOG_FILE" 2>&1

# Verify spec files
for file in requirements.md design.md tasks.md; do
  if [[ ! -f ".kiro/specs/issue-fix/${file}" ]]; then
    _stop_spinner
    err "Spec file ${file} was not written. Check log: ${LOG_FILE}"
    exit 1
  fi
done
_stop_spinner
_advance 2

# ---------------------------------------------------------------------------
# Stage 3: Agent (kiro-cli headless)
# ---------------------------------------------------------------------------
_start_spinner "Agent running (this may take a few minutes)…" "$CURRENT_PCT"
{
  log "=== kiro-cli agent ==="
  kiro-cli chat \
    --no-interactive \
    --trust-all-tools \
    --agent pr-agent \
    --output-format stream-json \
    -- \
    "Fix issue #${ISSUE_NUMBER}"
} >> "$LOG_FILE" 2>&1
AGENT_EXIT=$?
_stop_spinner

if [[ $AGENT_EXIT -ne 0 ]]; then
  err "kiro-cli exited with code ${AGENT_EXIT}. Check log: ${LOG_FILE}"
  # Don't exit — a non-zero exit doesn't always mean the PR failed to open
fi
_advance 3

# ---------------------------------------------------------------------------
# Stage 4: Done
# ---------------------------------------------------------------------------
_advance 4
echo ""
echo ""
printf "  ✓ Pipeline complete\n"
printf "  ✓ Log saved to: %s\n" "$LOG_FILE"
printf "  ✓ Specs at:     .kiro/specs/issue-fix/\n"
echo ""
