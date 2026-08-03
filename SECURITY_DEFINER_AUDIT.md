# Security DEFINER Functions: Execute Privilege Audit

**Objective:** Remediate remaining SECURITY DEFINER functions with PUBLIC EXECUTE privileges

**Date:** 2026-08-01  
**Scope:** 14 functions across governance, rate limiting, and audit logging  
**Risk Level:** Medium (privilege escalation vectors)

---

## Executive Summary

**Finding:** 14 SECURITY DEFINER functions retain PUBLIC EXECUTE privileges inherited from default ACL.

**Root Cause:** Pre-P0 design did not restrict SECURITY DEFINER privilege exposure.

**Remediation:** Single idempotent migration that revokes PUBLIC/anon/authenticated EXECUTE on all 14 functions and implements fail-closed access model.

**Impact:** Zero application workflow changes. All functions continue to work through proper channels (triggers, RLS policies, service_role).

---

## Privilege Matrix

### BEFORE Remediation

| Function | Type | Returns | SECURITY DEFINER | PUBLIC EXECUTE | anon | authenticated | service_role | supabase_admin |
|----------|------|---------|------------------|---|---|---|---|---|
| audit_trigger_fn() | trigger | trigger | YES | YES | YES | YES | NO | YES |
| consume_rate_limit(...) | infra | boolean | YES | YES | YES | YES | NO | YES |
| current_user_org() | helper | text | YES | YES | YES | YES | NO | YES |
| current_user_role() | helper | text | YES | YES | YES | YES | NO | YES |
| gm_rule_b1() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b2() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b3() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b4() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b5() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b6() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b7() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b8() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b9() | metadata | jsonb | YES | YES | YES | YES | NO | YES |
| gm_rule_b10() | metadata | jsonb | YES | YES | YES | YES | NO | YES |

### AFTER Remediation

| Function | Type | Returns | SECURITY DEFINER | PUBLIC EXECUTE | anon | authenticated | service_role | supabase_admin |
|----------|------|---------|------------------|---|---|---|---|---|
| audit_trigger_fn() | trigger | trigger | YES | NO | NO | NO | NO | YES |
| consume_rate_limit(...) | infra | boolean | YES | NO | NO | NO | YES | YES |
| current_user_org() | helper | text | YES | NO | NO | **YES (required by RLS)** | YES | YES |
| current_user_role() | helper | text | YES | NO | NO | **YES (required by RLS)** | YES | YES |
| gm_rule_b1() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b2() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b3() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b4() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b5() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b6() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b7() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b8() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b9() | metadata | jsonb | YES | NO | NO | NO | YES | YES |
| gm_rule_b10() | metadata | jsonb | YES | NO | NO | NO | YES | YES |

---

## Caller Analysis

### audit_trigger_fn()

**Classification:** Trigger-only (TG_OP, TG_TABLE_NAME semantics require trigger context)

**Callers:**
- `audit_approvals` TRIGGER (AFTER INSERT/DELETE/UPDATE)
- `audit_claims` TRIGGER (AFTER INSERT/DELETE/UPDATE)
- `audit_contracts` TRIGGER (AFTER INSERT/DELETE/UPDATE)
- *(11 additional audit triggers on other tables)*

**Direct EXECUTE calls in code:** 0 (verified via grep)

**Remediation:** Revoke PUBLIC/anon/authenticated. Grant supabase_admin (trigger execution role).

**Risk if not revoked:** Authenticated users could execute audit_trigger_fn() outside trigger context and corrupt TG_OP/TG_TABLE_NAME logic, bypassing audit guards.

---

### consume_rate_limit(text, integer, numeric)

**Classification:** Infrastructure helper (rate limiting backend)

**Callers:**
- Rate limiting infrastructure (if deployed)
- No direct application code calls (verified via grep)

**Direct EXECUTE calls in code:** 0

**Remediation:** Revoke PUBLIC/anon/authenticated. Grant service_role (for infrastructure use).

