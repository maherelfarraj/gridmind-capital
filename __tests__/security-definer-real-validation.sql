-- Security DEFINER Execute Privilege Validation - Real SQL Tests
-- Execute in isolated PostgreSQL environment matching production schema
--
-- BEFORE applying migration: 20260801000000_security_definer_execute_lockdown.sql
-- Run: psql -h localhost -U postgres -d gridmind_test -f __tests__/security-definer-real-validation.sql

-- ============================================================================
-- PHASE 1: Capture Pre-Migration ACL State
-- ============================================================================

\echo '=== PHASE 1: PRE-MIGRATION ACL STATE ==='

SELECT p.proname, 
       (aclexplode(p.proacl)).grantee::regrole AS grantee,
       (aclexplode(p.proacl)).privilege_type AS privilege
FROM pg_proc p
WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
                    'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
                    'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
                    'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
ORDER BY p.proname, grantee;

-- Count PUBLIC EXECUTE grants (should be > 0 if migration is needed)
SELECT COUNT(*) AS public_execute_count
FROM pg_proc p
WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
                    'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
                    'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
                    'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
AND proacl::text LIKE '%=x%';

-- ============================================================================
-- PHASE 2: Identify RLS Policy Dependencies
-- ============================================================================

\echo '=== PHASE 2: RLS POLICY DEPENDENCIES ==='

SELECT schemaname, tablename, policyname, 
       CASE WHEN qual ILIKE '%current_user_role%' OR qual ILIKE '%current_user_org%' 
            THEN 'SELECT' ELSE NULL END AS select_uses,
       CASE WHEN with_check ILIKE '%current_user_role%' OR with_check ILIKE '%current_user_org%' 
            THEN 'INSERT/UPDATE' ELSE NULL END AS write_uses
FROM pg_policies
WHERE (qual ILIKE '%current_user_role%' OR qual ILIKE '%current_user_org%'
   OR with_check ILIKE '%current_user_role%' OR with_check ILIKE '%current_user_org%')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- PHASE 3: Test RLS Policy Evaluation (CRITICAL)
-- ============================================================================

\echo '=== PHASE 3: RLS POLICY EVALUATION - BEFORE MIGRATION ==='

-- Create test user if needed
DO $$
BEGIN
  INSERT INTO auth.users (id, email, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Test as authenticated user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = '00000000-0000-0000-0000-000000000001';

SELECT COUNT(*) AS projects_count FROM public.projects;
SELECT COUNT(*) AS approvals_count FROM public.approvals;

-- Test calling helper function directly as authenticated (should work before migration)
\echo 'Testing current_user_role() as authenticated (before migration):'
SELECT public.current_user_role();

-- ============================================================================
-- PHASE 4: Test Anonymous Role Access (should always fail)
-- ============================================================================

\echo '=== PHASE 4: ANONYMOUS ROLE ACCESS ==='

SET LOCAL ROLE anon;

\echo 'Testing current_user_role() as anon (should fail):'
SELECT public.current_user_role();

-- ============================================================================
-- PHASE 5: Verify consume_rate_limit Caller
-- ============================================================================

\echo '=== PHASE 5: CONSUME_RATE_LIMIT INFRASTRUCTURE ==='

-- Code search result: grep -r "consume_rate_limit" app/ lib/
-- Expected: NOT FOUND (infrastructure-only)
-- Manual verification: Application code does not directly call consume_rate_limit

\echo 'Testing consume_rate_limit as service_role (infrastructure):'
SET LOCAL ROLE service_role;
SELECT public.consume_rate_limit('test-key', 1, 10.0);

-- ============================================================================
-- PHASE 6: Test Trigger Execution
-- ============================================================================

\echo '=== PHASE 6: AUDIT TRIGGER EXECUTION - BEFORE MIGRATION ==='

-- Insert test record
INSERT INTO public.profiles (id, email, created_at, full_name, role, tenant_id, is_active, user_type)
VALUES ('trigger-test-1', 'trigger-test@example.com', NOW(), 'Test User', 'viewer', NULL, false, 'internal')
ON CONFLICT (id) DO NOTHING;

-- Check audit log
SELECT COUNT(*) AS audit_rows
FROM public.audit_log 
WHERE record_id = 'trigger-test-1';

-- ============================================================================
-- PHASE 7: Governance Rules Metadata Verification
-- ============================================================================

\echo '=== PHASE 7: GOVERNANCE RULES METADATA VERIFICATION ==='

-- Code search: grep -r "gm_rule_b" app/actions/team.ts
-- Expected: Only metadata references like { code: 'B1', fn: 'gm_rule_b1', ... }
-- Manual verification needed: Application does not execute SELECT gm_rule_b*()

\echo 'Functions defined (gm_rule_b1-b10):'
SELECT p.proname, p.prokind
FROM pg_proc p
WHERE p.proname LIKE 'gm_rule_b%'
ORDER BY p.proname;

-- ============================================================================
-- PHASE 8: Post-Migration Verification (run AFTER applying migration)
-- ============================================================================

\echo '=== PHASE 8: POST-MIGRATION ACL COMPARISON ==='
\echo 'Run this section AFTER applying migration'

-- SELECT p.proname, 
--        (aclexplode(p.proacl)).grantee::regrole AS grantee,
--        (aclexplode(p.proacl)).privilege_type AS privilege
-- FROM pg_proc p
-- WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
--                     'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
--                     'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
--                     'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
-- ORDER BY p.proname, grantee;

-- Count PUBLIC EXECUTE after migration (should be 0)
-- SELECT COUNT(*) AS public_execute_count
-- FROM pg_proc p
-- WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
--                     'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
--                     'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
--                     'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
-- AND proacl::text LIKE '%=x%';

-- Test RLS policies still work
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims.sub = '00000000-0000-0000-0000-000000000001';
-- SELECT COUNT(*) FROM public.projects;  -- Should succeed
-- SELECT COUNT(*) FROM public.approvals;  -- Should succeed

-- Test audit trigger still fires
-- INSERT INTO public.profiles (id, email, created_at, full_name, role, tenant_id, is_active, user_type)
-- VALUES ('trigger-test-2', 'trigger-test2@example.com', NOW(), 'Test User 2', 'viewer', NULL, false, 'internal')
-- ON CONFLICT (id) DO NOTHING;
-- SELECT COUNT(*) FROM public.audit_log WHERE record_id = 'trigger-test-2';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

\echo '=== VERIFICATION QUERIES ==='

-- Check all target functions are SECURITY DEFINER
SELECT p.proname, p.prosecdef
FROM pg_proc p
WHERE p.proname IN ('audit_trigger_fn', 'consume_rate_limit', 'current_user_org', 
                    'current_user_role', 'gm_rule_b1', 'gm_rule_b2', 'gm_rule_b3',
                    'gm_rule_b4', 'gm_rule_b5', 'gm_rule_b6', 'gm_rule_b7', 
                    'gm_rule_b8', 'gm_rule_b9', 'gm_rule_b10')
AND NOT p.prosecdef
LIMIT 1;
-- Should return: (no rows) - all functions must be SECURITY DEFINER

\echo 'VALIDATION COMPLETE - Review results above'
