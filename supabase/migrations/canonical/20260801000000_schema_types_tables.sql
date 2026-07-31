-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- SCHEMA, TYPES, TABLES
-- File 1 of 6  |  source of truth: project zmahjutrpvwjcmhkiibj (read-only introspection)
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
-- Represents the VERIFIED PRE-P0 production state. Do not embed P0 changes here.
-- Intended target: an EMPTY bootstrap database (see 20260801000005_postconditions.sql).
-- DELTA vs dump: +approval_steps.decision_note, +copilot_messages."tableCard"
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
-- SCHEMA
-- ---------------------------------------------------------------------

CREATE SCHEMA public;

-- ---------------------------------------------------------------------
-- ENUM TYPES (18)
-- ---------------------------------------------------------------------

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'delegated'
);

CREATE TYPE public.cost_category AS ENUM (
    'engineering',
    'procurement',
    'subcontracts',
    'construction',
    'overhead',
    'contingency'
);

CREATE TYPE public.email_status AS ENUM (
    'sent',
    'failed'
);

CREATE TYPE public.gate_status AS ENUM (
    'pending',
    'in_review',
    'approved',
    'rejected',
    'conditional'
);

CREATE TYPE public.guarantee_status AS ENUM (
    'active',
    'released',
    'expired',
    'called'
);

CREATE TYPE public.guarantee_type AS ENUM (
    'bid_bond',
    'performance_bond',
    'advance_payment_guarantee',
    'retention_bond'
);

CREATE TYPE public.milestone_status AS ENUM (
    'planned',
    'invoiced',
    'overdue',
    'paid'
);

CREATE TYPE public.ncr_source AS ENUM (
    'failed_inspection',
    'audit',
    'site_observation'
);

CREATE TYPE public.ncr_status AS ENUM (
    'open',
    'in_rectification',
    're_inspection',
    'closed'
);

CREATE TYPE public.notification_channel AS ENUM (
    'email',
    'push',
    'in_app',
    'sms'
);

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'active',
    'on_hold',
    'completed',
    'cancelled'
);

CREATE TYPE public.raci_letter AS ENUM (
    'R',
    'A',
    'A/R',
    'C',
    'I'
);

CREATE TYPE public.retention_status AS ENUM (
    'held',
    'release_requested',
    'released'
);

CREATE TYPE public.signature_entity_type AS ENUM (
    'gate_approval',
    'vo_approval',
    'client_report',
    'certificate'
);

CREATE TYPE public.user_role AS ENUM (
    'system_admin',
    'tenant_admin',
    'project_director',
    'project_manager',
    'engineer',
    'hse_manager',
    'commissioning_manager',
    'finance_manager',
    'commercial_manager',
    'viewer',
    'subcontractor',
    'client_viewer'
);

CREATE TYPE public.vo_origin AS ENUM (
    'ifc_discrepancy',
    'client_request',
    'site_condition'
);

CREATE TYPE public.vo_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'withdrawn'
);

CREATE TYPE public.workflow_status AS ENUM (
    'draft',
    'active',
    'completed',
    'cancelled'
);

-- ---------------------------------------------------------------------
-- TABLES (103)
-- ---------------------------------------------------------------------

CREATE TABLE public.activity_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    predecessor_id uuid NOT NULL,
    successor_id uuid NOT NULL,
    type text DEFAULT 'FS'::text,
    lag_days integer DEFAULT 0,
    CONSTRAINT activity_dependencies_type_check CHECK ((type = ANY (ARRAY['FS'::text, 'SS'::text, 'FF'::text, 'SF'::text])))
);

CREATE TABLE public.ai_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    module text,
    title text NOT NULL,
    description text,
    confidence integer DEFAULT 80,
    severity text DEFAULT 'medium'::text,
    status text DEFAULT 'open'::text,
    recommended_action text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_insights_module_check CHECK ((module = ANY (ARRAY['predictive_maintenance'::text, 'anomaly_detection'::text, 'schedule_risk'::text, 'cost_overrun'::text, 'safety'::text]))),
    CONSTRAINT ai_insights_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'info'::text]))),
    CONSTRAINT ai_insights_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text, 'dismissed'::text])))
);

