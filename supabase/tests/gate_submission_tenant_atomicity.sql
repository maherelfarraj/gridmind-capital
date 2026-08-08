-- Gate Submission Tenant Scoping + Atomicity — transactional regression tests
--
-- Exercises the submit_gate_form_tx RPC (migration 20260808190013) end-to-end
-- against the REAL schema.
--
-- Bug fixed: app/actions/gate-submissions.ts' submitGateForm() (backing
-- submitG4FormAction..submitG8FormAction) never tenant-scoped its project
-- lookup, never wrote gate_submissions.tenant_id, and ran a 5-step sequence
-- with no transaction/locks — a TOCTOU window that could create duplicate
-- pending approvals, and no defense against submitting against another
-- tenant's project.
--
-- Also covers the amendment that switched the function from SECURITY
-- DEFINER to SECURITY INVOKER and moved the approval title from a caller-
-- supplied p_title argument to a value derived server-side from the locked
-- projects row.
--
-- Run with:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
--        -f supabase/tests/gate_submission_tenant_atomicity.sql
--
-- A clean run prints NOTICE lines for PASS 1 … PASS 8 ending in
-- "ALL GATE SUBMISSION TENANT/ATOMICITY CHECKS PASSED" and leaves the
-- database untouched (BEGIN ... ROLLBACK).

BEGIN;

-- ---- Apply the RPC inside the transaction only -------------------------------
-- The ROLLBACK at the end discards both the DDL and all fixture data, leaving
-- the live DB exactly as it was (submit_gate_form_tx does NOT exist on main
-- until this migration is explicitly applied).
\ir ../migrations/20260808190013_submit_gate_form_tx.sql

DO $$
DECLARE
  v_tenant       UUID;
  v_actor        UUID;
  v_proj1        UUID;  -- current_phase = 5, used for gates 4/5 (min phase 3/4)
  v_proj2        UUID;  -- current_phase = 0, used for the phase-lock negative test
  v_proj5        UUID;  -- current_phase = 5, used for the approval-insert-failure atomicity test
  v_proj6        UUID;  -- current_phase = 5, used for the approved-resubmission no-op test
  v_result       TEXT;
  v_sub_count    INT;
  v_appr_count   INT;
  v_sub_tenant   UUID;
  v_sub_by       UUID;
  v_raised       BOOLEAN;
  v_msg          TEXT;
  v_form_before  JSONB;
  v_form_after   JSONB;
  v_updated_before TIMESTAMPTZ;
  v_updated_after  TIMESTAMPTZ;
