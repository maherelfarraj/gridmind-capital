-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- ROW LEVEL SECURITY, POLICIES, GRANTS
-- File 4 of 6  |  source of truth: project zmahjutrpvwjcmhkiibj (read-only introspection)
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
-- Represents the VERIFIED PRE-P0 production state. Do not embed P0 changes here.
-- Intended target: an EMPTY bootstrap database (see 20260801000005_postconditions.sql).
-- DELTA vs dump: dropped 7 stale policies, added 15 production-only policies.
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
SELECT pg_catalog.set_config('search_path', '', false);

-- ---------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (103 tables; 0 FORCED)
-- ---------------------------------------------------------------------

ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_conditions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_matrix ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bess_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cash_flow_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_information_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commissioning_tests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.copilot_audit_trail ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.copilot_intent_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.copilot_tenant_budget ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.energy_production ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.engineering_packages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.external_access ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.field_photos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_approver_defaults ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_certificates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_role_requirements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_signoff_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_signoffs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_submissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gate_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.grid_compliance_tests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.guarantees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.handover_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.help_topics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hse_incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hse_permits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.itp_activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.itp_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lender_facilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lender_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.marketplace_providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ncrs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_certificates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.phase_gates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.portal_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.project_gate_approvers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raci_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raci_deliverables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.resource_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.retention_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.schedule_milestones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transmittal_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.transmittals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.work_permits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

-- PostgreSQL database dump complete

-- ---------------------------------------------------------------------
-- POLICIES -- 129 from dump + 15 production-only = 144
-- ---------------------------------------------------------------------

CREATE POLICY ann_external_read ON public.client_announcements FOR SELECT TO authenticated USING ((public.is_external_role() AND public.has_external_access(project_id)));

CREATE POLICY ann_internal_read ON public.client_announcements FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

-- Reconciled against production pg_policy on 2026-08-01.
-- The pg_dump draft had USING (true) -- an unconditional read of the approval
-- matrix, including external subcontractors -- and omitted TO authenticated.
CREATE POLICY approval_matrix_read
  ON public.approval_matrix
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    NOT public.is_external_role()
  );

CREATE POLICY approval_rules_insert ON public.approval_rules FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY approval_rules_select ON public.approval_rules FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY approvals_external_block ON public.approvals AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY approvals_insert ON public.approvals FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY approvals_select ON public.approvals FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY approvals_update ON public.approvals FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY audit_log_select_admin ON public.audit_log FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));

CREATE POLICY authenticated_all ON public.raci_assignments TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_all ON public.raci_deliverables TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY authenticated_all ON public.roles TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY bess_metrics_delete ON public.bess_metrics FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY bess_metrics_insert ON public.bess_metrics FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY bess_metrics_select ON public.bess_metrics FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY bess_metrics_update ON public.bess_metrics FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY ca_read ON public.client_announcements FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR public.has_external_access(project_id)));

CREATE POLICY cir_client_insert ON public.client_information_requests FOR INSERT TO authenticated WITH CHECK (((requested_by = auth.uid()) AND public.is_external_role() AND public.has_external_access(project_id)));

CREATE POLICY cir_client_read ON public.client_information_requests FOR SELECT TO authenticated USING ((requested_by = auth.uid()));

CREATE POLICY cir_insert ON public.client_information_requests FOR INSERT TO authenticated WITH CHECK ((requested_by = auth.uid()));

CREATE POLICY cir_update ON public.client_information_requests FOR UPDATE TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY client_reports_external_read ON public.client_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((status = 'issued'::text) AND public.has_external_access(project_id))));

-- Reconciled against production pg_policy on 2026-08-01.
-- The pg_dump draft carried a demo-tenant bypass (tenant_id = '...0001') that
-- production has already removed, and omitted TO authenticated.
CREATE POLICY comments_insert_auth
  ON public.comments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
  );

-- Reconciled against production pg_policy on 2026-08-01.
-- The pg_dump draft replaced production's tenant predicate with a bare
-- auth.uid() IS NOT NULL (cross-tenant read for any logged-in user), added a
-- demo-tenant bypass, and omitted TO authenticated.
CREATE POLICY comments_select_tenant
  ON public.comments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
  );

CREATE POLICY comments_update_author ON public.comments FOR UPDATE USING ((auth.uid() = author_id));

