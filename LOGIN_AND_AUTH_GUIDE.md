# Login & Authentication System

## 1. Login Page UI

**Location**: `/auth/login`

**Components**:
- Email input field (validated RFC-compliant email)
- Password input field (minimum 6 characters)
- "Sign in" button
- "Forgot password?" link
- Error toast (red) for invalid credentials
- Loading spinner during authentication
- Social login options (Microsoft, Google, GitHub)

**Code Flow**:
1. User enters email + password
2. Clicks "Sign in"
3. `handleLogin()` calls `supabase.auth.signInWithPassword()`
4. On success:
   - JWT token stored in HttpOnly cookie
   - `last_active` timestamp set in profiles.last_active
   - `router.refresh()` reloads session
   - Redirect to `/dashboard`
5. On failure:
   - Error message displayed in red toast
   - User can retry

**Files**:
- Page: `app/auth/login/page.tsx`
- Component: `components/auth/login-page.tsx`
- Session resolver: `lib/auth/resolve-session.ts`

---

## 2. Authentication System

### Provider: Supabase Auth

**Type**: Email + Password authentication

**Session Storage**: 
- JWT stored in HttpOnly cookie (secure, not accessible via JavaScript)
- SameSite=Lax (CSRF protection)
- Secure flag enabled (HTTPS only in production)
- 24-hour expiration with auto-refresh

### Per-Request Session Flow

1. Browser sends request with JWT cookie
2. Middleware validates JWT signature
3. `resolveSession()` runs:
   - Verifies JWT
   - Joins with profiles table
   - Gets user role + permissions
4. Returns `AppSession` (user_id, email, role, permissions)
5. Headers set for server components:
   - `X-User-Id`: User's UUID
   - `X-User-Role`: AppRole (pmo_director, etc.)
   - `X-User-Permissions`: Comma-separated list

### Two Role Vocabularies (By Design)

**DbUserRole** (database layer):
- Used when WRITING to `profiles.role`
- Values: `project_director`, `finance_manager`, `engineer`, etc.
- Located in: `lib/auth/roles.ts`

**AppRole** (application layer):
- Used when READING permissions
- Values: `pmo_director`, `finance_controller`, `engineering_manager`, etc.
- Located in: `lib/session.ts`
- Mapped from DbUserRole via `ROLE_MAP`

**Why two?**: Prevents merge bugs. Each layer has its own vocab.

### Authorization Guards (lib/auth/guard.ts)

All guards are **fail-open** (throw errors, never mock fallback):

```typescript
await requireWriter()           // Verified user + tenant_id set
await requireProjectDirector()  // User has pmo_director role
await requireAssignedApprover() // User assigned to current approval
await requireAuthenticatedUser() // Any logged-in user
```

---

## 3. Pilot Team Login Credentials

**Domain**: gsi.jo (only working mail domain — gridmind.capital is NXDOMAIN)

**5 Test Identities** (using + addressing):

| Email | Role | Password | Permissions |
|-------|------|----------|-------------|
| ahmad@gsi.jo | Project Director (PD) | (ask pilot coordinator) | project.create, approval.decide, admin.audit |
| ahmad+dev@gsi.jo | Engineer (DEV) | (same as above) | project.update, approval.read, hse.read |
| ahmad+dm@gsi.jo | Document Manager (DM) | (same as above) | document.approve, approval.read |
| ahmad+fin@gsi.jo | Finance Manager (FIN) | (same as above) | finance.read, finance.edit, approval.decide |
| ahmad+gcm@gsi.jo | Consultant (GCM) | (same as above) | project.read, approval.read, hse.report |

### Login Test Procedure

**As ahmad@gsi.jo (PD)**:
1. Visit `/auth/login`
2. Enter: `ahmad@gsi.jo`
3. Password: (provided by pilot coordinator)
4. Click "Sign in"
5. Should redirect to `/dashboard`
6. Should show "Moz Farm" project (PRJ-2026-383)
7. Can create opportunities, approve G0, advance gates

**As ahmad+fin@gsi.jo (Finance Manager)**:
1. Visit `/auth/login`
2. Enter: `ahmad+fin@gsi.jo`
3. Password: (same as ahmad@)
4. Click "Sign in"
5. Should redirect to `/dashboard`
6. Should see finance-scoped approvals
7. Can decide payment approvals above threshold

