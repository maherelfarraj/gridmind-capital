-- =============================================================================
-- create_approval_workflow_tx: atomic approval-workflow creation
-- =============================================================================
-- Replaces the app-side multi-INSERT (approvals -> approval_steps ->
-- approval_events) + manual best-effort rollback with ONE transactional RPC.
--
-- WHY:
--   * Atomicity: the old path inserted the approval, then steps, then events as
--     three separate PostgREST calls and hand-rolled compensating DELETEs on
--     failure. A crash between calls (or a failed compensating delete) left
--     orphaned approvals/steps. Doing all three writes inside one plpgsql
--     function makes them a single transaction: any failure rolls back all of
--     them, no compensation code required.
--   * Latent bug fix: approval_steps.tenant_id is NOT NULL, but the app-side
--     insert never set it -- so a real step insert would fail on the NOT NULL
--     constraint. The RPC sets tenant_id on every step.
--
-- The caller still performs the READ-ONLY work (duplicate detection, rule
-- lookup, and resolveApproveeSeat) and passes the RESOLVED steps in as JSONB.
-- resolveApproveeSeat is fail-closed, so every assigned_to handed in here is a
-- real active same-tenant profile id.
--
-- p_steps shape: [{ "level": int, "assigned_to": uuid, "assigned_role": text }]
-- Level 1's assignee becomes approvals.assignee_id.
--
-- SECURITY DEFINER + service_role-only (REVOKE from anon/authenticated), matching
-- the lockdown pattern of the other governance RPCs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_approval_workflow_tx(
  p_tenant_id     uuid,
  p_object_type   text,
  p_object_id     uuid,
  p_title         text,
  p_amount        numeric,
  p_gate_number   integer,
  p_requester     uuid,
  p_rule_id       uuid,
  p_priority      text,
  p_steps         jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_id  uuid;
  v_first_assignee uuid;
  v_step         jsonb;
  v_step_count   integer;
  v_inserted     integer;
BEGIN
  -- ---- validate steps -----------------------------------------------------
  IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'create_approval_workflow_tx: p_steps must be a JSON array';
  END IF;

  v_step_count := jsonb_array_length(p_steps);
  IF v_step_count < 1 THEN
    RAISE EXCEPTION 'create_approval_workflow_tx: at least one step is required';
  END IF;

  -- Every step must carry a real assignee (fail-closed resolution upstream).
  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
    IF (v_step->>'assigned_to') IS NULL OR (v_step->>'level') IS NULL THEN
      RAISE EXCEPTION 'create_approval_workflow_tx: every step needs level + assigned_to (got %)', v_step;
    END IF;
  END LOOP;

  v_first_assignee := (p_steps->0->>'assigned_to')::uuid;

  -- ---- approvals ----------------------------------------------------------
  INSERT INTO public.approvals (
    tenant_id, object_type, object_id, title, status, priority, amount,
    requester_id, assignee_id, rule_id, gate_number
  ) VALUES (
    p_tenant_id, p_object_type, p_object_id, p_title, 'pending',
    COALESCE(p_priority, 'normal'), p_amount, p_requester, v_first_assignee,
    p_rule_id, p_gate_number
  )
  RETURNING id INTO v_approval_id;

  -- ---- approval_steps (tenant_id IS set here -- the app never did) --------
  INSERT INTO public.approval_steps (tenant_id, approval_id, level, assigned_to, assigned_role, status)
  SELECT
    p_tenant_id,
    v_approval_id,
    (s->>'level')::integer,
    (s->>'assigned_to')::uuid,
    s->>'assigned_role',
    'pending'
  FROM jsonb_array_elements(p_steps) AS s;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> v_step_count THEN
    RAISE EXCEPTION 'create_approval_workflow_tx: expected % steps, inserted %', v_step_count, v_inserted;
  END IF;

  -- ---- approval_events: created + one assigned per level ------------------
  INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
  VALUES (
    p_tenant_id, v_approval_id, 'created', p_requester, NULL, 'pending',
    jsonb_build_object('rule_id', p_rule_id, 'levels', v_step_count, 'amount', p_amount, 'gate_number', p_gate_number)
  );

  INSERT INTO public.approval_events (tenant_id, approval_id, event, actor_id, from_status, to_status, detail)
  SELECT
    p_tenant_id, v_approval_id, 'assigned', p_requester, 'pending', 'pending',
    jsonb_build_object('level', (s->>'level')::integer, 'assigned_to', s->>'assigned_to', 'assigned_role', s->>'assigned_role')
  FROM jsonb_array_elements(p_steps) AS s;

  RETURN v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_approval_workflow_tx(uuid, text, uuid, text, numeric, integer, uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_approval_workflow_tx(uuid, text, uuid, text, numeric, integer, uuid, uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_approval_workflow_tx(uuid, text, uuid, text, numeric, integer, uuid, uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_approval_workflow_tx(uuid, text, uuid, text, numeric, integer, uuid, uuid, text, jsonb) TO service_role;
