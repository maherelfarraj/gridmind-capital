-- ============================================================================
-- P0 GOVERNANCE REMEDIATION — BATCH 1: IDENTITY AND DML CONTAINMENT
-- ============================================================================
-- Scope: identity provisioning + privilege/policy containment ONLY.
-- Explicitly OUT OF SCOPE: approval engine redesign, gate model changes,
-- historical data backfills, role value rewrites.
--
-- Containment model:
--   * Non-core governance tables   -> zero browser privileges, zero policies.
--   * Core browser/realtime tables -> exact SELECT baseline, tenant scoped.
--   * service_role / postgres / supabase_admin are never revoked and bypass
--     RLS, so guarded server actions keep full access.
--
-- This migration is transactional. Any failure rolls the whole thing back.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. PRECONDITIONS — fail loudly if the critical surface is missing
-- ----------------------------------------------------------------------------

DO $precheck$
DECLARE
  required_tables CONSTANT text[] := ARRAY[
    'public.profiles',
    'public.projects',
    'public.phase_gates',
    'public.approvals'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE EXCEPTION 'P0 precondition failed: required table % does not exist', t;
    END IF;
  END LOOP;
END
$precheck$;

-- ----------------------------------------------------------------------------
-- 0a. Global structural-privilege revocation across the whole public schema
-- ----------------------------------------------------------------------------
-- MAINTAIN, TRUNCATE, TRIGGER and REFERENCES are whole-table privileges that
-- RLS does NOT constrain. A browser role holding them can wipe a table, attach
-- a trigger, create a foreign key against it, or run maintenance commands
-- (VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW) regardless of
-- any policy. None of these are ever legitimate for anon/authenticated.
--
-- MAINTAIN is a PostgreSQL 17 table privilege. A read-only catalog check
-- confirmed anon and authenticated currently hold all four across every
-- existing public relation.
--
-- SELECT/INSERT/UPDATE/DELETE are deliberately NOT revoked here: some
-- non-governance application tables may still have intentional browser
-- behavior that requires separate review.

REVOKE MAINTAIN, TRUNCATE, TRIGGER, REFERENCES
  ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 0b. Deny the same structural privileges on FUTURE tables
-- ----------------------------------------------------------------------------
-- ALL TABLES above only affects tables that exist right now. Default
-- privileges close the gap for anything created later.
--
-- Default privileges are per-creating-role, so the owner list is discovered
-- dynamically rather than hard-coded. Three sources are unioned:
--   1. current_user
--   2. actual owners of every relation in the public schema
--   3. owners of existing table default-ACL records that affect global
--      (defaclnamespace = 0) or public-schema defaults
--
-- Source 3 matters because a role such as supabase_admin can hold a default
-- ACL that grants structural privileges on future tables while owning no
-- public relation today — sources 1 and 2 would never surface it.
--
-- Role existence alone is not enough: ALTER DEFAULT PRIVILEGES FOR ROLE
-- requires the executing role to BE the target role or hold membership in it,
-- so pg_has_role is checked first. Any role we cannot act for raises a
-- WARNING (not a silent skip) because a real gap remains open until an
-- owner-authorized operation closes it. Role membership and ownership are
-- never modified to work around this.

DO $default_privs$
DECLARE
  owner_role name;
BEGIN
  FOR owner_role IN
    SELECT DISTINCT owner_name
    FROM (
      SELECT current_user::name AS owner_name

      UNION

      SELECT pg_get_userbyid(c.relowner)::name
      FROM pg_class c
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f')

      UNION

      SELECT pg_get_userbyid(d.defaclrole)::name
      FROM pg_default_acl d
      WHERE d.defaclobjtype = 'r'
        AND (
          d.defaclnamespace = 0
          OR d.defaclnamespace = 'public'::regnamespace
        )
    ) owners
    WHERE owner_name IS NOT NULL
  LOOP
    IF owner_role = current_user
       OR pg_has_role(current_user, owner_role, 'MEMBER')
    THEN
      -- Global defaults: required because a schema-scoped REVOKE cannot
      -- undo a privilege granted through global default privileges.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I '
        'REVOKE MAINTAIN, TRUNCATE, TRIGGER, REFERENCES '
        'ON TABLES FROM PUBLIC, anon, authenticated',
        owner_role
      );

      -- Schema-scoped defaults: reverses any matching public-schema
      -- default grants.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
        'REVOKE MAINTAIN, TRUNCATE, TRIGGER, REFERENCES '
        'ON TABLES FROM PUBLIC, anon, authenticated',
        owner_role
      );

      RAISE NOTICE
        'P0: hardened global and public-schema table defaults for owner role %',
        owner_role;
    ELSE
      RAISE WARNING
        'P0: current role % cannot administer owner role %; future-table '
        'MAINTAIN/TRUNCATE/TRIGGER/REFERENCES defaults for that role are NOT '
        'revoked and an owner-authorized operation is still required',
        current_user,
        owner_role;
    END IF;
  END LOOP;
