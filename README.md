# kiro-pr-bot

A bot that reads an open GitHub issue, generates a Kiro spec for the fix, implements the code change on a branch, and opens a Pull Request — triggered by a single command.

```bash
./run.sh 19
```

Built with [Kiro CLI](https://kiro.dev/cli/) for the [Kiro University Challenge 2026](https://kiro.dev/2026/university/).  
Target repo: [Designerpro13/hb-frontend](https://github.com/Designerpro13/hb-frontend) — a Vite + React / FastAPI security lab with 21 open OWASP-style issues.

---

## How it works

```
./run.sh 19
  │
  ├─ 1. Validates environment (GITHUB_TOKEN, kiro-cli, Docker)
  ├─ 2. tsx src/spec-gen.ts 19
  │       └─ Fetches issue #19 from GitHub via Octokit
  │       └─ Writes .kiro/specs/issue-fix/{requirements,design,tasks}.md
  │
  └─ 3. kiro-cli chat --no-interactive --agent pr-agent ...
          └─ pr-agent reads the spec + steering + security-fix Power
          └─ MCP: reads issue details, creates branch, opens PR
          └─ Hook: lints on every file save
          └─ Hook: runs tests before finishing
          └─ Hook: pr-guard checks preconditions before create_pull_request
```

**Demo target:** issue #19 — *"Access token stored in localStorage"*  
The agent fixes the React frontend and FastAPI backend, then opens a PR.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | ≥ 20 | `node --version` |
| Docker | any recent | `docker info` |
| kiro-cli | latest | `kiro-cli --version` |
| GitHub PAT | — | scopes: `repo`, `issues`, `pull_requests` |

---

## Setup

```bash
git clone https://github.com/Designerpro13/kiro-pr-bot.git
cd kiro-pr-bot
npm install
cp .env.example .env
# Edit .env — set GITHUB_TOKEN=ghp_...
```

Verify connectivity (optional):
```bash
npm run verify-mcp
```

---

## Usage

```bash
./run.sh 19    # Fix: "Access token stored in localStorage"
./run.sh 13    # Fix: "SQL injection in /api/search"
```

The agent streams output to the terminal and saves a full run log to `run-log.json`.

---

## Kiro Lessons Demonstrated

| # | Lesson | Artifact | What it does |
|---|---|---|---|
| 1 | **Specs** | `.kiro/specs/issue-fix/` | `requirements.md`, `design.md`, `tasks.md` — generated from the live GitHub issue |
| 2 | **Steering** | `.kiro/steering/` | 4 files: `product.md`, `tech.md`, `code-conventions.md` (`always`), `security-fix-patterns.md` (`auto`) |
| 3 | **Hooks** | `.kiro/hooks/` | `PostFileSave` → ESLint fix · `Stop` → npm test · `PreToolUse` → pr-guard |
| 4 | **MCP** | `.kiro/settings/mcp.json` | GitHub Docker MCP — `list_issues`, `create_branch`, `create_pull_request`, `add_issue_comment` |
| 5 | **Powers** | `powers/security-fix-power/` | Custom Power with OWASP skill — activates on keywords: `localStorage`, `injection`, `csrf`, `idor` |
| 6 | **Custom Agent** | `.kiro/agents/pr-agent.json` | Scoped to `read,write,shell,grep` · pre-loaded steering · shell permission rules |
| 7 | **CLI Headless** | `run.sh` | `kiro-cli chat --no-interactive --agent pr-agent --output-format stream-json` |

---

## Project Structure

```
kiro-pr-bot/
├── .kiro/
│   ├── specs/issue-fix/             # Lesson 1 — generated per run
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   ├── steering/                    # Lesson 2
│   │   ├── product.md               # inclusion: always
│   │   ├── tech.md                  # inclusion: always
│   │   ├── code-conventions.md      # inclusion: always
│   │   └── security-fix-patterns.md # inclusion: auto (OWASP patterns)
│   ├── hooks/                       # Lesson 3
│   │   ├── lint-on-save.json        # PostFileSave → eslint --fix
│   │   ├── test-on-stop.json        # Stop → npm test
│   │   └── pr-guard.json            # PreToolUse create_pull_request → pr-guard.sh
│   ├── settings/
│   │   └── mcp.json                 # Lesson 4 — GitHub Docker MCP
│   └── agents/
│       └── pr-agent.json            # Lesson 6 — scoped custom agent
│
├── powers/                          # Lesson 5
│   └── security-fix-power/
│       ├── plugin.json              # keywords: owasp, localStorage, injection …
│       └── skills/owasp-fix/
│           └── SKILL.md             # Before/after fix patterns for all 21 issues
│
├── src/
│   ├── spec-gen.ts     # Octokit → 3 spec files
│   ├── pipeline.ts     # Orchestrator (validate → spec-gen → kiro-cli)
│   └── verify-mcp.ts   # Token scope + issue list check
│
├── tests/
│   ├── spec-gen.test.ts   # 26 unit tests (all mocked)
│   └── pipeline.test.ts   # 10 unit tests (all mocked)
│
├── scripts/
│   └── pr-guard.sh        # Pre-PR gate: spec files + tests + localStorage check
│
├── run.sh             # Lesson 7 entry point
├── package.json       # Node 20 ESM, pinned deps
├── tsconfig.json      # strict NodeNext
├── eslint.config.js   # typescript-eslint strictTypeChecked
└── .env.example
```

---

## Development

```bash
npm run typecheck   # tsc --noEmit (must pass before any commit)
npm test            # vitest --run  (36 tests)
npm run lint        # eslint
npm run lint:fix    # eslint --fix
```

---

## Hook Behaviour

**`lint-on-save.json`** — `PostFileSave` on `*.ts|*.tsx`  
Every file the agent saves is auto-linted with `eslint --fix`. Keeps generated code clean without manual steps.

**`test-on-stop.json`** — `Stop`  
Runs `npm test` automatically when the agent finishes. Catches regressions before the session ends.

**`pr-guard.json`** — `PreToolUse` on `create_pull_request`  
Before the GitHub MCP can open a PR, `scripts/pr-guard.sh` checks:
- All three spec files exist under `.kiro/specs/issue-fix/`
- The test suite passes
- No `localStorage` token patterns remain in `hb-frontend/frontend/src/`

Default: soft-warn (PR proceeds with warnings logged). Set `STRICT_PR_GUARD=1` to hard-block.

---

## MCP Configuration

The GitHub MCP server runs via Docker (`ghcr.io/github/github-mcp-server`).  
Toolsets enabled: `repos`, `issues`, `pull_requests`.

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
               "-e", "GITHUB_TOOLSETS", "ghcr.io/github/github-mcp-server"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}",
        "GITHUB_TOOLSETS": "repos,issues,pull_requests"
      }
    }
  }
}
```

---

## Security

- `GITHUB_TOKEN` is read from the environment — never hardcoded or committed
- The `pr-agent` shell permissions deny `rm -rf *` and `sudo *`
- `.kiroignore` (if used) can gate access to `.env`
- The target repo is a controlled security lab — intentionally vulnerable, not production

---

## License

MIT
