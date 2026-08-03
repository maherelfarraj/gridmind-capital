# Security DEFINER Execute Privilege Validation Plan

## Overview

PR #76 proposes revoking EXECUTE privileges on 14 SECURITY DEFINER functions. Before migration applies to production, real database validation must occur in isolated PostgreSQL environment matching production schema.

## Critical Assumption to Validate

**UNPROVEN:** "RLS policies execute as table owner; authenticated users don't need EXECUTE on helper functions"

This must be tested in Phase 3. If RLS policies fail after revoking EXECUTE from current_user_org/current_user_role, retention of those grants is acceptable—still hardens PUBLIC/anon exposure.

## Phase 1: Capture Pre-Migration ACL State

**Environment:** Isolated PostgreSQL with production schema

**Procedure:**
```sql
-- Document current ACL on all 14 target functions
SELECT p.proname, 
       (aclexplode(p.proacl)).grantee::regrole AS grantee,
       (aclexplode(p.proacl)).privilege_type AS privilege
FROM pg_proc p
WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
                    'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
                    'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
                    'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
ORDER BY p.proname, grantee;
```

**Expected Output:** Table showing current PUBLIC/anon/authenticated EXECUTE grants

**Decision Point:** Confirm PUBLIC EXECUTE exists on at least one function (if none exist, migration is redundant)

---

## Phase 2: Identify RLS Policy Dependencies

**Procedure:**
```sql
-- Find all policies that reference helper functions
SELECT p.polname, p.tablename, 
       CASE WHEN p.qual ILIKE '%current_user_org%' THEN 'qual'
            WHEN p.qual ILIKE '%current_user_role%' THEN 'qual'
            WHEN p.with_check ILIKE '%current_user_org%' THEN 'with_check'
            WHEN p.with_check ILIKE '%current_user_role%' THEN 'with_check'
       END AS ref_location,
       p.qual, p.with_check
FROM pg_policies p
WHERE p.qual ILIKE '%current_user_role%' 
   OR p.qual ILIKE '%current_user_org%'
   OR p.with_check ILIKE '%current_user_role%'
   OR p.with_check ILIKE '%current_user_org%';
```

**Expected Output:** List of policies using current_user_org() and current_user_role()

**Decision Point:** Determines which RLS tests must run in Phase 3

---

## Phase 3: CRITICAL - Test RLS Policy Evaluation After EXECUTE Revocation

**Procedure:**
```sql
-- BEFORE migration: capture row counts accessible to authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = '00000000-0000-0000-0000-000000000001';
SELECT COUNT(*) AS projects_visible FROM public.projects;
SELECT COUNT(*) AS approvals_visible FROM public.approvals;

-- Apply migration here

-- AFTER migration: test if authenticated user can still access same rows
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = '00000000-0000-0000-0000-000000000001';
SELECT COUNT(*) AS projects_visible FROM public.projects;
SELECT COUNT(*) AS approvals_visible FROM public.approvals;
```

**Expected Outcomes:**
- ✅ **Success:** Row counts identical before/after → EXECUTE revocation safe
- ❌ **Failure:** ERROR "permission denied for function current_user_role" → Must retain grant:
  ```sql
  GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;
  ```

**Decision Point:** BLOCKS migration if authenticated role cannot query. Modify migration to retain grants if needed.

---

## Phase 4: Test Anonymous Role Access Restrictions

**Procedure:**
```sql
-- Test each function as anonymous user
SET LOCAL ROLE anon;
SELECT public.current_user_role();        -- Should fail
SELECT public.current_user_org();         -- Should fail
SELECT public.consume_rate_limit(...);    -- Should fail
SELECT public.gm_rule_b1(...);           -- Should fail
```

**Expected:** All return ERROR "permission denied for function..."

**Decision Point:** Confirms anon EXECUTE revoked successfully

---

## Phase 5: Verify consume_rate_limit Caller Status

**Procedure:**

1. Search application code for direct calls:
   ```bash
   grep -r "consume_rate_limit" app/ lib/ --include="*.ts" --include="*.tsx"
   ```
   Expected: NOT FOUND (infrastructure-only)

2. If found, identify caller and test:
   ```sql
   -- Test caller as infrastructure role
   SET LOCAL ROLE service_role;
   SELECT public.consume_rate_limit('key', 1, 10.0);  -- Should work
   ```

**Decision Point:** If no caller found, classification confirmed. If caller found, verify service_role EXECUTE works.

---