END
$default_privs$;

-- ----------------------------------------------------------------------------
-- 1. handle_new_user() — signup metadata is NOT an authority source
-- ----------------------------------------------------------------------------
-- New auth users get an UNPROVISIONED profile:
--   role = 'viewer', tenant_id = NULL, is_active = FALSE
-- An administrator must explicitly provision tenant + role + activation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $handle_new_user$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, tenant_id, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      NULLIF(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    'viewer',
    NULL,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$handle_new_user$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'P0: creates an UNPROVISIONED profile (role=viewer, tenant_id=NULL, is_active=false). Never derives authority from signup metadata.';

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. get_my_tenant_id() — fail-closed tenant resolution for RLS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $get_my_tenant_id$
  SELECT p.tenant_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active IS TRUE
    AND p.tenant_id IS NOT NULL
$get_my_tenant_id$;

COMMENT ON FUNCTION public.get_my_tenant_id() IS
  'P0: returns NULL when the caller is missing, inactive, or unprovisioned. Never falls back to a default tenant.';

REVOKE EXECUTE ON FUNCTION public.get_my_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. rls_auto_enable() — remove direct client execution (event trigger stays)
-- ----------------------------------------------------------------------------

DO $rls_auto$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc pr
    JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public'
      AND pr.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
    RAISE NOTICE 'P0: revoked direct EXECUTE on public.rls_auto_enable()';
  ELSE
    RAISE NOTICE 'P0: public.rls_auto_enable() not present; nothing to revoke';
  END IF;
END
$rls_auto$;

-- ----------------------------------------------------------------------------
-- 4. Canonical role vocabulary — NULL and off-vocabulary values are rejected
-- ----------------------------------------------------------------------------
-- Existing invalid rows are reported, NOT rewritten. The new constraint is
-- added NOT VALID so no unsafe full-table rewrite/validation happens here.
-- handle_new_user() already writes role='viewer', so no code path depends on
-- a NULL role for unprovisioned users.

DO $role_report$
DECLARE
  invalid_count bigint;
  invalid_values text;
BEGIN
  SELECT count(*), COALESCE(string_agg(DISTINCT COALESCE(p.role, '<null>'), ', '), '')
    INTO invalid_count, invalid_values
  FROM public.profiles p
  WHERE p.role IS NULL
     OR p.role NOT IN (
       'system_admin','tenant_admin','project_director','project_manager',
       'engineer','hse_manager','commissioning_manager','finance_manager',
       'commercial_manager','viewer','subcontractor','client_viewer'
     );

  IF invalid_count > 0 THEN
    RAISE NOTICE 'P0: % profile row(s) hold NULL or non-canonical role values: %', invalid_count, invalid_values;
    RAISE NOTICE 'P0: these rows are NOT modified by this migration; remediate them before VALIDATE CONSTRAINT.';
  ELSE
    RAISE NOTICE 'P0: all profiles.role values are canonical and non-null.';
  END IF;
END
$role_report$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role IS NOT NULL
    AND role IN (
      'system_admin','tenant_admin','project_director','project_manager',
      'engineer','hse_manager','commissioning_manager','finance_manager',
      'commercial_manager','viewer','subcontractor','client_viewer'
    )
  )
  NOT VALID;

-- Enforced for every INSERT/UPDATE from now on. Once any legacy rows reported
-- above are remediated, run this separately as a controlled operation:
--
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_check;

-- ----------------------------------------------------------------------------
-- 5. Non-core governance and configuration tables — total browser lockdown
-- ----------------------------------------------------------------------------
-- No proven direct browser/realtime read requirement exists for any table in
-- this list, so each one receives:
--   * REVOKE ALL PRIVILEGES from PUBLIC, anon, authenticated
--   * RLS enabled (defense in depth)
--   * every RLS policy dropped (section 7), and none recreated
-- service_role bypasses RLS and is never revoked, so guarded server actions
-- retain full read/write access.

