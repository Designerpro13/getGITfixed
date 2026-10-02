#!/usr/bin/env bash
# run.sh — headless entry point for getGITfixed
#
# Usage: ./run.sh <issue-number>
# Example: ./run.sh 19
#
# Validates env, generates specs, then invokes kiro-cli headlessly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check args
if [[ $# -ne 1 ]]; then
  echo "[getGITfixed] Usage: ./run.sh <issue-number>"
  echo "Example: ./run.sh 19"
  exit 1
fi

ISSUE_NUMBER="$1"

# Validate issue number is numeric
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "[getGITfixed] Error: Issue number must be numeric (e.g., 19)"
  exit 1
fi

# Check required tools
echo "[getGITfixed] Checking dependencies…"

# Check Node
if ! command -v node &> /dev/null; then
  echo "[getGITfixed] Error: Node.js is required but not installed."
  exit 1
fi

# Check kiro-cli
if ! command -v kiro-cli &> /dev/null; then
  echo "[getGITfixed] Error: kiro-cli is required but not installed."
  exit 1
fi

# Check Docker (start with sudo if needed)
if ! command -v docker &> /dev/null; then
  echo "[getGITfixed] Error: Docker is required but not installed."
  exit 1
fi

# Try to start Docker daemon with sudo if not running
if ! docker info &> /dev/null 2>&1; then
  echo "[getGITfixed] Docker daemon not running. Attempting to start with sudo…"
  if ! sudo docker info &> /dev/null 2>&1; then
    echo "[getGITfixed] Error: Docker daemon could not be started. Please ensure sudo is configured or Docker is running."
    exit 1
  fi
  echo "[getGITfixed] Docker daemon started."
fi

# Check GITHUB_TOKEN
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[getGITfixed] Error: GITHUB_TOKEN environment variable is not set."
  echo "Copy .env.example to .env, fill in your GitHub PAT, then run: export \$(cat .env | xargs)"
  exit 1
fi

# Check spec generator
if [[ ! -f "src/spec-gen.ts" ]]; then
  echo "[getGITfixed] Error: spec-gen.ts not found."
  exit 1
fi

echo "[getGITfixed] Generating spec for issue #${ISSUE_NUMBER}…"

# Generate spec files
npx tsx src/spec-gen.ts "$ISSUE_NUMBER"

# Verify specs were written
for file in requirements.md design.md tasks.md; do
  if [[ ! -f ".kiro/specs/issue-fix/${file}" ]]; then
    echo "[getGITfixed] Error: Spec file ${file} was not written."
    exit 1
  fi
done

echo "[getGITfixed] Specs generated. Running kiro-cli headlessly…"

# Run kiro-cli headlessly with stream-json output
kiro-cli chat \
  --no-interactive \
  --trust-all-tools \
  --agent pr-agent \
  --output-format stream-json \
  -- \
  "Fix issue #${ISSUE_NUMBER}" \
  2>&1 | tee run-log.json

echo ""
echo "[getGITfixed] Pipeline complete. Check run-log.json and .kiro/specs/issue-fix/ for details."
