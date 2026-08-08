-- GM-G3: delegate_gate_approval -- verify the delegate INSIDE the transaction
--
-- The v1 RPC moved the assignee to p_delegate without checking that p_delegate
-- was a real, active, same-tenant profile. Combined with the app previously
-- offering FAKE hardcoded recipients, a delegation could point the current step
-- at a non-existent / inactive / cross-tenant id -- stranding the approval on a
-- principal who can never authenticate. This adds a fail-closed delegate check
-- as a security backstop (the app also only OFFERS eligible profiles, but the
-- RPC must not trust the caller):
--
--   * p_delegate must reference an EXISTING profile;
--   * that profile must be is_active = true;
--   * it must belong to the SAME tenant as the approval;
--   * it must NOT be the acting approver (delegating to yourself is a no-op);
--   * it must NOT be an external role (subcontractor / client_viewer) -- external
--     principals never hold an internal approver seat.
--
-- Signature is unchanged (still 6 args), so this is a CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.delegate_gate_approval(
  p_approval_id       uuid,
  p_tenant_id         uuid,
  p_actor             uuid,
  p_delegate          uuid,
  p_rationale         text DEFAULT NULL,
  p_is_admin_override boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now       timestamptz := now();
  v_approval  public.approvals%ROWTYPE;
  v_step      public.approval_steps%ROWTYPE;
  v_delegate  public.profiles%ROWTYPE;
  v_rows      integer;
BEGIN
  IF p_approval_id IS NULL OR p_tenant_id IS NULL OR p_actor IS NULL OR p_delegate IS NULL THEN
    RAISE EXCEPTION 'delegate_gate_approval: missing required argument';
  END IF;

  IF p_delegate = p_actor THEN
    RAISE EXCEPTION 'delegate_gate_approval: cannot delegate to yourself';
  END IF;

  SELECT * INTO v_approval FROM public.approvals WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delegate_gate_approval: approval % not found', p_approval_id;
  END IF;

  IF v_approval.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'delegate_gate_approval: tenant mismatch for approval %', p_approval_id;
  END IF;
  IF v_approval.object_type <> 'gate' THEN
    RAISE EXCEPTION 'delegate_gate_approval: approval % is not a gate workflow', p_approval_id;
  END IF;
  IF v_approval.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'delegate_gate_approval: approval % has already been decided', p_approval_id;
  END IF;

  -- ---- verify the delegate (fail-closed) ---------------------------------
  SELECT * INTO v_delegate FROM public.profiles WHERE id = p_delegate;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % is not a known profile', p_delegate;
  END IF;
  IF v_delegate.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % is not in this tenant', p_delegate;
  END IF;
  IF v_delegate.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % is not active', p_delegate;
  END IF;
  IF v_delegate.role IN ('subcontractor', 'client_viewer') THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % holds an external role and cannot approve gates', p_delegate;
  END IF;

  -- lock the current pending step
  SELECT * INTO v_step
    FROM public.approval_steps
   WHERE approval_id = p_approval_id AND status = 'pending'
   ORDER BY level
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delegate_gate_approval: no pending approval step for approval %', p_approval_id;
  END IF;

  -- authorization: current-step assignee, or a validated admin override
  IF NOT p_is_admin_override AND v_step.assigned_to IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'delegate_gate_approval: actor % is not the current step assignee', p_actor;
  END IF;

  -- move the current step to the delegate
  UPDATE public.approval_steps
     SET assigned_to = p_delegate
   WHERE id = v_step.id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'delegate_gate_approval: expected exactly one step reassigned, got %', v_rows;
  END IF;

  -- move the approval to the delegate + mark delegated + record rationale
  UPDATE public.approvals
     SET assignee_id = p_delegate, status = 'delegated', decision_note = p_rationale, updated_at = v_now
   WHERE id = p_approval_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'delegate_gate_approval: expected exactly one approval delegated, got %', v_rows;
  END IF;

  INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
  VALUES (p_tenant_id, p_approval_id, 'delegated', p_actor, v_approval.status::text, 'delegated',
          jsonb_build_object('level', v_step.level, 'from', v_step.assigned_to, 'to', p_delegate, 'rationale', p_rationale));

  INSERT INTO public.audit_log (tenant_id, table_name, record_id, action, changed_by, old_values, new_values)
  VALUES (p_tenant_id, 'approvals', p_approval_id::text, 'update', p_actor,
          jsonb_build_object('status', v_approval.status::text, 'assignee_id', v_step.assigned_to),
          jsonb_build_object('status', 'delegated', 'assignee_id', p_delegate, 'rationale', p_rationale));

  RETURN 'delegated';
END;
$$;

REVOKE ALL ON FUNCTION public.delegate_gate_approval(uuid, uuid, uuid, uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delegate_gate_approval(uuid, uuid, uuid, uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delegate_gate_approval(uuid, uuid, uuid, uuid, text, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delegate_gate_approval(uuid, uuid, uuid, uuid, text, boolean) TO service_role;