**Risk if not revoked:** Anonymous or authenticated users could exhaust rate-limiting buckets or bypass rate-limit enforcement by calling the function directly with arbitrary parameters.

---

### current_user_org()

**Classification:** RLS policy helper (reads external_access table)

**Callers:**
- RLS policies (called by policy engine during policy evaluation)
- Internal functions (if any call it)

**Direct EXECUTE calls in code:** 0 (never called as a PostgREST RPC)

**Invoked by these RLS policies (all `TO authenticated`):**
- `pol_read` on `purchase_order_lines`
- `po_external_read` and `po_external_ack` on `purchase_orders`
- `rfq_external_read` on `rfqs`

**CORRECTION — authenticated MUST retain EXECUTE:**
An earlier draft claimed "a policy runs as the table owner, so the user does not need EXECUTE on
functions the policy calls." **That is false and was empirically disproven** on a disposable branch:
a function invoked inside an RLS policy's `USING`/`WITH CHECK` clause is executed **as the querying
role**, not the table owner. SECURITY DEFINER governs what happens *inside* the function body, not
whether the caller may invoke it. Revoking EXECUTE from `authenticated` therefore makes every
dependent query fail with `permission denied for function current_user_org`.

**Remediation:** Revoke PUBLIC and anon ONLY. **Keep authenticated and service_role.**

**Risk if authenticated were revoked:** total read (and, for `po_external_ack`, update) outage on
`purchase_orders`, `purchase_order_lines`, and `rfqs` for all external/authenticated users.
**Hardening achieved:** anon (and inherited PUBLIC) can no longer call the function directly.

---

### current_user_role()

**Classification:** RLS policy helper (reads profiles table)

**Callers:**
- RLS policies (policy engine context)
- Internal functions (if any)

**Direct EXECUTE calls in code:** 0 (never called as a PostgREST RPC)

**Invoked by these RLS policies (all `TO authenticated`):**
- `cr_external_read` on `client_reports`
- `pm_external_read` on `payment_milestones`
- `vo_external_read` on `variation_orders`

**CORRECTION — authenticated MUST retain EXECUTE:** same PostgreSQL semantic as
`current_user_org()` above — an RLS-invoked function runs as the querying role, so `authenticated`
must keep EXECUTE or SELECT on all three tables fails with `permission denied for function
current_user_role`.

**Remediation:** Revoke PUBLIC and anon ONLY. **Keep authenticated and service_role.**

**Risk if authenticated were revoked:** total SELECT outage on `client_reports`,
`payment_milestones`, and `variation_orders` for all external/authenticated users.

---

### gm_rule_b1 through gm_rule_b10

**Classification:** Governance rule metadata (tracked in app/actions/team.ts)

**Usage in code:**
```typescript
// app/actions/team.ts
{ code: 'B1', fn: 'gm_rule_b1', label: 'Gate approvals are signed', deepLink: '/admin/signatures' },
{ code: 'B2', fn: 'gm_rule_b2', label: 'No PAC gate approved with open NCRs', deepLink: null },
// ... etc
```

**Direct EXECUTE calls in code:** 0 (names are references only, not function calls)

**Remediation:** Revoke PUBLIC/anon/authenticated. Grant service_role (for future admin dashboards).

**Risk if not revoked:** Authenticated users could execute governance rules and discover business logic, or abuse the functions to access internal state.

---

## Migration Details

**File:** `supabase/migrations/20260801100000_security_definer_execute_lockdown.sql`

**Strategy:**
1. Begin SERIALIZABLE transaction for isolation
2. Revoke PUBLIC EXECUTE on all 14 functions
3. Revoke anon EXECUTE on all 14 functions
4. Revoke authenticated EXECUTE on all 14 functions
5. Grant appropriate roles (supabase_admin, service_role)
6. Commit (rollback only if verification fails)

**Idempotency:** REVOKE on non-existent privilege is idempotent (no error). Safe to re-run.

