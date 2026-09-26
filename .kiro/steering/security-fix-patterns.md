---
inclusion: auto
---

# Security Fix Patterns — React / FastAPI

This file is loaded automatically whenever the agent is working on a security-related fix. It encodes OWASP-aligned before/after patterns
specifically for the `Designerpro13/hb-frontend` tech stack.

---

## 1. Token Storage: localStorage → httpOnly Cookies

**Issue type:** CWE-922 — Insecure Storage of Sensitive Information

### Why localStorage is dangerous

`localStorage` is accessible from any JavaScript on the page. An XSS vulnerability anywhere on the site lets an attacker steal the token with `localStorage.getItem('access_token')`.

### Fix pattern (React frontend)

**Before (`frontend/src/auth.ts` or similar):**

```typescript
// ❌ Insecure — token readable by any script
localStorage.setItem('access_token', token);
const token = localStorage.getItem('access_token');
```

**After:**

```typescript
// ✅ Token is stored in an httpOnly cookie set by the server
// Client-side code never touches the token directly
// Auth state is derived from a /api/me endpoint
async function getAuthStatus(): Promise<{ loggedIn: boolean; user?: User }> {
  const res = await fetch('/api/me', { credentials: 'include' });
  if (!res.ok) return { loggedIn: false };
  return { loggedIn: true, user: await res.json() as User };
}
```

**Backend change (FastAPI):**

```python
# ✅ Set httpOnly, Secure, SameSite=Lax cookie on login
from fastapi import Response

@app.post("/api/login")
async def login(credentials: LoginRequest, response: Response):
    token = create_access_token(credentials)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=3600,
    )
    return {"status": "ok"}
```

---

## 2. SQL Injection: f-strings → Parameterized Queries

**Issue type:** CWE-89 — Improper Neutralization of Special Elements in SQL

### Fix pattern (FastAPI + SQLAlchemy or raw psycopg2)

**Before:**

```python
# ❌ f-string interpolation — SQL injection possible
query = f"SELECT * FROM users WHERE username = '{username}'"
result = db.execute(query)
```

**After (SQLAlchemy ORM):**

```python
# ✅ Parameterized via ORM — no injection possible
from sqlalchemy import select
stmt = select(User).where(User.username == username)
result = db.execute(stmt)
```

**After (raw SQL with psycopg2):**

```python
# ✅ Parameterized placeholder
cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
```

---

## 3. IDOR: Add Ownership Checks

**Issue type:** CWE-639 — Authorization Bypass Through User-Controlled Key

**Before:**

```python
# ❌ Any authenticated user can read any user's data
@app.get("/api/user/{user_id}")
async def get_user(user_id: int, current_user = Depends(get_current_user)):
    return db.query(User).filter(User.id == user_id).first()
```

**After:**

```python
# ✅ Ownership check — user can only access their own record
@app.get("/api/user/{user_id}")
async def get_user(user_id: int, current_user: User = Depends(get_current_user)):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(User).filter(User.id == user_id).first()
```

---

## 4. CSRF Protection

**Issue type:** CWE-352 — Cross-Site Request Forgery

**FastAPI:**

```python
# ✅ Use SameSite=Lax cookies (see pattern 1) — provides basic CSRF protection
# For stricter protection, add a CSRF token header check:
from fastapi import Header, HTTPException

async def verify_csrf(x_csrf_token: str = Header(...)):
    if not is_valid_csrf_token(x_csrf_token):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")
```

---

## 5. Unauthenticated Endpoints

**Issue type:** CWE-306 — Missing Authentication for Critical Function

```python
# ✅ Always protect mutation endpoints with Depends(get_current_user)
@app.post("/api/admin/action")
async def admin_action(
    payload: ActionRequest,
    current_user: User = Depends(get_current_user),
    _admin: None = Depends(require_admin_role),
):
    ...
```

---

## Checklist before opening a PR

- [ ] No `localStorage.setItem/getItem` calls remain for auth tokens
- [ ] All SQL queries use parameterized form
- [ ] All `/api/user/{id}` routes check `current_user.id == id`
- [ ] Login/logout endpoints set `httpOnly` cookies
- [ ] Mutation endpoints are protected with `Depends(get_current_user)`