CREATE POLICY contract_milestones_delete ON public.contract_milestones FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contract_milestones_insert ON public.contract_milestones FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contract_milestones_select ON public.contract_milestones FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contract_milestones_update ON public.contract_milestones FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contracts_delete ON public.contracts FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contracts_insert ON public.contracts FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contracts_select ON public.contracts FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY contracts_update ON public.contracts FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY copilot_audit_viewer ON public.copilot_audit_trail USING ((user_id = auth.uid())) WITH CHECK (false);

CREATE POLICY copilot_budget_admin ON public.copilot_tenant_budget USING (false) WITH CHECK (false);

CREATE POLICY copilot_conversations_user_access ON public.copilot_conversations USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY copilot_intent_log_viewer ON public.copilot_intent_log USING ((user_id = auth.uid())) WITH CHECK (false);

CREATE POLICY copilot_messages_access ON public.copilot_messages USING ((conversation_id IN ( SELECT copilot_conversations.id
   FROM public.copilot_conversations
  WHERE (copilot_conversations.user_id = auth.uid())))) WITH CHECK ((conversation_id IN ( SELECT copilot_conversations.id
   FROM public.copilot_conversations
  WHERE (copilot_conversations.user_id = auth.uid()))));

CREATE POLICY cost_entries_external_block ON public.cost_entries AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY cost_entries_select ON public.cost_entries FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY cr_external_read ON public.client_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((status = 'issued'::text) AND (public.current_user_role() = 'client_viewer'::text) AND public.has_external_access(project_id))));

CREATE POLICY dd_insert ON public.delivery_documents FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));

CREATE POLICY doc_files_external_read ON public.document_files AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));

CREATE POLICY docs_insert ON public.documents FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY docs_select ON public.documents FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY docs_update ON public.documents FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY documents_external_read ON public.documents AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));

CREATE POLICY email_log_external_block ON public.email_log AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY email_log_select_own ON public.email_log FOR SELECT USING ((user_id = auth.uid()));

CREATE POLICY energy_production_delete ON public.energy_production FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY energy_production_insert ON public.energy_production FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY energy_production_select ON public.energy_production FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY energy_production_update ON public.energy_production FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY eng_packages_external_read ON public.engineering_packages AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));

-- Reconciled against production pg_policy on 2026-08-01.
-- The pg_dump draft replaced production's tenant predicate with a bare
-- auth.uid() IS NOT NULL (cross-tenant read for any logged-in user), added a
-- demo-tenant bypass, and omitted TO authenticated.
CREATE POLICY gate_templates_select
  ON public.gate_templates
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_my_tenant_id()
  );

CREATE POLICY gate_templates_write ON public.gate_templates USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY grid_compliance_tests_delete ON public.grid_compliance_tests FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY grid_compliance_tests_insert ON public.grid_compliance_tests FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY grid_compliance_tests_select ON public.grid_compliance_tests FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY grid_compliance_tests_update ON public.grid_compliance_tests FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY guarantees_external_block ON public.guarantees AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY guarantees_select ON public.guarantees FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY help_articles_insert ON public.help_articles FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY help_articles_select ON public.help_articles FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY help_articles_update ON public.help_articles FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY help_public ON public.help_articles FOR SELECT USING ((is_public = true));

CREATE POLICY help_topics_insert ON public.help_topics FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY help_topics_select ON public.help_topics FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_activities_delete ON public.itp_activities FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_activities_insert ON public.itp_activities FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_activities_select ON public.itp_activities FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_activities_update ON public.itp_activities FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_plans_delete ON public.itp_plans FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_plans_insert ON public.itp_plans FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_plans_select ON public.itp_plans FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY itp_plans_update ON public.itp_plans FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY ncrs_delete ON public.ncrs FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY ncrs_insert ON public.ncrs FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY ncrs_select ON public.ncrs FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY ncrs_update ON public.ncrs FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY notif_insert ON public.notifications FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY notif_select_own ON public.notifications FOR SELECT USING ((user_id = auth.uid()));

CREATE POLICY notif_update_own ON public.notifications FOR UPDATE USING ((user_id = auth.uid()));

CREATE POLICY notification_prefs_select_own ON public.notification_prefs FOR SELECT USING ((user_id = auth.uid()));

CREATE POLICY notification_prefs_update_own ON public.notification_prefs FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY notification_prefs_upsert_own ON public.notification_prefs FOR INSERT WITH CHECK ((user_id = auth.uid()));

CREATE POLICY payment_milestones_select ON public.payment_milestones FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY pg_external_read ON public.phase_gates AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND public.has_external_access(project_id))));