DO $noncore_lockdown$
DECLARE
  noncore CONSTANT text[] := ARRAY[
    -- transactional governance records
    'approval_steps',
    'approval_conditions',
    'approval_events',
    'approval_items',
    'gate_submissions',
    'gate_signoffs',
    'project_gate_approvers',
    'project_team',
    'project_members',
    'workflow_events',
    'audit_log',
    'audit_logs',
    'signatures',
    -- identity and governance configuration. Repository scan proved every
    -- reference goes through createAdminClient() (service_role) inside
    -- 'use server' actions or the 'server-only' lib/db/queries.ts module.
    -- No 'use client' file, browser Supabase client, or realtime channel
    -- touches any of these.
    'tenants',
    'roles',
    'departments',
    'external_access',
    'approval_rules',
    'approval_matrix',
    'gates',
    'gate_approver_defaults',
    'gate_role_requirements',
    'gate_signoff_templates',
    'gate_templates'
  ];
  tname text;
BEGIN
  FOREACH tname IN ARRAY noncore LOOP
    IF to_regclass(format('public.%I', tname)) IS NULL THEN
      RAISE NOTICE 'P0: skipping public.% (table not present)', tname;
      CONTINUE;
    END IF;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC, anon, authenticated',
      'public', tname
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      'public', tname
    );

    RAISE NOTICE 'P0: locked down public.% (all browser privileges revoked, RLS enabled)', tname;
  END LOOP;
END
$noncore_lockdown$;

-- ----------------------------------------------------------------------------
-- 6. Core governance tables — reset privileges to an empty baseline
-- ----------------------------------------------------------------------------
-- Everything is revoked first. Section 9 regrants the exact allowed set.

REVOKE ALL PRIVILEGES ON TABLE public.profiles    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.projects    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.approvals   FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.phase_gates FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Drop EVERY existing RLS policy across the whole governed surface
-- ----------------------------------------------------------------------------
-- No command filter of any kind. PostgreSQL combines permissive policies with
-- OR, so a surviving legacy SELECT policy would bypass the new tenant
-- resolver. Every policy is discovered from pg_policies and removed; section 9
-- then recreates only the five approved core policies.

DO $drop_all_policies$
DECLARE
  governed CONSTANT text[] := ARRAY[
    'profiles',
    'projects',
    'approvals',
    'phase_gates',
    'approval_steps',
    'approval_conditions',
    'approval_events',
    'approval_items',
    'gate_submissions',
    'gate_signoffs',
    'project_gate_approvers',
    'project_team',
    'project_members',
    'workflow_events',
    'audit_log',
    'audit_logs',
    'signatures',
    'tenants',
    'roles',
    'departments',
    'external_access',
    'approval_rules',
    'approval_matrix',
    'gates',
    'gate_approver_defaults',
    'gate_role_requirements',
    'gate_signoff_templates',
    'gate_templates'
  ];
  pol record;
  dropped int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (governed)
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    dropped := dropped + 1;
    RAISE NOTICE 'P0: dropped policy % on %.% [cmd=%]',
      pol.policyname, pol.schemaname, pol.tablename, pol.cmd;
  END LOOP;

  RAISE NOTICE 'P0: dropped % policy/policies across the governed surface', dropped;
END
$drop_all_policies$;

-- ----------------------------------------------------------------------------
-- 8. Defensive BEFORE UPDATE trigger on profiles
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user must reflect the real caller so
-- anon/authenticated can be distinguished from trusted service contexts.

CREATE OR REPLACE FUNCTION public.profile_protect_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $protect$
DECLARE
  table_owner name;
  is_untrusted boolean;
