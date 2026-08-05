-- Gate Governance Workflow — transactional regression tests
--
-- Exercises the governed gate-approval RPCs end-to-end against the REAL schema:
--   * create_approval_workflow_tx      (20260805190005)
--   * decide_gate_approval  v4         (20260805190008)  [signature keyed to the
--       CANONICAL phase_gates.id, signature REQUIRED for endorsements]
--   * delegate_gate_approval role-chk  (20260805190009)  [delegate role must be
--       an approver AND admin-or-exact-match to the current step]
--
-- The ENTIRE script runs inside ONE transaction and ROLLS BACK at the end, so
-- it never persists a fixture. Every check RAISEs on failure, which aborts and
-- rolls the transaction back. Run with:
--
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f supabase/tests/gate_governance_workflow.sql
--
-- A clean run prints a series of NOTICE lines ending in "ALL GATE GOVERNANCE
-- CHECKS PASSED" and leaves the database untouched.

BEGIN;

DO $$
DECLARE
  v_tenant   UUID;
  v_p1       UUID;  -- actor / level-1 assignee (approver role)
  v_p2       UUID;  -- level-2 assignee / delegate (approver role)
  v_p3       UUID;
  v_p1role   TEXT;
  v_p2role   TEXT;
  v_pbad     UUID;  -- active NON-approver profile (delegation must reject)
  v_proj     UUID;
  v_g3       UUID;
  v_appr     UUID;
  v_result   TEXT;
  v_assignee UUID;
  v_status   TEXT;
  v_g3status TEXT;
  v_count    INT;
  v_steps    JSONB;
  v_sig      JSONB;
