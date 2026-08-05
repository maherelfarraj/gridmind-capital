-- GM-G3: Fully atomic gate-decision RPC (supersedes finalize_gate_decision)
--
-- The previous flow updated approval_steps and approvals from the server action
-- and only THEN called finalize_gate_decision for the phase/submission writes.
-- That left a window where the step/approval writes could commit while the
-- phase transition failed (or vice versa) -- a non-atomic gate decision.
--
-- decide_gate_approval performs the ENTIRE gate decision inside ONE plpgsql
-- transaction: it locks the approval and its current step, verifies tenant +
-- assignment, updates the step, finalizes (or partially advances) the approval,
-- updates the gate submission, drives the phase_gates state machine, recomputes
-- projects.current_phase, and writes approval_events / workflow_events /
-- audit_log. Any RAISE (or failed statement) rolls back every one of these
-- writes, so the decision is all-or-nothing.
--
-- Exact-row guards (item 4): the function RAISEs unless it finds exactly one
-- tenant-owned project, exactly one gate_submissions row, exactly one approval
-- finalized, and -- on final approval -- exactly one current-phase row and
-- exactly one next-phase row (when a next phase exists).
--
-- Notes baked in:
--   * phase_gates has NO tenant_id column -- it is scoped by project_id (the
--     project itself is tenant-verified) + phase_number.
--   * approval_events uses columns (event, detail, from_status, to_status) --
--     NOT (event_type, metadata). The server action had been inserting the
--     wrong column names, so those events were silently dropped; the RPC writes
--     the correct columns inside the transaction.
--   * approval_events.id / audit_log.id are GENERATED ALWAYS AS IDENTITY, so id
--     is never supplied. audit_log.action is constrained to insert/update/delete.
--   * gate_submissions.reviewed_by is TEXT (actor cast to text); phase_gates
--     and projects take the uuid actor directly.