CREATE POLICY phase_gates_insert ON public.phase_gates FOR INSERT WITH CHECK ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));

CREATE POLICY phase_gates_select ON public.phase_gates FOR SELECT USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));

CREATE POLICY phase_gates_update ON public.phase_gates FOR UPDATE USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));

CREATE POLICY pi_external_read ON public.portal_invoices AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR (submitted_by = auth.uid())));

CREATE POLICY pi_write ON public.portal_invoices FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));

CREATE POLICY pm_external_read ON public.payment_milestones AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND (client_visible = true) AND public.has_external_access(project_id))));

CREATE POLICY po_external_ack ON public.purchase_orders FOR UPDATE TO authenticated USING ((public.is_external_role() AND (organization_name = public.current_user_org()) AND public.has_external_access(project_id)));

CREATE POLICY po_external_read ON public.purchase_orders AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((organization_name = public.current_user_org()) AND public.has_external_access(project_id))));

CREATE POLICY pol_read ON public.purchase_order_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.purchase_orders po
  WHERE ((po.id = purchase_order_lines.po_id) AND ((NOT public.is_external_role()) OR ((po.organization_name = public.current_user_org()) AND public.has_external_access(po.project_id)))))));

CREATE POLICY pol_write ON public.purchase_order_lines TO authenticated USING ((NOT public.is_external_role())) WITH CHECK ((NOT public.is_external_role()));

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));

CREATE POLICY project_members_insert ON public.project_members FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY project_members_select ON public.project_members FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY project_members_update ON public.project_members FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY projects_delete ON public.projects FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY projects_external_read ON public.projects AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR public.has_external_access(id)));

CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY projects_select ON public.projects FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY projects_update ON public.projects FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY resource_plan_delete ON public.resource_plan FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY resource_plan_insert ON public.resource_plan FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY resource_plan_select ON public.resource_plan FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY resource_plan_update ON public.resource_plan FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY retention_entries_select ON public.retention_entries FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY retention_external_block ON public.retention_entries AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY rfq_external_read ON public.rfqs AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((organization_name = public.current_user_org()) AND public.has_external_access(project_id))));

CREATE POLICY rfqr_admin_update ON public.rfq_responses FOR UPDATE TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY rfqr_insert ON public.rfq_responses FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));

CREATE POLICY securities_delete ON public.securities FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY securities_insert ON public.securities FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY securities_select ON public.securities FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY securities_update ON public.securities FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));

CREATE POLICY signatures_insert_self ON public.signatures FOR INSERT TO authenticated WITH CHECK ((signer_id = auth.uid()));

CREATE POLICY sm_external_block ON public.schedule_milestones AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

CREATE POLICY sm_read ON public.schedule_milestones FOR SELECT TO authenticated USING (true);

CREATE POLICY variation_orders_select ON public.variation_orders FOR SELECT USING ((auth.uid() IS NOT NULL));

CREATE POLICY variation_orders_write ON public.variation_orders USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY vo_external_read ON public.variation_orders AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND (client_visible = true) AND public.has_external_access(project_id))));

CREATE POLICY work_packages_external_read ON public.work_packages AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));

CREATE POLICY workflow_events_external_block ON public.workflow_events AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));

-- ---------------------------------------------------------------------
-- POLICIES PRESENT IN PRODUCTION BUT ABSENT FROM THE DUMP (15)
-- ---------------------------------------------------------------------

CREATE POLICY approvals_select_tenant ON public.approvals AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = public.get_my_tenant_id()));
CREATE POLICY dept_read ON public.departments AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));
CREATE POLICY dept_write ON public.departments AS PERMISSIVE FOR ALL TO authenticated USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));
CREATE POLICY gapd_read ON public.gate_approver_defaults AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));
CREATE POLICY gapd_write ON public.gate_approver_defaults AS PERMISSIVE FOR ALL TO authenticated USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text, 'project_director'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text, 'project_director'::text])));
CREATE POLICY grr_read ON public.gate_role_requirements AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));
CREATE POLICY grr_write ON public.gate_role_requirements AS PERMISSIVE FOR ALL TO authenticated USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));
CREATE POLICY gst_read ON public.gate_signoff_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));
CREATE POLICY gst_write ON public.gate_signoff_templates AS PERMISSIVE FOR ALL TO authenticated USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));
CREATE POLICY gate_templates_select_tenant ON public.gate_templates AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = public.get_my_tenant_id()));
CREATE POLICY gates_read ON public.gates AS PERMISSIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));
CREATE POLICY gates_write ON public.gates AS PERMISSIVE FOR ALL TO authenticated USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));
CREATE POLICY notifications_select_tenant ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = public.get_my_tenant_id()));
CREATE POLICY portal_invoices_select_tenant ON public.portal_invoices AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = public.get_my_tenant_id()));
CREATE POLICY projects_select_tenant ON public.projects AS PERMISSIVE FOR SELECT TO public USING ((tenant_id = public.get_my_tenant_id()));