## Phase 6: Test Trigger Execution Continues

**Procedure:**
```sql
-- Before migration: INSERT into audited table
INSERT INTO public.profiles (id, created_at, email) 
VALUES ('test-id', NOW(), 'test@example.com')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

SELECT COUNT(*) FROM public.audit_log WHERE record_id = 'test-id';
-- Expected: 1 audit row

-- Apply migration

-- After migration: INSERT into audited table
INSERT INTO public.profiles (id, created_at, email) 
VALUES ('test-id-2', NOW(), 'test2@example.com')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

SELECT COUNT(*) FROM public.audit_log WHERE record_id = 'test-id-2';
-- Expected: 1 audit row (trigger still fires)
```

**Decision Point:** Confirms audit triggers work before/after migration

---

## Phase 7: Governance Rules Metadata Verification

**Procedure:**

1. Search for governance rule execution:
   ```bash
   grep -r "gm_rule_b" app/ lib/ --include="*.ts" --include="*.tsx"
   ```
   Expected: Only metadata references like `{ code: 'B1', fn: 'gm_rule_b1', ... }`

2. Verify no direct execution:
   ```bash
   grep -r "SELECT.*gm_rule_b\|execute.*gm_rule_b" app/ lib/
   ```
   Expected: NOT FOUND

**Decision Point:** Confirms gm_rule_b* are metadata-only, safe to revoke all roles

---

## Phase 8: Post-Migration ACL Comparison

**Procedure:**
```sql
-- Repeat Phase 1 query to verify migration changes
SELECT p.proname, 
       (aclexplode(p.proacl)).grantee::regrole AS grantee,
       (aclexplode(p.proacl)).privilege_type AS privilege
FROM pg_proc p
WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', ...)
ORDER BY p.proname, grantee;
```

**Compare to Phase 1:**
- PUBLIC EXECUTE should be removed (if existed)
- anon EXECUTE should be removed
- authenticated EXECUTE should be removed (unless Phase 3 required retention)
- supabase_admin and postgres EXECUTE should remain

**Decision Point:** Confirms migration applied correctly

---

## Phase 9: Application Workflow Verification

**Procedure:**

1. Run full test suite:
   ```bash
   pnpm test
   ```
   Expected: 342 tests pass (baseline unchanged)

2. Perform smoke tests on critical workflows:
   - Login (uses RLS policies)
   - Create project (uses RLS policies + governance guards)
   - Audit log appears for mutations
   - Rate limiting (if used) works

3. Verify no permission denied errors in:
   - Dashboard loading
   - Data queries
   - Admin operations

**Decision Point:** Confirms no application breakage

---

## Pass/Fail Criteria

**PASS Conditions:**
- Phase 1: PUBLIC EXECUTE confirmed on ≥1 function
- Phase 2: RLS policies documented (if any)
- Phase 3: RLS policies work OR acceptable to retain authenticated grants
- Phase 4: anon cannot execute any functions
- Phase 5: consume_rate_limit classification verified
- Phase 6: Audit triggers fire before/after
- Phase 7: gm_rule_b* metadata-only confirmed
- Phase 8: ACL post-migration matches expectations
- Phase 9: All tests pass, workflows unbroken

**FAIL Conditions:**
- Phase 3: RLS queries fail AND retention not acceptable
- Phase 6: Audit triggers fail to fire
- Phase 9: Tests fail or workflows broken

**Outcome:** PASS all phases before merge; adjust migration if Phase 3 requires grant retention.

---

## Rollback Procedure

If any phase fails:

1. Revert migration from database
2. Restore original ACL state from Phase 1 documentation
3. Modify migration based on findings
4. Commit corrections
5. Restart validation from Phase 1

---

## Sign-Off Template

```
Validation Results (to be filled by reviewer):

Phase 1: ACL captured ✓/✗
Phase 2: RLS dependencies documented ✓/✗
Phase 3: RLS policies work after migration ✓/✗
  - If ✗: Retained grants on [functions]: [list]
Phase 4: anon EXECUTE revoked ✓/✗
Phase 5: consume_rate_limit verified ✓/✗
Phase 6: Audit triggers fire ✓/✗
Phase 7: gm_rule_b* metadata-only ✓/✗
Phase 8: Post-migration ACL correct ✓/✗
Phase 9: All tests pass ✓/✗

Overall Result: PASS / FAIL
Migration safe for merge: YES / NO (conditional)

Signed by: [reviewer name]
Date: [date]
```
