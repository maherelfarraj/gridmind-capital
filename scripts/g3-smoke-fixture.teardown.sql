-- =====================================================================
-- G3 Smoke-Test Fixture — TEARDOWN (idempotent, self-asserting)
-- =====================================================================
-- Removes the disposable GMC-G3-SMOKE project and EVERY row created by
-- scripts/g3-smoke-fixture.seed.sql plus any lifecycle rows produced while
-- testing (gate_submissions, approvals + children, approval_conditions,
-- workflow_events, audit_log).
--
-- DELETE ORDER MATTERS. `projects` and `approvals` carry AFTER DELETE audit
-- triggers that INSERT a delete-row into audit_log. So we delete those tables
-- FIRST (letting their triggers fire), and sweep audit_log LAST — otherwise the
-- project-delete trigger leaves a residual audit row behind (the exact bug that
-- left one row after the previous teardown). audit_log itself has no trigger,
-- so its own deletion does not recurse.
--
-- Safe to run multiple times. Returns production to a clean state.
-- =====================================================================

DO $$
DECLARE
  v_project uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_approval_ids uuid[];
  v_n int;
BEGIN
  -- Collect approval ids tied to this fixture project (gate approvals use object_id = project id)
  SELECT array_agg(id) INTO v_approval_ids
  FROM public.approvals
  WHERE object_type = 'gate' AND object_id = v_project;

  -- 1) Approval children first (FKs), then approvals (fires approvals audit trigger)
  IF v_approval_ids IS NOT NULL THEN
    DELETE FROM public.approval_conditions WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approval_events     WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approval_steps      WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approvals           WHERE id         = ANY(v_approval_ids);
  END IF;

  -- 2) Lifecycle + fixture rows scoped to the project (no audit triggers here)
  DELETE FROM public.workflow_events  WHERE metadata->>'project_id' = v_project::text;
  DELETE FROM public.gate_submissions WHERE project_id = v_project;
  DELETE FROM public.project_team     WHERE project_id = v_project;
  DELETE FROM public.document_files   WHERE project_id = v_project;
  DELETE FROM public.phase_gates      WHERE project_id = v_project;

  -- 3) The project itself (fires the projects audit trigger -> inserts an audit_log row)
  DELETE FROM public.projects WHERE id = v_project;

  -- 4) Sweep audit_log LAST so the trigger-generated delete rows are also removed.
  DELETE FROM public.audit_log WHERE record_id = v_project::text;

  -- ---- POST-TEARDOWN ASSERTIONS (fail loudly if anything survived) ----
  SELECT
    (SELECT count(*) FROM public.projects        WHERE id = v_project)
  + (SELECT count(*) FROM public.phase_gates     WHERE project_id = v_project)
  + (SELECT count(*) FROM public.document_files  WHERE project_id = v_project)
  + (SELECT count(*) FROM public.project_team    WHERE project_id = v_project)
  + (SELECT count(*) FROM public.gate_submissions WHERE project_id = v_project)
  + (SELECT count(*) FROM public.workflow_events WHERE metadata->>'project_id' = v_project::text)
  + (SELECT count(*) FROM public.approvals       WHERE object_type = 'gate' AND object_id = v_project)
  + (SELECT count(*) FROM public.audit_log       WHERE record_id = v_project::text)
  INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TEARDOWN ASSERT: % fixture row(s) still present after teardown', v_n;
  END IF;

  -- Approval children must be gone too (guard against orphans if ids were collected).
  IF v_approval_ids IS NOT NULL THEN
    SELECT
      (SELECT count(*) FROM public.approval_events     WHERE approval_id = ANY(v_approval_ids))
    + (SELECT count(*) FROM public.approval_steps      WHERE approval_id = ANY(v_approval_ids))
    + (SELECT count(*) FROM public.approval_conditions WHERE approval_id = ANY(v_approval_ids))
    INTO v_n;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TEARDOWN ASSERT: % approval child row(s) still present', v_n;
    END IF;
  END IF;

  RAISE NOTICE 'G3 smoke fixture torn down & asserted clean: project=%', v_project;
END $$;

-- Verification (should return 0 rows):
--   SELECT count(*) FROM public.projects WHERE code='GMC-G3-SMOKE';
