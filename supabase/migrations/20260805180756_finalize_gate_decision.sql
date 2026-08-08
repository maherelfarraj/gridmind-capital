-- GM-G3: Atomic gate-decision finalizer
--
-- The G3 (and any gate) approval/rejection lifecycle previously ran as a
-- sequence of independent UPDATE/INSERT statements from the server action. A
-- failure partway through (e.g. the next-phase activation or the current_phase
-- recount) left the gate half-transitioned: submission approved but phase_gates
-- not advanced, or advanced without a workflow_events audit row.
--
-- This function performs the ENTIRE gate transition inside a single plpgsql
-- transaction. Any RAISE (or any failed statement) rolls back every write in
-- the function, so the gate is either fully finalized or untouched.
--
-- Two additional correctness fixes are baked in here:
--   1. phase_gates has NO tenant_id column. The prior code filtered
--      phase_gates by tenant_id, which errors at runtime. Tenant ownership is
--      enforced via the tenant-scoped gate_submissions and projects updates
--      plus the caller's own tenant verification; phase_gates is scoped by
--      project_id + phase_number only.
--   2. The rejection rationale is now persisted to workflow_events.comment
--      (previously discarded).

CREATE OR REPLACE FUNCTION public.finalize_gate_decision(
  p_project_id  uuid,
  p_gate_number integer,
  p_tenant_id   uuid,
  p_decision    text,
  p_actor       uuid,
  p_rationale   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         timestamptz := now();
  v_next_phase  integer := p_gate_number + 1;
  v_approved    integer;
  v_sub_rows    integer;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'finalize_gate_decision: invalid decision %', p_decision;
  END IF;
  IF p_project_id IS NULL OR p_gate_number IS NULL OR p_tenant_id IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'finalize_gate_decision: missing required argument';
  END IF;

  IF p_decision = 'approved' THEN
    -- 1. Mark the gate submission approved (tenant-scoped).
    UPDATE public.gate_submissions
       SET status = 'approved', reviewed_at = v_now, reviewed_by = p_actor
     WHERE project_id = p_project_id
       AND gate_number = p_gate_number
       AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_sub_rows = ROW_COUNT;
    IF v_sub_rows = 0 THEN
      RAISE EXCEPTION 'finalize_gate_decision: no gate_submissions row for project % gate % tenant %',
        p_project_id, p_gate_number, p_tenant_id;
    END IF;

    -- 2. Current phase gate in_review -> approved (phase_gates has NO tenant_id).
    UPDATE public.phase_gates
       SET status = 'approved', reviewed_at = v_now, reviewed_by = p_actor
     WHERE project_id = p_project_id
       AND phase_number = p_gate_number
       AND status = 'in_review';

    -- 3. Next phase gate pending -> in_review (no-op if none exists).
    UPDATE public.phase_gates
       SET status = 'in_review', reviewed_at = v_now, reviewed_by = p_actor
     WHERE project_id = p_project_id
       AND phase_number = v_next_phase
       AND status = 'pending';

    -- 4. Recompute projects.current_phase as the exact count of approved gates.
    SELECT count(*) INTO v_approved
      FROM public.phase_gates
     WHERE project_id = p_project_id
       AND status = 'approved';

    UPDATE public.projects
       SET current_phase = v_approved
     WHERE id = p_project_id
       AND tenant_id = p_tenant_id;

    -- 5. Audit event (rationale preserved in comment).
    INSERT INTO public.workflow_events
      (instance_id, from_state, to_state, transition_code, actor_id, comment, metadata)
    VALUES
      (NULL, 'in_review', 'approved', 'gate_approved', p_actor, p_rationale,
       jsonb_build_object('project_id', p_project_id, 'gate_number', p_gate_number, 'tenant_id', p_tenant_id));

  ELSE  -- rejected
    -- 1. Mark the gate submission rejected (tenant-scoped). Rationale -> comments.
    UPDATE public.gate_submissions
       SET status = 'rejected', reviewed_at = v_now, reviewed_by = p_actor, comments = p_rationale
     WHERE project_id = p_project_id
       AND gate_number = p_gate_number
       AND tenant_id = p_tenant_id;
    GET DIAGNOSTICS v_sub_rows = ROW_COUNT;
    IF v_sub_rows = 0 THEN
      RAISE EXCEPTION 'finalize_gate_decision: no gate_submissions row for project % gate % tenant %',
        p_project_id, p_gate_number, p_tenant_id;
    END IF;

    -- 2. Keep the current phase in_review (allow resubmission); do NOT advance.

    -- 3. Audit event (rationale preserved in comment).
    INSERT INTO public.workflow_events
      (instance_id, from_state, to_state, transition_code, actor_id, comment, metadata)
    VALUES
      (NULL, 'in_review', 'in_review', 'gate_rejected', p_actor, p_rationale,
       jsonb_build_object('project_id', p_project_id, 'gate_number', p_gate_number, 'tenant_id', p_tenant_id));
  END IF;
END;
$$;

-- The app invokes this exclusively through the service_role admin client.
-- Honoring the P0 execute lockdown, grant EXECUTE only to service_role; do NOT
-- grant to PUBLIC / anon / authenticated.
--
-- NOTE: `REVOKE ... FROM PUBLIC` does NOT remove the explicit per-role grants
-- that Supabase's ALTER DEFAULT PRIVILEGES stamps onto every new function for
-- anon/authenticated. Those roles must be revoked EXPLICITLY (verified against
-- prod: after FROM PUBLIC alone, authenticated/anon still had EXECUTE).
REVOKE ALL ON FUNCTION public.finalize_gate_decision(uuid, integer, uuid, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_gate_decision(uuid, integer, uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_gate_decision(uuid, integer, uuid, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_gate_decision(uuid, integer, uuid, text, uuid, text) TO service_role;