CREATE TABLE public.approval_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    title text NOT NULL,
    detail text,
    status text DEFAULT 'open'::text,
    due_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_conditions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'met'::text, 'waived'::text, 'breached'::text])))
);

CREATE TABLE public.approval_events (
    id bigint NOT NULL,
    tenant_id uuid,
    approval_id uuid,
    event text NOT NULL,
    actor_id uuid,
    actor_role text,
    from_status text,
    to_status text,
    detail jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.approval_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    phase_gate_id uuid,
    role_id uuid,
    person_id uuid,
    title text NOT NULL,
    type text DEFAULT 'gate_signoff'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT approval_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);

CREATE TABLE public.approval_matrix (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    action_code text NOT NULL,
    action_name text NOT NULL,
    category text NOT NULL,
    department_code text NOT NULL,
    initiator_role text NOT NULL,
    approver_role text NOT NULL,
    secondary_approver_role text,
    threshold_usd numeric,
    requires_segregation boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.approval_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    object_type text NOT NULL,
    min_amount numeric,
    max_amount numeric,
    required_roles text[] DEFAULT '{}'::text[] NOT NULL,
    approval_levels integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    assigned_to uuid,
    assigned_role text,
    status text DEFAULT 'pending'::text,
    decided_at timestamp with time zone,
    decided_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    decision_note text,
    CONSTRAINT approval_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'skipped'::text])))
);

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    instance_id uuid,
    object_id uuid,
    object_type text NOT NULL,
    title text NOT NULL,
    description text,
    amount numeric,
    currency text DEFAULT 'USD'::text,
    priority text DEFAULT 'normal'::text NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    assignee_id uuid,
    requester_id uuid,
    due_date timestamp with time zone,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by uuid,
    decision text,
    CONSTRAINT approvals_decision_check CHECK ((decision = ANY (ARRAY['proceed'::text, 'conditional_proceed'::text, 'hold'::text, 'reject'::text]))),
    CONSTRAINT approvals_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text])))
);

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    asset_tag text NOT NULL,
    name text NOT NULL,
    category text,
    status text DEFAULT 'active'::text NOT NULL,
    location text,
    purchase_date date,
    purchase_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    tenant_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    changed_by uuid,
    old_values jsonb,
    new_values jsonb,
    changed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);

CREATE TABLE public.bess_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    date date NOT NULL,
    soc_pct numeric,
    cycles_cumulative numeric DEFAULT 0,
    throughput_mwh numeric DEFAULT 0,
    soh_pct numeric,
    warranty_cycle_limit numeric DEFAULT 6000,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cash_flow_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    period text NOT NULL,
    planned_inflow numeric DEFAULT 0,
    actual_inflow numeric DEFAULT 0,
    planned_outflow numeric DEFAULT 0,
    actual_outflow numeric DEFAULT 0,
    cumulative_net numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    claim_number text NOT NULL,
    title text NOT NULL,
    type text DEFAULT 'cost'::text,
    description text,
    amount numeric DEFAULT 0,
    eot_days integer DEFAULT 0,
    status text DEFAULT 'submitted'::text,
    submitted_date date DEFAULT CURRENT_DATE,
    response_due date,
    resolved_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claims_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'accepted'::text, 'rejected'::text, 'settled'::text, 'withdrawn'::text]))),
    CONSTRAINT claims_type_check CHECK ((type = ANY (ARRAY['time'::text, 'cost'::text, 'disruption'::text, 'other'::text])))
);

CREATE TABLE public.client_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    author_id uuid,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.client_information_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.client_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    version integer NOT NULL,
    period_label text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    storage_path text,
    generated_by uuid,
    issued_by uuid,
    issued_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    content text NOT NULL,
    author_id uuid,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_name text,
    mentions text[] DEFAULT '{}'::text[],
    is_resolved boolean DEFAULT false NOT NULL,
    parent_id uuid
);

