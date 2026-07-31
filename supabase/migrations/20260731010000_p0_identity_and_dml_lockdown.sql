-- ============================================================================
-- P0 GOVERNANCE REMEDIATION — BATCH 1: IDENTITY AND DML CONTAINMENT
-- ============================================================================
-- Scope: identity provisioning + privilege/policy containment ONLY.
-- Explicitly OUT OF SCOPE: approval engine redesign, gate model changes,
-- historical data backfills, role value rewrites.
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
-- 4. Canonical role vocabulary — direct CHECK constraint on profiles.role
-- ----------------------------------------------------------------------------
-- Existing invalid rows are reported, NOT rewritten. The new constraint is
-- added NOT VALID so no unsafe full-table rewrite/validation happens here.

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
    RAISE NOTICE 'P0: % profile row(s) hold non-canonical role values: %', invalid_count, invalid_values;
    RAISE NOTICE 'P0: these rows are NOT modified by this migration; remediate them before VALIDATE CONSTRAINT.';
  ELSE
    RAISE NOTICE 'P0: all profiles.role values are canonical.';
  END IF;
END
$role_report$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'system_admin','tenant_admin','project_director','project_manager',
    'engineer','hse_manager','commissioning_manager','finance_manager',
    'commercial_manager','viewer','subcontractor','client_viewer'
  ))
  NOT VALID;

-- Enforced for every INSERT/UPDATE from now on. Once any legacy rows reported
-- above are remediated, run this separately as a controlled operation:
--
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_check;

-- ----------------------------------------------------------------------------
-- 5. profiles privileges — browser may read own row, write 4 harmless columns
-- ----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.profiles FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON TABLE public.profiles FROM authenticated;

GRANT SELECT ON TABLE public.profiles TO authenticated;

GRANT UPDATE (full_name, locale, digit_style, last_active)
  ON TABLE public.profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Defensive BEFORE UPDATE trigger on profiles
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
-- 7. Governance table DML lockdown (anon + authenticated)
-- ----------------------------------------------------------------------------

DO $dml_lockdown$
DECLARE
  covered CONSTANT text[] := ARRAY[
    'public.projects',
    'public.phase_gates',
    'public.approvals',
    'public.approval_steps',
    'public.approval_conditions',
    'public.approval_events',
    'public.approval_items',
    'public.gate_submissions',
    'public.gate_signoffs',
    'public.project_gate_approvers',
    'public.project_team',
    'public.project_members',
    'public.workflow_events',
    'public.audit_log',
    'public.audit_logs',
    'public.signatures'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY covered LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE NOTICE 'P0: skipping % (table not present)', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE %s FROM anon',
      t
    );
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON TABLE %s FROM authenticated',
      t
    );
  END LOOP;
END
$dml_lockdown$;

-- ----------------------------------------------------------------------------
-- 8. Drop every non-SELECT RLS policy on the covered surface
-- ----------------------------------------------------------------------------
-- Discovered from pg_policies rather than guessed by name. cmd = 'ALL' counts
-- as a mutation policy and is dropped too.

DO $drop_mutation_policies$
DECLARE
  covered CONSTANT text[] := ARRAY[
    'profiles',
    'projects',
    'phase_gates',
    'approvals',
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
    'signatures'
  ];
  pol record;
  dropped int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (covered)
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    dropped := dropped + 1;
    RAISE NOTICE 'P0: dropped mutation policy % on %.% [cmd=%]',
      pol.policyname, pol.schemaname, pol.tablename, pol.cmd;
  END LOOP;

  RAISE NOTICE 'P0: dropped % non-SELECT policy/policies across the governance surface', dropped;
END
$drop_mutation_policies$;

-- ----------------------------------------------------------------------------
-- 9. Rebuild SELECT policies for the browser/realtime core
-- ----------------------------------------------------------------------------
-- Verified browser/realtime consumers:
--   projects, approvals  -> components/dashboard/dashboard-page-client.tsx
--   profiles, phase_gates -> direct session/stepper reads
-- No other governance table has a proven browser read requirement, so none
-- receive an authenticated SELECT grant.

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_gates ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- profiles: own row update (column privileges + trigger are the real limits)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- projects: own tenant only
DROP POLICY IF EXISTS projects_select_tenant ON public.projects;
CREATE POLICY projects_select_tenant
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- approvals: own tenant only
DROP POLICY IF EXISTS approvals_select_tenant ON public.approvals;
CREATE POLICY approvals_select_tenant
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- phase_gates: via parent project's tenant
DROP POLICY IF EXISTS phase_gates_select_tenant ON public.phase_gates;
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

GRANT SELECT ON TABLE public.projects    TO authenticated;
GRANT SELECT ON TABLE public.approvals   TO authenticated;
GRANT SELECT ON TABLE public.phase_gates TO authenticated;

REVOKE ALL ON TABLE public.projects    FROM anon;
REVOKE ALL ON TABLE public.approvals   FROM anon;
REVOKE ALL ON TABLE public.phase_gates FROM anon;

COMMIT;
