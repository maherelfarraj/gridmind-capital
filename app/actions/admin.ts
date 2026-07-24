'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/guard'

import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TenantData {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  created_at: string
  max_projects: number | null
  max_users: number | null
  settings: Record<string, unknown>
}

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: string
  department: string | null
  avatar_url: string | null
  created_at: string
  last_seen_at: string | null
}

// ─────────────────────────────────────────────────────────────
// Tenant
// ─────────────────────────────────────────────────────────────

export async function getTenant(): Promise<TenantData | null> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, status, created_at, max_projects, max_users, settings')
    .eq('id', tenantId)
    .single()

  if (error || !data) return null
  return data as TenantData
}

export async function updateTenant(payload: Partial<Pick<TenantData, 'name' | 'settings'>>): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('tenants')
    .update(payload)
    .eq('id', tenantId)

  if (error) return { error: error.message }
  return {}
}

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────

export async function getUsers(): Promise<UserProfile[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, department, avatar_url, created_at, last_active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((u) => ({
    id: u.id,
    full_name: u.full_name ?? '',
    email: u.email ?? '',
    role: u.role ?? 'viewer',
    department: u.department ?? null,
    avatar_url: u.avatar_url ?? null,
    created_at: u.created_at ?? '',
    last_seen_at: u.last_active ?? null,
  })) satisfies UserProfile[]
}

export async function updateUserRole(userId: string, role: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  return {}
}

export async function deactivateUser(userId: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Soft-delete: set role to 'viewer' and clear department
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'viewer', department: 'Deactivated' })
    .eq('id', userId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  return {}
}

// ─────────────────────────────────────────────────────────────
// Approval rules
// ─────────────────────────────────────────────────────────────

export interface ApprovalRule {
  id: string
  name: string
  object_type: string
  min_amount: number
  max_amount: number
  required_roles: string[]
  approval_levels: number
  is_active: boolean
}

// ─────────────────────────────────────────────────────────────
// Platform health
// ─────────────────────────────────────────────────────────────

export interface HealthCheck {
  /** Machine-readable key */
  key: string
  /** Human-readable label */
  label: string
  /** green = all good, amber = warning, red = critical */
  status: 'green' | 'amber' | 'red'
  /** Numeric finding — 0 is always green */
  count: number
  detail: string
}

export interface PlatformHealth {
  checks: HealthCheck[]
  /** ISO timestamp of when the snapshot was taken */
  checkedAt: string
}

/**
 * Returns a snapshot of platform health indicators.
 * Restricted to system_admin / tenant_admin — returns { error } otherwise.
 */