-- ---------------------------------------------------------------------
-- GRANTS, OWNERSHIP AND DEFAULT ACLs
-- ---------------------------------------------------------------------
--
-- REWRITTEN 2026-08-01 (defect G1 of the reconciliation report).
--
-- CORRECTION TO THE RECONCILIATION REPORT ITSELF: that report stated this
-- baseline contained ZERO GRANT statements. That was WRONG. A grants block did
-- exist here, but every GRANT was assembled dynamically as a string inside a
-- DO block, so a scan anchored on a statement-initial GRANT/REVOKE keyword
-- could not see it. Same class of error as the parser false positives in
-- section 4 of that report. The report has been amended.
--
-- The previous DO block was nonetheless unfit as a canonical baseline:
--   1. It was a RULE, not a reproduction. It granted to whatever relations
--      happened to exist at run time, so it could not fail loudly if the
--      relation set drifted from production's verified 102 tables + 6 views.
--   2. It granted to service_role, which the reconciliation never verified.
--   3. It invented a GRANT on rate_limit_buckets to service_role.
--   4. It omitted sequences, function EXECUTE ACLs, ownership and default ACLs
--      entirely -- so increment_copilot_usage inherited PostgreSQL's default
--      EXECUTE TO PUBLIC, which is BROADER than production.
--
-- Everything below is either VERIFIED (section A, executable) or NOT VERIFIED
-- (section B, commented out and blocked). Nothing is inferred into section A.
-- Production's broad anon/authenticated posture is reproduced as a FACT to be
-- matched, not as a recommendation. RLS is the only control over these grants,
-- and no table sets FORCE ROW LEVEL SECURITY, so the owner still bypasses every
-- policy. Tightening belongs in a later migration, never in this baseline.

-- =====================================================================
-- SECTION A -- VERIFIED AGAINST PRODUCTION. EXECUTABLE.
-- =====================================================================

-- A0. SCHEMA PRIVILEGES on public -- ADDED 2026-08-01.
-- Captured (privilege-gap-report section 1): USAGE held explicitly by PUBLIC,
-- anon, authenticated, service_role and postgres. CREATE held ONLY by
-- pg_database_owner, which also owns the schema.
--
-- STATUS: SEMANTICALLY REPRODUCIBLE, GRANTOR PROVENANCE REQUIRES VALIDATION.
-- Production records grantor = pg_database_owner on all five entries. A GRANT
-- issued by the migration role records grantor = postgres instead, so the ACL is
-- semantically equivalent but NOT byte-identical. That difference is accepted and
-- documented rather than papered over: reproducing the grantor would require
-- impersonating the owner or re-owning the schema, both out of scope and NOT
-- attempted here.
--
-- Schema ownership is deliberately left untouched. On a fresh Supabase project
-- the schema already exists with the correct owner, and re-owning a
-- platform-managed object would be destructive.
--
-- Whether the migration role may issue these at all depends on implicit
-- pg_database_owner membership (true only if postgres owns the database).
-- pg_auth_members does not record implicit membership, so this could NOT be
-- settled by introspection and must be confirmed on the disposable database.
--
-- CREATE is deliberately NOT granted: production grants it only to the schema
-- owner, which needs no statement.

GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO postgres;

