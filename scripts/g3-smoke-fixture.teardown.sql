-- =====================================================================
-- G3 Smoke-Test Fixture — TEARDOWN (idempotent, self-asserting)
-- =====================================================================
-- Removes the disposable GMC-G3-SMOKE project and EVERY row created by
-- scripts/g3-smoke-fixture.seed.sql plus any lifecycle rows produced while
-- testing (gate_submissions, approvals + children, approval_conditions,
-- signatures, workflow_events, audit_log).
--
-- TENANT IS REQUIRED. Like the seed, this takes `-v tenant_id=<uuid>` and has
-- NO fallback. The fixture project id is fixed, but binding the teardown to an
-- explicit tenant means a mistyped/rotated environment can never delete a row
-- that merely shares the id. The fixture is additionally verified by code and
-- provenance before anything is deleted.
--
--   psql "$POSTGRES_URL_NON_POOLING" -v tenant_id="<uuid>" \
--     -f scripts/g3-smoke-fixture.teardown.sql
--
-- STORAGE IS NOT HANDLED HERE. Signature BLOBS live in the `documents` bucket
-- and SQL cannot delete them. Run scripts/g3-smoke-fixture.teardown.ts instead,
-- which removes the validated storage objects FIRST and then executes this
-- file — deleting the rows first would discard the only record of which paths
-- to remove, permanently orphaning the blobs.
--
-- DELETE ORDER MATTERS. `projects` and `approvals` carry AFTER DELETE audit
-- triggers that INSERT a delete-row into audit_log. So we delete those tables
-- FIRST (letting their triggers fire), and sweep audit_log LAST — otherwise the
-- project-delete trigger leaves a residual audit row behind (the exact bug that
-- left one row after the previous teardown). audit_log itself has no trigger,
-- so its own deletion does not recurse.
--
-- Safe to run multiple times, including after a PARTIAL previous teardown:
-- every step is keyed to ids rather than to the project row still existing.
-- =====================================================================

-- Abort immediately if -v tenant_id was not supplied. No fallback of any kind.
\if :{?tenant_id}
\else
  \echo 'TEARDOWN ABORTED: -v tenant_id=<uuid> is required (no fallback).'
  \quit
\endif

DO $$
DECLARE
  v_tenant_input text := nullif(:'tenant_id', '');
  v_tenant   uuid;
  v_project  uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_approval_ids uuid[];
  v_approval_texts text[];
  v_code text;
  v_provenance jsonb;
  v_row_tenant uuid;
  v_n int;
