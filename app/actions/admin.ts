'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/guard'
import { isDbUserRole } from '@/lib/auth/roles'

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
  // P0: FAIL-CLOSED authorization
  let actor
  try {
    const res = await requireInternalRole(['system_admin', 'tenant_admin'])
    actor = res.profile
  } catch (e: any) {
    return { error: e.message }
  }

  const tenantId = actor.tenantId

  // P0: Validate requested role is in canonical whitelist
  if (!isDbUserRole(role)) {
    return { error: `"${role}" is not a valid role.` }
  }

  // P0: tenant_admin cannot assign system_admin
  if (actor.role === 'tenant_admin' && role === 'system_admin') {
    return { error: 'Only system_admin can assign system_admin role' }
  }

  const admin = createAdminClient()

  // P0: Verify target user exists and is in the same tenant
  const { data: targetProfile, error: lookupErr } = await admin
    .from('profiles')
    .select('id, role, tenant_id, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (lookupErr) return { error: `Profile lookup failed: ${lookupErr.message}` }
  if (!targetProfile) return { error: 'User not found' }
  
  // P0: tenant_admin can only manage users in their tenant
  if (actor.role === 'tenant_admin' && targetProfile.tenant_id !== tenantId) {
    return { error: 'Cannot modify users outside your tenant' }
  }

  // P0: tenant_admin cannot modify existing system_admin
  if (actor.role === 'tenant_admin' && targetProfile.role === 'system_admin') {
    return { error: 'Cannot modify system_admin accounts' }
  }

  // P0: Update role
  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  // P0: Write audit log (required by P0 migration)
  try {
    await admin.from('audit_log').insert({
      tenant_id: tenantId,
      actor_id: actor.userId,
      action: 'updateUserRole',
      resource_type: 'profile',
      resource_id: userId,
      details: { old_role: targetProfile.role, new_role: role },
      timestamp: new Date().toISOString(),
    })
  } catch (auditErr: any) {
    // Log audit failure but don't fail the mutation (already committed)
    console.error('[P0] Audit log insert failed:', auditErr.message)
  }

  return {}
}

// ─────────────────────────────────────────────────────────────
// Invite (internal staff)
// ─────────────────────────────────────────────────────────────

export interface InviteInternalUserArgs {
  email: string
  fullName: string
  /** Must be a member of the `user_role` enum. */
  role: string
  department?: string
  /** Optional seat in the 19-role org catalog (`roles.id`). */
  homeRoleId?: string
  /** Origin used to build the callback URL, e.g. https://app.example.com */
  siteUrl: string
}

export interface InviteInternalUserResult {
  userId?: string
  /** Fallback action link — always returned so invites work without SMTP. */
  inviteLink?: string
  /** True when the email already belonged to a profile (role was updated). */
  isExisting?: boolean
  error?: string
}

/**
 * Invite an internal staff member.
 *
 * Mirrors `inviteExternalUser` but accepts the internal `user_role` enum and
 * does NOT create `external_access` grants — internal users get access through
 * their role plus `project_team` seats (see `assignRole` in actions/team.ts).
 *
 * A copyable action link is always returned, so the flow still works when
 * Supabase Auth has no custom SMTP configured.
 */
export async function inviteInternalUser(
  args: InviteInternalUserArgs,
): Promise<InviteInternalUserResult> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const email = args.email.trim().toLowerCase()
  const fullName = args.fullName.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' }
  }
  if (!isDbUserRole(args.role)) {
    return { error: `"${args.role}" is not a valid role.` }
  }

  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  // Step 1 — does a profile already exist for this email in the tenant?
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  let userId: string

  if (existing) {
    userId = existing.id
    const { error: updErr } = await admin
      .from('profiles')
      .update({
        role: args.role,
        full_name: fullName || undefined,
        department: args.department?.trim() || null,
        user_type: 'internal',
        ...(args.homeRoleId ? { home_role_id: args.homeRoleId } : {}),
        is_active: true,
      })
      .eq('id', userId)
    if (updErr) return { error: updErr.message }
  } else {
    // P0: Do NOT store role/tenant in auth.users.user_metadata
    // The P0 migration hardened handle_new_user trigger to NOT use metadata as authority
    // Step 2 — create the auth user. Sends the invite email when SMTP is set.
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${args.siteUrl}/auth/callback?next=/`,
    })

    if (inviteErr || !invited?.user) {
      return { error: inviteErr?.message ?? 'Failed to invite user.' }
    }
    userId = invited.user.id

    // The handle_new_user trigger creates the profile row, but it may not have
    // fired yet for an invite, so upsert to guarantee correct tenant/role.
    const { error: upsertErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        tenant_id: tenantId,
        email,
        full_name: fullName,
        role: args.role,
        department: args.department?.trim() || null,
        user_type: 'internal',
        ...(args.homeRoleId ? { home_role_id: args.homeRoleId } : {}),
        is_active: true,
      },
      { onConflict: 'id', ignoreDuplicates: false },
    )
    if (upsertErr) return { error: upsertErr.message }
  }

  // Step 3 — always produce a shareable link as an SMTP-independent fallback.
  //
  // We build the URL from `hashed_token` and point it at our own callback
  // (which calls verifyOtp) rather than returning Supabase's `action_link`.
  // action_link goes to /auth/v1/verify, which redirects back with the session
  // in the URL *fragment* — unreadable by a server route handler.
  let inviteLink: string | undefined
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = linkData?.properties?.hashed_token
  if (hashedToken) {
    inviteLink =
      `${args.siteUrl}/auth/callback` +
      `?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=/`
  }

  revalidatePath('/admin/users')
  return { userId, inviteLink, isExisting: !!existing }
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

    // Table is `audit_log` (singular) and the timestamp column is `changed_at`.
    // Querying the nonexistent `audit_logs`/`created_at` returned a PostgREST
    // error (which supabase-js does NOT throw, so the catch below never fired):
    // count came back null, `count ?? 0` made it 0, and the check reported
    // GREEN "0 changes" — indistinguishable from a genuinely quiet day.
    const { count, error } = await admin
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('changed_at', today.toISOString())

    if (error) {
      checks.push({
        key:    'audit_log_today',
        label:  'Audit log entries today',
        status: 'red',
        count:  -1,
        detail: `Audit log query failed: ${error.message}`,
      })
    } else {
      const n = count ?? 0
      checks.push({
        key:    'audit_log_today',
        label:  'Audit log entries today',
        // Zero rows is now meaningful rather than masking a broken query.
        status: n > 0 ? 'green' : 'amber',
        count:  n,
        detail: `${n} change${n !== 1 ? 's' : ''} recorded in audit_log since midnight UTC.`,
      })
    }
  } catch {
    checks.push({ key: 'audit_log_today', label: 'Audit log entries today', status: 'amber', count: -1, detail: 'Query failed.' })
  }

  // ── 5. Tables missing RLS ─────────────────────────────────────────────────
  // Query pg_tables for the known application tables and find those where
  // rowsecurity is false. Requires a security-definer RPC or service role.
  const KNOWN_TABLES = [
    'profiles', 'projects', 'approvals', 'approval_items', 'audit_log',
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