CREATE OR REPLACE FUNCTION public.decide_gate_approval(
  p_approval_id       uuid,
  p_tenant_id         uuid,
  p_actor             uuid,
  p_decision          text,
  p_rationale         text DEFAULT NULL,
  p_is_admin_override boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now             timestamptz := now();
  v_approval        public.approvals%ROWTYPE;
  v_step            public.approval_steps%ROWTYPE;
  v_gate            integer;
  v_project         uuid;
  v_next_phase      integer;
  v_pending_remain  integer;
  v_rows            integer;
  v_approved_count  integer;
  v_next_exists     integer;
  v_proj_count      integer;
BEGIN
  -- ---- argument validation ------------------------------------------------
  IF p_approval_id IS NULL OR p_tenant_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'decide_gate_approval: missing required argument';
  END IF;
  IF p_decision NOT IN ('proceed', 'conditional_proceed', 'hold', 'reject') THEN
    RAISE EXCEPTION 'decide_gate_approval: invalid decision %', p_decision;
  END IF;

  -- ---- lock + load the approval row --------------------------------------
  SELECT * INTO v_approval FROM public.approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'decide_gate_approval: approval % not found', p_approval_id;
  END IF;

  IF v_approval.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'decide_gate_approval: tenant mismatch for approval %', p_approval_id;
  END IF;
  IF v_approval.object_type <> 'gate' THEN
    RAISE EXCEPTION 'decide_gate_approval: approval % is not a gate workflow', p_approval_id;
  END IF;
  IF v_approval.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decide_gate_approval: approval % has already been decided', p_approval_id;
  END IF;
  IF v_approval.gate_number IS NULL THEN
    RAISE EXCEPTION 'decide_gate_approval: gate approval % is missing gate_number', p_approval_id;
  END IF;

  v_gate       := v_approval.gate_number;
  v_project    := v_approval.object_id;
  v_next_phase := v_gate + 1;

  -- exactly one tenant-owned project
  SELECT count(*) INTO v_proj_count
    FROM public.projects WHERE id = v_project AND tenant_id = p_tenant_id;
  IF v_proj_count <> 1 THEN
    RAISE EXCEPTION 'decide_gate_approval: expected exactly one tenant-owned project for %, found %', v_project, v_proj_count;
  END IF;

  -- ---- lock the current pending step -------------------------------------
  SELECT * INTO v_step
    FROM public.approval_steps
   WHERE approval_id = p_approval_id AND status = 'pending'
   ORDER BY level
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'decide_gate_approval: no pending approval step for approval %', p_approval_id;
  END IF;

  -- assigned approver / delegation target (admin override bypasses assignment)
  IF NOT p_is_admin_override AND v_step.assigned_to IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'decide_gate_approval: actor % is not assigned to the current step', p_actor;
  END IF;

  -- =========================================================================
  -- HOLD: pause. Audit only; approval and gate remain untouched (stays pending).
  -- =========================================================================
  IF p_decision = 'hold' THEN
    INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
    VALUES (p_tenant_id, p_approval_id, 'decided', p_actor, v_approval.status::text, v_approval.status::text,
            jsonb_build_object('decision', 'hold', 'level', v_step.level, 'rationale', p_rationale));
    RETURN 'hold';
  END IF;

  -- =========================================================================
  -- REJECT: finalize approval + submission together; phases unchanged.
  -- =========================================================================
  IF p_decision = 'reject' THEN
    UPDATE public.approval_steps
       SET status = 'rejected', decided_at = v_now, decided_by = p_actor, decision_note = p_rationale
     WHERE id = v_step.id;

    -- skip any remaining pending steps
    UPDATE public.approval_steps
       SET status = 'skipped'
     WHERE approval_id = p_approval_id AND status = 'pending';

    UPDATE public.approvals
       SET status = 'rejected', decision = 'reject', decision_note = p_rationale,
           decided_by = p_actor, decided_at = v_now, updated_at = v_now
     WHERE id = p_approval_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'decide_gate_approval: expected exactly one approval finalized, got %', v_rows;
    END IF;

    UPDATE public.gate_submissions
       SET status = 'rejected', reviewed_at = v_now, reviewed_by = p_actor::text,
           comments = p_rationale, updated_at = v_now
     WHERE project_id = v_project AND gate_number = v_gate AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'decide_gate_approval: expected exactly one gate_submissions row updated on reject, got %', v_rows;
    END IF;

    -- phase v_gate stays in_review; phase v_next_phase stays pending (no writes).

    INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
    VALUES (p_tenant_id, p_approval_id, 'decided', p_actor, 'pending', 'rejected',
            jsonb_build_object('decision', 'reject', 'level', v_step.level, 'rationale', p_rationale));

    INSERT INTO public.workflow_events (instance_id, from_state, to_state, transition_code, actor_id, comment, metadata)
    VALUES (NULL, 'in_review', 'in_review', 'gate_rejected', p_actor, p_rationale,
            jsonb_build_object('project_id', v_project, 'gate_number', v_gate, 'tenant_id', p_tenant_id));

    INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, changed_by, old_values, new_values)
    VALUES (p_tenant_id, 'approvals', p_approval_id::text, 'update', p_actor,
            jsonb_build_object('status', v_approval.status::text),
            jsonb_build_object('status', 'rejected', 'decision', 'reject', 'gate_number', v_gate, 'rationale', p_rationale));

    RETURN 'rejected';
  END IF;

  -- =========================================================================
  -- PROCEED / CONDITIONAL_PROCEED: approve the current step.
  -- =========================================================================
  UPDATE public.approval_steps
     SET status = 'approved', decided_at = v_now, decided_by = p_actor, decision_note = p_rationale
   WHERE id = v_step.id;

  INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
  VALUES (p_tenant_id, p_approval_id, 'decided', p_actor, 'pending', 'approved',
          jsonb_build_object('decision', p_decision, 'level', v_step.level, 'rationale', p_rationale));

  -- record the decision on the approval trail; status stays pending until quorum
  UPDATE public.approvals
     SET decision = p_decision, decision_note = p_rationale, updated_at = v_now
   WHERE id = p_approval_id;

  SELECT count(*) INTO v_pending_remain
    FROM public.approval_steps
   WHERE approval_id = p_approval_id AND status = 'pending';

  -- PARTIAL approval: the next step is already open (pending). G3 unchanged.
  IF v_pending_remain > 0 THEN
    RETURN 'partial';
  END IF;

  -- =========================================================================
  -- FINAL QUORUM APPROVAL: advance the gate.
  -- =========================================================================
  UPDATE public.approvals
     SET status = 'approved', decision = p_decision, decision_note = p_rationale,
         decided_by = p_actor, decided_at = v_now, updated_at = v_now
   WHERE id = p_approval_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'decide_gate_approval: expected exactly one approval finalized, got %', v_rows;
  END IF;

  UPDATE public.gate_submissions
     SET status = 'approved', reviewed_at = v_now, reviewed_by = p_actor::text, updated_at = v_now
   WHERE project_id = v_project AND gate_number = v_gate AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'decide_gate_approval: expected exactly one gate_submissions row updated, got %', v_rows;
  END IF;

  -- current phase in_review -> approved (exactly one)
  UPDATE public.phase_gates
     SET status = 'approved', reviewed_at = v_now, reviewed_by = p_actor
   WHERE project_id = v_project AND phase_number = v_gate AND status = 'in_review';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'decide_gate_approval: expected exactly one current phase % row updated, got %', v_gate, v_rows;
  END IF;

  -- next phase pending -> in_review (exactly one, when a next phase exists)
  SELECT count(*) INTO v_next_exists
    FROM public.phase_gates WHERE project_id = v_project AND phase_number = v_next_phase;
  IF v_next_exists > 0 THEN
    UPDATE public.phase_gates
       SET status = 'in_review', reviewed_at = v_now, reviewed_by = p_actor
     WHERE project_id = v_project AND phase_number = v_next_phase AND status = 'pending';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'decide_gate_approval: expected exactly one next phase % row updated, got %', v_next_phase, v_rows;
    END IF;
  END IF;

  -- projects.current_phase = exact count of approved gates (exactly one project)
  SELECT count(*) INTO v_approved_count
    FROM public.phase_gates WHERE project_id = v_project AND status = 'approved';

  UPDATE public.projects
     SET current_phase = v_approved_count, updated_at = v_now
   WHERE id = v_project AND tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'decide_gate_approval: expected exactly one project updated, got %', v_rows;
  END IF;

  INSERT INTO public.workflow_events (instance_id, from_state, to_state, transition_code, actor_id, comment, metadata)
  VALUES (NULL, 'in_review', 'approved', 'gate_approved', p_actor, p_rationale,
          jsonb_build_object('project_id', v_project, 'gate_number', v_gate, 'tenant_id', p_tenant_id));

  INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
  VALUES (p_tenant_id, p_approval_id, 'approved', p_actor, 'pending', 'approved',
          jsonb_build_object('decision', p_decision, 'gate_number', v_gate, 'rationale', p_rationale));

  INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, changed_by, old_values, new_values)
  VALUES (p_tenant_id, 'approvals', p_approval_id::text, 'update', p_actor,
          jsonb_build_object('status', v_approval.status::text),
          jsonb_build_object('status', 'approved', 'decision', p_decision, 'gate_number', v_gate, 'current_phase', v_approved_count));

  RETURN 'approved';
END;
$$;

-- service_role only (P0 execute lockdown). REVOKE FROM PUBLIC does NOT drop the
-- default per-role grants Supabase stamps on new functions -- anon/authenticated
-- must be revoked EXPLICITLY, then verified with has_function_privilege.
REVOKE ALL ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean) TO service_role;
