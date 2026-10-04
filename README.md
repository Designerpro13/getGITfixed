# getGITfixed

> Point it at a GitHub issue. Get a PR back.

```bash
./intro.sh          # see what this is
setup.sh     # load .env + verify MCP
./run.sh 19         # fix issue #19, open the PR
```

Built with [Kiro CLI](https://kiro.dev) for the [Kiro University Challenge 2026](https://kiro.dev/2026/university).  
Target repo: [Designerpro13/hb-frontend](https://github.com/Designerpro13/hb-frontend) — a Vite + React / FastAPI security lab with 21 open OWASP-style issues.

---

## How it works

```
./run.sh <issue>
  │
  ├─ 1. Validates environment   GITHUB_TOKEN · kiro-cli · Docker
  ├─ 2. Starts Docker daemon    sudo systemctl start docker (if needed)
  ├─ 3. spec-gen.ts             Fetches issue from GitHub via Octokit
  │                             Writes .kiro/specs/issue-fix/
  │                               ├── requirements.md  (user story + AC)
  │                               ├── design.md        (fix approach + branch name)
  │                               └── tasks.md         (19-step checklist)
  │
  └─ 4. kiro-cli --no-interactive --agent pr-agent --trust-all-tools
          ├── Reads spec + steering + OWASP Power
          ├── Clones Designerpro13/hb-frontend
          ├── Implements the security fix
          ├── Runs the test suite
          ├── Creates branch  fix/issue-<N>-<slug>
          ├── Opens PR referencing the issue + spec
          └── Comments on the original issue with the PR link

  Progress bar on stdout · full output streamed to logs/run-<N>-<ts>.log
```

---

## Prerequisites

| Requirement | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Docker | any recent | [docker.com](https://docker.com) |
| kiro-cli | latest | `npm install -g @kirodotdev/cli` |
| GitHub PAT | — | scopes: `repo`, `issues`, `pull_requests` |

---

## Setup

```bash
git clone https://github.com/Designerpro13/getGITfixed.git
cd getGITfixed
npm install
cp .env.example .env
# Edit .env → set GITHUB_TOKEN=ghp_...
```

Then run the setup script — it loads `.env`, exports the token, and verifies MCP connectivity:

```bash
source setup.sh
```

---

## Usage

```bash
./run.sh 2     # Fix: "Debug mode exposes stack traces and secrets"
./run.sh 19    # Fix: "Access token stored in localStorage"
./run.sh 13    # Fix: "SQL injection in /api/search"
```

Each run creates a timestamped log at `logs/run-<N>-<timestamp>.log`.  
Spec files are written to `.kiro/specs/issue-fix/` before the agent starts.

---

## Kiro Lessons Demonstrated

| # | Lesson | Artifact | What it does |
|---|---|---|---|
| 1 | **Specs** | `.kiro/specs/issue-fix/` | Three spec files generated at runtime from the live GitHub issue via `src/spec-gen.ts` |
| 2 | **Steering** | `.kiro/steering/` | 4 files loaded into every session — `product.md`, `tech.md`, `code-conventions.md` (always), `security-fix-patterns.md` (auto on OWASP keywords) |
| 3 | **Hooks** | `.kiro/hooks/` | `PostFileSave` → ESLint fix · `Stop` → npm test · `PreToolUse` → pr-guard before any PR is opened |
| 4 | **Property-based testing** | `tests/` | Correctness review on `src/spec-gen.ts` — 8 pytest + 36 Vitest tests covering edge cases |
| 5 | **Powers** | `powers/security-fix-power/` | Custom Power with OWASP skill — auto-activates on: `localStorage`, `injection`, `csrf`, `idor`, `xss`, `sqli` |
| 6 | **MCP** | `.kiro/agents/pr-agent.json` | GitHub Docker MCP inline — `list_issues`, `create_branch`, `create_pull_request`, `add_issue_comment` |
| 7 | **Custom Agent** | `.kiro/agents/pr-agent.json` | Scoped to `read,write,shell,grep` · `model: auto` · shell allow/deny list · steering pre-loaded |
| CLI | **Headless** | `run.sh` | `kiro-cli chat --no-interactive --trust-all-tools --agent pr-agent --output-format stream-json` |

---

## Project Structure

```
getGITfixed/
├── .kiro/
│   ├── specs/issue-fix/             ← generated per run
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── steering/
│   │   ├── product.md               ← inclusion: always
│   │   ├── tech.md                  ← inclusion: always
│   │   ├── code-conventions.md      ← inclusion: always
│   │   └── security-fix-patterns.md ← inclusion: auto (OWASP before/after patterns)
│   ├── hooks/
│   │   ├── lint-on-save.json        ← PostFileSave → eslint --fix
│   │   ├── test-on-stop.json        ← Stop → npm test
│   │   └── pr-guard.json            ← PreToolUse create_pull_request → pr-guard.sh
│   ├── settings/
│   │   └── mcp.json                 ← GitHub Docker MCP (workspace-level)
│   └── agents/
│       └── pr-agent.json            ← scoped custom agent
│
├── powers/
│   └── security-fix-power/
│       ├── plugin.json              ← keywords + skill reference
│       └── skills/owasp-fix/
│           └── SKILL.md             ← before/after fix patterns for all vuln types
│
├── src/
│   ├── spec-gen.ts     ← Octokit → 3 spec files (with optional octokit injection)
│   ├── pipeline.ts     ← validate → spec-gen → kiro-cli
│   └── verify-mcp.ts   ← token scope check + issue list
│
├── tests/
│   ├── spec-gen.test.ts   ← 26 unit tests (all mocked)
│   └── pipeline.test.ts   ← 10 unit tests (all mocked)
│
├── scripts/
│   └── pr-guard.sh        ← pre-PR gate: spec files · tests · localStorage check
│
├── semantic-review/
│   └── *.md               ← Kiro IDE Correctness review artifacts
│
├── logs/                  ← per-run log files (gitignored)
│
├── intro.sh               ← ASCII art intro + project overview
├── setup.sh               ← load .env, export token, verify MCP
├── run.sh                 ← main entry point (progress bar + log file)
├── package.json
├── tsconfig.json          ← strict NodeNext
├── eslint.config.js       ← typescript-eslint strictTypeChecked
└── .env.example
```

---

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest --run  (36 tests)
npm run lint        # eslint
npm run lint:fix    # eslint --fix
```

All three must be clean before committing.

---

## Hook Behaviour

**`lint-on-save.json`** (`PostFileSave` on `*.ts|*.tsx`)  
Every TypeScript file the agent saves is immediately auto-fixed with `eslint --fix`.

**`test-on-stop.json`** (`Stop`)  
`npm test` runs automatically when the agent finishes its session.

**`pr-guard.json`** (`PreToolUse` on `create_pull_request`)  
Before any PR is opened, `scripts/pr-guard.sh` checks:
- All three spec files exist in `.kiro/specs/issue-fix/`
- The test suite passes (`npm test`)
- No `localStorage` token patterns remain in the frontend code

Set `STRICT_PR_GUARD=1` to hard-block the PR on failure (default: soft-warn).

---

## MCP Configuration

GitHub MCP server runs via Docker (`ghcr.io/github/github-mcp-server`).  
Defined both in `.kiro/settings/mcp.json` (workspace) and inline in `pr-agent.json`.  
Toolsets: `repos`, `issues`, `pull_requests`.

Token is always read from `${GITHUB_TOKEN}` — never hardcoded.

---

## Security Notes

- `GITHUB_TOKEN` is injected via environment, never committed
- Agent shell permissions: allow `npm`, `git`, `npx`, `tsx`, `bash` — deny `rm -rf`, `sudo`, `chmod 777`
- `.env` is gitignored
- Target repo is a controlled security lab — intentionally vulnerable, not production