BEGIN
  SELECT pg_get_userbyid(c.relowner)
    INTO table_owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles';

  IF table_owner IS NULL THEN
    RAISE EXCEPTION
      'P0: could not resolve owner of public.profiles'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  is_untrusted := current_user IN ('anon', 'authenticated')
                  OR current_user NOT IN ('postgres', 'service_role', 'supabase_admin', table_owner);

  IF is_untrusted THEN
    IF OLD.id            IS DISTINCT FROM NEW.id
    OR OLD.email         IS DISTINCT FROM NEW.email
    OR OLD.tenant_id     IS DISTINCT FROM NEW.tenant_id
    OR OLD.role          IS DISTINCT FROM NEW.role
    OR OLD.is_active     IS DISTINCT FROM NEW.is_active
    OR OLD.user_type     IS DISTINCT FROM NEW.user_type
    OR OLD.external_org  IS DISTINCT FROM NEW.external_org
    OR OLD.home_role_id  IS DISTINCT FROM NEW.home_role_id
    OR OLD.department    IS DISTINCT FROM NEW.department
    THEN
      RAISE EXCEPTION
        'P0: protected profile fields (id, email, tenant_id, role, is_active, user_type, external_org, home_role_id, department) cannot be changed by role %', current_user
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$protect$;

REVOKE EXECUTE ON FUNCTION public.profile_protect_sensitive_fields()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_protect_sensitive_trigger ON public.profiles;

CREATE TRIGGER profile_protect_sensitive_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profile_protect_sensitive_fields();

COMMENT ON TRIGGER profile_protect_sensitive_trigger ON public.profiles IS
  'P0: blocks anon/authenticated changes to identity and authority columns. Trusted service contexts pass through.';

-- ----------------------------------------------------------------------------
-- 9. Core browser/realtime surface — exact policy and privilege baseline
-- ----------------------------------------------------------------------------
-- Verified browser/realtime consumers:
--   projects, approvals   -> components/dashboard/dashboard-page-client.tsx
--   profiles, phase_gates -> session resolution and gate stepper reads
-- No other governance table has a proven browser read requirement.

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_gates ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- profiles: own row update. Column privileges and the protective trigger are
-- the real limits on what may actually change.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- projects: own tenant only
CREATE POLICY projects_select_tenant
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- approvals: own tenant only
CREATE POLICY approvals_select_tenant
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- phase_gates: via parent project's tenant
CREATE POLICY phase_gates_select_tenant
  ON public.phase_gates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = phase_gates.project_id
        AND p.tenant_id = public.get_my_tenant_id()
    )
  );

-- Exact regrant set. Nothing else is granted to anon or authenticated.
GRANT SELECT ON TABLE public.profiles    TO authenticated;
GRANT SELECT ON TABLE public.projects    TO authenticated;
GRANT SELECT ON TABLE public.approvals   TO authenticated;
GRANT SELECT ON TABLE public.phase_gates TO authenticated;

-- Column-scoped write set. last_active is included because a client-side
-- writer is proven: app/auth/login/page.tsx is a 'use client' component that
-- stamps profiles.last_active through the browser Supabase client after
-- signInWithPassword. Remove last_active here if that writer is moved to a
-- guarded server action.
GRANT UPDATE (full_name, locale, digit_style, last_active)
  ON TABLE public.profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. POSTCONDITION — no structural privileges survive for browser roles
-- ----------------------------------------------------------------------------
-- Runs before COMMIT so any surviving MAINTAIN/TRUNCATE/TRIGGER/REFERENCES
-- grant aborts the transaction and rolls the whole migration back.
--
-- has_table_privilege() resolves the effective privilege, so this also catches
-- grants inherited through role membership or PUBLIC, not just direct grants.
--
-- Scope note: this verifies EXISTING relations. Future-table defaults for any
-- owner role reported by the WARNING in section 0b are outside what this
-- migration can close and remain an owner-authorized follow-up.

DO $verify_structural_privileges$
DECLARE
  remaining_count bigint;
BEGIN
  SELECT count(*)
    INTO remaining_count
  FROM pg_class c
  JOIN pg_namespace n
    ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND (
      has_table_privilege('anon', c.oid, 'MAINTAIN')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR has_table_privilege('anon', c.oid, 'TRIGGER')
      OR has_table_privilege('anon', c.oid, 'REFERENCES')
      OR has_table_privilege('authenticated', c.oid, 'MAINTAIN')
      OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
      OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
    );

  IF remaining_count > 0 THEN
    RAISE EXCEPTION
      'P0 postcondition failed: % public relations retain structural privileges for anon/authenticated',
      remaining_count;
  END IF;

  RAISE NOTICE
    'P0 postcondition passed: anon/authenticated retain no MAINTAIN, TRUNCATE, TRIGGER, or REFERENCES privileges on public relations';
END
$verify_structural_privileges$;

COMMIT;
