-- =====================================================================
-- G3 Smoke-Test Fixture — SEED (idempotent)
-- =====================================================================
-- Creates a clearly-labeled DISPOSABLE project (code GMC-G3-SMOKE) that
-- sits directly in G3 `in_review` so the full submit → approval-quorum →
-- rejection/resubmission → G3 → G4 runtime lifecycle can be exercised.
--
-- NOTE: The preview shares the PRODUCTION database. Running this writes
-- real production rows. Use scripts/g3-smoke-fixture.teardown.sql to remove.
--
-- Safe to run multiple times: keyed on the fixed fixture project id.
-- =====================================================================

DO $$
DECLARE
  v_tenant   uuid;
  v_project  uuid := 'aaaaaaaa-0000-4000-8000-000000000003';  -- fixed fixture id
  v_uploader uuid;
  -- team people (all active profiles)
  v_p1 uuid := '20000000-0000-0000-0000-000000000002'; -- project_manager
  v_p2 uuid := '658563bf-8f86-4e34-b854-815f79798dad'; -- engineer
  v_p3 uuid := '73977f55-76f3-4089-9cd7-a8d8cf59baf8'; -- finance_manager
  v_p4 uuid := '8eefd4e1-0dbc-4756-9201-fae27ddc6422'; -- project_manager
  -- team roles
  v_r1 uuid := '2868060e-3747-4a81-a478-92e3ce0d2775'; -- DEV
  v_r2 uuid := '5d5b4c6d-4b6c-4799-92fc-eac82c61dd25'; -- ELE
  v_r3 uuid := '9d84ef60-20dc-4b88-bfea-b367678af259'; -- FIN
  v_r4 uuid := '61d9ddee-b1e5-4886-9386-2759ab3c9f00'; -- CM
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  v_uploader := '52a9ccd6-24a2-4a52-bb3b-e16cd35ed4c5'; -- tenant_admin

  -- 1) Project at G3 (current_phase = 3, active)
  INSERT INTO public.projects (id, tenant_id, name, code, status, technology, current_phase, health, provenance)
  VALUES (v_project, v_tenant, 'G3 Smoke Test Project', 'GMC-G3-SMOKE', 'active', 'Solar PV', 3, 'green',
          '{"fixture":"g3-smoke","disposable":true}'::jsonb)
  ON CONFLICT (id) DO UPDATE
    SET current_phase = 3, status = 'active', updated_at = now();

  -- 2) Phase gates: G1/G2 approved, G3 in_review, G4 pending
  DELETE FROM public.phase_gates WHERE project_id = v_project;
  INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
    (v_project, 1, 'Origination & Feasibility',           'approved'),
    (v_project, 2, 'Permitting & Grid Application',        'approved'),
    (v_project, 3, 'Commercial & Financial Close (RTB)',   'in_review'),
    (v_project, 4, 'Detailed Design (IFC)',                'pending');

  -- 3) Six deliverable documents (canonical document_files model)
  DELETE FROM public.document_files WHERE project_id = v_project;
  INSERT INTO public.document_files
    (tenant_id, project_id, project_code, storage_path, file_name, title, category, status, uploaded_by, visible_to_client)
  VALUES
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/ppa.pdf',        'ppa.pdf',        'Signed PPA',                 'commercial', 'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/epc.pdf',        'epc.pdf',        'EPC Contract',               'commercial', 'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/term-sheet.pdf', 'term-sheet.pdf', 'Debt Term Sheet',            'financial',  'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/model.xlsx',     'model.xlsx',     'Financial Model',            'financial',  'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/insurance.pdf',  'insurance.pdf',  'Insurance Bind Confirmation','commercial', 'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/board.pdf',      'board.pdf',      'Board Investment Approval',  'financial',  'approved', v_uploader, false);

  -- 4) Four active team assignments (distinct role + person)
  DELETE FROM public.project_team WHERE project_id = v_project;
  INSERT INTO public.project_team (tenant_id, project_id, role_id, person_id) VALUES
    (v_tenant, v_project, v_r1, v_p1),
    (v_tenant, v_project, v_r2, v_p2),
    (v_tenant, v_project, v_r3, v_p3),
    (v_tenant, v_project, v_r4, v_p4);

  RAISE NOTICE 'G3 smoke fixture seeded: project=% tenant=%', v_project, v_tenant;
END $$;

-- Verification (run separately if desired):
--   SELECT code, current_phase, status FROM public.projects WHERE code='GMC-G3-SMOKE';
--   SELECT phase_number, phase_name, status FROM public.phase_gates
--     WHERE project_id='aaaaaaaa-0000-4000-8000-000000000003' ORDER BY phase_number;
