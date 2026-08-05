-- =====================================================================
-- G3 Smoke-Test Fixture — SEED (idempotent, tenant-parameterized, self-asserting)
-- =====================================================================
-- Creates a clearly-labeled DISPOSABLE project (code GMC-G3-SMOKE) that
-- sits directly in G3 `in_review` so the full submit -> approval-quorum ->
-- rejection/resubmission -> G3 -> G4 runtime lifecycle can be exercised.
--
-- NOTE: The preview shares the PRODUCTION database. Running this writes real
-- production rows. Use scripts/g3-smoke-fixture.teardown.sql to remove.
--
-- TENANT PARAMETER (REQUIRED — no fallback)
--   The target tenant MUST be passed explicitly:
--     psql "$POSTGRES_URL_NON_POOLING" -v tenant_id="<uuid>" -f scripts/g3-smoke-fixture.seed.sql
--   There is NO tenant-name fallback and NO "first tenant by created_at"
--   fallback: omitting -v tenant_id aborts the seed. This prevents the fixture
--   from silently binding to an arbitrary tenant.
--
-- EXACT-MATCH ALIGNMENT (must mirror lib/gates/g3-requirements.ts)
--   Deliverable document categories (DELIVERABLE_CATEGORY_MAP):
--     signed-ppa        -> commercial
--     epc-contract      -> procurement
--     financial-model   -> financial
--     insurance         -> insurance
--     lender-term-sheet -> financial
--     legal-opinion     -> legal
--   Staffing seat role codes (STAFFING_ROLE_CODE_MAP):
--     commercial-manager  -> DEV
--     finance-lead        -> FIN
--     legal-counsel       -> LEG
--     transaction-advisor -> PD
-- The post-seed assertions below FAIL the whole transaction if the seeded
-- categories/role-codes drift from these governed values, so a mis-seeded
-- fixture can never masquerade as a valid one.
-- =====================================================================

-- Abort immediately if -v tenant_id was not supplied. No fallback of any kind.
\if :{?tenant_id}
\else
  \echo 'SEED ABORTED: -v tenant_id=<uuid> is required (no fallback).'
  \quit
\endif

DO $$
DECLARE
  v_tenant_input text := nullif(:'tenant_id', '');
  v_tenant   uuid;
  v_project  uuid := 'aaaaaaaa-0000-4000-8000-000000000003';  -- fixed fixture id
  v_uploader uuid;
  v_people   uuid[];
  v_r_dev uuid; v_r_fin uuid; v_r_leg uuid; v_r_pd uuid;
  v_n int;