CREATE TABLE public.commissioning_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    test_number text NOT NULL,
    title text NOT NULL,
    system text,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.contract_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    title text NOT NULL,
    due_date date,
    amount numeric DEFAULT 0,
    status text DEFAULT 'pending'::text,
    achieved_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contract_milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'achieved'::text, 'missed'::text, 'paid'::text])))
);

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    contract_no text NOT NULL,
    title text NOT NULL,
    party text,
    type text DEFAULT 'subcontract'::text,
    value numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'draft'::text,
    signed_date date,
    commencement date,
    completion date,
    retention_pct numeric DEFAULT 5,
    ld_rate_per_day numeric DEFAULT 0,
    ld_cap_pct numeric DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'suspended'::text, 'completed'::text, 'terminated'::text]))),
    CONSTRAINT contracts_type_check CHECK ((type = ANY (ARRAY['epc'::text, 'subcontract'::text, 'supply'::text, 'service'::text, 'consultancy'::text])))
);

CREATE TABLE public.copilot_audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    context_sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    model_used text DEFAULT 'gpt-4-turbo'::text,
    response_time_ms integer,
    feedback_at timestamp with time zone,
    feedback_value smallint,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_audit_feedback CHECK ((feedback_value = ANY (ARRAY['-1'::integer, 0, 1, NULL::integer]))),
    CONSTRAINT check_audit_tokens CHECK ((total_tokens > 0))
);

CREATE TABLE public.copilot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_tenant_id CHECK ((tenant_id IS NOT NULL)),
    CONSTRAINT check_user_id CHECK ((user_id IS NOT NULL))
);

CREATE TABLE public.copilot_intent_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    question text NOT NULL,
    classified_intent text,
    matched_query_id text,
    was_catalog_hit boolean DEFAULT false NOT NULL,
    fallback_prose_used boolean DEFAULT false NOT NULL,
    suggested_queries text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_intent_log_question CHECK ((length(question) > 0))
);

CREATE TABLE public.copilot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb,
    feedback smallint,
    created_at timestamp with time zone DEFAULT now(),
    flagged boolean DEFAULT false NOT NULL,
    "tableCard" jsonb,
    CONSTRAINT check_content CHECK ((content IS NOT NULL)),
    CONSTRAINT check_conversation_id CHECK ((conversation_id IS NOT NULL)),
    CONSTRAINT check_role CHECK ((role IS NOT NULL)),
    CONSTRAINT copilot_messages_feedback_check CHECK ((feedback = ANY (ARRAY['-1'::integer, 0, 1, NULL::integer]))),
    CONSTRAINT copilot_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE public.copilot_tenant_budget (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    monthly_token_limit integer DEFAULT 100000 NOT NULL,
    current_month_tokens integer DEFAULT 0 NOT NULL,
    month_start_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_budget_positive CHECK ((monthly_token_limit > 0)),
    CONSTRAINT check_current_positive CHECK ((current_month_tokens >= 0))
);

CREATE TABLE public.cost_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    period text NOT NULL,
    category public.cost_category NOT NULL,
    budgeted_amount numeric(16,2) DEFAULT 0 NOT NULL,
    actual_amount numeric(16,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.daily_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    report_date date DEFAULT CURRENT_DATE NOT NULL,
    weather text,
    temp_high_c numeric,
    wind_kmh numeric,
    workforce_count integer DEFAULT 0,
    equipment_count integer DEFAULT 0,
    work_performed text,
    delays text,
    safety_notes text,
    visitors text,
    status text DEFAULT 'draft'::text,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT daily_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text])))
);

CREATE TABLE public.delivery_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    po_id uuid NOT NULL,
    project_id uuid,
    organization_name text DEFAULT ''::text NOT NULL,
    submitted_by uuid NOT NULL,
    doc_type text DEFAULT 'delivery_note'::text NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);

CREATE TABLE public.document_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    project_code text,
    storage_path text DEFAULT ''::text NOT NULL,
    file_name text NOT NULL,
    title text,
    code text,
    category text DEFAULT 'general'::text,
    size_bytes bigint DEFAULT 0,
    mime_type text,
    uploaded_by text DEFAULT 'Unknown'::text,
    status text DEFAULT 'draft'::text,
    revision text DEFAULT 'A'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    visible_to_client boolean DEFAULT false NOT NULL,
    CONSTRAINT document_files_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'superseded'::text, 'rejected'::text])))
);

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    doc_number text,
    revision text DEFAULT 'A'::text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    file_url text,
    file_size bigint,
    uploaded_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'superseded'::text])))
);

