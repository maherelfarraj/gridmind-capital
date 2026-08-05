-- GM-G3: delegate_gate_approval -- enforce the EXACT delegation role in the RPC
--
-- The verify-only RPC (190007) rejected external roles (subcontractor /
-- client_viewer) but accepted ANY other internal role as a delegate, even one
-- that could never hold the current step's seat. That means a delegation could
-- move an approver seat to, say, an engineer or hse_manager -- a role the app's
-- eligibility filter (lib/approvals/delegate-eligibility.ts) already forbids.
-- The RPC must not trust the caller, so it now mirrors that rule exactly:
--
-- After locking the current step (which carries assigned_role), the delegate
-- must be:
--   * an EXISTING, active, same-tenant profile (unchanged);
--   * NOT the acting approver (unchanged);
--   * a member of the CANONICAL approver-role set
--       (system_admin, tenant_admin, project_director, project_manager) --
--        this set is the SINGLE SOURCE OF TRUTH in lib/auth/roles.ts
--        (GATE_APPROVER_ROLES) and a drift test asserts the two stay identical;
--   * AND either a platform admin (system_admin / tenant_admin), who may take
--     any step, OR a role that EQUALS the current step's assigned_role.
--
-- Every other internal role is rejected, not only subcontractor/client_viewer.
-- Signature unchanged (still 6 args), so this is a CREATE OR REPLACE.

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
  -- CANONICAL approver-role set -- MUST equal GATE_APPROVER_ROLES in
  -- lib/auth/roles.ts (a drift test enforces this). Keep the two in lockstep.
  v_approver_roles text[] := ARRAY['system_admin','tenant_admin','project_director','project_manager'];
  v_admin_roles    text[] := ARRAY['system_admin','tenant_admin'];
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

  -- lock the current pending step FIRST -- its assigned_role is what the
  -- delegate's role must satisfy.
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
  IF v_delegate.role IS NULL THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % has no role', p_delegate;
  END IF;

  -- Must be an approver role at all (this ALSO rejects external roles and every
  -- non-approver internal role such as engineer / hse_manager).
  IF NOT (v_delegate.role = ANY (v_approver_roles)) THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate % holds role %, which is not an approver role', p_delegate, v_delegate.role;
  END IF;

  -- Non-admins must match the CURRENT step's required role exactly; platform
  -- admins may take any step.
  IF NOT (v_delegate.role = ANY (v_admin_roles))
     AND v_delegate.role IS DISTINCT FROM v_step.assigned_role THEN
    RAISE EXCEPTION 'delegate_gate_approval: delegate role % does not match the required role % for this step', v_delegate.role, v_step.assigned_role;
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