BEGIN
  -- ---- Resolve tenant STRICTLY from the required -v tenant_id (no fallback) ----
  IF v_tenant_input IS NULL THEN
    RAISE EXCEPTION 'SEED: tenant_id is required (pass -v tenant_id=<uuid>)';
  END IF;
  SELECT id INTO v_tenant FROM public.tenants WHERE id = v_tenant_input::uuid;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'SEED: tenant_id % not found', v_tenant_input;
  END IF;

  -- ---- Abort if a prior fixture with lifecycle activity already exists ----
  -- Re-seeding on top of an in-flight fixture would corrupt the state machine.
  -- Any existing gate_submissions / approvals / workflow_events for the fixture
  -- project means it is mid-lifecycle: refuse and require an explicit teardown.
  SELECT
    (SELECT count(*) FROM public.gate_submissions WHERE project_id = v_project)
  + (SELECT count(*) FROM public.approvals       WHERE object_type = 'gate' AND object_id = v_project)
  + (SELECT count(*) FROM public.workflow_events WHERE metadata->>'project_id' = v_project::text)
  INTO v_n;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'SEED: fixture % already has % lifecycle row(s); run scripts/g3-smoke-fixture.teardown.sql first', v_project, v_n;
  END IF;

  -- ---- Resolve the four canonical role ids by code (assert each exists) ----
  SELECT id INTO v_r_dev FROM public.roles WHERE code = 'DEV';
  SELECT id INTO v_r_fin FROM public.roles WHERE code = 'FIN';
  SELECT id INTO v_r_leg FROM public.roles WHERE code = 'LEG';
  SELECT id INTO v_r_pd  FROM public.roles WHERE code = 'PD';
  IF v_r_dev IS NULL OR v_r_fin IS NULL OR v_r_leg IS NULL OR v_r_pd IS NULL THEN
    RAISE EXCEPTION 'SEED: missing one of roles DEV/FIN/LEG/PD (dev=% fin=% leg=% pd=%)',
      v_r_dev, v_r_fin, v_r_leg, v_r_pd;
  END IF;

  -- ---- Resolve four DISTINCT active profiles in the tenant ----
  SELECT array_agg(id ORDER BY id) INTO v_people
  FROM (
    SELECT id FROM public.profiles
    WHERE tenant_id = v_tenant AND is_active = true
    ORDER BY id LIMIT 4
  ) s;
  IF v_people IS NULL OR array_length(v_people, 1) < 4 THEN
    RAISE EXCEPTION 'SEED: need >=4 active profiles in tenant %, found %',
      v_tenant, COALESCE(array_length(v_people, 1), 0);
  END IF;
  v_uploader := v_people[1];

  -- 1) Project at G3 (current_phase = 2 approved gates, active)
  INSERT INTO public.projects (id, tenant_id, name, code, status, technology, current_phase, health, provenance)
  VALUES (v_project, v_tenant, 'G3 Smoke Test Project', 'GMC-G3-SMOKE', 'active', 'Solar PV', 2, 'green',
          '{"fixture":"g3-smoke","disposable":true}'::jsonb)
  ON CONFLICT (id) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id, current_phase = 2, status = 'active', updated_at = now();

  -- 2) All 8 canonical phase gates: G1/G2 approved, G3 in_review, G4-G8 pending.
  --    Names mirror lib/gates/phase-model.ts CANONICAL_PHASE_NAMES exactly.
  DELETE FROM public.phase_gates WHERE project_id = v_project;
  INSERT INTO public.phase_gates (project_id, phase_number, phase_name, status) VALUES
    (v_project, 1, 'Origination & Feasibility',         'approved'),
    (v_project, 2, 'Permitting & Grid Application',      'approved'),
    (v_project, 3, 'Commercial & Financial Close (RTB)', 'in_review'),
    (v_project, 4, 'Detailed Design (IFC)',              'pending'),
    (v_project, 5, 'Procurement & Manufacturing',        'pending'),
    (v_project, 6, 'Construction & Installation',        'pending'),
    (v_project, 7, 'Commissioning & Grid Tests',         'pending'),
    (v_project, 8, 'Handover & O&M',                     'pending');

  -- 3) Six deliverable documents tagged with the EXACT governed categories.
  DELETE FROM public.document_files WHERE project_id = v_project;
  INSERT INTO public.document_files
    (tenant_id, project_id, project_code, storage_path, file_name, title, category, status, uploaded_by, visible_to_client)
  VALUES
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/ppa.pdf',        'ppa.pdf',        'Signed PPA',        'commercial',  'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/epc.pdf',        'epc.pdf',        'EPC Contract',      'procurement', 'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/model.xlsx',     'model.xlsx',     'Financial Model',   'financial',   'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/insurance.pdf',  'insurance.pdf',  'Insurance Binder',  'insurance',   'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/term-sheet.pdf', 'term-sheet.pdf', 'Lender Term Sheet', 'financial',   'approved', v_uploader, false),
    (v_tenant, v_project, 'GMC-G3-SMOKE', 'g3-smoke/legal.pdf',      'legal.pdf',      'Legal Opinion',     'legal',       'approved', v_uploader, false);

  -- 4) Four active team assignments through the EXACT governed role codes.
  DELETE FROM public.project_team WHERE project_id = v_project;
  INSERT INTO public.project_team (tenant_id, project_id, role_id, person_id) VALUES
    (v_tenant, v_project, v_r_dev, v_people[1]),  -- commercial-manager  seat
    (v_tenant, v_project, v_r_fin, v_people[2]),  -- finance-lead        seat
    (v_tenant, v_project, v_r_leg, v_people[3]),  -- legal-counsel       seat
    (v_tenant, v_project, v_r_pd,  v_people[4]);  -- transaction-advisor seat

  -- ---- POST-SEED ASSERTIONS (fail the whole tx on any drift) ----

  -- All 8 phase gates present in the exact expected states.
  SELECT count(*) INTO v_n FROM public.phase_gates WHERE project_id = v_project;
  IF v_n <> 8 THEN RAISE EXCEPTION 'SEED ASSERT: expected 8 phase_gates rows, found %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.phase_gates
   WHERE project_id = v_project AND (
     (phase_number = 1 AND status = 'approved')  OR
     (phase_number = 2 AND status = 'approved')  OR
     (phase_number = 3 AND status = 'in_review') OR
     (phase_number BETWEEN 4 AND 8 AND status = 'pending'));
  IF v_n <> 8 THEN RAISE EXCEPTION 'SEED ASSERT: phase_gates states wrong (matched %/8)', v_n; END IF;

  -- Each deliverable category present exactly as governed.
  SELECT count(*) INTO v_n FROM public.document_files
   WHERE project_id = v_project AND tenant_id = v_tenant
     AND category IN ('commercial','procurement','financial','insurance','legal')
     AND status NOT IN ('deleted','superseded');
  IF v_n <> 6 THEN RAISE EXCEPTION 'SEED ASSERT: expected 6 governed-category docs, found %', v_n; END IF;
  -- The specific categories required by the six deliverables must all be present.
  PERFORM 1 FROM public.document_files WHERE project_id = v_project AND category = 'commercial';
  IF NOT FOUND THEN RAISE EXCEPTION 'SEED ASSERT: missing commercial doc (signed-ppa)'; END IF;
  PERFORM 1 FROM public.document_files WHERE project_id = v_project AND category = 'procurement';
  IF NOT FOUND THEN RAISE EXCEPTION 'SEED ASSERT: missing procurement doc (epc-contract)'; END IF;
  PERFORM 1 FROM public.document_files WHERE project_id = v_project AND category = 'insurance';
  IF NOT FOUND THEN RAISE EXCEPTION 'SEED ASSERT: missing insurance doc'; END IF;
  PERFORM 1 FROM public.document_files WHERE project_id = v_project AND category = 'legal';
  IF NOT FOUND THEN RAISE EXCEPTION 'SEED ASSERT: missing legal doc (legal-opinion)'; END IF;
  SELECT count(*) INTO v_n FROM public.document_files WHERE project_id = v_project AND category = 'financial';
  IF v_n <> 2 THEN RAISE EXCEPTION 'SEED ASSERT: expected 2 financial docs (financial-model + lender-term-sheet), found %', v_n; END IF;

  -- Four staffing seats through DEV/FIN/LEG/PD, four DISTINCT active people.
  SELECT count(DISTINCT pt.role_id) INTO v_n
  FROM public.project_team pt JOIN public.roles r ON r.id = pt.role_id
  WHERE pt.project_id = v_project AND pt.tenant_id = v_tenant
    AND r.code IN ('DEV','FIN','LEG','PD');
  IF v_n <> 4 THEN RAISE EXCEPTION 'SEED ASSERT: expected 4 governed role codes, found %', v_n; END IF;
  SELECT count(DISTINCT pt.person_id) INTO v_n
  FROM public.project_team pt
  JOIN public.profiles pf ON pf.id = pt.person_id
  WHERE pt.project_id = v_project AND pt.tenant_id = v_tenant
    AND pf.is_active = true AND pf.tenant_id = v_tenant;
  IF v_n <> 4 THEN RAISE EXCEPTION 'SEED ASSERT: expected 4 distinct active in-tenant team members, found %', v_n; END IF;

  RAISE NOTICE 'G3 smoke fixture seeded & asserted: project=% tenant=% people=%', v_project, v_tenant, v_people;
END $$;

-- Verification (run separately if desired):
--   SELECT code, current_phase, status FROM public.projects WHERE code='GMC-G3-SMOKE';
--   SELECT phase_number, phase_name, status FROM public.phase_gates
--     WHERE project_id='aaaaaaaa-0000-4000-8000-000000000003' ORDER BY phase_number;
--   SELECT category, count(*) FROM public.document_files
--     WHERE project_id='aaaaaaaa-0000-4000-8000-000000000003' GROUP BY category ORDER BY category;