CREATE TABLE public.email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    subject text NOT NULL,
    status public.email_status DEFAULT 'sent'::public.email_status NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.energy_production (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    date date NOT NULL,
    energy_mwh numeric DEFAULT 0,
    availability_pct numeric DEFAULT 100,
    curtailment_mwh numeric DEFAULT 0,
    p50_mwh numeric,
    p90_mwh numeric,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.engineering_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    package_code text NOT NULL,
    title text NOT NULL,
    discipline text,
    status text DEFAULT 'draft'::text NOT NULL,
    progress_pct numeric DEFAULT 0 NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.external_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);

CREATE TABLE public.field_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    storage_path text NOT NULL,
    caption text,
    report_id uuid,
    ticket_id uuid,
    taken_at timestamp with time zone DEFAULT now(),
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.finance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    record_type text NOT NULL,
    description text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    transaction_date date,
    cost_code text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.gate_approver_defaults (
    gate_number integer NOT NULL,
    primary_role text NOT NULL,
    secondary_role text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT gate_approver_defaults_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);

CREATE TABLE public.gate_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    gate_code text NOT NULL,
    gate_name text,
    verification_id text NOT NULL,
    deliverables jsonb DEFAULT '[]'::jsonb NOT NULL,
    storage_path text,
    issued_by uuid,
    issued_by_name text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.gate_role_requirements (
    gate_number integer NOT NULL,
    role_code text NOT NULL,
    CONSTRAINT gate_role_requirements_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);

CREATE TABLE public.gate_signoff_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_approver boolean DEFAULT false NOT NULL,
    letter public.raci_letter DEFAULT 'C'::public.raci_letter NOT NULL
);

CREATE TABLE public.gate_signoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phase_gate_id uuid NOT NULL,
    role_id uuid NOT NULL,
    person_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    signed_at timestamp with time zone,
    CONSTRAINT gate_signoffs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'rejected'::text])))
);

CREATE TABLE public.gate_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    gate_number integer NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text,
    submitted_by text,
    submitted_at timestamp with time zone,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gate_submissions_gate_number_check CHECK ((gate_number >= 0)),
    CONSTRAINT gate_submissions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.gate_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    name text NOT NULL,
    description text,
    technology text,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    milestone text NOT NULL,
    sort_order integer NOT NULL
);

CREATE TABLE public.grid_compliance_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    test_name text NOT NULL,
    standard text,
    test_date date,
    result text DEFAULT 'scheduled'::text,
    certificate_ref text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grid_compliance_tests_result_check CHECK ((result = ANY (ARRAY['scheduled'::text, 'passed'::text, 'failed'::text, 'retest_required'::text])))
);

CREATE TABLE public.guarantees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    type public.guarantee_type DEFAULT 'performance_bond'::public.guarantee_type NOT NULL,
    bank_name text,
    amount numeric(16,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    issue_date date,
    expiry_date date,
    status public.guarantee_status DEFAULT 'active'::public.guarantee_status NOT NULL,
    release_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.handover_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    document_type text,
    title text NOT NULL,
    revision text DEFAULT 'A'::text,
    status text DEFAULT 'pending'::text,
    submitted_by text,
    approved_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT handover_records_document_type_check CHECK ((document_type = ANY (ARRAY['as_built'::text, 'operation_manual'::text, 'warranty'::text, 'training_cert'::text, 'spare_parts'::text]))),
    CONSTRAINT handover_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.help_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    zone text DEFAULT 'general'::text NOT NULL,
    content text,
    summary text,
    tags text[] DEFAULT '{}'::text[],
    view_count integer DEFAULT 0 NOT NULL,
    helpful integer DEFAULT 0 NOT NULL,
    not_helpful integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.help_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    title text NOT NULL,
    content text,
    category text,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.hse_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    type text,
    severity text DEFAULT 'minor'::text,
    date date,
    location text,
    description text,
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.hse_permits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    type text,
    issuer text,
    issue_date date,
    expiry_date date,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    inspection_number text NOT NULL,
    title text NOT NULL,
    type text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    result text,
    inspector_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.itp_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    itp_id uuid NOT NULL,
    seq integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    inspection_type text DEFAULT 'surveillance'::text,
    reference_doc text,
    responsible text,
    status text DEFAULT 'pending'::text,
    result_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT itp_activities_inspection_type_check CHECK ((inspection_type = ANY (ARRAY['hold'::text, 'witness'::text, 'surveillance'::text, 'review'::text]))),
    CONSTRAINT itp_activities_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'waived'::text])))
);