-- A1. TABLE PRIVILEGES -- 102 of 103 tables to anon + authenticated.
-- Verified: anon and authenticated each hold DELETE, INSERT, MAINTAIN,
-- REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE. That set is identical to
-- GRANT ALL on PostgreSQL 17; it is spelled out explicitly so the statement
-- stays exact if it is ever replayed on a server whose ALL means something
-- different. Listed one relation per line, not discovered dynamically, so a
-- missing table fails loudly instead of being silently skipped.

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.activity_dependencies TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ai_insights TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_conditions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_matrix TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_rules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_steps TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approvals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.assets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.audit_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.bess_metrics TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.cash_flow_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.claims TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_announcements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_information_requests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_reports TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.comments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.commissioning_tests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.contract_milestones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.contracts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_audit_trail TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_conversations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_intent_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_tenant_budget TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.cost_entries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.daily_reports TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.delivery_documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.departments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.document_files TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.email_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.energy_production TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.engineering_packages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.external_access TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.field_photos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.finance_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_approver_defaults TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_certificates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_role_requirements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_signoff_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_signoffs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_submissions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.grid_compliance_tests TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.guarantees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.handover_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.help_articles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.help_topics TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.hse_incidents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.hse_permits TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.inspections TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.itp_activities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.itp_plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.lender_facilities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.lender_reports TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.maintenance_plans TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_providers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ncrs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notification_prefs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notifications TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.opportunities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_certificates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_milestones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.phase_gates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.portal_invoices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.progress_updates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_gate_approvers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_team TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.purchase_order_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.purchase_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.raci_assignments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.raci_deliverables TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.resource_plan TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.retention_entries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.rfq_responses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.rfqs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.risks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.roles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_activities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_baselines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_milestones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.securities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signatures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.task_comments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tenants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tickets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.transmittal_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.transmittals TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.variation_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.variations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.work_packages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.work_permits TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_definitions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_instances TO anon, authenticated;

-- A2. rate_limit_buckets -- PARTIAL EXCEPTION, CORRECTED 2026-08-01.
-- Captured ACL (privilege-gap-report section 2):
--     postgres     = all 8   (owner-derived, no statement needed)
--     service_role = all 8   (EXPLICIT -- granted in A4b with the other 102)
--     anon         = ABSENT
--     authenticated= ABSENT
--
-- The earlier draft emitted NO statement at all here, reasoning that production
-- withholds this table. That was only half right: it is withheld from anon and
-- authenticated, NOT from service_role. Withholding it from service_role too
-- would have broken server-side rate limiting, which runs exclusively under the
-- service-role key.
--
-- The service_role grant for this table is NOT duplicated here -- it is one of
-- the 103 enumerated in A4b, so there is exactly one statement per
-- (relation, grantee) pair in this file.
--
-- ---------------------------------------------------------------------
-- D3 CORRECTION (2026-08-01) -- SECURITY. ABSENCE IS NOT DENIAL.
-- ---------------------------------------------------------------------
-- The previous revision of this section deliberately emitted NO statement for
-- anon/authenticated, on the reasoning that "the bootstrap target is empty, so
-- there is no grant to revoke and a REVOKE would CREATE an ACL entry production
-- does not have".
--
-- THAT REASONING IS DISPROVEN BY EXECUTION. On supabase/postgres 17.6.1.158 the
-- table came out as:
--
--     anon=arwdDxtm/postgres  authenticated=arwdDxtm/postgres
--
-- i.e. FULL DML for both roles, granted by nobody in this baseline.
--
-- Cause: the Supabase image ships its own ALTER DEFAULT PRIVILEGES records for
-- schema public (granting ALL ON TABLES to anon, authenticated and service_role)
-- and those defaults are ALREADY ACTIVE when file ...0000 runs. Any table created
-- in public therefore receives that ACL automatically at CREATE time. Emitting no
-- statement does not yield "no privileges" -- it yields whatever the default ACL
-- decides, which here is everything.
--
-- The empty-target premise was the flaw: the target is empty of TABLES, not empty
-- of DEFAULT PRIVILEGES. An explicit REVOKE is therefore REQUIRED to reproduce
-- production, and it removes an inherited entry rather than creating one.
--
-- Detected by postcondition P-G1 (103 tables granted to anon vs 102 expected) and
-- P-G5 (9760 column-privilege rows vs 9720 expected; the surplus 40 = 5 columns
-- x 2 roles x 4 column-level privileges, which is exactly this table).
--
-- Ordering: this runs in ...0003, long after the table exists in ...0000, so the
-- inherited ACL is present and there is something real to revoke. Nothing later
-- in the sequence re-grants this table to anon or authenticated -- A4b grants it
-- to service_role only, and the A8 default ACLs govern FUTURE objects exclusively.
--
-- Owner privileges are untouched: postgres holds its 8 privileges by ownership,
-- which REVOKE ... FROM anon, authenticated cannot affect.

REVOKE ALL PRIVILEGES ON TABLE public.rate_limit_buckets FROM anon, authenticated;

