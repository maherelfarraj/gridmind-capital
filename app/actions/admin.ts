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