CREATE TABLE public.itp_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    itp_no text NOT NULL,
    title text NOT NULL,
    work_package text,
    discipline text,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT itp_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'superseded'::text])))
);

CREATE TABLE public.lender_facilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    lender_name text,
    facility_amount numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    reporting_frequency text DEFAULT 'monthly'::text,
    contact_email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lender_facilities_reporting_frequency_check CHECK ((reporting_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text])))
);

CREATE TABLE public.lender_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    title text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.maintenance_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    tenant_id uuid,
    title text NOT NULL,
    frequency text,
    last_performed date,
    next_due date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.marketplace_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    logo_url text,
    integration_type text,
    status text DEFAULT 'available'::text,
    rating numeric DEFAULT 0,
    review_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketplace_providers_category_check CHECK ((category = ANY (ARRAY['data_feed'::text, 'analytics'::text, 'epc_tool'::text, 'compliance'::text, 'finance'::text, 'field_service'::text]))),
    CONSTRAINT marketplace_providers_integration_type_check CHECK ((integration_type = ANY (ARRAY['api'::text, 'webhook'::text, 'file_import'::text, 'oauth'::text]))),
    CONSTRAINT marketplace_providers_status_check CHECK ((status = ANY (ARRAY['available'::text, 'connected'::text, 'pending'::text, 'deprecated'::text])))
);

CREATE TABLE public.ncrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    ncr_number text NOT NULL,
    title text NOT NULL,
    description text,
    raised_by uuid,
    source public.ncr_source DEFAULT 'failed_inspection'::public.ncr_source NOT NULL,
    root_cause text,
    corrective_action text,
    status public.ncr_status DEFAULT 'open'::public.ncr_status NOT NULL,
    cycle integer DEFAULT 1 NOT NULL,
    reinspection_passed boolean DEFAULT false NOT NULL,
    closure_note text,
    raised_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    severity text,
    cost_impact numeric,
    CONSTRAINT ncrs_cost_impact_check CHECK (((cost_impact IS NULL) OR (cost_impact >= (0)::numeric))),
    CONSTRAINT ncrs_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['critical'::text, 'major'::text, 'minor'::text]))))
);

CREATE TABLE public.notification_prefs (
    user_id uuid NOT NULL,
    email_on_approval boolean DEFAULT true NOT NULL,
    email_on_ncr boolean DEFAULT true NOT NULL,
    email_on_vo boolean DEFAULT true NOT NULL,
    email_on_escalation boolean DEFAULT true NOT NULL,
    email_on_mention boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_weekly_digest boolean DEFAULT true NOT NULL
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    type text DEFAULT 'info'::text NOT NULL,
    channel public.notification_channel DEFAULT 'in_app'::public.notification_channel NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    technology text,
    capacity_mw numeric,
    location text,
    country text,
    stage text DEFAULT 'prospect'::text,
    irr_pct numeric,
    capex_usd numeric,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT opportunities_stage_check CHECK ((stage = ANY (ARRAY['prospect'::text, 'screening'::text, 'feasibility'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.payment_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    pc_number text NOT NULL,
    period_start date,
    period_end date,
    progress_pct numeric DEFAULT 0,
    contract_value numeric DEFAULT 0,
    gross_amount numeric DEFAULT 0,
    previous_certified numeric DEFAULT 0,
    this_period numeric DEFAULT 0,
    retention_pct numeric DEFAULT 5,
    retention_amount numeric DEFAULT 0,
    advance_recovery numeric DEFAULT 0,
    net_amount numeric DEFAULT 0,
    status text DEFAULT 'draft'::text,
    submitted_date date,
    certified_date date,
    paid_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_certificates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'certified'::text, 'invoiced'::text, 'paid'::text])))
);