-- A3. VIEW PRIVILEGES -- RELOCATED TO ...0004_views.sql BY THE D2 CORRECTION.
--
-- D2 CORRECTION (2026-08-01, proven by local execution). This section used to
-- carry six GRANT statements naming the six views. It failed with SQLSTATE 42P01
-- (undefined_table) on public.v_gate_progress, because the views are created by
-- 20260801000004_views.sql, which runs AFTER this file. A privilege cannot be
-- granted on a relation that does not exist yet.
--
-- The six view GRANTs for anon/authenticated, the six for service_role (formerly
-- in A4b) and the six ALTER VIEW ... OWNER TO postgres statements (formerly in
-- A7) now live in ...0004_views.sql, immediately after the view definitions.
-- No file was renamed and no placeholder view was created: the dependency is
-- satisfied by putting each statement after the object it needs, not by
-- weakening the statement or reordering the files.
--
-- Privilege fidelity is unchanged -- the same 18 statements exist, with the same
-- privilege lists and the same grantees, at a point in the sequence where they
-- can actually execute. Postconditions still assert the same final ACL
-- fingerprints (P-G2 / P-G3), so the relocation is validated by outcome rather
-- than by inspection.

-- A4. SEQUENCE PRIVILEGES -- 2 sequences, SELECT + UPDATE + USAGE.
-- Production has exactly 2 sequences in schema public. Both are the implicit
-- identity sequences of the only 2 GENERATED ALWAYS AS IDENTITY columns in the
-- schema (approval_events.id and audit_log.id), which PostgreSQL names
-- <table>_<column>_seq. Postcondition P-G4 asserts both names exist, so a
-- naming surprise fails loudly rather than silently skipping the grant.

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.approval_events_id_seq TO anon, authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO anon, authenticated;

-- A4b. SERVICE_ROLE PRIVILEGES -- ADDED 2026-08-01 (largest gap in the draft).
-- Captured: service_role holds the identical 8-privilege set on ALL 103 tables
-- and ALL 6 views, plus SELECT+UPDATE+USAGE on both sequences. Grantor postgres,
-- no grant options. The previous pass had ZERO service_role grants: it deleted an
-- unverified service_role grant rather than carry it forward on faith. Right
-- method, wrong outcome -- the grant is real, and is reinstated here on evidence
-- rather than on assumption.
--
-- Without these the service-role key is rejected on every table, and inserts into
-- approval_events / audit_log fail on the sequence.
--
-- This list is 103, not the 102 of A1, because rate_limit_buckets IS granted to
-- service_role (see A2). Enumerated one per line, never discovered at run time,
-- so a drifted relation set fails loudly instead of being silently skipped.

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.activity_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ai_insights TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_conditions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_matrix TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approval_steps TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.approvals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.bess_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.cash_flow_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_announcements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_information_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.client_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.commissioning_tests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.contract_milestones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_audit_trail TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_intent_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.copilot_tenant_budget TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.cost_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.daily_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.delivery_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.departments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.document_files TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.email_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.energy_production TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.engineering_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.external_access TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.field_photos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.finance_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_approver_defaults TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_certificates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_role_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_signoff_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_signoffs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_submissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gate_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.gates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.grid_compliance_tests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.guarantees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.handover_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.help_articles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.help_topics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.hse_incidents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.hse_permits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.inspections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.itp_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.itp_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.lender_facilities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.lender_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.maintenance_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.marketplace_providers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.ncrs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notification_prefs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.opportunities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_certificates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.payment_milestones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.phase_gates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.portal_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.progress_updates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_gate_approvers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.project_team TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.purchase_order_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.purchase_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.raci_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.raci_deliverables TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.rate_limit_buckets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.resource_plan TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.retention_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.rfq_responses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.rfqs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.risks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_activities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_baselines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.schedule_milestones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.securities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.signatures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.task_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.transmittal_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.transmittals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.variation_orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.variations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.work_packages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.work_permits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_definitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE public.workflow_instances TO service_role;

-- The 6 service_role view grants formerly here were RELOCATED to
-- ...0004_views.sql by the D2 correction (same reason as A3: the views do not
-- exist until that file runs).

-- Both sequences. anon/authenticated already covered in A4; no privileges are
-- added for them here beyond the capture.

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.approval_events_id_seq TO service_role;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

