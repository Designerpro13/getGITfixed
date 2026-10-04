#!/usr/bin/env bash
# intro.sh — project intro with ASCII art

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

clear

printf "${CYAN}"
cat << 'EOF'

   ██████╗ ███████╗████████╗ ██████╗ ██╗████████╗███████╗██╗██╗  ██╗███████╗██████╗
  ██╔════╝ ██╔════╝╚══██╔══╝██╔════╝ ██║╚══██╔══╝██╔════╝██║╚██╗██╔╝██╔════╝██╔══██╗
  ██║  ███╗█████╗     ██║   ██║  ███╗██║   ██║   █████╗  ██║ ╚███╔╝ █████╗  ██║  ██║
  ██║   ██║██╔══╝     ██║   ██║   ██║██║   ██║   ██╔══╝  ██║ ██╔██╗ ██╔══╝  ██║  ██║
  ╚██████╔╝███████╗   ██║   ╚██████╔╝██║   ██║   ██║     ██║██╔╝ ██╗███████╗██████╔╝
   ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝ ╚═╝   ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═════╝

EOF
printf "${NC}"

printf "${DIM}  ─────────────────────────────────────────────────────────────────────────────${NC}\n"
printf "${BOLD}${GREEN}  Point it at a GitHub issue. Get a PR back.${NC}\n"
printf "${DIM}  ─────────────────────────────────────────────────────────────────────────────${NC}\n"
echo ""

printf "  ${BOLD}What it does:${NC}\n"
printf "  ${CYAN}1.${NC} Reads a GitHub issue via the GitHub MCP\n"
printf "  ${CYAN}2.${NC} Generates a Kiro spec  ${DIM}(requirements · design · tasks)${NC}\n"
printf "  ${CYAN}3.${NC} Implements the security fix on a branch\n"
printf "  ${CYAN}4.${NC} Runs the test suite\n"
printf "  ${CYAN}5.${NC} Opens a PR — referencing the issue and the spec\n"
echo ""

printf "  ${BOLD}7 Kiro lessons, one pipeline:${NC}\n"
printf "  ${YELLOW}◆${NC} Specs        ${DIM}·${NC} auto-generated from live GitHub issues\n"
printf "  ${YELLOW}◆${NC} Steering     ${DIM}·${NC} OWASP patterns + project conventions always in context\n"
printf "  ${YELLOW}◆${NC} Hooks        ${DIM}·${NC} lint on save · test on stop · PR guard\n"
printf "  ${YELLOW}◆${NC} MCP          ${DIM}·${NC} GitHub Docker MCP for branches, PRs, comments\n"
printf "  ${YELLOW}◆${NC} Powers       ${DIM}·${NC} security-fix Power with OWASP skill\n"
printf "  ${YELLOW}◆${NC} Custom Agent ${DIM}·${NC} scoped pr-agent, model=auto, shell allow/deny list\n"
printf "  ${YELLOW}◆${NC} Headless CLI ${DIM}·${NC} stream-json · progress bar · per-run log file\n"
echo ""

printf "${DIM}  ─────────────────────────────────────────────────────────────────────────────${NC}\n"
printf "  ${BOLD}Usage:${NC}\n"
echo ""
printf "    ${GREEN}source setup.sh${NC}          ${DIM}# load .env + verify MCP${NC}\n"
printf "    ${GREEN}./run.sh <issue-number>${NC}  ${DIM}# e.g. ./run.sh 19${NC}\n"
echo ""
printf "${DIM}  ─────────────────────────────────────────────────────────────────────────────${NC}\n"
printf "  ${DIM}github.com/Designerpro13/getGITfixed  ·  Kiro University Challenge 2026${NC}\n"
printf "${DIM}  ─────────────────────────────────────────────────────────────────────────────${NC}\n"
echo ""