CREATE TABLE public.payment_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    planned_date date,
    planned_amount numeric(16,2) DEFAULT 0 NOT NULL,
    invoiced_at timestamp with time zone,
    invoice_amount numeric(16,2),
    due_date date,
    paid_at timestamp with time zone,
    paid_amount numeric(16,2),
    status public.milestone_status DEFAULT 'planned'::public.milestone_status NOT NULL,
    escalation_level integer DEFAULT 0 NOT NULL,
    retention_pct numeric(6,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    CONSTRAINT payment_milestones_escalation_level_check CHECK (((escalation_level >= 0) AND (escalation_level <= 4)))
);

CREATE TABLE public.phase_gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_number integer NOT NULL,
    phase_name text NOT NULL,
    status public.gate_status DEFAULT 'pending'::public.gate_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.portal_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    invoice_ref text NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    period_label text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    po_id uuid,
    invoice_date date,
    pdf_path text
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    tenant_id uuid,
    full_name text,
    email text,
    role text DEFAULT 'viewer'::text,
    department text,
    avatar_url text,
    locale text DEFAULT 'en'::text NOT NULL,
    digit_style text DEFAULT 'western'::text NOT NULL,
    last_active timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true NOT NULL,
    user_type text DEFAULT 'internal'::text NOT NULL,
    home_role_id uuid,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text, 'project_director'::text, 'project_manager'::text, 'engineer'::text, 'hse_manager'::text, 'commissioning_manager'::text, 'finance_manager'::text, 'commercial_manager'::text, 'viewer'::text, 'subcontractor'::text])))
);

CREATE TABLE public.progress_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    update_date date DEFAULT CURRENT_DATE NOT NULL,
    percent_complete numeric NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT progress_updates_percent_complete_check CHECK (((percent_complete >= (0)::numeric) AND (percent_complete <= (100)::numeric)))
);

CREATE TABLE public.project_gate_approvers (
    project_id uuid NOT NULL,
    gate_number integer NOT NULL,
    primary_role text NOT NULL,
    secondary_role text,
    CONSTRAINT project_gate_approvers_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    user_id uuid,
    tenant_id uuid,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.project_team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    role_id uuid NOT NULL,
    person_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    status public.project_status DEFAULT 'planning'::public.project_status NOT NULL,
    technology text DEFAULT 'Solar PV'::text NOT NULL,
    capacity_mw numeric,
    location text,
    country text,
    start_date date,
    target_completion date,
    actual_completion date,
    budget_usd numeric,
    spent_usd numeric DEFAULT 0 NOT NULL,
    current_phase integer DEFAULT 0 NOT NULL,
    health text DEFAULT 'green'::text NOT NULL,
    project_manager uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bess_mwh numeric,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT projects_health_check CHECK ((health = ANY (ARRAY['green'::text, 'amber'::text, 'red'::text])))
);

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    line_no integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    quantity numeric(18,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'ea'::text NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    po_number text NOT NULL,
    vendor_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    issue_date date,
    delivery_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    description text,
    delivery_address text,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    vendor_contact_email text,
    vendor_contact_email_updated_at timestamp with time zone,
    vendor_contact_email_updated_by uuid
);

CREATE TABLE public.raci_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deliverable_id uuid NOT NULL,
    role_id uuid NOT NULL,
    letter public.raci_letter NOT NULL
);

CREATE TABLE public.raci_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.rate_limit_buckets (
    key text NOT NULL,
    tokens numeric NOT NULL,
    capacity integer NOT NULL,
    refill_per_sec numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_buckets_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT rate_limit_buckets_refill_per_sec_check CHECK ((refill_per_sec > (0)::numeric))
);

CREATE TABLE public.resource_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    plan_month date NOT NULL,
    planned_workforce integer DEFAULT 0 NOT NULL,
    planned_equipment integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.retention_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    payment_milestone_id uuid,
    invoice_ref text,
    invoice_amount numeric(16,2) DEFAULT 0 NOT NULL,
    retention_pct numeric(6,3) DEFAULT 0 NOT NULL,
    retention_amount numeric(16,2) DEFAULT 0 NOT NULL,
    status public.retention_status DEFAULT 'held'::public.retention_status NOT NULL,
    release_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rfq_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    rfq_id uuid NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    submitted_by uuid NOT NULL,
    price numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    validity_days integer DEFAULT 30 NOT NULL,
    notes text,
    attachment_path text,
    status text DEFAULT 'submitted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.rfqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    rfq_number text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    issue_date date,
    close_date date,
    awarded_vendor text,
    estimated_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    scope_summary text,
    amount_usd numeric
);

