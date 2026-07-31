-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- PRIMARY KEYS, UNIQUE, FOREIGN KEYS, INDEXES
-- File 2 of 6  |  source of truth: project zmahjutrpvwjcmhkiibj (read-only introspection)
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
-- Represents the VERIFIED PRE-P0 production state. Do not embed P0 changes here.
-- Intended target: an EMPTY bootstrap database (see 20260801000005_postconditions.sql).
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
-- PRIMARY KEY / UNIQUE CONSTRAINTS (139)
-- ---------------------------------------------------------------------

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_predecessor_id_successor_id_key UNIQUE (predecessor_id, successor_id);

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_conditions
    ADD CONSTRAINT approval_conditions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_action_code_key UNIQUE (action_code);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_approval_id_level_assigned_to_key UNIQUE (approval_id, level, assigned_to);

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_project_id_date_key UNIQUE (project_id, date);

ALTER TABLE ONLY public.cash_flow_records
    ADD CONSTRAINT cash_flow_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_project_id_claim_number_key UNIQUE (project_id, claim_number);

ALTER TABLE ONLY public.client_announcements
    ADD CONSTRAINT client_announcements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_information_requests
    ADD CONSTRAINT client_information_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_project_id_version_key UNIQUE (project_id, version);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contract_milestones
    ADD CONSTRAINT contract_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_contract_no_key UNIQUE (project_id, contract_no);

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_tenant_id_key UNIQUE (tenant_id);

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_project_id_period_category_key UNIQUE (project_id, period, category);

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_project_id_report_date_key UNIQUE (project_id, report_date);

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_project_id_date_key UNIQUE (project_id, date);

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_user_id_project_id_key UNIQUE (user_id, project_id);

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_pkey PRIMARY KEY (gate_number);

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_verification_id_key UNIQUE (verification_id);

ALTER TABLE ONLY public.gate_role_requirements
    ADD CONSTRAINT gate_role_requirements_pkey PRIMARY KEY (gate_number, role_code);

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_gate_id_role_id_key UNIQUE (gate_id, role_id);

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_phase_gate_id_role_id_key UNIQUE (phase_gate_id, role_id);

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_submissions
    ADD CONSTRAINT gate_submissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_submissions
    ADD CONSTRAINT gate_submissions_project_id_gate_number_key UNIQUE (project_id, gate_number);

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_tenant_id_name_key UNIQUE (tenant_id, name);

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_code_key UNIQUE (code);

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grid_compliance_tests
    ADD CONSTRAINT grid_compliance_tests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.guarantees
    ADD CONSTRAINT guarantees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.handover_records
    ADD CONSTRAINT handover_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.help_topics
    ADD CONSTRAINT help_topics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hse_incidents
    ADD CONSTRAINT hse_incidents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hse_permits
    ADD CONSTRAINT hse_permits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.itp_activities
    ADD CONSTRAINT itp_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_project_id_itp_no_key UNIQUE (project_id, itp_no);

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_project_id_lender_name_key UNIQUE (project_id, lender_name);