export async function getPlatformHealth(): Promise<PlatformHealth | { error: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return gate

  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  const checks: HealthCheck[] = []

  // ── 1. Auth users without a matching profile row ─────────────────────────
  try {
    // We count auth.users vs profiles. Service role can list auth users.
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authIds = new Set((authUsers?.users ?? []).map((u) => u.id))

    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .in('id', [...authIds])

    const profileIds = new Set((profiles ?? []).map((p) => p.id))
    const missing = [...authIds].filter((id) => !profileIds.has(id)).length

    checks.push({
      key:    'users_without_profiles',
      label:  'Auth users without a profile row',
      status: missing === 0 ? 'green' : missing <= 3 ? 'amber' : 'red',
      count:  missing,
      detail: missing === 0
        ? 'All auth users have a matching profile.'
        : `${missing} auth user${missing !== 1 ? 's' : ''} have no profile row — the handle_new_user trigger may have failed for them.`,
    })
  } catch {
    checks.push({ key: 'users_without_profiles', label: 'Auth users without a profile row', status: 'amber', count: -1, detail: 'Could not query auth.users.' })
  }

  // ── 2. Profiles without a tenant_id ──────────────────────────────────────
  try {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .is('tenant_id', null)

    const n = count ?? 0
    checks.push({
      key:    'profiles_without_tenant',
      label:  'Profiles missing tenant_id',
      status: n === 0 ? 'green' : n <= 5 ? 'amber' : 'red',
      count:  n,
      detail: n === 0
        ? 'Every profile has a tenant_id.'
        : `${n} profile row${n !== 1 ? 's' : ''} have no tenant_id and will be invisible to all tenant-scoped queries.`,
    })
  } catch {
    checks.push({ key: 'profiles_without_tenant', label: 'Profiles missing tenant_id', status: 'amber', count: -1, detail: 'Query failed.' })
  }

  // ── 3. Active projects in this tenant ────────────────────────────────────
  try {
    const { count } = await admin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    const n = count ?? 0
    checks.push({
      key:    'active_projects',
      label:  'Active projects in tenant',
      status: 'green',
      count:  n,
      detail: `${n} active project${n !== 1 ? 's' : ''} in this tenant.`,
    })
  } catch {
    checks.push({ key: 'active_projects', label: 'Active projects in tenant', status: 'amber', count: -1, detail: 'Query failed.' })
  }

  // ── 4. Audit_log entries written today ───────────────────────────────────
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await admin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', today.toISOString())

    const n = count ?? 0
    checks.push({
      key:    'audit_log_today',
      label:  'Audit log entries today',
      status: 'green',
      count:  n,
      detail: `${n} change${n !== 1 ? 's' : ''} recorded in audit_logs since midnight UTC.`,
    })
  } catch {
    checks.push({ key: 'audit_log_today', label: 'Audit log entries today', status: 'amber', count: -1, detail: 'Query failed.' })
  }

  // ── 5. Tables missing RLS ─────────────────────────────────────────────────
  // Query pg_tables for the known application tables and find those where
  // rowsecurity is false. Requires a security-definer RPC or service role.
  const KNOWN_TABLES = [
    'profiles', 'projects', 'approvals', 'approval_items', 'audit_logs',
    'comments', 'cost_entries', 'documents', 'document_files',
    'email_log', 'external_access', 'gate_submissions', 'guarantees',
    'hse_incidents', 'hse_permits', 'inspections', 'ncrs',
    'notifications', 'payment_milestones', 'portal_invoices', 'profiles',
    'risks', 'retention_entries', 'signatures', 'tasks', 'tenants',
    'tickets', 'variation_orders', 'work_permits', 'workflow_events',
  ]

  try {
    // Use rpc to query pg_tables via a helper the service role can reach.
    // Falls back to raw sql via the admin client (Supabase service role can
    // execute arbitrary SQL through the REST /rpc endpoint only if a fn exists;
    // otherwise we approximate using Supabase's own metadata endpoint).
    const { data: rlsData, error: rlsError } = await admin
      .rpc('get_tables_rls_status' as never)
      .select()

    if (rlsError || !rlsData) throw new Error(rlsError?.message ?? 'no data')

    const noRls = (rlsData as { tablename: string; rowsecurity: boolean }[])
      .filter((t) => KNOWN_TABLES.includes(t.tablename) && !t.rowsecurity)
      .map((t) => t.tablename)

    checks.push({
      key:    'tables_missing_rls',
      label:  'Audited tables missing RLS',
      status: noRls.length === 0 ? 'green' : noRls.length <= 3 ? 'amber' : 'red',
      count:  noRls.length,
      detail: noRls.length === 0
        ? 'All audited tables have Row Level Security enabled.'
        : `RLS is OFF on: ${noRls.join(', ')}.`,
    })
  } catch {
    // RPC helper not deployed — approximate: show as amber/unknown
    checks.push({
      key:    'tables_missing_rls',
      label:  'Audited tables missing RLS',
      status: 'amber',
      count:  -1,
      detail: 'Cannot verify — deploy the get_tables_rls_status() RPC helper (SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = \'public\') to enable this check.',
    })
  }

  return { checks, checkedAt: new Date().toISOString() }
}

export async function getApprovalRules(): Promise<ApprovalRule[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('approval_rules')
    .select('id, name, object_type, min_amount, max_amount, required_roles, approval_levels, is_active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as ApprovalRule[]
}
