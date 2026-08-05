-- =====================================================================
-- G3 Smoke-Test Fixture — TEARDOWN (idempotent)
-- =====================================================================
-- Removes the disposable GMC-G3-SMOKE project and every row created by
-- scripts/g3-smoke-fixture.seed.sql, plus any lifecycle rows produced
-- while testing (submissions, approvals, workflow events).
--
-- Safe to run multiple times. Returns production to a clean state.
-- =====================================================================

DO $$
DECLARE
  v_project uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_approval_ids uuid[];
BEGIN
  -- Collect approval ids tied to this fixture project (gate approvals use object_id = project id)
  SELECT array_agg(id) INTO v_approval_ids
  FROM public.approvals
  WHERE object_type = 'gate' AND object_id = v_project;

  -- Approval children first (FKs), then approvals
  IF v_approval_ids IS NOT NULL THEN
    DELETE FROM public.approval_events WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approval_steps  WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approvals       WHERE id         = ANY(v_approval_ids);
  END IF;

  -- Lifecycle + fixture rows scoped to the project
  DELETE FROM public.gate_submissions WHERE project_id = v_project;
  DELETE FROM public.project_team     WHERE project_id = v_project;
  DELETE FROM public.document_files   WHERE project_id = v_project;
  DELETE FROM public.phase_gates      WHERE project_id = v_project;

  -- Audit rows referencing the fixture project (record_id is text)
  DELETE FROM public.audit_log WHERE record_id = v_project::text;

  -- Finally the project itself
  DELETE FROM public.projects WHERE id = v_project;

  RAISE NOTICE 'G3 smoke fixture torn down: project=%', v_project;
END $$;

-- Verification (should return 0 rows):
--   SELECT count(*) FROM public.projects WHERE code='GMC-G3-SMOKE';
