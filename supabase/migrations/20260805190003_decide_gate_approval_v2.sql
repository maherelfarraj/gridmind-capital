-- GM-G3: decide_gate_approval v2 -- multi-level progression + atomic conditions
--
-- Adds two governed behaviors to the atomic gate-decision RPC, both entirely
-- inside the single plpgsql transaction so they are all-or-nothing with the
-- rest of the decision:
--
--  1. MULTI-LEVEL PROGRESSION. After a non-final step is approved, the RPC
--     locks the next pending step, moves approvals.assignee_id to that step's
--     assignee, keeps approvals.status = 'pending', writes an 'assigned' event
--     for the next level, and returns 'partial'. The current step's approver
--     can no longer decide (they are no longer the assignee); the next-level
--     assignee now is. G3 stays in_review until final quorum.
--
--  2. ATOMIC CONDITIONS. conditional_proceed now takes the conditions as a
--     JSONB array argument. The RPC requires >= 1 valid condition (non-empty
--     title + due_date), inserts every approval_conditions row and a
--     condition_added approval_event, and ONLY THEN approves the step / advances
--     the gate. Any condition failure (or a missing valid condition) RAISEs, so
--     the step, approval, submission, phase transition, project phase, events
--     and audit rows all roll back together.
--
-- The 6-arg version is dropped first: adding the p_conditions parameter changes
-- the signature, so CREATE OR REPLACE would create a second overload and leave
-- the old function callable. Drop then create the single 7-arg function.

DROP FUNCTION IF EXISTS public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean);

CREATE OR REPLACE FUNCTION public.decide_gate_approval(
  p_approval_id       uuid,
  p_tenant_id         uuid,
  p_actor             uuid,
  p_decision          text,
  p_rationale         text DEFAULT NULL,
  p_is_admin_override boolean DEFAULT false,
  p_conditions        jsonb DEFAULT NULL
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
  v_next_step       public.approval_steps%ROWTYPE;
  v_gate            integer;
  v_project         uuid;
  v_next_phase      integer;
  v_pending_remain  integer;
  v_rows            integer;
  v_approved_count  integer;
  v_next_exists     integer;
  v_proj_count      integer;
  v_cond            jsonb;
  v_cond_count      integer := 0;
  v_cond_title      text;
  v_cond_due        text;
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
  -- CONDITIONS FIRST (conditional_proceed): validate + insert BEFORE the step
  -- is approved or the gate advances, so a bad/empty condition set rolls the
  -- whole decision back.
  -- =========================================================================
  IF p_decision = 'conditional_proceed' THEN
    IF p_conditions IS NOT NULL AND jsonb_typeof(p_conditions) = 'array' THEN
      FOR v_cond IN SELECT * FROM jsonb_array_elements(p_conditions) LOOP
        v_cond_title := nullif(btrim(coalesce(v_cond->>'title', '')), '');
        v_cond_due   := nullif(btrim(coalesce(v_cond->>'due_date', '')), '');
        IF v_cond_title IS NOT NULL AND v_cond_due IS NOT NULL THEN
          INSERT INTO public.approval_conditions
            (tenant_id, approval_id, title, due_date, status, created_by)
          VALUES (p_tenant_id, p_approval_id, v_cond_title, v_cond_due::date, 'open', p_actor);

          INSERT INTO public.approval_events
            (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
          VALUES (p_tenant_id, p_approval_id, 'condition_added', p_actor, 'pending', 'pending',
                  jsonb_build_object('title', v_cond_title, 'due_date', v_cond_due));

          v_cond_count := v_cond_count + 1;
        END IF;
      END LOOP;
    END IF;

    IF v_cond_count < 1 THEN
      RAISE EXCEPTION 'decide_gate_approval: conditional_proceed requires at least one valid condition (title + due_date)';
    END IF;
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

  -- =========================================================================
  -- PARTIAL approval (multi-level): hand off to the next pending step. Move the
  -- assignee, keep status pending, record the assignment. G3 stays in_review.
  -- =========================================================================
  IF v_pending_remain > 0 THEN
    SELECT * INTO v_next_step
      FROM public.approval_steps
     WHERE approval_id = p_approval_id AND status = 'pending'
     ORDER BY level
     LIMIT 1
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'decide_gate_approval: pending remainder %>0 but no next step found', v_pending_remain;
    END IF;

    UPDATE public.approvals
       SET assignee_id = v_next_step.assigned_to, status = 'pending', updated_at = v_now
     WHERE id = p_approval_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'decide_gate_approval: expected exactly one approval reassigned, got %', v_rows;
    END IF;

    INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
    VALUES (p_tenant_id, p_approval_id, 'assigned', p_actor, 'pending', 'pending',
            jsonb_build_object('level', v_next_step.level, 'assigned_to', v_next_step.assigned_to));

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

-- service_role only (P0 execute lockdown): revoke PUBLIC + anon + authenticated
-- EXPLICITLY (the default per-role grants survive a PUBLIC-only revoke).
REVOKE ALL ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decide_gate_approval(uuid, uuid, uuid, text, text, boolean, jsonb) TO service_role;