-- A5. COLUMN-LEVEL PRIVILEGES -- ZERO STATEMENTS, AND THAT IS EXACT.
-- Production reports 9720 column-privilege rows. Every one is INHERITED from a
-- table/view grant; production holds no narrower per-column grant. Emitting
-- per-column GRANTs would therefore CREATE explicit column ACLs that production
-- does not have -- a real difference, not a compression of one.
--
-- The count reconciles exactly, which is what proves inheritance rather than
-- assuming it. PostgreSQL tracks 4 column-level privileges (SELECT, INSERT,
-- UPDATE, REFERENCES):
--   tables: (1177 total columns - 5 on rate_limit_buckets) = 1172
--           1172 columns x 2 roles x 4 privileges              = 9376
--   views:  (8+8+7+7+5+8) = 43 columns x 2 roles x 4 privileges =  344
--                                                        total  = 9720
-- 9720 == the production figure, to the row. A5 is complete BECAUSE A1/A3 are.

-- A6. FUNCTION EXECUTE ACLs -- corrects the one privilege that was BROADER
-- than production. 26 of 28 functions are verified as EXECUTE to PUBLIC, anon,
-- authenticated and service_role. increment_copilot_usage is verified as
-- restricted to postgres, authenticated and service_role -- NO PUBLIC, NO anon.
-- PostgreSQL grants EXECUTE TO PUBLIC by default, so the REVOKE is mandatory:
-- without it a bootstrapped database is MORE permissive than production.

-- ---------------------------------------------------------------------
-- D4 CORRECTION (2026-08-01) -- SECURITY. REVOKE FROM PUBLIC IS NOT ENOUGH.
-- ---------------------------------------------------------------------
-- Captured production ACL for this function (privilege-gap-report section 3):
--     authenticated = X
--     service_role  = X
--     postgres      = X   (owner-derived)
--     PUBLIC        = ABSENT
--     anon          = ABSENT
--
-- The previous revision issued REVOKE ALL ... FROM PUBLIC and then granted
-- authenticated + service_role. Local execution proved anon RETAINED EXECUTE:
--
--     has_function_privilege('anon', 'public.increment_copilot_usage(integer)',
--                            'EXECUTE')  =>  true
--
-- Two independent mechanisms were at work and only one was handled:
--
--   1. PostgreSQL grants EXECUTE to PUBLIC by default on every new function.
--      The existing REVOKE ... FROM PUBLIC correctly removes that.
--   2. The Supabase image ALSO ships ALTER DEFAULT PRIVILEGES granting EXECUTE
--      ON FUNCTIONS to anon, authenticated and service_role. That produces a
--      SEPARATE, EXPLICIT anon=X entry in proacl.
--
-- REVOKE ... FROM PUBLIC does NOT remove an explicit per-role grant. PUBLIC is
-- its own pseudo-grantee, not a superset that sweeps up named roles. The explicit
-- anon entry therefore survived, leaving the bootstrap BROADER than production on
-- the one function production deliberately restricts.
--
-- Both revokes are issued below, before the grants, so the resulting ACL contains
-- exactly the captured production grantees and nothing inherited.
--
-- The other 27 functions need no revoke: production grants them to PUBLIC, anon,
-- authenticated and service_role, which is what the defaults already produce.

