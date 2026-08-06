-- Gate Governance Workflow — transactional regression tests
--
-- Exercises the governed gate-approval RPCs end-to-end against the REAL schema.
-- Covers migrations through 20260806190012 (decide_gate_approval v6).
--
-- Fixture discipline:
--   v_requester — distinct from v_p1/v_p2/v_p3; all workflow approvals use this
--                 as requester so segregation-of-duties guards never fire on the
--                 test actors. PASS 7 is the ONLY intentional requester == actor fixture.
--   v_p1        — initial assignee / actor (approver role)
--   v_p2        — delegate target (approver role, different from v_p1)
--   v_p3        — second-level assignee (mandatory; fixture aborts if unavailable)
--   v_pbad      — active non-approver (optional; delegation rejection skipped if NULL)
--
-- Every sub-test that finalises a gate (proceed / conditional_proceed) uses its own
-- disposable project with canonical G3 + G4 gates. No gates above 4 are created.
--
-- Run with:
--   psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 \
--        -f supabase/tests/gate_governance_workflow.sql
--
-- A clean run prints NOTICE lines for PASS 1 … PASS 8 (and 8a … 8f) ending in
-- "ALL GATE GOVERNANCE CHECKS PASSED" and leaves the database untouched.

BEGIN;

-- ---- Apply v6 migration (decide_gate_approval) inside the transaction -------
-- This makes the corrected function available for PASS 8 without touching the
-- production ledger. The ROLLBACK at the end discards both the DDL and all test
-- fixture data, leaving the live DB on v5.
\ir ../migrations/20260806190012_decide_gate_approval_audit_transitions.sql

DO $$
DECLARE
  v_tenant    UUID;
  v_requester UUID;  -- approval requester (DISTINCT from v_p1/v_p2/v_p3)
  v_p1        UUID;  -- initial assignee / actor (approver role)
  v_p2        UUID;  -- delegate / second actor (approver role)
  v_p3        UUID;  -- second-level assignee (mandatory)
  v_p1role    TEXT;
  v_p2role    TEXT;
  v_p3role    TEXT;
  v_pbad      UUID;  -- active NON-approver (optional)
  v_proj      UUID;
  v_g3        UUID;
  v_appr      UUID;
  v_result    TEXT;
  v_assignee  UUID;
  v_status    TEXT;
  v_g3status  TEXT;
  v_count     INT;
  v_steps     JSONB;
  v_sig       JSONB;
