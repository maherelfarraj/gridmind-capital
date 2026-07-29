-- Batch 13 — RLS for browser/realtime-read tables
-- Tenant-scoped SELECT policies for projects, approvals, notifications, portal_invoices.
-- Deny-by-design: gate_*, approval_matrix, client_reports, department_* are service-role-only.
-- Idempotent: owner applies via SQL Editor. Do NOT auto-run.

-- ============================================================================
-- DENY-BY-DESIGN (service-role-only, no RLS — internal governance tables)
-- ============================================================================
-- gate_approver_defaults, gate_role_requirements, gate_signoff_templates, gates
-- approval_matrix, client_reports, departments
-- These are intentionally not readable by regular users; policies created in Batch 11.

-- ============================================================================
-- PROJECTS: tenant-scoped SELECT
-- ============================================================================
drop policy if exists "projects_select_tenant" on public.projects;
create policy "projects_select_tenant"
  on public.projects
  for select
  using (tenant_id = get_my_tenant_id());

-- ============================================================================
-- APPROVALS: tenant-scoped SELECT (scoped via approvals.tenant_id)
-- ============================================================================
drop policy if exists "approvals_select_tenant" on public.approvals;
create policy "approvals_select_tenant"
  on public.approvals
  for select
  using (tenant_id = get_my_tenant_id());

-- ============================================================================
-- NOTIFICATIONS: tenant-scoped SELECT (scoped via notifications.tenant_id)
-- ============================================================================
drop policy if exists "notifications_select_tenant" on public.notifications;
create policy "notifications_select_tenant"
  on public.notifications
  for select
  using (tenant_id = get_my_tenant_id());

-- ============================================================================
-- PORTAL_INVOICES: tenant-scoped SELECT (scoped via portal_invoices.tenant_id)
-- ============================================================================
drop policy if exists "portal_invoices_select_tenant" on public.portal_invoices;
create policy "portal_invoices_select_tenant"
  on public.portal_invoices
  for select
  using (tenant_id = get_my_tenant_id());

-- ============================================================================
-- GATE_TEMPLATES: tenant-scoped SELECT (was hardcoded, now dynamic)
-- ============================================================================
drop policy if exists "gate_templates_select_tenant" on public.gate_templates;
create policy "gate_templates_select_tenant"
  on public.gate_templates
  for select
  using (tenant_id = get_my_tenant_id());
