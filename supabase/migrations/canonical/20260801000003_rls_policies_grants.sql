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

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !! BLOCKED -- THIS POLICY DOES NOT MATCH PRODUCTION. DO NOT ADOPT.  !!
-- !! expression drift confirmed; production definition NOT captured
-- !! Verified by normalized expression fingerprint against pg_policies:
-- !! 140 of 144 policies matched exactly; this is one of the 4 that did not.
-- !! Production's exact definition could not be captured -- the Supabase MCP
-- !! became unavailable mid-capture. The statement below is the STALE dump
-- !! version, retained only so the object is not silently omitted.
-- !! ACTION: replace with the live definition before adopting this baseline:
-- !!   SELECT permissive, cmd, roles, qual, with_check FROM pg_policies
-- !!    WHERE schemaname='public' AND policyname='approval_matrix_read';
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CREATE POLICY approval_matrix_read ON public.approval_matrix FOR SELECT USING (true);

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

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !! BLOCKED -- THIS POLICY DOES NOT MATCH PRODUCTION. DO NOT ADOPT.  !!
-- !! dump grants access when tenant_id = the demo tenant '…0001'; production does NOT
-- !! Verified by normalized expression fingerprint against pg_policies:
-- !! 140 of 144 policies matched exactly; this is one of the 4 that did not.
-- !! Production's exact definition could not be captured -- the Supabase MCP
-- !! became unavailable mid-capture. The statement below is the STALE dump
-- !! version, retained only so the object is not silently omitted.
-- !! ACTION: replace with the live definition before adopting this baseline:
-- !!   SELECT permissive, cmd, roles, qual, with_check FROM pg_policies
-- !!    WHERE schemaname='public' AND policyname='comments_insert_auth';
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CREATE POLICY comments_insert_auth ON public.comments FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) OR (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)));

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !! BLOCKED -- THIS POLICY DOES NOT MATCH PRODUCTION. DO NOT ADOPT.  !!
-- !! dump grants access when tenant_id = the demo tenant '…0001'; production does NOT
-- !! Verified by normalized expression fingerprint against pg_policies:
-- !! 140 of 144 policies matched exactly; this is one of the 4 that did not.
-- !! Production's exact definition could not be captured -- the Supabase MCP
-- !! became unavailable mid-capture. The statement below is the STALE dump
-- !! version, retained only so the object is not silently omitted.
-- !! ACTION: replace with the live definition before adopting this baseline:
-- !!   SELECT permissive, cmd, roles, qual, with_check FROM pg_policies
-- !!    WHERE schemaname='public' AND policyname='comments_select_tenant';
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CREATE POLICY comments_select_tenant ON public.comments FOR SELECT USING (((tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) OR (auth.uid() IS NOT NULL)));

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

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !! BLOCKED -- THIS POLICY DOES NOT MATCH PRODUCTION. DO NOT ADOPT.  !!
-- !! dump grants access when tenant_id = the demo tenant '…0001'; production does NOT
-- !! Verified by normalized expression fingerprint against pg_policies:
-- !! 140 of 144 policies matched exactly; this is one of the 4 that did not.
-- !! Production's exact definition could not be captured -- the Supabase MCP
-- !! became unavailable mid-capture. The statement below is the STALE dump
-- !! version, retained only so the object is not silently omitted.
-- !! ACTION: replace with the live definition before adopting this baseline:
-- !!   SELECT permissive, cmd, roles, qual, with_check FROM pg_policies
-- !!    WHERE schemaname='public' AND policyname='gate_templates_select';
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
CREATE POLICY gate_templates_select ON public.gate_templates FOR SELECT USING (((tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) OR (auth.uid() IS NOT NULL)));

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
-- GRANTS
-- ---------------------------------------------------------------------

-- Production fact, recorded verbatim. Supabase's default grants give anon and
-- authenticated FULL DML on every public relation; RLS is the ONLY thing limiting
-- them. This is reproduced because the baseline must match production, NOT because
-- it is desirable. Tightening belongs in a later migration, not here.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','v')
             AND c.relname <> 'rate_limit_buckets'
  LOOP
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', r.relname);
  END LOOP;
  -- rate_limit_buckets is deliberately NOT granted to anon/authenticated in production.
  EXECUTE 'GRANT ALL ON TABLE public.rate_limit_buckets TO service_role';
END $$;
COMMIT;
