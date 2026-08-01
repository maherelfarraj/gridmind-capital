-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- VIEWS
-- File 5 of 6  |  source of truth: project zmahjutrpvwjcmhkiibj (read-only introspection)
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
-- Represents the VERIFIED PRE-P0 production state. Do not embed P0 changes here.
--
-- SOURCE NOTE: every definition below was captured with pg_get_viewdef() against
-- production. NONE came from supabase/migrations/20260730000005_views_and_rpc.sql,
-- which is quarantined: it selects from person, person_role_assignment, project_role,
-- task, task_assignment and copilot_usage -- none of which exist in production.
--
-- DELTA vs 20260729000002_full_baseline.sql: that dump contains only 4 views.
-- v_person_task_load and v_person_workload are production-only and are added here.
--
-- OWNERSHIP: all six views are owned by postgres in production. Ownership is not
-- reproducible by a normal migration role; a view is owned by whoever creates it.
-- If the bootstrap role is not postgres, the schema owner must run:
--     ALTER VIEW public.<name> OWNER TO postgres;
-- This matters because these views are NOT security_invoker: they run with the
-- privileges of their owner, so the owner determines what RLS the view bypasses.
--
-- RELOPTIONS: none of the six carry reloptions in production (no security_invoker,
-- no security_barrier). Reproduced as-is.
-- =====================================================================

BEGIN;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- The captured definitions use unqualified relation names and unqualified enum
-- casts (e.g. 'A'::raci_letter), exactly as production stores them. A search_path
-- containing public is therefore REQUIRED while these views are created. Postgres
-- resolves the names to OIDs at creation time, so the stored definition is stable
-- regardless of the caller's search_path afterwards.
SET LOCAL search_path = public, pg_catalog;

-- ---------------------------------------------------------------------
-- v_gate_progress
-- depends on: phase_gates, gate_signoffs
-- columns: phase_gate_id, project_id, phase_number, phase_name, status,
--          total_signoffs, signed_count, ready_to_approve
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_gate_progress AS
 SELECT pg.id AS phase_gate_id,
    pg.project_id,
    pg.phase_number,
    pg.phase_name,
    pg.status::text AS status,
    count(gs.id) AS total_signoffs,
    count(*) FILTER (WHERE gs.status = 'signed'::text) AS signed_count,
    COALESCE(bool_and(gs.status = 'signed'::text), false) AS ready_to_approve
   FROM phase_gates pg
     LEFT JOIN gate_signoffs gs ON gs.phase_gate_id = pg.id
  GROUP BY pg.id, pg.project_id, pg.phase_number, pg.phase_name, pg.status;

-- ---------------------------------------------------------------------
-- v_inbox
-- depends on: approvals, approval_items
-- columns: id, tenant_id, title, status, due_date, created_at, source, object_type
-- NOTE: this view has NO tenant filter of its own. It is a UNION ALL over two
-- base tables and relies entirely on those tables' RLS. Recorded as a production
-- fact; not corrected here.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_inbox AS
 SELECT approvals.id,
    approvals.tenant_id,
    approvals.title,
    approvals.status::text AS status,
    approvals.due_date::text AS due_date,
    approvals.created_at,
    'workflow_approval'::text AS source,
    approvals.object_type
   FROM approvals
UNION ALL
 SELECT approval_items.id,
    approval_items.tenant_id,
    approval_items.title,
    approval_items.status,
    NULL::text AS due_date,
    approval_items.created_at,
    approval_items.type AS source,
    approval_items.type AS object_type
   FROM approval_items;

-- ---------------------------------------------------------------------
-- v_person_task_load          [PRODUCTION-ONLY -- absent from the dump]
-- depends on: tasks, profiles
-- columns: person_id, full_name, project_id, todo, in_progress, blocked, overdue
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_person_task_load AS
 SELECT t.assignee_person_id AS person_id,
    COALESCE(p.full_name, p.email, 'Unknown'::text) AS full_name,
    t.project_id,
    count(*) FILTER (WHERE t.status = 'todo'::text) AS todo,
    count(*) FILTER (WHERE t.status = 'in_progress'::text) AS in_progress,
    count(*) FILTER (WHERE t.status = 'blocked'::text) AS blocked,
    count(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status <> 'done'::text) AS overdue
   FROM tasks t
     LEFT JOIN profiles p ON p.id = t.assignee_person_id
  WHERE t.assignee_person_id IS NOT NULL
  GROUP BY t.assignee_person_id, p.full_name, p.email, t.project_id;

-- ---------------------------------------------------------------------
-- v_person_workload           [PRODUCTION-ONLY -- absent from the dump]
-- depends on: raci_assignments, raci_deliverables, phase_gates, project_team, profiles
-- depends on enum: raci_letter
-- columns: project_id, person_id, full_name, a_count, r_count, c_count, i_count
-- NOTE: this is the RACI-based definition that production actually has. It bears
-- no resemblance to the definition in the quarantined 20260730000005 file.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_person_workload AS
 SELECT pg.project_id,
    pt.person_id,
    COALESCE(p.full_name, p.email, 'Unknown'::text) AS full_name,
    count(*) FILTER (WHERE ra.letter = 'A'::raci_letter) AS a_count,
    count(*) FILTER (WHERE ra.letter = 'R'::raci_letter) AS r_count,
    count(*) FILTER (WHERE ra.letter = 'C'::raci_letter) AS c_count,
    count(*) FILTER (WHERE ra.letter = 'I'::raci_letter) AS i_count
   FROM raci_assignments ra
     JOIN raci_deliverables rd ON rd.id = ra.deliverable_id
     JOIN phase_gates pg ON pg.id = rd.gate_id
     JOIN project_team pt ON pt.role_id = ra.role_id AND pt.project_id = pg.project_id
     LEFT JOIN profiles p ON p.id = pt.person_id
  GROUP BY pg.project_id, pt.person_id, p.full_name, p.email;

