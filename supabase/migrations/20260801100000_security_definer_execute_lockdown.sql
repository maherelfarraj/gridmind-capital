-- Security DEFINER Functions: Execute Privilege Lockdown
-- Objective: Remove PUBLIC EXECUTE on SECURITY DEFINER functions
-- Reference: P0 Security Hardening / Residual Functions Audit
--
-- Analysis Summary:
-- - audit_trigger_fn: Trigger-only, never called directly. Revoke PUBLIC/anon/authenticated.
-- - consume_rate_limit: Rate limiting helper. Revoke PUBLIC/anon, keep authenticated if needed.
-- - current_user_org: RLS policy helper. Revoke PUBLIC/anon ONLY. MUST keep authenticated
--   (invoked by authenticated RLS policies pol_read, po_external_read, po_external_ack, rfq_external_read).
-- - current_user_role: RLS policy helper. Revoke PUBLIC/anon ONLY. MUST keep authenticated
--   (invoked by authenticated RLS policies cr_external_read, pm_external_read, vo_external_read).
-- - gm_rule_b1 through gm_rule_b10: Metadata references only. Revoke PUBLIC/anon/authenticated.
--
-- All functions already have correct search_path = 'public'. No function body changes.
-- All functions remain SECURITY DEFINER (unchanged).

BEGIN;

-- Idempotency: Set transaction isolation to prevent concurrent conflicts
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 1. audit_trigger_fn() - Trigger-only function
-- Current: PUBLIC EXECUTE (inherited from default ACL)
-- Action: Revoke all except postgres/supabase_admin (who execute via trigger)
-- Justification: Trigger semantics mean auth.uid() is available, no direct client call needed

REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_trigger_fn() FROM authenticated;

-- Explicit grant to supabase_admin (trigger execution context)
GRANT EXECUTE ON FUNCTION public.audit_trigger_fn() TO supabase_admin;

-- 2. consume_rate_limit(text, integer, numeric) - Rate limiting backend
-- Current: PUBLIC EXECUTE
-- Action: Revoke PUBLIC/anon, revoke authenticated, grant only to service_role
-- Justification: Rate limiting is an infrastructure concern, not a user-facing API
--                If rate limiting is ever needed per-user, it should be called by a service-role function

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) FROM authenticated;

-- Grant only to service_role for infrastructure use
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) TO service_role;

-- 3. current_user_org() - RLS policy helper
-- Current: =X (PUBLIC) | anon=X | authenticated=X | service_role=X
-- Action: Revoke PUBLIC and anon ONLY. KEEP authenticated. KEEP service_role.
-- Justification: This function is invoked INSIDE RLS policy USING clauses that are declared
--                TO authenticated (pol_read on purchase_order_lines; po_external_read and
--                po_external_ack on purchase_orders; rfq_external_read on rfqs). In PostgreSQL,
--                a function called by an RLS policy is executed AS THE QUERYING ROLE, so
--                authenticated MUST retain EXECUTE or every such query fails with
--                "permission denied for function current_user_org" (verified empirically).
--                anon is never subject to these policies (they are TO authenticated) and no
--                app code calls the function via RPC, so removing PUBLIC + anon is safe hardening.

REVOKE EXECUTE ON FUNCTION public.current_user_org() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_org() FROM anon;

-- Explicitly (re)assert the grants RLS depends on; idempotent and self-documenting.
GRANT EXECUTE ON FUNCTION public.current_user_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO supabase_admin;

-- 4. current_user_role() - RLS policy helper
-- Current: =X (PUBLIC) | anon=X | authenticated=X | service_role=X
-- Action: Revoke PUBLIC and anon ONLY. KEEP authenticated. KEEP service_role.
-- Justification: Same as current_user_org. Invoked by authenticated RLS policies
--                cr_external_read (client_reports), pm_external_read (payment_milestones),
--                and vo_external_read (variation_orders). Revoking authenticated would break
--                SELECT on all three tables for external/authenticated users.

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO supabase_admin;

-- 5. gm_rule_b1 through gm_rule_b10 - Governance rules (metadata/reporting)
-- All functions have signature: () RETURNS jsonb
-- Current: PUBLIC EXECUTE
-- Action: Revoke PUBLIC/anon/authenticated for all
-- Justification: These are internal governance rules used for auditing/reporting.
--                App references them by name only (in app/actions/team.ts metadata),
--                never executes them directly. They are not RPC endpoints.

REVOKE EXECUTE ON FUNCTION public.gm_rule_b1() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b1() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b1() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b2() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b3() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b3() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b3() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b4() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b4() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b4() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b5() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b5() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b5() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b6() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b6() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b6() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b7() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b7() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b7() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b8() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b8() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b8() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b9() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b9() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b9() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.gm_rule_b10() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b10() FROM anon;
REVOKE EXECUTE ON FUNCTION public.gm_rule_b10() FROM authenticated;

-- Grant governance rules to service_role for any future admin dashboard that may need to execute them
GRANT EXECUTE ON FUNCTION public.gm_rule_b1() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b2() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b3() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b4() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b5() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b6() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b7() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b8() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b9() TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b10() TO service_role;

-- Verification queries (run after migration)
--
-- SELECT 'VERIFICATION: Execute privileges after lockdown' AS check_type;
--
-- -- 1. Verify audit_trigger_fn has no PUBLIC EXECUTE
-- SELECT p.proacl FROM pg_proc p
-- WHERE p.proname = 'audit_trigger_fn' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- -- Expected: {supabase_admin=X/postgres,postgres=X/postgres} (no PUBLIC, anon, authenticated)
--
-- -- 2. Verify consume_rate_limit has no PUBLIC EXECUTE
-- SELECT p.proacl FROM pg_proc p
-- WHERE p.proname = 'consume_rate_limit' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- -- Expected: {service_role=X/postgres,postgres=X/postgres} (no PUBLIC, anon, authenticated)
--
-- -- 3. Verify current_user_org: no PUBLIC, no anon, but authenticated RETAINED
-- SELECT p.proacl FROM pg_proc p
-- WHERE p.proname = 'current_user_org' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- -- Expected: postgres=X, authenticated=X, service_role=X, supabase_admin=X (NO bare "=X" PUBLIC, NO anon)
--
-- -- 4. Verify current_user_role: no PUBLIC, no anon, but authenticated RETAINED
-- SELECT p.proacl FROM pg_proc p
-- WHERE p.proname = 'current_user_role' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- -- Expected: postgres=X, authenticated=X, service_role=X, supabase_admin=X (NO bare "=X" PUBLIC, NO anon)
--
-- -- 5. Verify gm_rule_b1 through gm_rule_b10 have no PUBLIC EXECUTE
-- SELECT p.proname, p.proacl FROM pg_proc p
-- WHERE p.proname LIKE 'gm_rule_b%' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
-- ORDER BY p.proname;
-- -- Expected: All have {service_role=X/postgres,postgres=X/postgres} (no PUBLIC, anon, authenticated)

COMMIT;