CREATE TABLE public.risks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    risk_number text NOT NULL,
    title text NOT NULL,
    description text,
    category text,
    probability integer DEFAULT 3 NOT NULL,
    impact integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    mitigation text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT risks_impact_range CHECK (((impact IS NULL) OR ((impact >= 1) AND (impact <= 5)))),
    CONSTRAINT risks_probability_range CHECK (((probability IS NULL) OR ((probability >= 1) AND (probability <= 5))))
);

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    department_id uuid NOT NULL,
    mission text,
    is_bess_critical boolean DEFAULT false NOT NULL,
    counts_toward_staffing boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.schedule_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    activity_code text,
    name text NOT NULL,
    phase text,
    discipline text,
    gate_number integer,
    duration_days integer DEFAULT 1,
    planned_start date,
    planned_finish date,
    actual_start date,
    actual_finish date,
    percent_complete numeric DEFAULT 0,
    weight numeric DEFAULT 1,
    is_critical boolean DEFAULT false,
    is_milestone boolean DEFAULT false,
    status text DEFAULT 'not_started'::text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT schedule_activities_percent_complete_check CHECK (((percent_complete >= (0)::numeric) AND (percent_complete <= (100)::numeric))),
    CONSTRAINT schedule_activities_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])))
);

CREATE TABLE public.schedule_baselines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text DEFAULT 'Baseline 1'::text NOT NULL,
    snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.schedule_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    planned_start date NOT NULL,
    planned_end date NOT NULL,
    actual_start date,
    actual_end date,
    status text DEFAULT 'not_started'::text NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL,
    owner text DEFAULT 'Unassigned'::text NOT NULL,
    progress_pct integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.securities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    contract_id uuid,
    type text NOT NULL,
    issuer text,
    reference text,
    amount numeric DEFAULT 0,
    issue_date date,
    expiry_date date,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT securities_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'released'::text, 'claimed'::text]))),
    CONSTRAINT securities_type_check CHECK ((type = ANY (ARRAY['advance_payment_bond'::text, 'performance_bond'::text, 'parent_company_guarantee'::text, 'retention_bond'::text, 'insurance'::text])))
);

CREATE TABLE public.signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid,
    entity_type public.signature_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    signer_id uuid NOT NULL,
    signer_name text NOT NULL,
    signer_role text,
    signature_image_path text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    statement text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    deliverable_id uuid,
    title text NOT NULL,
    description text,
    assignee_role_id uuid,
    assignee_person_id uuid,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])))
);

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    plan text DEFAULT 'enterprise'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    date_format text DEFAULT 'DD/MM/YYYY'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    default_currency text DEFAULT 'USD'::text NOT NULL,
    approval_threshold_low numeric DEFAULT 50000 NOT NULL,
    approval_threshold_medium numeric DEFAULT 250000 NOT NULL,
    approval_threshold_high numeric DEFAULT 1000000 NOT NULL,
    auto_escalation_hours integer DEFAULT 24 NOT NULL,
    escalation_target text,
    notifications_email boolean DEFAULT true NOT NULL,
    notifications_push boolean DEFAULT true NOT NULL,
    notifications_in_app boolean DEFAULT true NOT NULL,
    notifications_sms boolean DEFAULT false NOT NULL,
    sso_provider text DEFAULT 'local'::text NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    session_timeout text DEFAULT '2 hours'::text NOT NULL,
    max_concurrent_sessions integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    ticket_number text NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'issue'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    assigned_to uuid,
    created_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.transmittal_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    transmittal_id uuid NOT NULL,
    document_id uuid,
    title text NOT NULL,
    revision text DEFAULT 'A'::text,
    copies integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.transmittals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    transmittal_no text NOT NULL,
    direction text DEFAULT 'outgoing'::text,
    from_party text,
    to_party text,
    subject text NOT NULL,
    purpose text DEFAULT 'for_information'::text,
    status text DEFAULT 'draft'::text,
    issue_date date,
    response_due date,
    response_date date,
    response_code text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transmittals_direction_check CHECK ((direction = ANY (ARRAY['outgoing'::text, 'incoming'::text]))),
    CONSTRAINT transmittals_purpose_check CHECK ((purpose = ANY (ARRAY['for_information'::text, 'for_review'::text, 'for_approval'::text, 'for_construction'::text, 'as_built'::text]))),
    CONSTRAINT transmittals_response_code_check CHECK ((response_code = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text]))),
    CONSTRAINT transmittals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'acknowledged'::text, 'responded'::text, 'closed'::text])))
);