BEGIN
  -- ---- fixture -----------------------------------------------------------
  SELECT id INTO v_tenant FROM public.tenants LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'no tenant available for test'; END IF;

  -- The stricter delegate RPC accepts ONLY canonical approver roles, so the
  -- fixture actors must themselves be approvers or the "valid delegation" step
  -- would be (correctly) rejected. Capture each one's role for the role checks.
  SELECT id, role INTO v_p1, v_p1role FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager')
    ORDER BY id LIMIT 1;
  SELECT id, role INTO v_p2, v_p2role FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager') AND id <> v_p1
    ORDER BY id LIMIT 1;
  SELECT id INTO v_p3 FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager')
      AND id NOT IN (v_p1, v_p2)
    ORDER BY id LIMIT 1;
  IF v_p1 IS NULL OR v_p2 IS NULL THEN
    RAISE EXCEPTION 'need at least two active approver-role profiles in tenant %', v_tenant;
  END IF;
  -- Optional: an active NON-approver (engineer/hse_manager/etc.) for a negative
  -- delegation test. NULL is tolerated (that check is skipped with a NOTICE).
  SELECT id INTO v_pbad FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role NOT IN ('system_admin','tenant_admin','project_director','project_manager',
                       'subcontractor','client_viewer')
    ORDER BY id LIMIT 1;

  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Gate Gov Test', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
    RETURNING id INTO v_proj;

  INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
    (v_proj, 3, 'Commercial & Financial Close (RTB)', 'in_review'),
    (v_proj, 4, 'Detailed Design (IFC)', 'pending');
  SELECT id INTO v_g3 FROM public.phase_gates WHERE project_id = v_proj AND phase_number = 3;

  -- Satisfy the RACI sign-off trigger so a proceed can succeed.
  UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3;

  INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
    VALUES (v_tenant, v_proj, 3, 'submitted', v_p1);

  -- ---- 1) create_approval_workflow_tx: atomic, steps carry tenant_id ------
  v_steps := jsonb_build_array(
    jsonb_build_object('level', 1, 'assigned_to', v_p1, 'assigned_role', 'project_manager'),
    jsonb_build_object('level', 2, 'assigned_to', v_p2, 'assigned_role', 'tenant_admin')
  );
  v_appr := public.create_approval_workflow_tx(
    v_tenant, 'gate', v_proj, 'ZZ G3', NULL, 3, v_p1, NULL, 'normal', v_steps
  );

  SELECT count(*) INTO v_count FROM public.approval_steps
    WHERE approval_id = v_appr AND tenant_id = v_tenant;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL create_tx: expected 2 tenant-scoped steps, got %', v_count;
  END IF;

  SELECT assignee_id INTO v_assignee FROM public.approvals WHERE id = v_appr;
  IF v_assignee <> v_p1 THEN RAISE EXCEPTION 'FAIL create_tx: first assignee not level-1 actor'; END IF;

  SELECT count(*) INTO v_count FROM public.approval_events WHERE approval_id = v_appr;
  IF v_count < 1 THEN RAISE EXCEPTION 'FAIL create_tx: no approval_events written'; END IF;
  RAISE NOTICE 'PASS 1: create_approval_workflow_tx — 2 tenant-scoped steps + events, assignee=L1';

  -- ---- 2) multi-level progression: L1 -> partial, assignee moves to L2 ----
  v_sig := jsonb_build_object(
    'signer_name', 'Level One', 'signer_role', 'project_manager',
    'image_path', 'signatures/x/gate_approval/' || v_appr || '-l1.png',
    'statement', 'I endorse Proceed (L1).', 'ip_address', '127.0.0.1'
  );
  v_result := public.decide_gate_approval(v_appr, v_tenant, v_p1, 'proceed', 'ok l1', false, NULL, v_sig);
  IF v_result <> 'partial' THEN RAISE EXCEPTION 'FAIL progression: L1 expected partial, got %', v_result; END IF;

  SELECT assignee_id, status INTO v_assignee, v_status FROM public.approvals WHERE id = v_appr;
  IF v_assignee <> v_p2 THEN RAISE EXCEPTION 'FAIL progression: assignee did not move to L2 actor'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'FAIL progression: approval finalized too early (%)', v_status; END IF;

  -- signature row for L1 must exist (inserted INSIDE the RPC tx), keyed to the
  -- CANONICAL phase_gates.id (v_g3) — NOT the approval id.
  SELECT count(*) INTO v_count FROM public.signatures
    WHERE entity_type = 'gate_approval' AND entity_id = v_g3 AND signer_id = v_p1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL progression: L1 signature not keyed to phase_gates.id (got %)', v_count; END IF;
  -- and it must NOT be keyed to the approval id (the old, wrong identity)
  SELECT count(*) INTO v_count FROM public.signatures
    WHERE entity_type = 'gate_approval' AND entity_id = v_appr;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL identity: signature wrongly keyed to approval id (got %)', v_count; END IF;
  RAISE NOTICE 'PASS 2: L1 proceed -> partial, assignee moved to L2, L1 signature keyed to phase_gates.id';

  -- ---- 3) final level: L2 proceed -> approved, G3 advances, sig persisted -
  v_sig := jsonb_build_object(
    'signer_name', 'Level Two', 'signer_role', 'tenant_admin',
    'image_path', 'signatures/x/gate_approval/' || v_appr || '-l2.png',
    'statement', 'I endorse Proceed (final).', 'ip_address', '127.0.0.1'
  );
  v_result := public.decide_gate_approval(v_appr, v_tenant, v_p2, 'proceed', 'ok final', false, NULL, v_sig);
  IF v_result <> 'approved' THEN RAISE EXCEPTION 'FAIL final: expected approved, got %', v_result; END IF;

  SELECT status INTO v_status FROM public.approvals WHERE id = v_appr;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'FAIL final: approval not approved (%)', v_status; END IF;
  SELECT status INTO v_g3status FROM public.phase_gates WHERE id = v_g3;
  IF v_g3status <> 'approved' THEN RAISE EXCEPTION 'FAIL final: G3 not advanced (%)', v_g3status; END IF;
  -- Both endorsement signatures (L1 + L2) are keyed to the SAME canonical
  -- phase_gates.id, not the approval id.
  SELECT count(*) INTO v_count FROM public.signatures WHERE entity_id = v_g3;
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL final: expected 2 signatures keyed to phase_gates.id, got %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.signatures WHERE entity_id = v_appr;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL identity: signatures wrongly keyed to approval id (got %)', v_count; END IF;
  RAISE NOTICE 'PASS 3: L2 proceed -> approved, G3 advanced, both signatures keyed to phase_gates.id';

  -- ---- 4) endorsement without a signature RAISEs (nothing persisted) ------
  -- Uses a FRESH project + in-review gate so the ONLY reason the decision can
  -- fail is the missing signature (not gate state or sign-offs).
  DECLARE
    v_proj2  UUID;
    v_g3b    UUID;
    v_appr2  UUID;
  BEGIN
    INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
      VALUES (v_tenant, 'ZZ Gate Gov NoSig', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
      RETURNING id INTO v_proj2;
    INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
      (v_proj2, 3, 'RTB', 'in_review'), (v_proj2, 4, 'IFC', 'pending');
    SELECT id INTO v_g3b FROM public.phase_gates WHERE project_id = v_proj2 AND phase_number = 3;
    UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3b;
    INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
      VALUES (v_tenant, v_proj2, 3, 'submitted', v_p1);

    v_appr2 := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_proj2, 'ZZ G3 b', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role','project_manager'))
    );
    BEGIN
      PERFORM public.decide_gate_approval(v_appr2, v_tenant, v_p1, 'proceed', 'no sig', false, NULL, NULL);
      RAISE EXCEPTION 'FAIL sig-required: proceed without signature did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL sig-required%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%signature is required%' THEN
        RAISE EXCEPTION 'FAIL sig-required: wrong rejection reason: %', SQLERRM;
      END IF;
      -- and nothing was persisted for this gate (signatures key to phase_gates.id)
      IF (SELECT count(*) FROM public.signatures WHERE entity_id = v_g3b) <> 0 THEN
        RAISE EXCEPTION 'FAIL sig-required: a signature row survived a rejected decision';
      END IF;
      RAISE NOTICE 'PASS 4: proceed without a signature is rejected by the RPC, nothing persisted';
    END;
  END;

  -- ---- 5) delegation verifies the delegate (identity AND role) ------------
  -- The step's assigned_role is set to v_p2's OWN role so the "valid" delegation
  -- is a deterministic exact-role match, independent of whether v_p2 is an admin.
  DECLARE
    v_apprD UUID;
    v_fake  UUID := '00000000-0000-0000-0000-0000000000fe';
  BEGIN
    v_apprD := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_proj, 'ZZ G3 c', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p2role))
    );

    -- self-delegation rejected
    BEGIN
      PERFORM public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_p1, 'self', false);
      RAISE EXCEPTION 'FAIL delegate: self-delegation did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL delegate%' THEN RAISE; END IF;
    END;

    -- unknown delegate rejected
    BEGIN
      PERFORM public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_fake, 'ghost', false);
      RAISE EXCEPTION 'FAIL delegate: unknown delegate did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL delegate%' THEN RAISE; END IF;
    END;

    -- NON-APPROVER delegate rejected by the new role gate (skipped if none exist)
    IF v_pbad IS NOT NULL THEN
      BEGIN
        PERFORM public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_pbad, 'not an approver', false);
        RAISE EXCEPTION 'FAIL delegate: non-approver delegate did NOT raise';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%FAIL delegate%' THEN RAISE; END IF;
      END;
    ELSE
      RAISE NOTICE 'NOTE: no active non-approver profile available; skipped non-approver rejection';
    END IF;

    -- valid delegation (exact-role match) moves BOTH the step and approval assignee
    v_result := public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_p2, 'busy', false);
    SELECT assignee_id INTO v_assignee FROM public.approvals WHERE id = v_apprD;
    IF v_assignee <> v_p2 THEN RAISE EXCEPTION 'FAIL delegate: approval assignee did not move'; END IF;
    SELECT count(*) INTO v_count FROM public.approval_steps
      WHERE approval_id = v_apprD AND status = 'pending' AND assigned_to = v_p2;
    IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL delegate: pending step not reassigned to delegate'; END IF;
    RAISE NOTICE 'PASS 5: delegation rejects self/unknown/non-approver, valid (role-matched) moves step + approval assignee';
  END;

  -- ---- 6) wrong-tenant decision is rejected ------------------------------
  BEGIN
    PERFORM public.decide_gate_approval(
      v_appr, '00000000-0000-0000-0000-0000000000ff', v_p1, 'hold', 'x', false, NULL, NULL
    );
    RAISE EXCEPTION 'FAIL tenant: wrong-tenant decision did NOT raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%FAIL tenant%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 6: wrong-tenant decision rejected (%)', left(SQLERRM, 50);
  END;

  RAISE NOTICE '=== ALL GATE GOVERNANCE CHECKS PASSED (rolling back) ===';
END $$;

ROLLBACK;