-- ---------------------------------------------------------------------
-- v_project_staffing
-- depends on: projects, project_team, roles
-- columns: project_id, name, assigned_roles, total_roles, staffing_pct
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_project_staffing AS
 SELECT pr.id AS project_id,
    pr.name,
    count(pt.id) FILTER (WHERE r.counts_toward_staffing) AS assigned_roles,
    ( SELECT count(*) AS count
           FROM roles
          WHERE roles.counts_toward_staffing) AS total_roles,
    round(100.0 * count(pt.id) FILTER (WHERE r.counts_toward_staffing)::numeric / (( SELECT count(*) AS count
           FROM roles
          WHERE roles.counts_toward_staffing))::numeric, 1) AS staffing_pct
   FROM projects pr
     LEFT JOIN project_team pt ON pt.project_id = pr.id
     LEFT JOIN roles r ON r.id = pt.role_id
  GROUP BY pr.id, pr.name;

-- ---------------------------------------------------------------------
-- v_role_workload
-- depends on: roles, departments, raci_assignments
-- depends on enum: raci_letter
-- columns: role_id, code, title, department, a_count, r_count, c_count, i_count
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_role_workload AS
 SELECT r.id AS role_id,
    r.code,
    r.title,
    d.name AS department,
    count(*) FILTER (WHERE ra.letter = ANY (ARRAY['A'::raci_letter, 'A/R'::raci_letter])) AS a_count,
    count(*) FILTER (WHERE ra.letter = ANY (ARRAY['R'::raci_letter, 'A/R'::raci_letter])) AS r_count,
    count(*) FILTER (WHERE ra.letter = 'C'::raci_letter) AS c_count,
    count(*) FILTER (WHERE ra.letter = 'I'::raci_letter) AS i_count
   FROM roles r
     JOIN departments d ON d.id = r.department_id
     LEFT JOIN raci_assignments ra ON ra.role_id = r.id
  GROUP BY r.id, r.code, r.title, d.name;

-- ---------------------------------------------------------------------
-- VIEW OWNERSHIP  [relocated here by the D2 correction, 2026-08-01]
-- ---------------------------------------------------------------------
-- Ownership is set BEFORE the grants below, because the owner is recorded as the
-- grantor in every resulting ACL entry. Production shows grantor=postgres on all
-- view privileges; granting first and re-owning afterwards would leave the
-- original creator as grantor and would not reproduce that.
--
-- These are no-ops when the baseline runs as postgres (the creator is already the
-- owner) and fail loudly otherwise, which is the desired signal: these views are
-- NOT security_invoker, so they execute with their owner's privileges and the
-- owner determines which RLS they bypass.

ALTER VIEW public.v_gate_progress OWNER TO postgres;
ALTER VIEW public.v_inbox OWNER TO postgres;
ALTER VIEW public.v_person_task_load OWNER TO postgres;
ALTER VIEW public.v_person_workload OWNER TO postgres;
ALTER VIEW public.v_project_staffing OWNER TO postgres;
ALTER VIEW public.v_role_workload OWNER TO postgres;

-- ---------------------------------------------------------------------
-- VIEW GRANTS  [relocated here by the D2 correction, 2026-08-01]
-- ---------------------------------------------------------------------
-- D2: these statements previously lived in 20260801000003_rls_policies_grants.sql
-- (sections A3 and A4b), which runs BEFORE this file. Local execution failed there
-- with SQLSTATE 42P01 on public.v_gate_progress -- the views did not exist yet.
-- They are now issued immediately after the views are created and owned.
--
-- The previous revision of THIS file also carried a dynamic DO-block that looped
-- over pg_class WHERE relkind='v' and issued GRANT ALL via EXECUTE format(...).
-- That block is DELETED, for two reasons beyond the ordering fix:
--
--   1. It was a RULE, not a reproduction. It granted to whatever views happened
--      to exist at run time, so a missing or renamed view would be silently
--      skipped instead of failing loudly. A canonical baseline must enumerate.
--   2. Grants hidden inside a DO block are invisible to statement-level scanners
--      anchored on a leading GRANT/REVOKE keyword -- the exact false negative
--      that once let this file be reported as containing "0 grants".
--
-- Privilege list is written out in full rather than as GRANT ALL, so the file
-- states the eight privileges production actually holds:
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.
-- (MAINTAIN is PostgreSQL 17+; production and the reference image are both 17.6.)

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_gate_progress TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_inbox TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_person_task_load TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_person_workload TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_project_staffing TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_role_workload TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_gate_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_inbox TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_person_task_load TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_person_workload TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_project_staffing TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.v_role_workload TO service_role;

COMMIT;