BEGIN
  -- ---- fixture ---------------------------------------------------------------
  SELECT id INTO v_tenant FROM public.tenants LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'no tenant available for test'; END IF;

  SELECT id INTO v_actor FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
    ORDER BY id LIMIT 1;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'no active profile available for test'; END IF;

  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Submit Atomic 1', 'ZZ-SUB-' || floor(random()*1e7)::text, 5, 'active')
    RETURNING id INTO v_proj1;
  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Submit Atomic 2', 'ZZ-SUB-' || floor(random()*1e7)::text, 0, 'active')
    RETURNING id INTO v_proj2;
  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Submit Atomic FORCEFAILPASS5', 'ZZ-SUB-' || floor(random()*1e7)::text, 5, 'active')
    RETURNING id INTO v_proj5;
  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Submit Atomic 6', 'ZZ-SUB-' || floor(random()*1e7)::text, 5, 'active')
    RETURNING id INTO v_proj6;

  -- 1) SAME-TENANT SUCCESS: gate 4 requires current_phase >= 3; proj1 has 5.
  v_result := public.submit_gate_form_tx(
    v_tenant, v_proj1, 4, v_actor, '{"note":"pass1"}'::jsonb
  );
  IF v_result <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL 1: expected submitted, got %', v_result;
  END IF;

  SELECT tenant_id, submitted_by INTO v_sub_tenant, v_sub_by
    FROM public.gate_submissions WHERE project_id = v_proj1 AND gate_number = 4;
  IF v_sub_tenant IS DISTINCT FROM v_tenant OR v_sub_by IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'FAIL 1: gate_submissions not tagged correctly (tenant=%, submitted_by=%)', v_sub_tenant, v_sub_by;
  END IF;

  SELECT count(*) INTO v_appr_count FROM public.approvals
    WHERE tenant_id = v_tenant AND object_type = 'gate' AND object_id = v_proj1
      AND gate_number = 4 AND status = 'pending';
  IF v_appr_count <> 1 THEN
    RAISE EXCEPTION 'FAIL 1: expected exactly one pending approval, got %', v_appr_count;
  END IF;

  -- The title is now derived server-side from the project row, not a caller
  -- argument — assert it actually contains the real project name.
  IF NOT EXISTS (
    SELECT 1 FROM public.approvals
     WHERE tenant_id = v_tenant AND object_type = 'gate' AND object_id = v_proj1
       AND gate_number = 4 AND title LIKE '%ZZ Submit Atomic 1%'
  ) THEN
    RAISE EXCEPTION 'FAIL 1: approval title was not derived from the projects row';
  END IF;
  RAISE NOTICE 'PASS 1: same-tenant submission tags tenant_id/submitted_by, creates exactly one pending approval, and derives its title server-side';

  -- 2) IDEMPOTENT RESUBMISSION: same tenant/project/gate while pending — no duplicate approval.
  v_result := public.submit_gate_form_tx(
    v_tenant, v_proj1, 4, v_actor, '{"note":"pass2-resub"}'::jsonb
  );
  IF v_result <> 'resubmitted' THEN
    RAISE EXCEPTION 'FAIL 2: expected resubmitted, got %', v_result;
  END IF;

  SELECT count(*) INTO v_appr_count FROM public.approvals
    WHERE tenant_id = v_tenant AND object_type = 'gate' AND object_id = v_proj1 AND gate_number = 4;
  IF v_appr_count <> 1 THEN
    RAISE EXCEPTION 'FAIL 2: expected approval count to remain 1, got %', v_appr_count;
  END IF;

  SELECT count(*) INTO v_sub_count FROM public.gate_submissions
    WHERE project_id = v_proj1 AND gate_number = 4;
  IF v_sub_count <> 1 THEN
    RAISE EXCEPTION 'FAIL 2: expected exactly one gate_submissions row (upsert), got %', v_sub_count;
  END IF;
  RAISE NOTICE 'PASS 2: resubmission while pending is idempotent (no duplicate approval, upsert not insert)';

  -- 3) CROSS-TENANT: a fake/foreign tenant id against a real tenant's project
  --    must RAISE and leave zero rows changed.
  v_raised := false;
  BEGIN
    PERFORM public.submit_gate_form_tx(
      'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid, v_proj1, 5, v_actor,
      '{"note":"pass3-cross-tenant"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    v_msg := SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL 3: cross-tenant call should have raised';
  END IF;
  IF v_msg NOT LIKE '%not found for tenant%' THEN
    RAISE EXCEPTION 'FAIL 3: unexpected error message: %', v_msg;
  END IF;

  SELECT count(*) INTO v_sub_count FROM public.gate_submissions
    WHERE project_id = v_proj1 AND gate_number = 5;
  IF v_sub_count <> 0 THEN
    RAISE EXCEPTION 'FAIL 3: cross-tenant attempt must not create a gate_submissions row, got %', v_sub_count;
  END IF;
  RAISE NOTICE 'PASS 3: cross-tenant p_tenant_id raises tenant-mismatch guard, zero rows changed';

  -- 4) PHASE-LOCK: proj2 has current_phase = 0; gate 6 requires >= 5.
  v_raised := false;
  BEGIN
    PERFORM public.submit_gate_form_tx(
      v_tenant, v_proj2, 6, v_actor, '{"note":"pass4-phase-lock"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    v_msg := SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL 4: phase-locked gate submission should have raised';
  END IF;
  IF v_msg NOT LIKE '%is locked at current phase%' THEN
    RAISE EXCEPTION 'FAIL 4: unexpected error message: %', v_msg;
  END IF;

  SELECT count(*) INTO v_sub_count FROM public.gate_submissions
    WHERE project_id = v_proj2 AND gate_number = 6;
  IF v_sub_count <> 0 THEN
    RAISE EXCEPTION 'FAIL 4: phase-locked attempt must not create a gate_submissions row, got %', v_sub_count;
  END IF;
  RAISE NOTICE 'PASS 4: phase-locked gate submission raises, zero rows changed';

  -- 5) ATOMICITY: force the approval INSERT to fail and prove the earlier
  --    gate_submissions upsert in the SAME function call is rolled back too.
  --    v_proj5's name contains the marker 'FORCEFAILPASS5', which flows into
  --    the server-derived approval title; a temporary trigger rejects any
  --    approvals insert whose title carries that marker.
  CREATE OR REPLACE FUNCTION pg_temp.pass5_force_approval_failure()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $trig$
  BEGIN
    IF NEW.title LIKE '%FORCEFAILPASS5%' THEN
      RAISE EXCEPTION 'PASS5_INJECTED_FAILURE: simulated approval-insert failure';
    END IF;
    RETURN NEW;
  END;
  $trig$;

  CREATE TRIGGER pass5_force_approval_failure_trg
    BEFORE INSERT ON public.approvals
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.pass5_force_approval_failure();

  v_raised := false;
  BEGIN
    PERFORM public.submit_gate_form_tx(
      v_tenant, v_proj5, 4, v_actor, '{"note":"pass5-force-fail"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    v_msg := SQLERRM;
  END;

  DROP TRIGGER pass5_force_approval_failure_trg ON public.approvals;

  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL 5: injected approval-insert failure should have raised';
  END IF;
  IF v_msg NOT LIKE '%PASS5_INJECTED_FAILURE%' THEN
    RAISE EXCEPTION 'FAIL 5: unexpected error message: %', v_msg;
  END IF;

  -- The whole function call is one statement from the DO block's point of
  -- view; the EXCEPTION handler above implicitly rolled back everything the
  -- function did, including the gate_submissions upsert that ran BEFORE the
  -- approval insert failed.
  SELECT count(*) INTO v_sub_count FROM public.gate_submissions
    WHERE project_id = v_proj5 AND gate_number = 4;
  IF v_sub_count <> 0 THEN
    RAISE EXCEPTION 'FAIL 5: approval-insert failure did not roll back the gate_submissions upsert, found % row(s)', v_sub_count;
  END IF;

  SELECT count(*) INTO v_appr_count FROM public.approvals
    WHERE object_id = v_proj5 AND gate_number = 4;
  IF v_appr_count <> 0 THEN
    RAISE EXCEPTION 'FAIL 5: approval-insert failure left a partial approvals row, found % row(s)', v_appr_count;
  END IF;
  RAISE NOTICE 'PASS 5: an approval-insert failure rolls back the gate_submissions upsert from the same call — the write is fully atomic';

  -- 6) APPROVED RESUBMISSION IS A HARD NO-OP: once a gate_submissions row is
  --    'approved', resubmission must RAISE and change nothing at all (not
  --    even touch updated_at), not just skip the approval step.
  v_result := public.submit_gate_form_tx(
    v_tenant, v_proj6, 4, v_actor, '{"note":"pass6-initial"}'::jsonb
  );
  IF v_result <> 'submitted' THEN
    RAISE EXCEPTION 'FAIL 6 setup: expected submitted, got %', v_result;
  END IF;

  UPDATE public.gate_submissions
     SET status = 'approved'
   WHERE project_id = v_proj6 AND gate_number = 4;

  SELECT form_data, updated_at INTO v_form_before, v_updated_before
    FROM public.gate_submissions WHERE project_id = v_proj6 AND gate_number = 4;

  v_raised := false;
  BEGIN
    PERFORM public.submit_gate_form_tx(
      v_tenant, v_proj6, 4, v_actor, '{"note":"pass6-attempted-resubmit-after-approval"}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    v_msg := SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'FAIL 6: resubmission of an approved gate should have raised';
  END IF;
  IF v_msg NOT LIKE '%already been approved%' THEN
    RAISE EXCEPTION 'FAIL 6: unexpected error message: %', v_msg;
  END IF;

  SELECT form_data, updated_at INTO v_form_after, v_updated_after
    FROM public.gate_submissions WHERE project_id = v_proj6 AND gate_number = 4;
  IF v_form_after IS DISTINCT FROM v_form_before OR v_updated_after IS DISTINCT FROM v_updated_before THEN
    RAISE EXCEPTION 'FAIL 6: an approved gate_submissions row was mutated by the rejected resubmission attempt';
  END IF;

  SELECT count(*) INTO v_appr_count FROM public.approvals
    WHERE object_id = v_proj6 AND gate_number = 4;
  IF v_appr_count <> 1 THEN
    RAISE EXCEPTION 'FAIL 6: approvals count should remain exactly 1 (the original), got %', v_appr_count;
  END IF;
  RAISE NOTICE 'PASS 6: resubmitting an already-approved gate raises and changes absolutely nothing';

  RAISE NOTICE '=== PASS 1-6 COMPLETE — proceeding to ACL checks ===';
END $$;

-- 7) & 8) ACL CHECKS — run as their own DO block. PL/pgSQL does not support
--    explicit SAVEPOINT/ROLLBACK TO SAVEPOINT statements, so each role-switch
--    attempt is wrapped in its own nested BEGIN...EXCEPTION...END block; a
--    caught exception implicitly rolls back to an automatic savepoint taken
--    at that block's start, which also restores the SET LOCAL ROLE change —
--    no manual RESET ROLE is needed on the exception path, only after a
--    call that succeeds without raising.
DO $$
DECLARE
  v_anon_denied BOOLEAN := false;
  v_auth_denied BOOLEAN := false;
  v_svc_ok      BOOLEAN := false;
  v_pub_grant   BOOLEAN;
  v_anon_msg    TEXT;
  v_auth_msg    TEXT;
  v_tenant      UUID;
  v_actor       UUID;
  v_proj8       UUID;
  v_result      TEXT;
