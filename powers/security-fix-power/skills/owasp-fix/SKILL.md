# OWASP Security Fix Skill — React / FastAPI

This skill provides structured, copy-paste-ready fix patterns for the most common security vulnerabilities found in the `Designerpro13/hb-frontend` repository. Each section includes the vulnerability context, the concrete before/after code, and a verification checklist.

---

## Skill: Fix Insecure Token Storage (localStorage → httpOnly Cookie)

**Trigger keywords:** `localStorage`, `access_token`, `token`, `sessionStorage`

### Vulnerability Context

The frontend stores the JWT/access token in `localStorage`, which is readable by any JavaScript on the page. A single XSS flaw anywhere on the site is enough to exfiltrate the token.

### Step-by-Step Fix

**Step 1 — Remove all `localStorage` token reads/writes from the frontend.**

Find with: `grep -r "localStorage" frontend/src/`

Replace every occurrence of:
```typescript
localStorage.setItem('access_token', token);
const token = localStorage.getItem('access_token');
localStorage.removeItem('access_token');
```

With a cookie-based auth state check:
```typescript
// Auth state is now derived from a /api/me call.
// The cookie is set server-side and is never accessible from JS.
import type { User } from './types.js';

export async function getAuthUser(): Promise<User | null> {
  const res = await fetch('/api/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json() as Promise<User>;
}
```

**Step 2 — Update the FastAPI login endpoint to set an httpOnly cookie.**

```python
from datetime import timedelta
from fastapi import APIRouter, Response, HTTPException
from app.auth import create_access_token, verify_credentials

router = APIRouter()

@router.post("/api/login")
async def login(credentials: LoginRequest, response: Response):
    user = await verify_credentials(credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(hours=1),
    )
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,   # Not readable by JavaScript
        secure=True,     # HTTPS only
        samesite="lax",  # CSRF mitigation
        max_age=3600,
    )
    return {"status": "ok"}
```

**Step 3 — Add a `/api/me` endpoint so the frontend can check auth state.**

```python
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.models import User

router = APIRouter()

@router.get("/api/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    return {"id": current_user.id, "username": current_user.username}
```

**Step 4 — Update the logout endpoint to clear the cookie.**

```python
@router.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"status": "ok"}
```

### Verification Checklist

- [ ] `grep -r "localStorage.setItem" frontend/src/` returns zero results
- [ ] `grep -r "localStorage.getItem" frontend/src/` returns zero results
- [ ] Login response sets `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Lax`
- [ ] `/api/me` returns 401 when the cookie is absent
- [ ] `/api/logout` clears the cookie

---

## Skill: Fix SQL Injection

**Trigger keywords:** `injection`, `sqli`, `f"SELECT`, `f'SELECT`, `execute(`

### Vulnerability Context

The FastAPI backend builds SQL queries using Python f-strings, allowing an attacker to inject arbitrary SQL by crafting a malicious input value.

### Step-by-Step Fix

**Before (vulnerable):**
```python
@app.get("/api/search")
async def search(q: str, db = Depends(get_db)):
    results = db.execute(f"SELECT * FROM items WHERE name LIKE '%{q}%'")
    return results.fetchall()
```

**After (parameterized with SQLAlchemy):**
```python
from sqlalchemy import text

@app.get("/api/search")
async def search(q: str, db = Depends(get_db)):
    stmt = text("SELECT * FROM items WHERE name LIKE :pattern")
    results = db.execute(stmt, {"pattern": f"%{q}%"})
    return results.mappings().all()
```

**Or with the ORM:**
```python
from sqlalchemy import select
from app.models import Item

@app.get("/api/search")
async def search(q: str, db = Depends(get_db)):
    stmt = select(Item).where(Item.name.contains(q))
    return db.execute(stmt).scalars().all()
```

### Verification Checklist

- [ ] `grep -rn "f\"SELECT\|f'SELECT\|f\"UPDATE\|f'DELETE" backend/` returns zero results
- [ ] All `db.execute()` calls use bound parameters or the SQLAlchemy ORM
- [ ] Input with `'; DROP TABLE items; --` returns an error, not a 500

---

## Skill: Fix IDOR (Insecure Direct Object Reference)

**Trigger keywords:** `idor`, `/api/user/{`, `user_id`, `authorization`

### Step-by-Step Fix

```python
from fastapi import HTTPException, Depends
from app.auth import get_current_user
from app.models import User

@app.get("/api/user/{user_id}")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user
```

### Verification Checklist

- [ ] Authenticated request for own user ID returns 200
- [ ] Authenticated request for a different user ID returns 403
- [ ] Unauthenticated request returns 401

---

## Skill: Fix Missing CSRF Protection

**Trigger keywords:** `csrf`, `SameSite`, `cross-site`

### Step-by-Step Fix

```python
# SameSite=Lax on the auth cookie (see token storage fix) provides baseline CSRF protection.
# For state-changing endpoints beyond login, add a double-submit CSRF token:

from fastapi import Header, HTTPException, Cookie
import secrets

def verify_csrf(
    x_csrf_token: str = Header(...),
    csrf_cookie: str = Cookie(..., alias="csrf_token"),
):
    if not secrets.compare_digest(x_csrf_token, csrf_cookie):
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

@app.post("/api/sensitive-action")
async def sensitive_action(
    payload: ActionRequest,
    _csrf: None = Depends(verify_csrf),
    current_user: User = Depends(get_current_user),
):
    ...
```

---

## General PR Description Template

When opening a PR for a security fix, use this structure:

```markdown
## Security Fix: [Issue Title]

Closes #[N]

### What was the vulnerability?
[One paragraph describing the root cause and the attack vector]

### What was changed?
- [File 1]: [What changed and why]
- [File 2]: [What changed and why]

### How to verify the fix?
1. [Step 1]
2. [Step 2]

### Spec
This fix was implemented from the Kiro spec at `.kiro/specs/issue-fix/`.
- [requirements.md](.kiro/specs/issue-fix/requirements.md)
- [design.md](.kiro/specs/issue-fix/design.md)
- [tasks.md](.kiro/specs/issue-fix/tasks.md)
```