**Role-Based Visibility**:
- PD (ahmad@): Full project visibility, can create/approve
- FIN (ahmad+fin@): Finance-scoped approvals only
- DEV (ahmad+dev@): Engineering workstream only
- DM (ahmad+dm@): Document reviews only
- GCM (ahmad+gcm@): General management views

---

## 4. Session Management

### Sign In
- Calls: `supabase.auth.signInWithPassword(email, password)`
- Returns: JWT token
- Stored: HttpOnly cookie
- Effect: `router.refresh()` reloads server session

### Sign Out
- Navigate to `/dashboard` > Settings
- Click "Sign out"
- Calls: `supabase.auth.signOut()`
- Effect: JWT cookie cleared
- Redirects to `/auth/login`

### Unauthenticated Access
- User visits `/dashboard/*` without JWT
- Middleware checks for cookie
- Not found → `resolveSession()` returns null
- Redirects to `/auth/login?next=/dashboard/...`
- After login, `?next` parameter redirects back to original page

### Session Expired
- JWT expires after 24 hours
- Next request triggers auto-refresh
- If auto-refresh fails, user redirected to `/auth/login`

---

## 5. Security

### Cookie Protection
✓ **HttpOnly**: Not accessible via JavaScript (prevents XSS theft)  
✓ **Secure**: Only sent over HTTPS (prevents network sniffing)  
✓ **SameSite=Lax**: Only sent with same-site requests (prevents CSRF)  
✓ **24-hour expiration**: Limits token lifetime

### SQL Injection Prevention
- All queries use parameterized `supabase.from()` API
- No string concatenation in WHERE clauses

### Authorization Enforcement
- Every state-changing action guards with `requireWriter()`
- Every approval decision guards with `requireAssignedApprover()`
- No hardcoded role checks (use AppRole mappings)
- No mock fallback on auth failure

---

## 6. Architecture

### Files

| File | Purpose |
|------|---------|
| `app/auth/login/page.tsx` | Login page (RSC wrapper) |
| `components/auth/login-page.tsx` | Login UI (client component) |
| `lib/auth/resolve-session.ts` | Session resolution from JWT |
| `lib/auth/guard.ts` | Authorization guards |
| `lib/auth/roles.ts` | DbUserRole enum + role vocabulary |
| `lib/session.ts` | AppRole + AppSession types + ROLE_MAP |

### Flow Diagram

```
Login Page (/auth/login)
    ↓
handleLogin(email, password)
    ↓
supabase.auth.signInWithPassword()
    ↓
JWT returned → HttpOnly cookie set
    ↓
router.refresh() → middleware runs
    ↓
resolveSession() joins with profiles
    ↓
AppSession returned (user_id + role + permissions)
    ↓
Redirect to /dashboard
    ↓
Role-gated UI rendered based on AppRole permissions
```

---

## 7. Testing

### Test: Valid Login
```
Email: ahmad@gsi.jo
Password: (ask coordinator)
Expected: Redirect to /dashboard, see PRJ-2026-383
```

### Test: Invalid Credentials
```
Email: ahmad@gsi.jo
Password: wrong
Expected: Error toast "Invalid email or password"
```

### Test: Role-Based Access
```
Login as: ahmad+fin@gsi.jo
Expected: Dashboard shows finance-scoped approvals only
Login as: ahmad+dev@gsi.jo
Expected: Dashboard shows engineering workstream only
```

### Test: Sign Out
```
On dashboard, click Settings > "Sign out"
Expected: Redirect to /auth/login, JWT cookie cleared
```

---

## 8. Production Readiness

✓ All secrets stored in environment variables (not hardcoded)  
✓ Session expiration configured (24 hours)  
✓ Auto-refresh on next request after expiration  
✓ Role-based access control enforced  
✓ Authorization guards on all state changes  
✓ No mock fallback on auth failure  
✓ All passwords hashed by Supabase (bcrypt)  
✓ HTTPS enforced in production (Secure cookie flag)  

**Status**: Production-ready for pilot operations.