**Function bodies:** NOT MODIFIED

**Ownership:** NOT MODIFIED

**Search path:** NOT MODIFIED (already set correctly to 'public')

---

## Verification

### Pre-Migration Snapshot

```sql
SELECT p.proname, p.proacl
FROM pg_proc p
WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 'current_user_role')
  OR (p.proname LIKE 'gm_rule_b%' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
ORDER BY p.proname;
```

### Post-Migration Verification

1. **No PUBLIC EXECUTE remains:**
   ```sql
   SELECT p.proname, p.proacl FROM pg_proc p
   WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
     AND (p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 'current_user_role')
          OR p.proname LIKE 'gm_rule_b%')
     AND p.proacl::text LIKE '%{=,%';
   -- Expected result: 0 rows
   ```

2. **Triggers still execute:**
   ```sql
   -- Insert a test row into approvals
   -- Verify audit_log has an entry
   -- Expected: audit_trigger_fn fired and wrote audit_log row
   ```

3. **RLS policies still work:**
   ```sql
   -- Login as authenticated user
   -- Query a table with current_user_role() or current_user_org() in policy
   -- Verify policy correctly filters rows
   ```

4. **Rate limiting still works (if used):**
   ```sql
   -- Call service_role endpoint that invokes consume_rate_limit
   -- Verify rate limiting enforcement
   ```

---

## Rollback

**File:** `supabase/migrations/20260801100000_security_definer_execute_lockdown_rollback.sql`

```sql
BEGIN;

-- Restore PUBLIC EXECUTE on all 14 functions
GRANT EXECUTE ON FUNCTION public.audit_trigger_fn() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.gm_rule_b1() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b2() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b3() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b4() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b5() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b6() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b7() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b8() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b9() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_rule_b10() TO PUBLIC;

COMMIT;
```

---

## Risk Assessment

| Function | Risk Level | Impact | Mitigation |
|----------|-----------|--------|-----------|
| audit_trigger_fn() | MEDIUM | Audit corruption, log tampering | Revoke PUBLIC, restrict to trigger context |
| consume_rate_limit(...) | MEDIUM | Rate limit bypass, infrastructure abuse | Revoke PUBLIC, grant service_role only |
| current_user_org() | MEDIUM | Data leak of org affiliations | Revoke PUBLIC, keep RLS policy context |
| current_user_role() | MEDIUM | Data leak of role assignments | Revoke PUBLIC, keep RLS policy context |
| gm_rule_b1-b10 | LOW | Business logic discovery, edge cases | Revoke PUBLIC, functions are metadata-only |

---

## Testing

**Unit Tests:** `__tests__/security-definer-privileges.test.ts`
- 30+ test cases covering privilege scoping
- Workflow preservation verification
- Security hardening checks

**Integration Tests:** (Manual in isolated environment)
- Trigger execution with audit_trigger_fn
- RLS policy evaluation with current_user_org/role
- Rate limiting with service_role

**Regression Tests:** (Run against production read-only)
- Verify no unintended privilege changes on other functions
- Verify triggers still fire
- Verify RLS policies still evaluate

---

## Deployment Checklist

- [ ] Migration runs cleanly in isolated environment
- [ ] Verification queries pass (no PUBLIC EXECUTE remains)
- [ ] Triggers still execute and write audit logs
- [ ] RLS policies still evaluate correctly
- [ ] Rate limiting still works (if deployed)
- [ ] All tests pass (342 tests unchanged)
- [ ] TypeScript typecheck passes
- [ ] Build succeeds
- [ ] Git diff --check passes
- [ ] Code review approved
- [ ] PR approved for merge
- [ ] Migration tested in staging (if available)

---

## References

- P0 Security Hardening: PR #68, PR #73, Batch 1
- SECURITY DEFINER Functions: PostgreSQL Documentation
- Privilege Escalation Vectors: CWE-269, CWE-94
- Defense in Depth: P0 + this remediation + existing RLS policies
