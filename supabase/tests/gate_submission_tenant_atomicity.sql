-- Gate Submission Tenant Scoping + Atomicity — transactional regression tests
--
-- Exercises the new submit_gate_form_tx RPC (migration 20260808190013) end-to-end
-- against the REAL schema.
--
-- Bug fixed: app/actions/gate-submissions.ts' submitGateForm() (backing
-- submitG4FormAction..submitG8FormAction) never tenant-scoped its project
-- lookup, never wrote gate_submissions.tenant_id, and ran a 5-step sequence
-- with no transaction/locks — a TOCTOU window that could create duplicate
-- pending approvals, and no defense against submitting against another
-- tenant's project.
--
-- Run with:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
--        -f supabase/tests/gate_submission_tenant_atomicity.sql
--
-- A clean run prints NOTICE lines for PASS 1 … PASS 4 ending in
-- "ALL GATE SUBMISSION TENANT/ATOMICITY CHECKS PASSED" and leaves the
-- database untouched (BEGIN ... ROLLBACK).

BEGIN;

-- ---- Apply the new RPC inside the transaction only --------------------------
-- The ROLLBACK at the end discards both the DDL and all fixture data, leaving
-- the live DB exactly as it was (submit_gate_form_tx does NOT exist on main
-- until this migration is explicitly applied).
\ir ../migrations/20260808190013_submit_gate_form_tx.sql

DO $$
DECLARE
  v_tenant     UUID;
  v_actor      UUID;
  v_proj1      UUID;  -- current_phase = 5, used for gate 4 (min phase 3)
  v_proj2      UUID;  -- current_phase = 0, used for the phase-lock negative test
  v_result     TEXT;
  v_sub_count  INT;
  v_appr_count INT;
  v_sub_tenant UUID;
  v_sub_by     UUID;
  v_raised     BOOLEAN;
  v_msg        TEXT;
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

  -- 1) SAME-TENANT SUCCESS: gate 4 requires current_phase >= 3; proj1 has 5.
  v_result := public.submit_gate_form_tx(
    v_tenant, v_proj1, 4, v_actor, '{"note":"pass1"}'::jsonb, 'PASS1 G4 Submission'
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
  RAISE NOTICE 'PASS 1: same-tenant submission tags tenant_id/submitted_by and creates exactly one pending approval';

  -- 2) IDEMPOTENT RESUBMISSION: same tenant/project/gate while pending — no duplicate approval.
  v_result := public.submit_gate_form_tx(
    v_tenant, v_proj1, 4, v_actor, '{"note":"pass2-resub"}'::jsonb, 'PASS2 G4 Submission'
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
      '{"note":"pass3-cross-tenant"}'::jsonb, 'PASS3 Cross Tenant Attempt'
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
      v_tenant, v_proj2, 6, v_actor, '{"note":"pass4-phase-lock"}'::jsonb, 'PASS4 Phase Lock Attempt'
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

  RAISE NOTICE '=== ALL GATE SUBMISSION TENANT/ATOMICITY CHECKS PASSED (rolling back) ===';
END $$;

ROLLBACK;
