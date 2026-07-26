-- Atomic governance RPC: creates project + 7 phase_gates + G0 approval in one transaction
-- Returns project_id on success, rolls back everything on any failure

CREATE OR REPLACE FUNCTION create_project_governed(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_tenant_id uuid;
  v_gate_phase int;
  v_approval_id uuid;
  v_result jsonb;
BEGIN
  -- Extract required fields from payload
  v_tenant_id := (payload->>'tenant_id')::uuid;
  
  -- Validate required fields
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'tenant_id is required');
  END IF;

  -- 1. Insert project (planning, phase 0)
  INSERT INTO projects (
    tenant_id,
    code,
    name,
    technology,
    capacity_mw,
    bess_mwh,
    location,
    country,
    target_completion,
    status,
    current_phase,
    health,
    project_manager,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    payload->>'code',
    payload->>'name',
    payload->>'technology',
    (payload->>'capacity_mw')::numeric,
    (payload->>'bess_mwh')::numeric,
    payload->>'location',
    payload->>'country',
    (payload->>'target_completion')::date,
    'planning'::project_status,
    0,
    'green'::health_status,
    (payload->>'project_manager')::uuid,
    (payload->>'created_by')::uuid,
    COALESCE((payload->>'created_at')::timestamp, now()),
    now()
  )
  RETURNING id INTO v_project_id;

  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Failed to create project');
  END IF;

  -- 2. Insert 7 phase_gates (G0–G6, all pending)
  FOR v_gate_phase IN 0..6 LOOP
    INSERT INTO phase_gates (
      project_id,
      phase_number,
      phase_name,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_project_id,
      v_gate_phase,
      CASE v_gate_phase
        WHEN 0 THEN 'Origination & Feasibility'
        WHEN 1 THEN 'Permitting & Grid Application'
        WHEN 2 THEN 'Commercial & Financial Close'
        WHEN 3 THEN 'Detailed Design'
        WHEN 4 THEN 'Procurement & Manufacturing'
        WHEN 5 THEN 'Construction & Installation'
        WHEN 6 THEN 'Commissioning & Grid Tests'
      END,
      'pending'::gate_status,
      now(),
      now()
    );
  END LOOP;

  -- 3. Insert G0 approval (pending)
  INSERT INTO approvals (
    tenant_id,
    object_type,
    object_id,
    title,
    status,
    priority,
    amount,
    requester_id,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    'opportunity',
    v_project_id,
    payload->>'code',
    'pending'::approval_status,
    'normal'::approval_priority,
    (payload->>'amount')::numeric,
    (payload->>'created_by')::uuid,
    COALESCE((payload->>'created_at')::timestamp, now()),
    now()
  )
  RETURNING id INTO v_approval_id;

  IF v_approval_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Failed to create G0 approval');
  END IF;

  -- Emit 'created' event for approval
  INSERT INTO approval_events (
    approval_id,
    actor_id,
    event_type,
    metadata,
    created_at
  ) VALUES (
    v_approval_id,
    (payload->>'created_by')::uuid,
    'created',
    jsonb_build_object('via_rpc', true, 'phase_gates', 7),
    now()
  );

  -- Success: return project_id
  RETURN jsonb_build_object(
    'project_id', v_project_id,
    'approval_id', v_approval_id,
    'gates_count', 7
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback entire transaction on any error
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_project_governed(jsonb) TO anon, authenticated;