BEGIN
  -- PUBLIC: no ACL entry at all for the pseudo-role "PUBLIC" (grantee OID 0).
  SELECT EXISTS (
    SELECT 1
      FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(p.proacl) AS acl
     WHERE p.proname = 'submit_gate_form_tx'
       AND p.pronamespace = 'public'::regnamespace
       AND acl.grantee = 0
       AND acl.privilege_type = 'EXECUTE'
  ) INTO v_pub_grant;
  IF v_pub_grant THEN
    RAISE EXCEPTION 'FAIL 7a: PUBLIC still has an EXECUTE grant on submit_gate_form_tx';
  END IF;

  -- anon: SET LOCAL ROLE + a real call must fail with insufficient_privilege.
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.submit_gate_form_tx(
      gen_random_uuid(), gen_random_uuid(), 4, gen_random_uuid(), '{}'::jsonb
    );
    RESET ROLE;  -- only reached if the deny FAILED to fire
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_anon_denied := true;
    WHEN OTHERS THEN
      v_anon_msg := SQLERRM;
  END;
  IF NOT v_anon_denied THEN
    RAISE EXCEPTION 'FAIL 7b: anon should be denied EXECUTE with insufficient_privilege, got: %', COALESCE(v_anon_msg, '(no error raised — anon was NOT denied)');
  END IF;

  -- authenticated: same check.
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.submit_gate_form_tx(
      gen_random_uuid(), gen_random_uuid(), 4, gen_random_uuid(), '{}'::jsonb
    );
    RESET ROLE;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_auth_denied := true;
    WHEN OTHERS THEN
      v_auth_msg := SQLERRM;
  END;
  IF NOT v_auth_denied THEN
    RAISE EXCEPTION 'FAIL 7c: authenticated should be denied EXECUTE with insufficient_privilege, got: %', COALESCE(v_auth_msg, '(no error raised — authenticated was NOT denied)');
  END IF;

  RAISE NOTICE 'PASS 7: PUBLIC has no EXECUTE grant, and anon/authenticated are both denied with insufficient_privilege';

  -- 8) service_role: SET LOCAL ROLE + a real, valid call must succeed (no
  --    insufficient_privilege — SECURITY INVOKER means it runs as
  --    service_role, which has BYPASSRLS and full table grants already).
  SELECT id INTO v_tenant FROM public.tenants LIMIT 1;
  SELECT id INTO v_actor FROM public.profiles WHERE tenant_id = v_tenant AND is_active = true ORDER BY id LIMIT 1;

  BEGIN
    SET LOCAL ROLE service_role;

    INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
      VALUES (v_tenant, 'ZZ Submit Atomic 8 SVC', 'ZZ-SUB-' || floor(random()*1e7)::text, 5, 'active')
      RETURNING id INTO v_proj8;

    v_result := public.submit_gate_form_tx(
      v_tenant, v_proj8, 4, v_actor, '{"note":"pass8-service-role"}'::jsonb
    );

    RESET ROLE;

    IF v_result = 'submitted' THEN
      v_svc_ok := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 8: service_role call unexpectedly failed: %', SQLERRM;
  END;

  IF NOT v_svc_ok THEN
    RAISE EXCEPTION 'FAIL 8: service_role should be able to execute and submit successfully';
  END IF;
  RAISE NOTICE 'PASS 8: service_role can execute submit_gate_form_tx end-to-end';

  RAISE NOTICE '=== ALL GATE SUBMISSION TENANT/ATOMICITY CHECKS PASSED (rolling back) ===';
END $$;

ROLLBACK;
