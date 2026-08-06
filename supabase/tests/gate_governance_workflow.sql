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

  -- ---- 7) SEGREGATION OF DUTIES: requester may not self-decide -----------
  -- A FRESH in-review gate whose approval requester AND sole step assignee are
  -- the SAME person (v_p1). The ONLY reason a decision can be refused is the
  -- requester rule, and it must be refused even WITH admin override. Assert a
  -- clean rollback: no step, approval, gate, signature, condition, event,
  -- workflow-event, or audit mutation survives the refusal.
  DECLARE
    v_projS   UUID;
    v_g3s     UUID;
    v_apprS   UUID;
    v_sigS    JSONB;
    v_ev0     INT;  v_ev1     INT;
    v_sig0    INT;  v_sig1    INT;
    v_cond0   INT;  v_cond1   INT;
    v_wev0    INT;  v_wev1    INT;
    v_aud0    INT;  v_aud1    INT;
    v_stepA0  UUID; v_stepA1  UUID;
    v_stepS0  TEXT; v_stepS1  TEXT;
  BEGIN
    INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
      VALUES (v_tenant, 'ZZ Gate Gov SelfAct', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
      RETURNING id INTO v_projS;
    INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
      (v_projS, 3, 'RTB', 'in_review'), (v_projS, 4, 'IFC', 'pending');
    SELECT id INTO v_g3s FROM public.phase_gates WHERE project_id = v_projS AND phase_number = 3;
    UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3s;
    INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
      VALUES (v_tenant, v_projS, 3, 'submitted', v_p1);

    -- requester = v_p1, level-1 assignee = v_p1 (self-action target)
    v_apprS := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_projS, 'ZZ G3 self', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
    );

    -- snapshot pre-state
    SELECT count(*) INTO v_ev0   FROM public.approval_events     WHERE approval_id = v_apprS;
    SELECT count(*) INTO v_sig0  FROM public.signatures          WHERE entity_id = v_g3s;
    SELECT count(*) INTO v_cond0 FROM public.approval_conditions WHERE approval_id = v_apprS;
    SELECT count(*) INTO v_wev0  FROM public.workflow_events     WHERE (metadata->>'project_id') = v_projS::text;
    SELECT count(*) INTO v_aud0  FROM public.audit_log           WHERE record_id = v_apprS::text;
    SELECT assigned_to, status INTO v_stepA0, v_stepS0
      FROM public.approval_steps WHERE approval_id = v_apprS ORDER BY level LIMIT 1;

    v_sigS := jsonb_build_object(
      'signer_name', 'Self Actor', 'signer_role', v_p1role,
      'image_path', 'signatures/x/gate_approval/' || v_apprS || '-self.png',
      'statement', 'I (the requester) endorse my own gate.', 'ip_address', '127.0.0.1'
    );

    -- (a) requester as the ASSIGNED approver (no override) -> refused
    BEGIN
      PERFORM public.decide_gate_approval(v_apprS, v_tenant, v_p1, 'proceed', 'self', false, NULL, v_sigS);
      RAISE EXCEPTION 'FAIL self-decide: requester/assignee decision did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-decide%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-decide: wrong rejection reason: %', SQLERRM;
      END IF;
    END;

    -- (b) requester WITH admin override -> still refused (override cannot bypass)
    BEGIN
      PERFORM public.decide_gate_approval(v_apprS, v_tenant, v_p1, 'proceed', 'self+override', true, NULL, v_sigS);
      RAISE EXCEPTION 'FAIL self-decide: requester admin-override decision did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-decide%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-decide: wrong override rejection reason: %', SQLERRM;
      END IF;
    END;

    -- (c) requester self-DELEGATION -> refused (even with admin override)
    BEGIN
      PERFORM public.delegate_gate_approval(v_apprS, v_tenant, v_p1, v_p2, 'hand off my own', true);
      RAISE EXCEPTION 'FAIL self-delegate: requester delegation did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-delegate%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-delegate: wrong rejection reason: %', SQLERRM;
      END IF;
    END;

    -- snapshot post-state and assert ZERO mutation from the three refusals
    SELECT count(*) INTO v_ev1   FROM public.approval_events     WHERE approval_id = v_apprS;
    SELECT count(*) INTO v_sig1  FROM public.signatures          WHERE entity_id = v_g3s;
    SELECT count(*) INTO v_cond1 FROM public.approval_conditions WHERE approval_id = v_apprS;
    SELECT count(*) INTO v_wev1  FROM public.workflow_events     WHERE (metadata->>'project_id') = v_projS::text;
    SELECT count(*) INTO v_aud1  FROM public.audit_log           WHERE record_id = v_apprS::text;
    SELECT assigned_to, status INTO v_stepA1, v_stepS1
      FROM public.approval_steps WHERE approval_id = v_apprS ORDER BY level LIMIT 1;

    IF v_ev1   <> v_ev0   THEN RAISE EXCEPTION 'FAIL self-action: approval_events changed (% -> %)', v_ev0, v_ev1; END IF;
    IF v_sig1  <> v_sig0  THEN RAISE EXCEPTION 'FAIL self-action: signatures changed (% -> %)', v_sig0, v_sig1; END IF;
    IF v_cond1 <> v_cond0 THEN RAISE EXCEPTION 'FAIL self-action: approval_conditions changed (% -> %)', v_cond0, v_cond1; END IF;
    IF v_wev1  <> v_wev0  THEN RAISE EXCEPTION 'FAIL self-action: workflow_events changed (% -> %)', v_wev0, v_wev1; END IF;
    IF v_aud1  <> v_aud0  THEN RAISE EXCEPTION 'FAIL self-action: audit_log changed (% -> %)', v_aud0, v_aud1; END IF;
    IF v_stepA1 <> v_stepA0 OR v_stepS1 <> v_stepS0 THEN
      RAISE EXCEPTION 'FAIL self-action: step assignee/status changed (% / % -> % / %)', v_stepA0, v_stepS0, v_stepA1, v_stepS1;
    END IF;

    SELECT status INTO v_status  FROM public.approvals   WHERE id = v_apprS;
    IF v_status <> 'pending' THEN RAISE EXCEPTION 'FAIL self-action: approval status changed to %', v_status; END IF;
    SELECT status INTO v_g3status FROM public.phase_gates WHERE id = v_g3s;
    IF v_g3status <> 'in_review' THEN RAISE EXCEPTION 'FAIL self-action: gate status changed to %', v_g3status; END IF;

    RAISE NOTICE 'PASS 7: requester self-decide (assignee AND admin-override) + self-delegate all refused, ZERO mutation';
  END;

  -- ---- 8) AUDIT TRANSITIONS: from_status must reflect real approval status --
  -- Exercises all five event-emitting decision paths on a FRESH delegated
  -- approval so the ONLY observable difference vs v5 is the from_status value.
  -- Each sub-block uses a separate approval to keep the assertions clean.
  -- Ordinary 'pending' paths are also verified to confirm no regression.
  --
  -- Literals are pinned in assertions (not derived from a shared constant) so
  -- a mutation that changes the variable assignment is caught by a fixed string.
  DECLARE
    v_projA  UUID;
    v_g3A    UUID;
    v_apprA  UUID;
    v_sigA   JSONB;
    v_ev_from TEXT; v_ev_to TEXT;
  BEGIN
    -- Shared project + gate for all sub-tests in this block.
    INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
      VALUES (v_tenant, 'ZZ Audit Trans', 'ZZ-GAT-' || floor(random()*1e7)::text, 2, 'active')
      RETURNING id INTO v_projA;
    INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
      (v_projA, 3, 'RTB', 'in_review'), (v_projA, 4, 'IFC', 'pending');
    SELECT id INTO v_g3A FROM public.phase_gates WHERE project_id = v_projA AND phase_number = 3;
    UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3A;
    INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
      VALUES (v_tenant, v_projA, 3, 'submitted', v_p1);

    v_sigA := jsonb_build_object(
      'signer_name', 'Delegated Actor', 'signer_role', v_p2role,
      'image_path', 'signatures/x/gate_approval/aud-test.png',
      'statement', 'Delegated endorsement.', 'ip_address', '127.0.0.1'
    );

    -- 8a) HOLD on a delegated approval: decided delegated->delegated
    v_apprA := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_projA, 'ZZ aud hold', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
    );
    -- Delegate to v_p2 to put approval in 'delegated' state.
    PERFORM public.delegate_gate_approval(v_apprA, v_tenant, v_p1, v_p2, 'busy', false);
    -- Verify approval is now delegated before deciding.
    SELECT status INTO v_status FROM public.approvals WHERE id = v_apprA;
    IF v_status <> 'delegated' THEN
      RAISE EXCEPTION 'FAIL 8a setup: expected delegated, got %', v_status;
    END IF;
    -- Now v_p2 holds the step. Decide as v_p2 (admin override because step
    -- assigned_role may differ from p2's role after delegation).
    PERFORM public.decide_gate_approval(v_apprA, v_tenant, v_p2, 'hold', 'pause', true, NULL, NULL);
    -- The decided event must be delegated -> delegated (literal 'delegated', not 'pending').
    SELECT from_status, to_status INTO v_ev_from, v_ev_to
      FROM public.approval_events
      WHERE approval_id = v_apprA AND event = 'decided'
      ORDER BY created_at DESC LIMIT 1;
    IF v_ev_from <> 'delegated' THEN
      RAISE EXCEPTION 'FAIL 8a hold from_status: expected literal ''delegated'', got ''%''', v_ev_from;
    END IF;
    IF v_ev_to <> 'delegated' THEN
      RAISE EXCEPTION 'FAIL 8a hold to_status: expected literal ''delegated'', got ''%''', v_ev_to;
    END IF;
    RAISE NOTICE 'PASS 8a: delegated + hold -> decided delegated->delegated';

    -- 8b) REJECT on a delegated approval: decided delegated->rejected
    v_apprA := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_projA, 'ZZ aud reject', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
    );
    PERFORM public.delegate_gate_approval(v_apprA, v_tenant, v_p1, v_p2, 'busy', false);
    PERFORM public.decide_gate_approval(v_apprA, v_tenant, v_p2, 'reject', 'no go', true, NULL, NULL);
    SELECT from_status, to_status INTO v_ev_from, v_ev_to
      FROM public.approval_events
      WHERE approval_id = v_apprA AND event = 'decided'
      ORDER BY created_at DESC LIMIT 1;
    IF v_ev_from <> 'delegated' THEN
      RAISE EXCEPTION 'FAIL 8b reject from_status: expected literal ''delegated'', got ''%''', v_ev_from;
    END IF;
    IF v_ev_to <> 'rejected' THEN
      RAISE EXCEPTION 'FAIL 8b reject to_status: expected literal ''rejected'', got ''%''', v_ev_to;
    END IF;
    -- audit_log old_values must also carry the real status.
    SELECT (old_values->>'status') INTO v_ev_from
      FROM public.audit_log WHERE record_id = v_apprA::text ORDER BY changed_at DESC LIMIT 1;
    IF v_ev_from <> 'delegated' THEN
      RAISE EXCEPTION 'FAIL 8b audit old_values status: expected literal ''delegated'', got ''%''', v_ev_from;
    END IF;
    RAISE NOTICE 'PASS 8b: delegated + reject -> decided delegated->rejected, audit old_values correct';

    -- 8c) CONDITIONAL_PROCEED final on a delegated (single-level) approval.
    --     condition_added: delegated->delegated
    --     decided:         delegated->approved
    --     approved:        delegated->approved
    -- Need a fresh gate_submission row (only one per project+gate allowed).
    -- Re-use v_projA but create a FRESH gate set on phase 5/6.
    DECLARE
      v_g5A UUID;
      v_apprC UUID;
    BEGIN
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
        (v_projA, 5, 'RTB2', 'in_review'), (v_projA, 6, 'IFC2', 'pending');
      SELECT id INTO v_g5A FROM public.phase_gates WHERE project_id = v_projA AND phase_number = 5;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g5A;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_projA, 5, 'submitted', v_p1);
      v_sigA := jsonb_build_object(
        'signer_name', 'Delegated Actor', 'signer_role', v_p2role,
        'image_path', 'signatures/x/gate_approval/aud-test-cond.png',
        'statement', 'Conditional delegated endorsement.', 'ip_address', '127.0.0.1'
      );
      v_apprC := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_projA, 'ZZ aud cond', NULL, 5, v_p1, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      PERFORM public.delegate_gate_approval(v_apprC, v_tenant, v_p1, v_p2, 'cond busy', false);
      PERFORM public.decide_gate_approval(v_apprC, v_tenant, v_p2, 'conditional_proceed', 'ok cond', true,
        jsonb_build_array(jsonb_build_object('title','Review land title','due_date','2026-09-30')), v_sigA);
      -- condition_added: delegated->delegated
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprC AND event = 'condition_added' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8c condition_added: expected delegated->delegated, got %->%', v_ev_from, v_ev_to;
      END IF;
      -- decided: delegated->approved (final level)
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprC AND event = 'decided' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8c decided: expected delegated->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      -- approved: delegated->approved
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprC AND event = 'approved' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8c approved: expected delegated->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8c: delegated + conditional_proceed final -> condition_added delegated->delegated, decided delegated->approved, approved delegated->approved';
    END;

    -- 8d) Multi-level partial on a delegated approval.
    --     decided: delegated -> pending  (approval returns to pending for L2)
    --     assigned: delegated -> pending
    -- v_p3 is required for a second step (separate from requester/assignee).
    IF v_p3 IS NULL THEN
      RAISE NOTICE 'NOTE 8d: no third approver profile available; skipping multi-level delegated partial test';
    ELSE
      DECLARE
        v_g7A UUID;
        v_apprM UUID;
        v_sigM JSONB;
      BEGIN
        INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
          (v_projA, 7, 'RTB3', 'in_review'), (v_projA, 8, 'IFC3', 'pending');
        SELECT id INTO v_g7A FROM public.phase_gates WHERE project_id = v_projA AND phase_number = 7;
        UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g7A;
        INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
          VALUES (v_tenant, v_projA, 7, 'submitted', v_p1);
        v_sigM := jsonb_build_object(
          'signer_name', 'Delegated Multi', 'signer_role', v_p2role,
          'image_path', 'signatures/x/gate_approval/aud-test-multi.png',
          'statement', 'Delegated partial endorsement.', 'ip_address', '127.0.0.1'
        );
        v_apprM := public.create_approval_workflow_tx(
          v_tenant, 'gate', v_projA, 'ZZ aud multi', NULL, 7, v_p1, NULL, 'normal',
          jsonb_build_array(
            jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role),
            jsonb_build_object('level',2,'assigned_to',v_p3,'assigned_role',v_p2role)
          )
        );
        -- Delegate L1 to v_p2.
        PERFORM public.delegate_gate_approval(v_apprM, v_tenant, v_p1, v_p2, 'multi busy', false);
        -- v_p2 decides L1 (partial — L2 remains).
        v_result := public.decide_gate_approval(v_apprM, v_tenant, v_p2, 'proceed', 'partial ok', true, NULL, v_sigM);
        IF v_result <> 'partial' THEN
          RAISE EXCEPTION 'FAIL 8d: expected partial, got %', v_result;
        END IF;
        -- decided: delegated -> pending
        SELECT from_status, to_status INTO v_ev_from, v_ev_to
          FROM public.approval_events
          WHERE approval_id = v_apprM AND event = 'decided' ORDER BY created_at DESC LIMIT 1;
        IF v_ev_from <> 'delegated' OR v_ev_to <> 'pending' THEN
          RAISE EXCEPTION 'FAIL 8d decided: expected delegated->pending, got %->%', v_ev_from, v_ev_to;
        END IF;
        -- assigned: delegated -> pending
        SELECT from_status, to_status INTO v_ev_from, v_ev_to
          FROM public.approval_events
          WHERE approval_id = v_apprM AND event = 'assigned' ORDER BY created_at DESC LIMIT 1;
        IF v_ev_from <> 'delegated' OR v_ev_to <> 'pending' THEN
          RAISE EXCEPTION 'FAIL 8d assigned: expected delegated->pending, got %->%', v_ev_from, v_ev_to;
        END IF;
        RAISE NOTICE 'PASS 8d: delegated + proceed partial -> decided delegated->pending, assigned delegated->pending';
      END;
    END IF;

    -- 8e) Ordinary PENDING decisions retain correct from_status = 'pending'.
    --     (Regression check: v6 must not break the common case.)
    DECLARE
      v_g9A UUID;
      v_apprP UUID;
      v_sigP JSONB;
    BEGIN
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
        (v_projA, 9, 'RTB4', 'in_review'), (v_projA, 10, 'IFC4', 'pending');
      SELECT id INTO v_g9A FROM public.phase_gates WHERE project_id = v_projA AND phase_number = 9;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g9A;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_projA, 9, 'submitted', v_p1);
      v_sigP := jsonb_build_object(
        'signer_name', 'Pending Actor', 'signer_role', v_p1role,
        'image_path', 'signatures/x/gate_approval/aud-test-pending.png',
        'statement', 'Pending endorsement.', 'ip_address', '127.0.0.1'
      );
      v_apprP := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_projA, 'ZZ aud pend', NULL, 9, v_p1, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      -- No delegation: approval stays 'pending'.
      SELECT status INTO v_status FROM public.approvals WHERE id = v_apprP;
      IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'FAIL 8e setup: expected pending, got %', v_status;
      END IF;
      PERFORM public.decide_gate_approval(v_apprP, v_tenant, v_p1, 'proceed', 'pend ok', false, NULL, v_sigP);
      -- decided: pending -> approved  (v_from_status = 'pending', final level)
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprP AND event = 'decided' ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8e decided: expected pending->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      -- approved: pending -> approved
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprP AND event = 'approved' LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8e approved: expected pending->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8e: pending + proceed final -> decided pending->approved, approved pending->approved';
    END;

    -- 8f) REJECT from pending: decided pending->rejected (regression).
    DECLARE v_apprR UUID; BEGIN
      -- Reuse v_projA gate 3 (re-insert a fresh submission since gate state was
      -- already advanced in 8a–8e; use gate 11 to avoid collision).
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
        (v_projA, 11, 'RTB5', 'in_review');
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_projA, 11, 'submitted', v_p1);
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now()
        WHERE phase_gate_id IN (SELECT id FROM public.phase_gates WHERE project_id = v_projA AND phase_number = 11);
      v_apprR := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_projA, 'ZZ aud rej pend', NULL, 11, v_p1, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      PERFORM public.decide_gate_approval(v_apprR, v_tenant, v_p1, 'reject', 'no', false, NULL, NULL);
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events
        WHERE approval_id = v_apprR AND event = 'decided' LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'rejected' THEN
        RAISE EXCEPTION 'FAIL 8f reject from pending: expected pending->rejected, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8f: pending + reject -> decided pending->rejected';
    END;

    RAISE NOTICE 'PASS 8: all audit-transition event checks passed (delegated + pending, all decision paths)';
  END;

  RAISE NOTICE '=== ALL GATE GOVERNANCE CHECKS PASSED (rolling back) ===';
END $$;

ROLLBACK;
