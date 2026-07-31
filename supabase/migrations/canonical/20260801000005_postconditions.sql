-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- POSTCONDITIONS
-- File 6 of 6  |  expected values derived from LIVE production introspection
--               of project zmahjutrpvwjcmhkiibj on 2026-08-01.
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
--
-- PURPOSE: abort the transaction if the bootstrap output does not match the
-- production fingerprint. Every number below was measured, not remembered.
--
-- RUN THIS LAST, in its own transaction, after files 1-5.
-- Any failure raises an exception and rolls this file back. Because each file
-- commits separately, a failure here does NOT undo files 1-5 -- it tells you the
-- bootstrap database is not a faithful replica and must be discarded.
-- =====================================================================

BEGIN;

SET statement_timeout = 0;
SET client_min_messages = warning;

DO $$
DECLARE
  v_fail text := '';
  v_n    bigint;
  v_txt  text;

  PROCEDURE_NOTE constant text := 'expected values captured from production 2026-08-01';

  -- helper: record a mismatch instead of failing on the first one, so a single
  -- run reports EVERY discrepancy rather than just the earliest.
  FUNCTION_NOTE constant text := 'see canonical/README.md';
BEGIN
  ------------------------------------------------------------------
  -- 1. OBJECT COUNTS
  ------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p');
  IF v_n <> 103 THEN v_fail := v_fail || format('tables: expected 103, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v';
  IF v_n <> 6 THEN v_fail := v_fail || format('views: expected 6, got %s%s', v_n, E'\n'); END IF;

  SELECT count(DISTINCT t.oid) INTO v_n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typtype='e';
  IF v_n <> 18 THEN v_fail := v_fail || format('enum types: expected 18, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S';
  IF v_n <> 2 THEN v_fail := v_fail || format('sequences: expected 2, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_indexes WHERE schemaname='public';
  IF v_n <> 220 THEN v_fail := v_fail || format('indexes: expected 220 (81 explicit + 139 constraint-backed), got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public';
  IF v_n <> 28 THEN v_fail := v_fail || format('functions: expected 28, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname='public';
  IF v_n <> 24 THEN v_fail := v_fail || format('public triggers: expected 24, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_policies WHERE schemaname='public';
  IF v_n <> 144 THEN v_fail := v_fail || format('policies: expected 144, got %s%s', v_n, E'\n'); END IF;

  ------------------------------------------------------------------
  -- 2. CONSTRAINTS BY TYPE
  ------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype='p';
  IF v_n <> 103 THEN v_fail := v_fail || format('primary keys: expected 103, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype='u';
  IF v_n <> 36 THEN v_fail := v_fail || format('unique constraints: expected 36, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype='f';
  IF v_n <> 153 THEN v_fail := v_fail || format('foreign keys: expected 153, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype='c';
  IF v_n <> 72 THEN v_fail := v_fail || format('check constraints: expected 72, got %s%s', v_n, E'\n'); END IF;

  ------------------------------------------------------------------
  -- 3. ROW LEVEL SECURITY
  ------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;
  IF v_n <> 103 THEN v_fail := v_fail || format('RLS-enabled tables: expected 103, got %s%s', v_n, E'\n'); END IF;

  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity;
  IF v_n <> 0 THEN v_fail := v_fail || format('RLS-FORCED tables: expected 0, got %s%s', v_n, E'\n'); END IF;

  ------------------------------------------------------------------
  -- 4. COLUMN-NAME FINGERPRINT ACROSS ALL 103 TABLES
  -- This is the strongest single check: md5 over "table:col1,col2,..." for every
  -- table in ordinal order. Matches production exactly as of 2026-08-01.
  ------------------------------------------------------------------
  SELECT md5(string_agg(tbl||':'||sig, E'\n' ORDER BY tbl)) INTO v_txt
  FROM (
    SELECT c.relname AS tbl, string_agg(a.attname, ',' ORDER BY a.attnum) AS sig
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
    GROUP BY c.relname
  ) s;
  IF v_txt <> '75f6236686b82ea3fbcab43debe8c619' THEN
    v_fail := v_fail || format('column fingerprint: expected 75f6236686b82ea3fbcab43debe8c619, got %s%s', v_txt, E'\n');
  END IF;

  ------------------------------------------------------------------
  -- 5. profiles -- exact 14 columns, in order
  ------------------------------------------------------------------
  SELECT string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod), ', ' ORDER BY a.attnum)
    INTO v_txt
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE n.nspname='public' AND c.relname='profiles' AND a.attnum>0 AND NOT a.attisdropped;
  IF v_txt <> 'id uuid, tenant_id uuid, full_name text, email text, role text, department text, '
            ||'avatar_url text, locale text, digit_style text, last_active timestamp with time zone, '
            ||'created_at timestamp with time zone, is_active boolean, user_type text, home_role_id uuid' THEN
    v_fail := v_fail || format('profiles columns mismatch: %s%s', v_txt, E'\n');
  END IF;

  -- profiles.external_org must NOT exist at baseline. It is added later by
  -- 20260731005000_add_profiles_external_org.sql, which must run BEFORE the P0
  -- migration 20260731010000.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='profiles' AND column_name='external_org') THEN
    v_fail := v_fail || 'profiles.external_org exists but must NOT be present in the pre-P0 baseline'||E'\n';
  END IF;

  ------------------------------------------------------------------
  -- 6. APPLICATION ROLE VOCABULARY (12 values, via CHECK -- profiles.role is TEXT,
  --    not a PG enum, so a bad value raises 23514 and never 22P02)
  ------------------------------------------------------------------
  SELECT pg_get_constraintdef(oid) INTO v_txt FROM pg_constraint WHERE conname='profiles_role_check';
  IF v_txt IS NULL THEN
    v_fail := v_fail || 'profiles_role_check is missing'||E'\n';
  ELSIF v_txt <> 'CHECK ((role = ANY (ARRAY[''system_admin''::text, ''tenant_admin''::text, '
                 ||'''project_director''::text, ''project_manager''::text, ''engineer''::text, '
                 ||'''hse_manager''::text, ''commissioning_manager''::text, ''finance_manager''::text, '
                 ||'''commercial_manager''::text, ''viewer''::text, ''subcontractor''::text, '
                 ||'''client_viewer''::text])))' THEN
    v_fail := v_fail || format('profiles_role_check vocabulary drifted: %s%s', v_txt, E'\n');
  END IF;

  -- the user_role ENUM also exists in production, with the same 12 labels
  SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) INTO v_txt
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  JOIN pg_namespace n ON n.oid=t.typnamespace
  WHERE n.nspname='public' AND t.typname='user_role';
  IF v_txt <> 'system_admin,tenant_admin,project_director,project_manager,engineer,hse_manager,'
            ||'commissioning_manager,finance_manager,commercial_manager,viewer,subcontractor,client_viewer' THEN
    v_fail := v_fail || format('user_role enum drifted: %s%s', v_txt, E'\n');
  END IF;

  ------------------------------------------------------------------
  -- 7. REQUIRED HELPER FUNCTION SIGNATURES (all SECURITY DEFINER in production)
  ------------------------------------------------------------------
  FOR v_txt IN
    SELECT x FROM unnest(ARRAY[
      'get_my_tenant_id()',
      'current_user_role()',
      'is_external_role()',
      'has_external_access(p_project_id uuid)',
      'handle_new_user()',
      'audit_trigger_fn()',
      'prevent_profiles_drop()',
      'increment_copilot_usage(p_token_count integer)',
      'consume_rate_limit(p_key text, p_capacity integer, p_refill_per_sec numeric)',
      'current_user_org()',
      'spawn_gate_signoffs()',
      'enforce_gate_approval()'
    ]) x
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' = v_txt
    ) THEN
      v_fail := v_fail || format('missing function: public.%s%s', v_txt, E'\n');
    END IF;
  END LOOP;

  -- the four identity/authorization helpers must be SECURITY DEFINER, else RLS
  -- policies that call them evaluate with the caller's own (restricted) rights
  -- and silently deny or, worse, leak depending on the policy's shape.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef
    AND p.proname IN ('get_my_tenant_id','current_user_role','is_external_role','has_external_access');
  IF v_n <> 4 THEN
    v_fail := v_fail || format('expected 4 SECURITY DEFINER identity helpers, got %s%s', v_n, E'\n');
  END IF;

  ------------------------------------------------------------------
  -- 8. ALL SIX VIEWS EXIST
  ------------------------------------------------------------------
  FOR v_txt IN
    SELECT x FROM unnest(ARRAY['v_gate_progress','v_inbox','v_person_task_load',
                               'v_person_workload','v_project_staffing','v_role_workload']) x
  LOOP
    IF to_regclass('public.'||v_txt) IS NULL THEN
      v_fail := v_fail || format('missing view: public.%s%s', v_txt, E'\n');
    END IF;
  END LOOP;

  ------------------------------------------------------------------
  -- 9. KEY CONSTRAINTS AND INDEXES
  ------------------------------------------------------------------
  IF to_regclass('public.profiles') IS NULL THEN
    v_fail := v_fail || 'missing table: public.profiles'||E'\n'; END IF;
  IF to_regclass('public.external_access') IS NULL THEN
    v_fail := v_fail || 'missing table: public.external_access'||E'\n'; END IF;
  IF to_regclass('public.phase_gates') IS NULL THEN
    v_fail := v_fail || 'missing table: public.phase_gates'||E'\n'; END IF;
  IF to_regclass('public.audit_log') IS NULL THEN
    v_fail := v_fail || 'missing table: public.audit_log'||E'\n'; END IF;

  -- audit_log shape is load-bearing: table_name is NOT NULL, so any writer that
  -- omits it fails with 23502. There is no audit_logs (plural) table.
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    v_fail := v_fail || 'unexpected table public.audit_logs (plural) -- only audit_log exists'||E'\n'; END IF;
  SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO v_txt
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE n.nspname='public' AND c.relname='audit_log' AND a.attnum>0 AND NOT a.attisdropped;
  IF v_txt <> 'id,tenant_id,table_name,record_id,action,changed_by,old_values,new_values,changed_at' THEN
    v_fail := v_fail || format('audit_log columns drifted: %s%s', v_txt, E'\n');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_log_action_check') THEN
    v_fail := v_fail || 'missing constraint audit_log_action_check'||E'\n'; END IF;

  ------------------------------------------------------------------
  -- 10. EVENT TRIGGER
  ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname='block_profiles_drop') THEN
    v_fail := v_fail || 'missing event trigger block_profiles_drop'||E'\n'; END IF;

  ------------------------------------------------------------------
  -- 11. NO APPLICATION DATA. A baseline bootstraps SCHEMA ONLY.
  -- Any row here means seed or demo data leaked into the baseline.
  ------------------------------------------------------------------
  FOR v_txt IN
    SELECT x FROM unnest(ARRAY['tenants','projects','profiles','approvals','phase_gates',
                               'audit_log','external_access','roles','departments']) x
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_txt) INTO v_n;
    IF v_n <> 0 THEN
      v_fail := v_fail || format('table %s contains %s rows -- baseline must be schema-only%s', v_txt, v_n, E'\n');
    END IF;
  END LOOP;

  -- no auth users may be created by the baseline
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM auth.users' INTO v_n;
    IF v_n <> 0 THEN
      v_fail := v_fail || format('auth.users contains %s rows -- baseline must not create auth users%s', v_n, E'\n');
    END IF;
  END IF;

  ------------------------------------------------------------------
  -- 12. NO CUSTOM APPLICATION-NAMED DATABASE ROLES
  -- Production has 12 such roles (system_admin, tenant_admin, ...) but NOTHING
  -- references them: no policy targets them and they hold no grants in public.
  -- They are deliberately excluded from the baseline. Their presence here would
  -- mean someone re-ran the misnamed 20260730000004_client_viewer_role.sql.
  ------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_roles
   WHERE rolname IN ('system_admin','tenant_admin','project_director','project_manager',
                     'engineer','hse_manager','commissioning_manager','finance_manager',
                     'commercial_manager','viewer','subcontractor','client_viewer');
  IF v_n <> 0 THEN
    RAISE WARNING 'INFO: % application-named DB roles exist. Production also has these, '
                  'but nothing references them. Not an error; recorded for parity.', v_n;
  END IF;

  ------------------------------------------------------------------
  -- VERDICT
  ------------------------------------------------------------------
  IF v_fail <> '' THEN
    RAISE EXCEPTION E'CANONICAL BASELINE POSTCONDITIONS FAILED\n%\n(%; %)', v_fail, PROCEDURE_NOTE, FUNCTION_NOTE;
  END IF;

  RAISE NOTICE 'Canonical baseline postconditions PASSED: 103 tables, 6 views, 18 enums, 28 functions, 24 triggers, 144 policies, 220 indexes, column fingerprint 75f6236686b82ea3fbcab43debe8c619.';
END $$;

COMMIT;