ALTER TABLE ONLY public.lender_reports
    ADD CONSTRAINT lender_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_project_id_ncr_number_key UNIQUE (project_id, ncr_number);

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_project_id_pc_number_key UNIQUE (project_id, pc_number);

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_project_id_phase_number_key UNIQUE (project_id, phase_number);

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_activity_id_update_date_key UNIQUE (activity_id, update_date);

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_pkey PRIMARY KEY (project_id, gate_number);

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_project_id_role_id_key UNIQUE (project_id, role_id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_deliverable_id_role_id_key UNIQUE (deliverable_id, role_id);

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.raci_deliverables
    ADD CONSTRAINT raci_deliverables_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_project_id_plan_month_key UNIQUE (project_id, plan_month);

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rfq_responses
    ADD CONSTRAINT rfq_responses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_activities
    ADD CONSTRAINT schedule_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_baselines
    ADD CONSTRAINT schedule_baselines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedule_milestones
    ADD CONSTRAINT schedule_milestones_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_project_id_transmittal_no_key UNIQUE (project_id, transmittal_no);

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_project_id_vo_number_key UNIQUE (project_id, vo_number);

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_project_id_vo_number_key UNIQUE (project_id, vo_number);

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_project_id_permit_no_key UNIQUE (project_id, permit_no);

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (id);

-- ---------------------------------------------------------------------
-- FOREIGN KEY CONSTRAINTS (153)
-- ---------------------------------------------------------------------

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_predecessor_id_fkey FOREIGN KEY (predecessor_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_successor_id_fkey FOREIGN KEY (successor_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approval_conditions
    ADD CONSTRAINT approval_conditions_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_phase_gate_id_fkey FOREIGN KEY (phase_gate_id) REFERENCES public.phase_gates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_approver_role_fkey FOREIGN KEY (approver_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_department_code_fkey FOREIGN KEY (department_code) REFERENCES public.departments(code);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_initiator_role_fkey FOREIGN KEY (initiator_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_secondary_approver_role_fkey FOREIGN KEY (secondary_approver_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id);

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_announcements
    ADD CONSTRAINT client_announcements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_information_requests
    ADD CONSTRAINT client_information_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contract_milestones
    ADD CONSTRAINT contract_milestones_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.copilot_messages(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_primary_role_fkey FOREIGN KEY (primary_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_secondary_role_fkey FOREIGN KEY (secondary_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gate_role_requirements
    ADD CONSTRAINT gate_role_requirements_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code);

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id);

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_phase_gate_id_fkey FOREIGN KEY (phase_gate_id) REFERENCES public.phase_gates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.grid_compliance_tests
    ADD CONSTRAINT grid_compliance_tests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.guarantees
    ADD CONSTRAINT guarantees_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.help_topics
    ADD CONSTRAINT help_topics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hse_incidents
    ADD CONSTRAINT hse_incidents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hse_permits
    ADD CONSTRAINT hse_permits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.itp_activities
    ADD CONSTRAINT itp_activities_itp_id_fkey FOREIGN KEY (itp_id) REFERENCES public.itp_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lender_reports
    ADD CONSTRAINT lender_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_primary_role_fkey FOREIGN KEY (primary_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_secondary_role_fkey FOREIGN KEY (secondary_role) REFERENCES public.roles(code);

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.raci_deliverables(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.raci_deliverables
    ADD CONSTRAINT raci_deliverables_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id);

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_payment_milestone_id_fkey FOREIGN KEY (payment_milestone_id) REFERENCES public.payment_milestones(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rfq_responses
    ADD CONSTRAINT rfq_responses_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);

ALTER TABLE ONLY public.schedule_activities
    ADD CONSTRAINT schedule_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.schedule_baselines
    ADD CONSTRAINT schedule_baselines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.schedule_milestones
    ADD CONSTRAINT schedule_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_person_id_fkey FOREIGN KEY (assignee_person_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_role_id_fkey FOREIGN KEY (assignee_role_id) REFERENCES public.roles(id);

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.raci_deliverables(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document_files(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_transmittal_id_fkey FOREIGN KEY (transmittal_id) REFERENCES public.transmittals(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.workflow_definitions(id);

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------
-- INDEXES (81 explicit; 139 more are constraint-backed)
-- ---------------------------------------------------------------------

CREATE INDEX cir_project_idx ON public.client_information_requests USING btree (project_id, created_at DESC);

CREATE INDEX client_ann_project_idx ON public.client_announcements USING btree (project_id, published_at DESC);

CREATE INDEX client_announcements_project_idx ON public.client_announcements USING btree (project_id, published_at DESC);

CREATE INDEX client_reports_project_idx ON public.client_reports USING btree (project_id, version DESC);

CREATE INDEX comments_object_idx ON public.comments USING btree (object_type, object_id);

CREATE INDEX cost_entries_project_period_idx ON public.cost_entries USING btree (project_id, period);

CREATE INDEX delivery_docs_po_idx ON public.delivery_documents USING btree (po_id);

CREATE INDEX email_log_created_idx ON public.email_log USING btree (created_at DESC);

CREATE INDEX email_log_user_idx ON public.email_log USING btree (user_id);

CREATE INDEX external_access_active_idx ON public.external_access USING btree (user_id, project_id) WHERE (revoked_at IS NULL);

CREATE INDEX external_access_project_idx ON public.external_access USING btree (project_id);

CREATE INDEX external_access_user_idx ON public.external_access USING btree (user_id);

CREATE INDEX gate_certs_project_idx ON public.gate_certificates USING btree (project_id, issued_at DESC);

CREATE INDEX gate_templates_tenant_idx ON public.gate_templates USING btree (tenant_id);

CREATE INDEX guarantees_project_idx ON public.guarantees USING btree (project_id);

CREATE INDEX idx_approval_events ON public.approval_events USING btree (approval_id, created_at);

CREATE INDEX idx_approval_events_approval ON public.approval_events USING btree (approval_id, created_at);

CREATE INDEX idx_approval_items_status ON public.approval_items USING btree (status);

CREATE INDEX idx_approvals_tenant_pending ON public.approvals USING btree (tenant_id) WHERE (status = 'pending'::public.approval_status);

CREATE INDEX idx_approvals_tenant_status_created ON public.approvals USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_audit_changed_at ON public.audit_log USING btree (changed_at);

CREATE INDEX idx_audit_log_tenant_changed ON public.audit_log USING btree (tenant_id, changed_at DESC);

CREATE INDEX idx_audit_table_record ON public.audit_log USING btree (table_name, record_id);

CREATE INDEX idx_conditions_approval ON public.approval_conditions USING btree (approval_id);

CREATE INDEX idx_copilot_audit_created ON public.copilot_audit_trail USING btree (created_at DESC);

CREATE INDEX idx_copilot_audit_tenant ON public.copilot_audit_trail USING btree (tenant_id);

CREATE INDEX idx_copilot_audit_user ON public.copilot_audit_trail USING btree (user_id);

CREATE INDEX idx_copilot_budget_tenant ON public.copilot_tenant_budget USING btree (tenant_id);

CREATE INDEX idx_copilot_conversations_created_at ON public.copilot_conversations USING btree (created_at DESC);

CREATE INDEX idx_copilot_conversations_tenant_id ON public.copilot_conversations USING btree (tenant_id);

CREATE INDEX idx_copilot_conversations_user_id ON public.copilot_conversations USING btree (user_id);

CREATE INDEX idx_copilot_intent_created ON public.copilot_intent_log USING btree (created_at DESC);

CREATE INDEX idx_copilot_intent_hit ON public.copilot_intent_log USING btree (was_catalog_hit);

CREATE INDEX idx_copilot_intent_tenant ON public.copilot_intent_log USING btree (tenant_id);

CREATE INDEX idx_copilot_intent_user ON public.copilot_intent_log USING btree (user_id);

CREATE INDEX idx_copilot_messages_conversation_id ON public.copilot_messages USING btree (conversation_id);

CREATE INDEX idx_copilot_messages_created_at ON public.copilot_messages USING btree (created_at DESC);

CREATE INDEX idx_daily_reports_project ON public.daily_reports USING btree (project_id, report_date);

CREATE INDEX idx_documents_project ON public.documents USING btree (project_id, created_at DESC);

CREATE INDEX idx_field_photos_project ON public.field_photos USING btree (project_id);

CREATE INDEX idx_finance_records_tenant_project ON public.finance_records USING btree (tenant_id, project_id);

CREATE INDEX idx_itp_activities_plan ON public.itp_activities USING btree (itp_id, seq);

CREATE INDEX idx_lender_reports_project ON public.lender_reports USING btree (project_id, period_end);

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (is_read = false);

CREATE INDEX idx_phase_gates_project ON public.phase_gates USING btree (project_id, phase_number);

CREATE INDEX idx_progress_project ON public.progress_updates USING btree (project_id, update_date);

CREATE INDEX idx_project_team_person ON public.project_team USING btree (person_id);

CREATE INDEX idx_projects_tenant_created ON public.projects USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_raci_deliv_gate ON public.raci_deliverables USING btree (gate_id);

CREATE INDEX idx_resource_plan_project_month ON public.resource_plan USING btree (project_id, plan_month);

CREATE INDEX idx_risks_tenant_status ON public.risks USING btree (tenant_id, status);

CREATE INDEX idx_sched_act_project ON public.schedule_activities USING btree (project_id);

CREATE INDEX idx_schedule_activities_project ON public.schedule_activities USING btree (project_id);

CREATE INDEX idx_securities_expiry ON public.securities USING btree (project_id, expiry_date);

CREATE INDEX idx_steps_approval ON public.approval_steps USING btree (approval_id, level);

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee_person_id, status);

CREATE INDEX idx_tasks_due ON public.tasks USING btree (due_date) WHERE (status <> 'done'::text);

CREATE INDEX idx_tasks_project_status ON public.tasks USING btree (project_id, status);

CREATE INDEX idx_variations_project ON public.variations USING btree (project_id);

CREATE INDEX idx_work_permits_project ON public.work_permits USING btree (project_id, status);

CREATE INDEX idx_workflow_events_instance_created ON public.workflow_events USING btree (instance_id, created_at DESC);

CREATE INDEX idx_workflow_events_project ON public.workflow_events USING btree (((metadata ->> 'project_id'::text)));

CREATE INDEX ncrs_project_idx ON public.ncrs USING btree (project_id);

CREATE INDEX ncrs_status_idx ON public.ncrs USING btree (status);

CREATE UNIQUE INDEX one_accountable_per_deliverable ON public.raci_assignments USING btree (deliverable_id) WHERE (letter = ANY (ARRAY['A'::public.raci_letter, 'A/R'::public.raci_letter]));

CREATE INDEX payment_milestones_project_idx ON public.payment_milestones USING btree (project_id);

CREATE INDEX po_lines_po_idx ON public.purchase_order_lines USING btree (po_id, line_no);

CREATE INDEX portal_invoices_project_idx ON public.portal_invoices USING btree (project_id);

CREATE INDEX portal_invoices_submitter_idx ON public.portal_invoices USING btree (submitted_by);

CREATE UNIQUE INDEX projects_tenant_code_key ON public.projects USING btree (tenant_id, code);

CREATE INDEX retention_entries_milestone_idx ON public.retention_entries USING btree (payment_milestone_id);

CREATE INDEX retention_entries_project_idx ON public.retention_entries USING btree (project_id);

CREATE INDEX rfq_responses_rfq_idx ON public.rfq_responses USING btree (rfq_id);

CREATE INDEX rfq_responses_submitter_idx ON public.rfq_responses USING btree (submitted_by);

CREATE INDEX risks_owner_id_idx ON public.risks USING btree (owner_id);

CREATE INDEX risks_project_id_idx ON public.risks USING btree (project_id);

CREATE INDEX schedule_milestones_project_idx ON public.schedule_milestones USING btree (project_id, planned_start);

CREATE INDEX signatures_entity_idx ON public.signatures USING btree (entity_type, entity_id);

CREATE INDEX signatures_project_idx ON public.signatures USING btree (project_id, signed_at DESC);

CREATE INDEX variation_orders_project_idx ON public.variation_orders USING btree (project_id);

CREATE INDEX variation_orders_status_idx ON public.variation_orders USING btree (status);
COMMIT;