CREATE TABLE public.variation_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    vo_number text NOT NULL,
    title text NOT NULL,
    description text,
    origin public.vo_origin DEFAULT 'client_request'::public.vo_origin NOT NULL,
    cost_impact numeric(16,2),
    time_impact_days integer,
    status public.vo_status DEFAULT 'draft'::public.vo_status NOT NULL,
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    baseline_updated boolean DEFAULT false NOT NULL,
    executed boolean DEFAULT false NOT NULL,
    executed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    client_cost_visible boolean DEFAULT false NOT NULL
);

CREATE TABLE public.variations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    vo_number text NOT NULL,
    title text NOT NULL,
    description text,
    origin text DEFAULT 'client'::text,
    status text DEFAULT 'draft'::text,
    cost_impact numeric DEFAULT 0,
    schedule_impact_days integer DEFAULT 0,
    submitted_date date,
    decided_date date,
    decided_by text,
    approval_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT variations_origin_check CHECK ((origin = ANY (ARRAY['client'::text, 'contractor'::text, 'internal'::text, 'design_development'::text, 'site_condition'::text, 'force_majeure'::text]))),
    CONSTRAINT variations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'implemented'::text])))
);

CREATE TABLE public.work_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    wp_code text NOT NULL,
    title text NOT NULL,
    discipline text,
    status text DEFAULT 'not_started'::text NOT NULL,
    progress_pct numeric DEFAULT 0 NOT NULL,
    planned_start date,
    planned_finish date,
    actual_start date,
    actual_finish date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.work_permits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    permit_no text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    location text,
    description text,
    hazards text[] DEFAULT '{}'::text[],
    precautions text[] DEFAULT '{}'::text[],
    requested_by text,
    issuer text,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    status text DEFAULT 'requested'::text,
    suspension_reason text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT work_permits_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'issued'::text, 'suspended'::text, 'closed'::text, 'cancelled'::text, 'expired'::text]))),
    CONSTRAINT work_permits_type_check CHECK ((type = ANY (ARRAY['hot_work'::text, 'confined_space'::text, 'working_at_height'::text, 'excavation'::text, 'electrical'::text, 'lifting'::text, 'general'::text])))
);

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    object_type text NOT NULL,
    states jsonb DEFAULT '[]'::jsonb NOT NULL,
    transitions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workflow_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid,
    from_state text,
    to_state text NOT NULL,
    transition_code text,
    actor_id uuid,
    comment text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workflow_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    object_id uuid,
    object_type text NOT NULL,
    current_state text NOT NULL,
    status public.workflow_status DEFAULT 'active'::public.workflow_status NOT NULL,
    started_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------------------------------------------------------------------
-- IDENTITY SEQUENCES (2)
-- ---------------------------------------------------------------------

ALTER TABLE public.approval_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.approval_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

-- ---------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------

COMMENT ON SCHEMA public IS 'standard public schema';

COMMENT ON COLUMN public.projects.provenance IS 'Per-field source metadata, e.g. {"budget_usd":{"source":"pilot_assumption","at":"..."}}. Values sourced from pilot_assumption are NOT lender-verified.';

COMMENT ON COLUMN public.risks.risk_number IS 'Canonical human id (RSK-####), auto-filled by set_risk_number. There is deliberately no separate `code` column.';

COMMENT ON COLUMN public.risks.probability IS 'Likelihood 1-5 (5x5 matrix axis).';

COMMENT ON COLUMN public.risks.impact IS 'Consequence 1-5 (5x5 matrix axis).';

COMMENT ON COLUMN public.risks.owner_id IS 'FK -> profiles.id. Risk owner; display name via join.';
COMMIT;
