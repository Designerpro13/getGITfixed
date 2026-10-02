---
specId: issue-2
issueNumber: 2
---

# Design: Debug mode and verbose exception responses expose internals

## Overview

This document describes the technical approach for fixing the security vulnerability
reported in issue #2.

## Affected Areas

The specific files and components to modify depend on the issue type. Use the
checklist in `.kiro/steering/security-fix-patterns.md` to identify the relevant code.

Common patterns for hb-frontend issues:

| Issue Type | Frontend Files | Backend Files |
|---|---|---|
| localStorage token | `frontend/src/auth.ts`, `frontend/src/hooks/useAuth.ts` | `backend/app/routers/auth.py` |
| SQL injection | — | `backend/app/routers/search.py`, `backend/app/db.py` |
| IDOR | — | `backend/app/routers/users.py` |
| CSRF | `frontend/src/api.ts` | `backend/app/middleware.py` |

## Fix Approach

1. **Identify** all instances of the vulnerable pattern using `grep` on the codebase
2. **Apply** the before→after replacement from the relevant section of `security-fix-patterns.md`
3. **Test** manually and with automated tests
4. **Review** the security checklist at the bottom of `security-fix-patterns.md`

## Security Rationale

Refer to the OWASP classification in the issue body and the guidance in
`.kiro/steering/security-fix-patterns.md` for the specific CWE reference and
fix rationale.

## Branch Naming

`fix/issue-2-<short-slug>`

Example: `fix/issue-2-debug-mode-and-verbose-exception-respons`

## PR Description Template

Use the template provided in `powers/security-fix-power/skills/owasp-fix/SKILL.md`
under "General PR Description Template".

## Testing Strategy

- **Unit tests:** Mock the affected service/function and assert secure behaviour
- **Integration tests:** Confirm the endpoint returns the correct HTTP status codes
  (401 for unauth, 403 for forbidden, 200 for authorised owner)
- **Regression:** All existing tests must still pass
