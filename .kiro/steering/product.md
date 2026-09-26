---
inclusion: always
---

# Product Context

## What is kiro-pr-bot?

`kiro-pr-bot` is a headless automation bot that:

1. Reads an open GitHub issue from **Designerpro13/hb-frontend**
2. Generates a structured Kiro spec (`requirements.md`, `design.md`, `tasks.md`) from the issue description
3. Implements the code fix on the target repo following the spec
4. Opens a Pull Request that references the issue and links back to the spec

The bot is triggered by a single command: `./run.sh <issue-number>`.

## Target Repository

- **Owner / Repo:** `Designerpro13/hb-frontend`
- **Frontend:** Vite + React (TypeScript)
- **Backend:** FastAPI (Python)
- **Open issues:** 21 security-themed issues (localStorage tokens, SQL injection, IDOR, missing CSRF protection, unauthenticated endpoints)

## Goals

- Demonstrate all 7 Kiro lessons in a single coherent project
- Every PR opened by the bot must reference the source issue and include a link to the generated spec
- The demo video target is issue #19 (localStorage access token storage)

## Out of scope

- Merging the PR — humans review and merge
- Fixing multiple issues in a single run — one run = one issue = one PR
- Non-security issues on the target repo
