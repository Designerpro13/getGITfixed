---
specId: issue-1
issueNumber: 1
---

# Tasks: Hardcoded credentials and secrets in backend source

## Pre-flight

- [ ] 1. Confirm `GITHUB_TOKEN` environment variable is set and has `repo`, `issues`, `pull_requests` scopes
- [ ] 2. Verify Docker is running (required for GitHub MCP server): `docker info`
- [ ] 3. Read the issue body in full: [#1](https://github.com/Designerpro13/hb-frontend/issues/1)

## Spec

- [ ] 4. Read `.kiro/specs/issue-fix/requirements.md` — understand acceptance criteria
- [ ] 5. Read `.kiro/specs/issue-fix/design.md` — identify files to change
- [ ] 6. Read `.kiro/steering/security-fix-patterns.md` — load OWASP fix guidance

## Implementation

- [ ] 7. Clone or navigate to a local copy of `Designerpro13/hb-frontend`
- [ ] 8. Run existing tests to establish a clean baseline: `npm test` (frontend) / `pytest` (backend)
- [ ] 9. Apply the fix following `design.md` and the security-fix-patterns guidance
- [ ] 10. Write new tests that verify the specific vulnerability is fixed
- [ ] 11. Run the full test suite and confirm it passes

## Git & PR

- [ ] 12. Create a branch: `git checkout -b fix/issue-1-<slug>`
- [ ] 13. Stage and commit: `git commit -m "fix: remediate security issue #1"`
- [ ] 14. Push the branch: `git push -u origin fix/issue-1-<slug>`
- [ ] 15. Open a PR via GitHub MCP referencing issue #1
- [ ] 16. Add a comment on issue #1 linking back to the PR

## Verification

- [ ] 17. Confirm the PR description includes a link to this spec
- [ ] 18. Confirm the vulnerability checklist in `security-fix-patterns.md` is all green
- [ ] 19. Confirm no `localStorage` token reads/writes remain (if applicable)