BEGIN
  -- ---- fixture ---------------------------------------------------------------
  SELECT id INTO v_tenant FROM public.tenants LIMIT 1;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'no tenant available for test'; END IF;

  -- Canonical approver-role set (matches GATE_APPROVER_ROLES in lib/auth/roles.ts)
  SELECT id, role INTO v_p1, v_p1role FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager','finance_manager')
    ORDER BY id LIMIT 1;

  SELECT id, role INTO v_p2, v_p2role FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager','finance_manager')
      AND id <> v_p1
    ORDER BY id LIMIT 1;

  SELECT id, role INTO v_p3, v_p3role FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role IN ('system_admin','tenant_admin','project_director','project_manager','finance_manager')
      AND id NOT IN (v_p1, v_p2)
    ORDER BY id LIMIT 1;

  -- Requester: active, same tenant, different from all actors.
  SELECT id INTO v_requester FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND id NOT IN (v_p1, v_p2, v_p3)
    ORDER BY id LIMIT 1;

  IF v_p1 IS NULL OR v_p2 IS NULL THEN
    RAISE EXCEPTION 'need at least two active approver-role profiles in tenant %', v_tenant;
  END IF;
  IF v_p3 IS NULL THEN
    RAISE EXCEPTION 'need at least three active approver-role profiles in tenant % (v_p3 is mandatory)', v_tenant;
  END IF;
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'need at least four active profiles in tenant % (v_requester must differ from v_p1/v_p2/v_p3)', v_tenant;
  END IF;

  -- Optional: active non-approver for delegation-rejection test.
  SELECT id INTO v_pbad FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
      AND role NOT IN ('system_admin','tenant_admin','project_director','project_manager',
                       'finance_manager','subcontractor','client_viewer')
    ORDER BY id LIMIT 1;

  -- Primary disposable project used by PASS 1–3, 5–7.
  INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
    VALUES (v_tenant, 'ZZ Gate Gov Test', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
    RETURNING id INTO v_proj;

  INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
    (v_proj, 3, 'Commercial & Financial Close (RTB)', 'in_review'),
    (v_proj, 4, 'Detailed Design (IFC)', 'pending');
  SELECT id INTO v_g3 FROM public.phase_gates WHERE project_id = v_proj AND phase_number = 3;

  UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3;
  INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
    VALUES (v_tenant, v_proj, 3, 'submitted', v_requester);

  -- ---- 1) create_approval_workflow_tx: atomic, steps carry tenant_id ----------
  v_steps := jsonb_build_array(
    jsonb_build_object('level', 1, 'assigned_to', v_p1, 'assigned_role', v_p1role),
    jsonb_build_object('level', 2, 'assigned_to', v_p2, 'assigned_role', v_p2role)
  );
  -- requester = v_requester so v_p1 and v_p2 can decide without self-action guard.
  v_appr := public.create_approval_workflow_tx(
    v_tenant, 'gate', v_proj, 'ZZ G3', NULL, 3, v_requester, NULL, 'normal', v_steps
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

  -- ---- 2) multi-level progression: L1 -> partial, assignee moves to L2 -------
  v_sig := jsonb_build_object(
    'signer_name', 'Level One', 'signer_role', v_p1role,
    'image_path', 'signatures/x/gate_approval/' || v_appr || '-l1.png',
    'statement', 'I endorse Proceed (L1).', 'ip_address', '127.0.0.1'
  );
  v_result := public.decide_gate_approval(v_appr, v_tenant, v_p1, 'proceed', 'ok l1', false, NULL, v_sig);
  IF v_result <> 'partial' THEN RAISE EXCEPTION 'FAIL progression: L1 expected partial, got %', v_result; END IF;

  SELECT assignee_id, status INTO v_assignee, v_status FROM public.approvals WHERE id = v_appr;
  IF v_assignee <> v_p2 THEN RAISE EXCEPTION 'FAIL progression: assignee did not move to L2 actor'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'FAIL progression: approval finalized too early (%)', v_status; END IF;

  SELECT count(*) INTO v_count FROM public.signatures
    WHERE entity_type = 'gate_approval' AND entity_id = v_g3 AND signer_id = v_p1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL progression: L1 signature not keyed to phase_gates.id (got %)', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.signatures
    WHERE entity_type = 'gate_approval' AND entity_id = v_appr;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL identity: signature wrongly keyed to approval id (got %)', v_count; END IF;
  RAISE NOTICE 'PASS 2: L1 proceed -> partial, assignee moved to L2, L1 signature keyed to phase_gates.id';

  -- ---- 3) final level: L2 proceed -> approved, G3 advances -------------------
  v_sig := jsonb_build_object(
    'signer_name', 'Level Two', 'signer_role', v_p2role,
    'image_path', 'signatures/x/gate_approval/' || v_appr || '-l2.png',
    'statement', 'I endorse Proceed (final).', 'ip_address', '127.0.0.1'
  );
  v_result := public.decide_gate_approval(v_appr, v_tenant, v_p2, 'proceed', 'ok final', false, NULL, v_sig);
  IF v_result <> 'approved' THEN RAISE EXCEPTION 'FAIL final: expected approved, got %', v_result; END IF;

  SELECT status INTO v_status FROM public.approvals WHERE id = v_appr;
  IF v_status <> 'approved' THEN RAISE EXCEPTION 'FAIL final: approval not approved (%)', v_status; END IF;
  SELECT status INTO v_g3status FROM public.phase_gates WHERE id = v_g3;
  IF v_g3status <> 'approved' THEN RAISE EXCEPTION 'FAIL final: G3 not advanced (%)', v_g3status; END IF;
  SELECT count(*) INTO v_count FROM public.signatures WHERE entity_id = v_g3;
  IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL final: expected 2 signatures keyed to phase_gates.id, got %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.signatures WHERE entity_id = v_appr;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL identity: signatures wrongly keyed to approval id (got %)', v_count; END IF;
  RAISE NOTICE 'PASS 3: L2 proceed -> approved, G3 advanced, both signatures keyed to phase_gates.id';

  -- ---- 4) endorsement without a signature RAISEs (nothing persisted) ---------
  DECLARE
    v_proj2 UUID; v_g3b UUID; v_appr2 UUID;
  BEGIN
    INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
      VALUES (v_tenant, 'ZZ Gate Gov NoSig', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
      RETURNING id INTO v_proj2;
    INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
      (v_proj2, 3, 'RTB', 'in_review'), (v_proj2, 4, 'IFC', 'pending');
    SELECT id INTO v_g3b FROM public.phase_gates WHERE project_id = v_proj2 AND phase_number = 3;
    UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3b;
    INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
      VALUES (v_tenant, v_proj2, 3, 'submitted', v_requester);
    v_appr2 := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_proj2, 'ZZ G3 b', NULL, 3, v_requester, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
    );
    BEGIN
      PERFORM public.decide_gate_approval(v_appr2, v_tenant, v_p1, 'proceed', 'no sig', false, NULL, NULL);
      RAISE EXCEPTION 'FAIL sig-required: proceed without signature did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL sig-required%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%signature is required%' THEN
        RAISE EXCEPTION 'FAIL sig-required: wrong rejection reason: %', SQLERRM;
      END IF;
      IF (SELECT count(*) FROM public.signatures WHERE entity_id = v_g3b) <> 0 THEN
        RAISE EXCEPTION 'FAIL sig-required: a signature row survived a rejected decision';
      END IF;
      RAISE NOTICE 'PASS 4: proceed without a signature is rejected by the RPC, nothing persisted';
    END;
  END;

  -- ---- 5) delegation verifies the delegate (identity AND role) ---------------
  -- Step's assigned_role = v_p2role so valid delegation is an exact-role match.
  DECLARE
    v_apprD UUID;
    v_fake  UUID := '00000000-0000-0000-0000-0000000000fe';
  BEGIN
    v_apprD := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_proj, 'ZZ G3 c', NULL, 3, v_requester, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p2role))
    );

    BEGIN
      PERFORM public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_p1, 'self', false);
      RAISE EXCEPTION 'FAIL delegate: self-delegation did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL delegate%' THEN RAISE; END IF;
    END;

    BEGIN
      PERFORM public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_fake, 'ghost', false);
      RAISE EXCEPTION 'FAIL delegate: unknown delegate did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL delegate%' THEN RAISE; END IF;
    END;

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

    -- valid delegation (p_is_admin_override=false, exact-role match)
    v_result := public.delegate_gate_approval(v_apprD, v_tenant, v_p1, v_p2, 'busy', false);
    SELECT assignee_id INTO v_assignee FROM public.approvals WHERE id = v_apprD;
    IF v_assignee <> v_p2 THEN RAISE EXCEPTION 'FAIL delegate: approval assignee did not move'; END IF;
    SELECT count(*) INTO v_count FROM public.approval_steps
      WHERE approval_id = v_apprD AND status = 'pending' AND assigned_to = v_p2;
    IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL delegate: pending step not reassigned to delegate'; END IF;
    RAISE NOTICE 'PASS 5: delegation rejects self/unknown/non-approver, valid (role-matched) moves step + approval assignee';
  END;

  -- ---- 6) wrong-tenant decision is rejected ----------------------------------
  BEGIN
    PERFORM public.decide_gate_approval(
      v_appr, '00000000-0000-0000-0000-0000000000ff', v_p1, 'hold', 'x', false, NULL, NULL
    );
    RAISE EXCEPTION 'FAIL tenant: wrong-tenant decision did NOT raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%FAIL tenant%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS 6: wrong-tenant decision rejected (%)', left(SQLERRM, 50);
  END;

  -- ---- 7) SEGREGATION OF DUTIES: requester may not self-decide ---------------
  -- ONLY intentional requester == actor fixture. requester = v_p1, assignee = v_p1.
  -- All three refusals must leave ZERO mutation.
  DECLARE
    v_projS  UUID; v_g3s UUID; v_apprS UUID; v_sigS JSONB;
    v_ev0 INT; v_ev1 INT; v_sig0 INT; v_sig1 INT;
    v_cond0 INT; v_cond1 INT; v_wev0 INT; v_wev1 INT;
    v_aud0 INT; v_aud1 INT;
    v_stepA0 UUID; v_stepA1 UUID; v_stepS0 TEXT; v_stepS1 TEXT;
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

    -- requester = v_p1, assignee = v_p1 (the intentional self-action fixture)
    v_apprS := public.create_approval_workflow_tx(
      v_tenant, 'gate', v_projS, 'ZZ G3 self', NULL, 3, v_p1, NULL, 'normal',
      jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
    );

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

    BEGIN
      PERFORM public.decide_gate_approval(v_apprS, v_tenant, v_p1, 'proceed', 'self', false, NULL, v_sigS);
      RAISE EXCEPTION 'FAIL self-decide: requester/assignee decision did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-decide%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-decide: wrong rejection reason: %', SQLERRM;
      END IF;
    END;

    BEGIN
      PERFORM public.decide_gate_approval(v_apprS, v_tenant, v_p1, 'proceed', 'self+override', true, NULL, v_sigS);
      RAISE EXCEPTION 'FAIL self-decide: requester admin-override decision did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-decide%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-decide: wrong override rejection reason: %', SQLERRM;
      END IF;
    END;

    BEGIN
      PERFORM public.delegate_gate_approval(v_apprS, v_tenant, v_p1, v_p2, 'hand off my own', true);
      RAISE EXCEPTION 'FAIL self-delegate: requester delegation did NOT raise';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%FAIL self-delegate%' THEN RAISE; END IF;
      IF SQLERRM NOT LIKE '%segregation of duties%' THEN
        RAISE EXCEPTION 'FAIL self-delegate: wrong rejection reason: %', SQLERRM;
      END IF;
    END;

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
      RAISE EXCEPTION 'FAIL self-action: step changed (% / % -> % / %)', v_stepA0, v_stepS0, v_stepA1, v_stepS1;
    END IF;
    SELECT status INTO v_status FROM public.approvals WHERE id = v_apprS;
    IF v_status <> 'pending' THEN RAISE EXCEPTION 'FAIL self-action: approval status changed to %', v_status; END IF;
    SELECT status INTO v_g3status FROM public.phase_gates WHERE id = v_g3s;
    IF v_g3status <> 'in_review' THEN RAISE EXCEPTION 'FAIL self-action: gate status changed to %', v_g3status; END IF;

    RAISE NOTICE 'PASS 7: requester self-decide (assignee AND admin-override) + self-delegate all refused, ZERO mutation';
  END;

  -- ---- 8) AUDIT TRANSITIONS: from_status must reflect real approval status ---
  -- Exercises all five event-emitting decision paths on DELEGATED and PENDING
  -- approvals to prove v6 captures v_from_status correctly.
  --
  -- Each sub-test uses a FRESH disposable project with canonical G3 + G4 gates.
  -- requester = v_requester; actor = v_p1; delegate = v_p2; p_is_admin_override = false.
  -- Assertions pin LITERAL strings, not shared variables.
  DECLARE
    v_ev_from TEXT;
    v_ev_to   TEXT;
  BEGIN

    -- 8a) HOLD on a delegated approval: decided delegated -> delegated
    DECLARE
      v_proj8a UUID; v_g3_8a UUID; v_appr8a UUID;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Hold', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8a;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8a, 3, 'RTB', 'in_review'), (v_proj8a, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8a FROM public.phase_gates WHERE project_id = v_proj8a AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8a;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8a, 3, 'submitted', v_requester);

      v_appr8a := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8a, 'ZZ aud hold', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      -- Delegate from v_p1 to v_p2 (p_is_admin_override=false, exact-role step)
      UPDATE public.approval_steps SET assigned_role = v_p2role
        WHERE approval_id = v_appr8a AND level = 1;
      PERFORM public.delegate_gate_approval(v_appr8a, v_tenant, v_p1, v_p2, 'busy 8a', false);
      SELECT status INTO v_status FROM public.approvals WHERE id = v_appr8a;
      IF v_status <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8a setup: expected delegated, got %', v_status;
      END IF;
      -- v_p2 holds the step — decide as v_p2
      PERFORM public.decide_gate_approval(v_appr8a, v_tenant, v_p2, 'hold', 'pause 8a', false, NULL, NULL);
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8a AND event = 'decided'
        ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8a hold from_status: expected literal ''delegated'', got ''%''', v_ev_from;
      END IF;
      IF v_ev_to <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8a hold to_status: expected literal ''delegated'', got ''%''', v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8a: delegated + hold -> decided delegated->delegated';
    END;

    -- 8b) REJECT on a delegated approval: decided delegated -> rejected
    --     + audit_log old_values.status = 'delegated'
    DECLARE
      v_proj8b UUID; v_g3_8b UUID; v_appr8b UUID; v_aud_old TEXT;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Reject', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8b;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8b, 3, 'RTB', 'in_review'), (v_proj8b, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8b FROM public.phase_gates WHERE project_id = v_proj8b AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8b;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8b, 3, 'submitted', v_requester);

      v_appr8b := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8b, 'ZZ aud reject', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      UPDATE public.approval_steps SET assigned_role = v_p2role
        WHERE approval_id = v_appr8b AND level = 1;
      PERFORM public.delegate_gate_approval(v_appr8b, v_tenant, v_p1, v_p2, 'busy 8b', false);
      PERFORM public.decide_gate_approval(v_appr8b, v_tenant, v_p2, 'reject', 'no go 8b', false, NULL, NULL);

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8b AND event = 'decided'
        ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8b reject from_status: expected literal ''delegated'', got ''%''', v_ev_from;
      END IF;
      IF v_ev_to <> 'rejected' THEN
        RAISE EXCEPTION 'FAIL 8b reject to_status: expected literal ''rejected'', got ''%''', v_ev_to;
      END IF;
      SELECT (old_values->>'status') INTO v_aud_old
        FROM public.audit_log WHERE record_id = v_appr8b::text ORDER BY changed_at DESC LIMIT 1;
      IF v_aud_old <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8b audit old_values status: expected literal ''delegated'', got ''%''', v_aud_old;
      END IF;
      RAISE NOTICE 'PASS 8b: delegated + reject -> decided delegated->rejected, audit old_values correct';
    END;

    -- 8c) CONDITIONAL_PROCEED final on a delegated (single-level) approval:
    --     condition_added: delegated->delegated
    --     decided:         delegated->approved  (final level, no pending steps remain)
    --     approved:        delegated->approved
    DECLARE
      v_proj8c UUID; v_g3_8c UUID; v_appr8c UUID; v_sig8c JSONB;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Cond', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8c;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8c, 3, 'RTB', 'in_review'), (v_proj8c, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8c FROM public.phase_gates WHERE project_id = v_proj8c AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8c;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8c, 3, 'submitted', v_requester);
      v_sig8c := jsonb_build_object(
        'signer_name', 'Delegate Cond', 'signer_role', v_p2role,
        'image_path', 'signatures/x/gate_approval/aud-cond-8c.png',
        'statement', 'Conditional delegated endorsement.', 'ip_address', '127.0.0.1'
      );
      v_appr8c := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8c, 'ZZ aud cond', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      UPDATE public.approval_steps SET assigned_role = v_p2role
        WHERE approval_id = v_appr8c AND level = 1;
      PERFORM public.delegate_gate_approval(v_appr8c, v_tenant, v_p1, v_p2, 'cond busy', false);
      PERFORM public.decide_gate_approval(v_appr8c, v_tenant, v_p2, 'conditional_proceed', 'ok cond', false,
        jsonb_build_array(jsonb_build_object('title','Review land title','due_date','2026-09-30')), v_sig8c);

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8c AND event = 'condition_added' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'delegated' THEN
        RAISE EXCEPTION 'FAIL 8c condition_added: expected delegated->delegated, got %->%', v_ev_from, v_ev_to;
      END IF;
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8c AND event = 'decided' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8c decided: expected delegated->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8c AND event = 'approved' LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8c approved: expected delegated->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8c: delegated + conditional_proceed final -> condition_added delegated->delegated, decided delegated->approved, approved delegated->approved';
    END;

    -- 8d) Multi-level PARTIAL on a delegated approval (v_p3 mandatory):
    --     decided delegated -> pending  (approval returns to pending for L2)
    --     assigned delegated -> pending
    DECLARE
      v_proj8d UUID; v_g3_8d UUID; v_appr8d UUID; v_sig8d JSONB;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Multi', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8d;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8d, 3, 'RTB', 'in_review'), (v_proj8d, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8d FROM public.phase_gates WHERE project_id = v_proj8d AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8d;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8d, 3, 'submitted', v_requester);
      v_sig8d := jsonb_build_object(
        'signer_name', 'Delegate Multi', 'signer_role', v_p2role,
        'image_path', 'signatures/x/gate_approval/aud-multi-8d.png',
        'statement', 'Delegated partial endorsement.', 'ip_address', '127.0.0.1'
      );
      -- L1 = v_p1 (to delegate from), L2 = v_p3 (so partial still has a pending step)
      v_appr8d := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8d, 'ZZ aud multi', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(
          jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role),
          jsonb_build_object('level',2,'assigned_to',v_p3,'assigned_role',v_p3role)
        )
      );
      -- Delegate L1 from v_p1 to v_p2 (exact-role match on step)
      UPDATE public.approval_steps SET assigned_role = v_p2role
        WHERE approval_id = v_appr8d AND level = 1;
      PERFORM public.delegate_gate_approval(v_appr8d, v_tenant, v_p1, v_p2, 'multi busy', false);

      -- v_p2 decides L1 (partial — L2 remains pending)
      v_result := public.decide_gate_approval(v_appr8d, v_tenant, v_p2, 'proceed', 'partial ok', false, NULL, v_sig8d);
      IF v_result <> 'partial' THEN
        RAISE EXCEPTION 'FAIL 8d: expected partial, got %', v_result;
      END IF;

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8d AND event = 'decided'
        ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'pending' THEN
        RAISE EXCEPTION 'FAIL 8d decided: expected delegated->pending, got %->%', v_ev_from, v_ev_to;
      END IF;

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8d AND event = 'assigned'
        ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'delegated' OR v_ev_to <> 'pending' THEN
        RAISE EXCEPTION 'FAIL 8d assigned: expected delegated->pending, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8d: delegated + proceed partial -> decided delegated->pending, assigned delegated->pending';
    END;

    -- 8e) PENDING + PROCEED final: decided pending->approved, approved pending->approved
    --     (regression — common path must still work correctly in v6)
    DECLARE
      v_proj8e UUID; v_g3_8e UUID; v_appr8e UUID; v_sig8e JSONB;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Pend', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8e;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8e, 3, 'RTB', 'in_review'), (v_proj8e, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8e FROM public.phase_gates WHERE project_id = v_proj8e AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8e;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8e, 3, 'submitted', v_requester);
      v_sig8e := jsonb_build_object(
        'signer_name', 'Pending Actor', 'signer_role', v_p1role,
        'image_path', 'signatures/x/gate_approval/aud-pend-8e.png',
        'statement', 'Pending endorsement.', 'ip_address', '127.0.0.1'
      );
      v_appr8e := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8e, 'ZZ aud pend', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      SELECT status INTO v_status FROM public.approvals WHERE id = v_appr8e;
      IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'FAIL 8e setup: expected pending, got %', v_status;
      END IF;
      PERFORM public.decide_gate_approval(v_appr8e, v_tenant, v_p1, 'proceed', 'pend ok', false, NULL, v_sig8e);

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8e AND event = 'decided'
        ORDER BY created_at DESC LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8e decided: expected pending->approved, got %->%', v_ev_from, v_ev_to;
      END IF;

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8e AND event = 'approved' LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'approved' THEN
        RAISE EXCEPTION 'FAIL 8e approved: expected pending->approved, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8e: pending + proceed final -> decided pending->approved, approved pending->approved';
    END;

    -- 8f) PENDING + REJECT: decided pending->rejected (regression)
    DECLARE
      v_proj8f UUID; v_g3_8f UUID; v_appr8f UUID;
    BEGIN
      INSERT INTO public.projects (tenant_id, name, code, current_phase, status)
        VALUES (v_tenant, 'ZZ Aud Rej Pend', 'ZZ-GGT-' || floor(random()*1e7)::text, 2, 'active')
        RETURNING id INTO v_proj8f;
      INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status)
        VALUES (v_proj8f, 3, 'RTB', 'in_review'), (v_proj8f, 4, 'IFC', 'pending');
      SELECT id INTO v_g3_8f FROM public.phase_gates WHERE project_id = v_proj8f AND phase_number = 3;
      UPDATE public.gate_signoffs SET status = 'signed', signed_at = now() WHERE phase_gate_id = v_g3_8f;
      INSERT INTO public.gate_submissions (tenant_id, project_id, gate_number, status, submitted_by)
        VALUES (v_tenant, v_proj8f, 3, 'submitted', v_requester);
      v_appr8f := public.create_approval_workflow_tx(
        v_tenant, 'gate', v_proj8f, 'ZZ aud rej pend', NULL, 3, v_requester, NULL, 'normal',
        jsonb_build_array(jsonb_build_object('level',1,'assigned_to',v_p1,'assigned_role',v_p1role))
      );
      PERFORM public.decide_gate_approval(v_appr8f, v_tenant, v_p1, 'reject', 'no', false, NULL, NULL);

      SELECT from_status, to_status INTO v_ev_from, v_ev_to
        FROM public.approval_events WHERE approval_id = v_appr8f AND event = 'decided' LIMIT 1;
      IF v_ev_from <> 'pending' OR v_ev_to <> 'rejected' THEN
        RAISE EXCEPTION 'FAIL 8f reject from pending: expected pending->rejected, got %->%', v_ev_from, v_ev_to;
      END IF;
      RAISE NOTICE 'PASS 8f: pending + reject -> decided pending->rejected';
    END;

    RAISE NOTICE 'PASS 8: all audit-transition checks passed (delegated + pending, all decision paths)';
  END;

  RAISE NOTICE '=== ALL GATE GOVERNANCE CHECKS PASSED (rolling back) ===';
END $$;

ROLLBACK;
