-- submit_gate_form_tx — atomic, tenant-scoped gate submission + approval creation
--
-- Bug fixed: app/actions/gate-submissions.ts' submitGateForm() (backing
-- submitG4FormAction..submitG8FormAction) never tenant-scoped its project
-- lookup (`SELECT ... FROM projects WHERE id = projectId`, no tenant_id
-- filter), never wrote gate_submissions.tenant_id, and ran the
-- project-check -> submission-check -> upsert -> approval-check -> approval-
-- insert sequence as 5 separate round-trips with no transaction and no row
-- locks. A writer could submit against another tenant's project, and a
-- concurrent double-submit could race past the existing-approval check and
-- create duplicate pending approvals (TOCTOU).
--
-- Fix: one SECURITY INVOKER transaction that locks + tenant-verifies the
-- project, enforces the phase-gate-lock check server-side, locks any
-- existing gate_submissions row before upserting (tagging tenant_id +
-- submitted_by), and locks any existing pending/delegated approvals row
-- before deciding whether to insert a new one -- closing the TOCTOU window
-- and guaranteeing both writes commit or roll back together.
--
-- SECURITY INVOKER (not DEFINER): the function runs with the CALLING role's
-- own privileges/RLS rather than the function owner's, so it carries no
-- privilege-escalation risk of its own. This is safe here because the ONLY
-- role granted EXECUTE is service_role, which already has BYPASSRLS and
-- full SELECT/INSERT/UPDATE/DELETE grants on projects/gate_submissions/
-- approvals directly -- the function adds transactional atomicity and row
-- locking on top of privileges the caller already holds, not new access.
--
-- p_title is NOT a parameter: the approval title is derived from the
-- tenant-verified, locked `projects` row (v_project.name) inside the
-- transaction, so a caller can no longer pass an arbitrary/spoofed title
-- disconnected from the project it actually locked.

CREATE OR REPLACE FUNCTION public.submit_gate_form_tx(
  p_tenant_id   uuid,
  p_project_id  uuid,
  p_gate_number integer,
  p_actor       uuid,
  p_form_data   jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now               timestamptz := now();
  v_project           public.projects%ROWTYPE;
  v_existing_sub      public.gate_submissions%ROWTYPE;
  v_existing_approval public.approvals%ROWTYPE;
  v_min_phase         integer;
  v_rows              integer;
  v_title             text;
BEGIN
  IF p_tenant_id IS NULL OR p_project_id IS NULL OR p_gate_number IS NULL OR p_actor IS NULL THEN
    RAISE EXCEPTION 'submit_gate_form_tx: missing required argument';
  END IF;
  IF p_gate_number NOT BETWEEN 0 AND 8 THEN
    RAISE EXCEPTION 'submit_gate_form_tx: invalid gate_number %', p_gate_number;
  END IF;

  -- Canonical 0-8 phase mapping (mirrors PHASE_GATE_MAPPING in gate-submissions.ts):
  -- gate_number 0/1 require current_phase >= 0; gate N (2-8) requires >= N-1.
  v_min_phase := CASE
    WHEN p_gate_number <= 1 THEN 0
    ELSE p_gate_number - 1
  END;

  -- Lock + tenant-verify the project in one step. Any project belonging to a
  -- different tenant (or nonexistent) is indistinguishable from "not found".
  SELECT * INTO v_project
    FROM public.projects
   WHERE id = p_project_id AND tenant_id = p_tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submit_gate_form_tx: project % not found for tenant %', p_project_id, p_tenant_id;
  END IF;

  IF v_project.current_phase < v_min_phase THEN
    RAISE EXCEPTION 'submit_gate_form_tx: gate % is locked at current phase %', p_gate_number, v_project.current_phase;
  END IF;

  -- Title is derived from the locked, tenant-verified project row -- never
  -- from caller input -- so it can never disagree with which project/tenant
  -- was actually locked and written.
  v_title := 'G' || p_gate_number || ' Submission — ' || v_project.name;

  -- Lock any existing submission for this (project, gate) before deciding
  -- whether to upsert. No resubmission once approved (preserves existing
  -- behavior from the pre-RPC implementation).
  SELECT * INTO v_existing_sub
    FROM public.gate_submissions
   WHERE project_id = p_project_id AND gate_number = p_gate_number
   FOR UPDATE;

  IF FOUND AND v_existing_sub.status = 'approved' THEN
    RAISE EXCEPTION 'submit_gate_form_tx: gate % has already been approved, resubmission is not permitted', p_gate_number;
  END IF;

  INSERT INTO public.gate_submissions
    (project_id, tenant_id, gate_number, form_data, status, submitted_by, submitted_at, updated_at)
  VALUES
    (p_project_id, p_tenant_id, p_gate_number, p_form_data, 'submitted', p_actor, v_now, v_now)
  ON CONFLICT (project_id, gate_number) DO UPDATE
    SET tenant_id    = p_tenant_id,
        form_data    = EXCLUDED.form_data,
        status       = 'submitted',
        submitted_by = p_actor,
        submitted_at = v_now,
        updated_at   = v_now;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'submit_gate_form_tx: expected exactly one gate_submissions row written, got %', v_rows;
  END IF;

  -- Lock any existing pending/delegated approval for this (tenant, project,
  -- gate) before deciding whether to insert. Holding this lock for the rest
  -- of the transaction closes the TOCTOU window that let two concurrent
  -- submissions both pass a plain SELECT and create duplicate approvals.
  SELECT * INTO v_existing_approval
    FROM public.approvals
   WHERE tenant_id = p_tenant_id
     AND object_type = 'gate'
     AND object_id = p_project_id
     AND gate_number = p_gate_number
     AND status IN ('pending', 'delegated')
   FOR UPDATE;

  IF FOUND THEN
    -- Idempotent resubmission: the submission above was updated in place;
    -- an approval workflow is already open for it, so no new one is created.
    RETURN 'resubmitted';
  END IF;

  INSERT INTO public.approvals
    (tenant_id, object_type, object_id, gate_number, title, status, priority, requester_id)
  VALUES
    (p_tenant_id, 'gate', p_project_id, p_gate_number, v_title, 'pending', 'normal', p_actor);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'submit_gate_form_tx: expected exactly one approval created, got %', v_rows;
  END IF;

  RETURN 'submitted';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_gate_form_tx(uuid, uuid, integer, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_gate_form_tx(uuid, uuid, integer, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_gate_form_tx(uuid, uuid, integer, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_gate_form_tx(uuid, uuid, integer, uuid, jsonb) TO service_role;