REVOKE ALL ON FUNCTION public.increment_copilot_usage(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_copilot_usage(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_copilot_usage(integer) TO authenticated, service_role;

-- The remaining 27 signatures keep EXECUTE TO PUBLIC and are granted explicitly
-- to anon, authenticated and service_role so the ACL is materialised rather
-- than left implicit. See the caveat in section B4 about the count 26 vs 27.

GRANT EXECUTE ON FUNCTION public.audit_trigger_fn() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, numeric) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_org() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_gate_approval() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b1() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b10() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b2() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b3() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b4() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b5() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b6() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b7() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b8() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gm_rule_b9() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_external_access(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_external_role() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_profiles_drop() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_ncr_number() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_risk_number() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_ticket_number() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_vo_number() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spawn_gate_signoffs() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO PUBLIC, anon, authenticated, service_role;

-- A7. OWNERSHIP -- verified: all 28 functions and all 6 views are owned by
-- postgres. These statements are no-ops when the baseline is executed AS
-- postgres, and fail loudly if it is not -- which is the desired signal.

ALTER FUNCTION public.audit_trigger_fn() OWNER TO postgres;
ALTER FUNCTION public.consume_rate_limit(text, integer, numeric) OWNER TO postgres;
ALTER FUNCTION public.current_user_org() OWNER TO postgres;
ALTER FUNCTION public.current_user_role() OWNER TO postgres;
ALTER FUNCTION public.enforce_gate_approval() OWNER TO postgres;
ALTER FUNCTION public.get_my_tenant_id() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b1() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b10() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b2() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b3() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b4() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b5() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b6() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b7() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b8() OWNER TO postgres;
ALTER FUNCTION public.gm_rule_b9() OWNER TO postgres;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.has_external_access(uuid) OWNER TO postgres;
ALTER FUNCTION public.increment_copilot_usage(integer) OWNER TO postgres;
ALTER FUNCTION public.is_external_role() OWNER TO postgres;
ALTER FUNCTION public.prevent_profiles_drop() OWNER TO postgres;
ALTER FUNCTION public.set_ncr_number() OWNER TO postgres;
ALTER FUNCTION public.set_risk_number() OWNER TO postgres;
ALTER FUNCTION public.set_ticket_number() OWNER TO postgres;
ALTER FUNCTION public.set_updated_at() OWNER TO postgres;
ALTER FUNCTION public.set_vo_number() OWNER TO postgres;
ALTER FUNCTION public.spawn_gate_signoffs() OWNER TO postgres;
ALTER FUNCTION public.touch_updated_at() OWNER TO postgres;

-- The 6 ALTER VIEW ... OWNER TO postgres statements formerly here were
-- RELOCATED to ...0004_views.sql by the D2 correction: the views do not exist
-- until that file runs, so ownership cannot be set from here either.

-- =====================================================================
-- SECTION A8 -- DEFAULT ACLs (EXECUTABLE PORTION)
-- =====================================================================
--
-- Production has EXACTLY 6 default-ACL records in schema public: 3 owned by
-- postgres, 3 by a platform superuser role. The 3 postgres-owned records are
-- reproduced verbatim below; run as postgres with no FOR ROLE clause they record
-- grantor = postgres and match production exactly.
--
-- These govern FUTURE objects only. They do not affect anything created earlier
-- in this baseline, which is why the explicit grants above remain required.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- =====================================================================
-- SECTION B -- PLATFORM ACTION REQUIRED. NOT EXECUTABLE BY THIS BASELINE.
-- =====================================================================
--
-- Everything previously blocked here has been CAPTURED and resolved (see
-- privilege-gap-report.txt). What remains is not a knowledge gap but an
-- AUTHORITY gap: the statements are known exactly and still cannot be issued by
-- the migration role.
--
-- RESOLVED, no longer blocked:
--   B1 schema USAGE ......... captured; reproduced in A0 (grantor caveat).
--   B2 service_role ACLs .... captured; reproduced in A2/A4b. The three
--                             administrative platform roles hold NOTHING on any
--                             public relation, so no statement exists to write.
--                             Their absence IS the correct reproduction.
--   B4 'second' function ACL  NEVER EXISTED. Exactly ONE exception
--                             (increment_copilot_usage): 27 + 1 = 28. The
--                             '2 exceptions' claim was a miscount.
--   B5 table ownership ...... all 103 tables, 6 views, 2 sequences and 28
--                             functions are owned by postgres, reproduced
--                             implicitly by executing this baseline as postgres.
--
-- ---------------------------------------------------------------------
-- B3. PLATFORM-OWNED DEFAULT ACLs -- PLATFORM ACTION REQUIRED
-- ---------------------------------------------------------------------
-- The remaining 3 of the 6 default-ACL records are owned by a platform superuser
-- role. ALTER DEFAULT PRIVILEGES is per-GRANTOR: only the owning role, a member
-- of it, or a superuser may issue them. postgres is NOT a member of that role, so
-- the migration role cannot issue these under any circumstance. Impersonating the
-- owner is NOT attempted and role membership is NOT altered -- either would be a
-- privilege escalation performed by a migration.
--
-- On a fresh Supabase project these are created by the platform's own bootstrap,
-- so a new project will normally already have them.
--
-- EXACT STATEMENTS, for execution by the platform role or an authorised platform
-- mechanism ONLY. <platform_superuser> is the administrative role identified in
-- privilege-gap-report.txt section 6; it is written as a placeholder so that no
-- statement in this file names an administrative role directly:
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE <platform_superuser> IN SCHEMA public
--       GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE <platform_superuser> IN SCHEMA public
--       GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO postgres, anon, authenticated, service_role;
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE <platform_superuser> IN SCHEMA public
--       GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
--
-- UNTIL THESE THREE ARE EXECUTED THE DEFAULT-ACL DIMENSION IS NOT EXACT, and
-- future-object privilege inheritance does not fully match production. This
-- baseline must NOT be described as achieving full privilege fidelity until they
-- have been applied and verified in a disposable environment.

COMMIT;