BEGIN
  IF v_tenant_input IS NULL THEN
    RAISE EXCEPTION 'TEARDOWN: tenant_id is required (pass -v tenant_id=<uuid>)';
  END IF;
  v_tenant := v_tenant_input::uuid;

  -- ---- FIXTURE VERIFICATION -------------------------------------------------
  -- If the project row still exists it MUST be the disposable fixture, owned by
  -- the supplied tenant. Anything else aborts before a single delete.
  -- If it does NOT exist we continue: a previous run may have been interrupted
  -- after deleting the project but before sweeping its residue.
  SELECT code, provenance, tenant_id
    INTO v_code, v_provenance, v_row_tenant
  FROM public.projects WHERE id = v_project;

  IF FOUND THEN
    IF v_code IS DISTINCT FROM 'GMC-G3-SMOKE' THEN
      RAISE EXCEPTION 'TEARDOWN REFUSED: project % has code % (expected GMC-G3-SMOKE)', v_project, v_code;
    END IF;
    IF v_provenance->>'fixture' IS DISTINCT FROM 'g3-smoke' THEN
      RAISE EXCEPTION 'TEARDOWN REFUSED: project % is not provenance.fixture=g3-smoke', v_project;
    END IF;
    IF v_row_tenant IS DISTINCT FROM v_tenant THEN
      RAISE EXCEPTION 'TEARDOWN REFUSED: project % belongs to tenant %, not %', v_project, v_row_tenant, v_tenant;
    END IF;
  ELSE
    RAISE NOTICE 'TEARDOWN: fixture project row already absent — sweeping residue only.';
  END IF;

  -- Collect approval ids tied to this fixture project (gate approvals use
  -- object_id = project id). Captured BEFORE the deletes because the audit rows
  -- the approvals trigger writes are keyed to these ids.
  SELECT array_agg(id) INTO v_approval_ids
  FROM public.approvals
  WHERE object_type = 'gate' AND object_id = v_project AND tenant_id = v_tenant;

  -- audit_log.record_id is TEXT, so compare against text ids, not uuids.
  SELECT array_agg(id::text) INTO v_approval_texts
  FROM unnest(coalesce(v_approval_ids, '{}'::uuid[])) AS id;

  -- 0) Signatures for this fixture. Deleted here so no governed signature row
  --    survives the fixture it belongs to. The RUNNER has already removed the
  --    matching storage objects; doing it in the other order would strand them.
  DELETE FROM public.signatures
   WHERE tenant_id = v_tenant AND project_id = v_project;

  -- 1) Approval children first (FKs), then approvals (fires approvals audit trigger)
  IF v_approval_ids IS NOT NULL THEN
    DELETE FROM public.approval_conditions WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approval_events     WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approval_steps      WHERE approval_id = ANY(v_approval_ids);
    DELETE FROM public.approvals           WHERE id         = ANY(v_approval_ids);
  END IF;

  -- 2) Lifecycle + fixture rows scoped to the project (no audit triggers here).
  --    gate_signoffs + approval_items are spawned by trg_spawn_gate_signoffs when
  --    a gate enters 'in_review'; gate_signoffs.phase_gate_id FKs phase_gates, so
  --    both must be removed BEFORE phase_gates.
  DELETE FROM public.workflow_events  WHERE metadata->>'project_id' = v_project::text;
  DELETE FROM public.gate_submissions WHERE project_id = v_project;
  DELETE FROM public.project_team     WHERE project_id = v_project;
  DELETE FROM public.document_files   WHERE project_id = v_project;
  DELETE FROM public.approval_items   WHERE project_id = v_project;
  DELETE FROM public.gate_signoffs gs
   USING public.phase_gates pg
   WHERE gs.phase_gate_id = pg.id AND pg.project_id = v_project;
  DELETE FROM public.phase_gates      WHERE project_id = v_project;

  -- 3) The project itself (fires the projects audit trigger -> inserts an audit_log row)
  DELETE FROM public.projects WHERE id = v_project;

  -- 4) Sweep audit_log LAST so the trigger-generated delete rows are also removed:
  --    rows keyed to the project AND rows keyed to any fixture approval id.
  DELETE FROM public.audit_log WHERE record_id = v_project::text;
  IF v_approval_texts IS NOT NULL THEN
    DELETE FROM public.audit_log WHERE record_id = ANY(v_approval_texts);
  END IF;

  -- ---- POST-TEARDOWN ASSERTIONS (fail loudly if anything survived) ----
  SELECT
    (SELECT count(*) FROM public.projects        WHERE id = v_project)
  + (SELECT count(*) FROM public.phase_gates     WHERE project_id = v_project)
  + (SELECT count(*) FROM public.document_files  WHERE project_id = v_project)
  + (SELECT count(*) FROM public.project_team    WHERE project_id = v_project)
  + (SELECT count(*) FROM public.gate_submissions WHERE project_id = v_project)
  + (SELECT count(*) FROM public.workflow_events WHERE metadata->>'project_id' = v_project::text)
  + (SELECT count(*) FROM public.approvals       WHERE object_type = 'gate' AND object_id = v_project)
  + (SELECT count(*) FROM public.approval_items  WHERE project_id = v_project)
  + (SELECT count(*) FROM public.signatures      WHERE project_id = v_project)
  + (SELECT count(*) FROM public.gate_signoffs gs JOIN public.phase_gates pg ON pg.id = gs.phase_gate_id WHERE pg.project_id = v_project)
  + (SELECT count(*) FROM public.audit_log       WHERE record_id = v_project::text)
  INTO v_n;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TEARDOWN ASSERT: % fixture row(s) still present after teardown', v_n;
  END IF;

  -- Approval children and approval-keyed audit rows must be gone too.
  IF v_approval_ids IS NOT NULL THEN
    SELECT
      (SELECT count(*) FROM public.approval_events     WHERE approval_id = ANY(v_approval_ids))
    + (SELECT count(*) FROM public.approval_steps      WHERE approval_id = ANY(v_approval_ids))
    + (SELECT count(*) FROM public.approval_conditions WHERE approval_id = ANY(v_approval_ids))
    + (SELECT count(*) FROM public.audit_log           WHERE record_id = ANY(v_approval_texts))
    INTO v_n;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'TEARDOWN ASSERT: % approval child/audit row(s) still present', v_n;
    END IF;
  END IF;

  -- Nothing may remain anywhere in the tenant that references the fixture.
  SELECT count(*) INTO v_n
  FROM public.signatures WHERE tenant_id = v_tenant AND project_id = v_project;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TEARDOWN ASSERT: % signature row(s) still present', v_n;
  END IF;

  RAISE NOTICE 'G3 smoke fixture torn down & asserted clean: project=% tenant=%', v_project, v_tenant;
END $$;

-- Verification (should return 0 rows):
--   SELECT count(*) FROM public.projects WHERE code='GMC-G3-SMOKE';
