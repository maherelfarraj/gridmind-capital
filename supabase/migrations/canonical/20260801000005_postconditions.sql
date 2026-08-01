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
  -- 13. handle_new_user() -- DEFECT F1 REGRESSION GUARD
  -- The draft of this function assigned 'project_manager' to every signup where
  -- production assigns 'viewer'. That was a privilege escalation introduced by
  -- the baseline itself. These checks fail loudly if it ever comes back.
  ------------------------------------------------------------------
  SELECT p.prosrc INTO v_txt FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='handle_new_user';
  IF v_txt IS NULL THEN
    v_fail := v_fail || 'handle_new_user() is missing'||E'\n';
  ELSE
    -- P-F1a: the escalation must not be present, in any spelling
    IF v_txt ILIKE '%project_manager%' THEN
      v_fail := v_fail || 'SECURITY: handle_new_user() references project_manager. '
                       || 'Production assigns viewer. This is the F1 privilege escalation.'||E'\n';
    END IF;
    -- P-F1b: the production default must be present
    IF v_txt NOT ILIKE '%''viewer''%' THEN
      v_fail := v_fail || 'handle_new_user() does not assign the production signup role ''viewer'''||E'\n';
    END IF;
    -- P-F1c: the full_name fallback must be '' and must not leak the email local-part
    IF v_txt ILIKE '%split_part%' THEN
      v_fail := v_fail || 'handle_new_user() falls back to the email local-part; production uses '''''||E'\n';
    END IF;
  END IF;

  -- P-F1d: SECURITY DEFINER + exact production search_path, including pg_temp.
  -- proconfig is an ordered text[]; compared as a whole, not by substring, so a
  -- reordering or a dropped element is caught.
  SELECT array_to_string(p.proconfig,'|') INTO v_txt
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='handle_new_user';
  IF coalesce(v_txt,'') <> 'search_path=public, pg_temp' THEN
    v_fail := v_fail || format('handle_new_user() search_path drifted: expected '
              || '"search_path=public, pg_temp", got "%s"%s', coalesce(v_txt,'<none>'), E'\n');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='handle_new_user' AND p.prosecdef) THEN
    v_fail := v_fail || 'handle_new_user() is not SECURITY DEFINER'||E'\n';
  END IF;

  ------------------------------------------------------------------
  -- 13b. approval_steps_status_check -- DEFECT C2 REGRESSION GUARD
  -- (profiles_role_check is already asserted in full at section 6 above, which
  --  is how the C1 defect was detectable: the postcondition was correct and the
  --  DDL was not.)
  ------------------------------------------------------------------
  SELECT pg_get_constraintdef(oid) INTO v_txt FROM pg_constraint
   WHERE conname='approval_steps_status_check';
  IF v_txt IS NULL THEN
    v_fail := v_fail || 'approval_steps_status_check is missing'||E'\n';
  ELSIF v_txt <> 'CHECK ((status = ANY (ARRAY[''pending''::text, ''approved''::text, '
                 ||'''rejected''::text, ''skipped''::text, ''on_hold''::text])))' THEN
    v_fail := v_fail || format('approval_steps_status_check vocabulary drifted: %s%s', v_txt, E'\n');
  END IF;

  ------------------------------------------------------------------
  -- 14. PRIVILEGES
  -- Verified production facts only. Where the reconciliation captured an exact
  -- value it is asserted exactly; where it captured only an aggregate, the
  -- aggregate is asserted and the gap is raised as a WARNING rather than being
  -- papered over with an invented expectation.
  ------------------------------------------------------------------

  -- P-G1: table privileges. Exactly 102 of 103 tables carry the full 8-privilege
  -- DML set for BOTH anon and authenticated; rate_limit_buckets carries none.
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
     AND has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     AND has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
  IF v_n <> 102 THEN
    v_fail := v_fail || format('expected 102 tables granted to anon+authenticated, got %s%s', v_n, E'\n');
  END IF;
  IF has_table_privilege('anon', 'public.rate_limit_buckets', 'SELECT')
     OR has_table_privilege('authenticated', 'public.rate_limit_buckets', 'SELECT') THEN
    v_fail := v_fail || 'rate_limit_buckets must be withheld from anon and authenticated'||E'\n';
  END IF;

  -- P-G2: view privileges -- all 6.
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='v'
     AND has_table_privilege('anon', c.oid, 'SELECT')
     AND has_table_privilege('authenticated', c.oid, 'SELECT');
  IF v_n <> 6 THEN
    v_fail := v_fail || format('expected 6 views granted to anon+authenticated, got %s%s', v_n, E'\n');
  END IF;

  -- P-G3: column privileges -- ordered fingerprint over the expanded set. The
  -- expected ROW COUNT is production-verified (9720) and reconciles exactly as
  -- 1172 table columns x 2 roles x 4 privileges + 43 view columns x 2 x 4.
  SELECT count(*) INTO v_n FROM information_schema.column_privileges
   WHERE table_schema='public' AND grantee IN ('anon','authenticated');
  IF v_n <> 9720 THEN
    v_fail := v_fail || format('expected 9720 anon/authenticated column-privilege rows, got %s%s', v_n, E'\n');
  END IF;
  -- No NARROWER per-column grant may exist: production has none, so every column
  -- privilege must be inherited from its relation.
  SELECT count(*) INTO v_n FROM information_schema.column_privileges cp
   WHERE cp.table_schema='public' AND cp.grantee IN ('anon','authenticated')
     AND NOT has_table_privilege(cp.grantee, ('public.'||quote_ident(cp.table_name))::regclass, cp.privilege_type);
  IF v_n <> 0 THEN
    v_fail := v_fail || format('%s column grants are NOT inherited from a table grant; '
              || 'production has no narrower per-column grant%s', v_n, E'\n');
  END IF;

  -- P-G4: sequences -- exactly 2, both identity sequences, both granted.
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='S';
  IF v_n <> 2 THEN
    v_fail := v_fail || format('expected 2 sequences in public, got %s%s', v_n, E'\n');
  END IF;
  FOR v_txt IN SELECT x FROM unnest(ARRAY['approval_events_id_seq','audit_log_id_seq']) x
  LOOP
    IF to_regclass('public.'||v_txt) IS NULL THEN
      v_fail := v_fail || format('missing sequence public.%s (identity sequence naming changed; '
                || 'the A4 grants would have silently targeted nothing)%s', v_txt, E'\n');
    ELSIF NOT (has_sequence_privilege('anon','public.'||v_txt,'SELECT,USAGE,UPDATE')
           AND has_sequence_privilege('authenticated','public.'||v_txt,'SELECT,USAGE,UPDATE')) THEN
      v_fail := v_fail || format('sequence public.%s not granted SELECT,USAGE,UPDATE to '
                || 'anon+authenticated%s', v_txt, E'\n');
    END IF;
  END LOOP;

  -- P-G5: function EXECUTE. increment_copilot_usage must NOT be executable by
  -- PUBLIC or anon -- PostgreSQL's default is EXECUTE TO PUBLIC, which is
  -- BROADER than production, so this asserts the corrective REVOKE took effect.
  IF has_function_privilege('public','public.increment_copilot_usage(integer)','EXECUTE') THEN
    v_fail := v_fail || 'SECURITY: increment_copilot_usage(integer) is EXECUTABLE BY PUBLIC; '
                     || 'production restricts it to postgres, authenticated, service_role'||E'\n';
  END IF;
  IF has_function_privilege('anon','public.increment_copilot_usage(integer)','EXECUTE') THEN
    v_fail := v_fail || 'SECURITY: increment_copilot_usage(integer) is EXECUTABLE BY anon'||E'\n';
  END IF;
  IF NOT has_function_privilege('authenticated','public.increment_copilot_usage(integer)','EXECUTE') THEN
    v_fail := v_fail || 'increment_copilot_usage(integer) must be EXECUTABLE BY authenticated'||E'\n';
  END IF;

  -- P-G6: ownership -- all 28 functions and all 6 views owned by postgres.
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND pg_get_userbyid(p.proowner) <> 'postgres';
  IF v_n <> 0 THEN
    v_fail := v_fail || format('%s public functions are not owned by postgres%s', v_n, E'\n');
  END IF;
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='v' AND pg_get_userbyid(c.relowner) <> 'postgres';
  IF v_n <> 0 THEN
    v_fail := v_fail || format('%s views are not owned by postgres%s', v_n, E'\n');
  END IF;

  -- P-G7: DEFAULT ACLs. SUPERSEDED by section 15.9/15.10 below -- the contents
  -- WERE captured on 2026-08-01. Production has 6 in schema public: 3 owned by
  -- postgres (now emitted by the baseline) and 3 owned by a platform superuser
  -- role that no migration role can create. Split-asserted below rather than
  -- warned about as a single undifferentiated gap.

  -- P-G8: schema USAGE. SUPERSEDED by section 15.1 -- the schema ACL WAS
  -- captured and is now asserted, not merely warned about.

  -- Emit the observed privilege fingerprints so a future pass can pin them. The
  -- reconciliation captured NO production-side grant fingerprint, so there is
  -- nothing to compare against yet; inventing an expected hash would guarantee
  -- either a permanent false failure or a meaningless constant.
  SELECT md5(string_agg(t.rel||'|'||t.grantee||'|'||t.priv, E'\n' ORDER BY t.rel, t.grantee, t.priv))
    INTO v_txt
  FROM (
    SELECT c.relname AS rel, r.grantee, p.priv
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace,
         unnest(ARRAY['anon','authenticated']) AS r(grantee),
         unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE',
                      'TRUNCATE','REFERENCES','TRIGGER']) AS p(priv)
    WHERE n.nspname='public' AND c.relkind IN ('r','v')
      AND has_table_privilege(r.grantee, c.oid, p.priv)
  ) t;
  RAISE NOTICE 'OBSERVED table/view privilege fingerprint (anon+authenticated): %', v_txt;

  ------------------------------------------------------------------
  -- 15. EXPLICIT-ACL POSTCONDITIONS (added 2026-08-01)
  --
  -- Everything above in section 14 uses has_table_privilege() and friends, which
  -- report EFFECTIVE privilege. Effective checks cannot tell an explicit grant
  -- apart from one inherited via PUBLIC or role membership, so they could not
  -- have detected the defects this pass corrected: the missing service_role
  -- grants were invisible to them, and a spurious per-column grant would still
  -- have reported "privilege present". The checks below read the STORED ACL
  -- arrays via aclexplode() and are authoritative for the explicit dimension.
  ------------------------------------------------------------------

  -- 15.1 schema public: USAGE for exactly the 5 captured grantees; CREATE for
  --       none of them (production grants CREATE only to the schema owner).
  --       GRANTOR IS DELIBERATELY NOT ASSERTED: production records
  --       pg_database_owner, a baseline run as postgres records postgres.
  --       Asserting it would be a guaranteed permanent false failure.
  SELECT count(*) INTO v_n
  FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a
  WHERE n.nspname='public' AND a.privilege_type='USAGE'
    AND COALESCE(pg_get_userbyid(NULLIF(a.grantee,0)),'PUBLIC')
        IN ('PUBLIC','anon','authenticated','service_role','postgres');
  IF v_n <> 5 THEN
    v_fail := v_fail || format('schema public USAGE grantees: expected 5, got %s%s', v_n, E'\n');
  END IF;

  SELECT count(*) INTO v_n
  FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a
  WHERE n.nspname='public' AND a.privilege_type='CREATE'
    AND COALESCE(pg_get_userbyid(NULLIF(a.grantee,0)),'PUBLIC')
        IN ('PUBLIC','anon','authenticated','service_role');
  IF v_n <> 0 THEN
    v_fail := v_fail || format('schema public CREATE leaked to %s non-owner role(s)%s', v_n, E'\n');
  END IF;

  -- 15.2 anon and authenticated each hold explicit ACLs on exactly 108
  --       relations (102 tables + 6 views). rate_limit_buckets is excluded.
  FOR v_txt IN SELECT x FROM unnest(ARRAY['anon','authenticated']) x
  LOOP
    SELECT count(DISTINCT c.oid) INTO v_n
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
         LATERAL aclexplode(c.relacl) a
    WHERE n.nspname='public' AND c.relkind IN ('r','v')
      AND pg_get_userbyid(NULLIF(a.grantee,0)) = v_txt;
    IF v_n <> 108 THEN
      v_fail := v_fail || format('%s explicit relation ACLs: expected 108, got %s%s', v_txt, v_n, E'\n');
    END IF;
  END LOOP;

  -- 15.3 service_role holds explicit ACLs on ALL 109 relations (103 tables +
  --       6 views). This is the single largest gap the draft had: zero.
  SELECT count(DISTINCT c.oid) INTO v_n
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
       LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relkind IN ('r','v')
    AND pg_get_userbyid(NULLIF(a.grantee,0))='service_role';
  IF v_n <> 109 THEN
    v_fail := v_fail || format('service_role explicit relation ACLs: expected 109, got %s%s', v_n, E'\n');
  END IF;

  -- 15.4 rate_limit_buckets -- the asymmetry that was previously wrong. It must
  --       carry all 8 privileges for service_role and NONE for anon or
  --       authenticated. Asserted from the stored ACL, in both directions.
  SELECT count(*) INTO v_n
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
       LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relname='rate_limit_buckets'
    AND pg_get_userbyid(NULLIF(a.grantee,0))='service_role';
  IF v_n <> 8 THEN
    v_fail := v_fail || format('rate_limit_buckets service_role privileges: expected 8, got %s%s', v_n, E'\n');
  END IF;

  SELECT count(*) INTO v_n
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
       LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relname='rate_limit_buckets'
    AND pg_get_userbyid(NULLIF(a.grantee,0)) IN ('anon','authenticated');
  IF v_n <> 0 THEN
    v_fail := v_fail || format('rate_limit_buckets leaked %s privilege(s) to anon/authenticated%s', v_n, E'\n');
  END IF;

  -- 15.5 no administrative role holds ANY privilege on ANY public relation.
  --       Production grants them nothing; inventing such a grant would be a
  --       silent privilege expansion that no effective-privilege check catches.
  SELECT count(*) INTO v_n
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
       LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relkind IN ('r','v','S')
    AND pg_get_userbyid(NULLIF(a.grantee,0))
        IN ('supabase_admin','supabase_auth_admin','dashboard_user');
  IF v_n <> 0 THEN
    v_fail := v_fail || format('%s administrative-role privilege(s) invented on public relations%s', v_n, E'\n');
  END IF;

  -- 15.6 sequences: SELECT+UPDATE+USAGE for anon, authenticated AND
  --       service_role = 3 privileges x 3 roles x 2 sequences = 18.
  SELECT count(*) INTO v_n
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
       LATERAL aclexplode(c.relacl) a
  WHERE n.nspname='public' AND c.relkind='S'
    AND pg_get_userbyid(NULLIF(a.grantee,0)) IN ('anon','authenticated','service_role')
    AND a.privilege_type IN ('SELECT','UPDATE','USAGE');
  IF v_n <> 18 THEN
    v_fail := v_fail || format('sequence explicit privileges: expected 18, got %s%s', v_n, E'\n');
  END IF;

  -- 15.7 function EXECUTE: exactly 27 of 28 carry PUBLIC EXECUTE. 27 + 1 = 28.
  --       The "second exception" the earlier report claimed never existed.
  SELECT count(*) INTO v_n
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
       LATERAL aclexplode(p.proacl) a
  WHERE n.nspname='public' AND a.privilege_type='EXECUTE' AND a.grantee=0;
  IF v_n <> 27 THEN
    v_fail := v_fail || format('functions with PUBLIC EXECUTE: expected 27, got %s%s', v_n, E'\n');
  END IF;

  SELECT count(*) INTO v_n
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
       LATERAL aclexplode(p.proacl) a
  WHERE n.nspname='public' AND a.privilege_type='EXECUTE'
    AND pg_get_userbyid(NULLIF(a.grantee,0))='service_role';
  IF v_n <> 28 THEN
    v_fail := v_fail || format('functions with service_role EXECUTE: expected 28, got %s%s', v_n, E'\n');
  END IF;

  -- 15.8 zero explicit column ACLs. Production has 0 non-null attacl rows: all
  --       9720 information_schema rows are expansions of table grants. Any
  --       value above 0 means someone "reproduced" the expanded rows and
  --       created narrower ACLs than production has.
  SELECT count(*) INTO v_n
  FROM pg_attribute att
  JOIN pg_class c ON c.oid=att.attrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND att.attacl IS NOT NULL;
  IF v_n <> 0 THEN
    v_fail := v_fail || format('explicit column ACLs: expected 0, got %s%s', v_n, E'\n');
  END IF;

  -- 15.9 postgres-owned default ACLs in public: exactly 3.
  SELECT count(*) INTO v_n
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole)='postgres';
  IF v_n <> 3 THEN
    v_fail := v_fail || format('postgres-owned default ACLs: expected 3, got %s%s', v_n, E'\n');
  END IF;

  -- 15.10 DEFERRED -- platform-owned default ACLs. Production has 3 more, owned
  --        by a superuser role this baseline cannot act as. They are absent by
  --        design after a bare bootstrap, so asserting them unconditionally
  --        would be a permanent false failure. Report-only unless the operator
  --        declares the platform action complete:
  --            SET canonical.platform_actions_applied = 'on';
  SELECT count(*) INTO v_n
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
  WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole) <> 'postgres';

  IF current_setting('canonical.platform_actions_applied', true) = 'on' THEN
    IF v_n <> 3 THEN
      v_fail := v_fail || format('platform-owned default ACLs: declared applied, '
                || 'expected 3, got %s%s', v_n, E'\n');
    END IF;
  ELSE
    RAISE NOTICE 'DEFERRED: platform-owned default ACLs found = % (expected 3 only after '
                 'the platform action of section B3). Privilege fidelity is '
                 'EXECUTABLE-BASELINE ONLY until they are applied.', v_n;
  END IF;

  -- 15.11 observed explicit-ACL fingerprint, emitted for a future pass to pin.
  --        No expected hash is asserted: none was ever computed against
  --        production, and inventing one guarantees either a permanent false
  --        failure or a meaningless constant.
  SELECT md5(string_agg(t.rel||'|'||t.grantee||'|'||t.priv, E'\n'
             ORDER BY t.rel, t.grantee, t.priv)) INTO v_txt
  FROM (
    SELECT c.relname AS rel,
           COALESCE(pg_get_userbyid(NULLIF(a.grantee,0)),'PUBLIC') AS grantee,
           a.privilege_type AS priv
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
         LATERAL aclexplode(c.relacl) a
    WHERE n.nspname='public' AND c.relkind IN ('r','v','S')
  ) t;
  RAISE NOTICE 'OBSERVED explicit relation ACL fingerprint (all grantees): %', v_txt;

  ------------------------------------------------------------------
  -- VERDICT
  ------------------------------------------------------------------
  IF v_fail <> '' THEN
    RAISE EXCEPTION E'CANONICAL BASELINE POSTCONDITIONS FAILED\n%\n(%; %)', v_fail, PROCEDURE_NOTE, FUNCTION_NOTE;
  END IF;

  RAISE NOTICE 'Canonical baseline postconditions PASSED: 103 tables, 6 views, 18 enums, 28 functions, 24 triggers, 144 policies, 220 indexes, column fingerprint 75f6236686b82ea3fbcab43debe8c619.';
END $$;

COMMIT;
