'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireInternalRole, isDbUserRole } from '@/lib/auth/guard'
import {
  activateUser as activateUserAuthority,
  changeUserRole,
  deactivateUser as deactivateUserAuthority,
  provisionInternalUser,
  provisionInvitedUser,
} from '@/lib/auth/provisioning'
import { getCurrentTenantId } from '@/lib/tenant'
import { isInternalIdentity } from '@/lib/admin/external-identity'
import { revertExternalConversion } from '@/lib/admin/revert-conversion-service'

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
  /**
   * The real authorization state, straight from `profiles.is_active`.
   *
   * This used to be absent from the projection entirely, and the UI inferred
   * status from `department === 'Deactivated'` — a leftover from the old
   * lossy soft-delete that `deactivateUser` no longer performs. No row in
   * production carries that marker, so every user rendered as Active
   * regardless of `is_active`, and a deactivation appeared to revert on
   * refresh even when the write had succeeded.
   */
  is_active: boolean
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
  try {
    await requireInternalRole(['system_admin', 'tenant_admin'])
  } catch (e: any) {
    return { error: e.message }
  }
  const tenantId = await getCurrentTenantId()

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
    .select('id, full_name, email, role, user_type, department, avatar_url, created_at, last_active, is_active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data
    // The Internal users tab lists internal identities only. External users are
    // governed by the External access tab, which also shows their organisation
    // and project grants. Listing them here presented a subcontractor as a
    // colleague and offered internal-only actions on them.
    //
    // Filtered on role OR user_type, matching the canonical containment
    // predicate (which keys off role). Production holds a profile that is
    // external by role and internal by column, and it must not appear here.
    .filter((u) => isInternalIdentity({ role: u.role, user_type: u.user_type }))
    .map((u): UserProfile => ({
      id: u.id,
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      role: u.role ?? 'viewer',
      department: u.department ?? null,
      avatar_url: u.avatar_url ?? null,
      created_at: u.created_at ?? '',
      last_seen_at: u.last_active ?? null,
      // Default to false, not true: an unreadable flag must not render a
      // deactivated account as Active.
      is_active: u.is_active === true,
    }))
}

/**
 * Change a user's role.
 *
 * Delegates entirely to the canonical provisioning service. The previous
 * implementation duplicated the authorization matrix inline AND wrote its audit
 * row with the wrong contract (`actor_id`/`resource_type`/`resource_id`/
 * `details`/`timestamp`, and a non-DML `action`), so every one of those audit
 * inserts was rejected by PostgREST and the CHECK constraint. The error was
 * swallowed by a try/catch that could never fire, because supabase-js returns
 * errors rather than throwing — the role change looked audited and was not.
 */
export async function updateUserRole(userId: string, role: string): Promise<{ error?: string }> {
  if (!isDbUserRole(role)) {
    return { error: `"${role}" is not a valid role.` }
  }

  const res = await changeUserRole({ userId, role })
  if ('error' in res) return { error: res.error }

  revalidatePath('/admin/users')
  return {}
}

// ─────────────────────────────────────────────────────────────
// Repair: reverse an unintended internal → external conversion
// ─────────────────────────────────────────────────────────────

/**
 * Restore an account that the external invite flow converted into an external
 * identity by mistake.
 *
 * Admin-gated and audited. The values restored are read out of the conversion's
 * own audit row, so this cannot be used to set an arbitrary role: if the audit
 * trail does not prove what the account was, or the account has changed since,
 * the reversal is refused.
 */
export async function revertUnintendedExternalConversion(
  email: string,
  opts?: { dryRun?: boolean },
): Promise<{ error?: string; restoredTo?: { role: string; user_type: string }; revokedGrants?: number }> {
  let actorId: string
  try {
    const { userId } = await requireInternalRole(['tenant_admin', 'system_admin'])
    actorId = userId
  } catch (e: any) {
    return { error: e.message }
  }

  const res = await revertExternalConversion(createAdminClient(), {
    email,
    actorId,
    dryRun: opts?.dryRun,
  })
  if ('error' in res) return { error: res.error }

  revalidatePath('/admin/users')
  return {
    restoredTo: { role: res.plan.patch.role, user_type: res.plan.patch.user_type },
    revokedGrants: res.revokedGrants,
  }
}

// ─────────────────────────────────────────────────────────────
// Invite (internal staff)
// ────────────────────────────────────────────────���────────────

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
  try {
    await requireInternalRole(['system_admin', 'tenant_admin'])
  } catch (e: any) {
    return { error: e.message }
  }

  const email = args.email.trim().toLowerCase()
  const fullName = args.fullName.trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' }
  }
  if (!isDbUserRole(args.role)) {
    return { error: `"${args.role}" is not a valid role.` }
  }
  // Captured after narrowing: the guard above does not survive into the async
  // closure below, where args.role would widen back to string.
  const role = args.role

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
  // Must describe THIS operation: it decides whether a failure below cancels a
  // brand-new invitation or deletes a pre-existing colleague's account.
  let wasNewlyInvited = false

  if (existing) {
    userId = existing.id
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
    wasNewlyInvited = true
  }

  // Step 2b — write the display row, then apply authority. Both run under
  // compensation: if either fails for a user we just created, the pending Auth
  // identity is removed rather than left able to sign in with no provisioning.
  const provisioned = await provisionInvitedUser({
    userId,
    wasNewlyInvited,
    provision: async () => {
      // Non-authority display fields only. The handle_new_user trigger creates
      // the row; this fills in the name without touching any protected field.
      // Authority is applied by the canonical service, which is what enforces
      // "tenant_admin may not invite a system_admin".
      const { error: nameErr } = await admin
        .from('profiles')
        .upsert({ id: userId, email, full_name: fullName }, { onConflict: 'id' })
      if (nameErr) return { error: nameErr.message }

      return provisionInternalUser({
        userId,
        role,
        tenantId,
        department: args.department?.trim() || null,
        homeRoleId: args.homeRoleId ?? null,
        isActive: true,
        // Same provenance that authorizes compensation to delete this auth
        // user: true only when the invite above created it. Lets the service
        // adopt the tenantless fail-closed shell handle_new_user just wrote.
        adoptNewlyInvited: wasNewlyInvited,
        reason: existing ? 'reinvite_existing_profile' : 'invite_new_user',
      })
    },
  })
  if ('error' in provisioned) return { error: provisioned.error }

  // Everything below is DELIVERY, not provisioning. A failure to mint a link
  // must not delete a correctly provisioned user — the account is valid and the
  // link can be regenerated.

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

/**
 * Deactivate a user.
 *
 * This used to "soft-delete" by setting role='viewer' and
 * department='Deactivated'. That was not deactivation: `is_active` stayed true
 * so the account could still sign in, the user's real role was destroyed (so
 * reactivation could not restore it), and a free-text department string is not
 * an authorization state. It now delegates to the canonical operation, which
 * sets is_active = false and nothing else.
 */
export async function deactivateUser(userId: string): Promise<{ error?: string }> {
  const res = await deactivateUserAuthority({ userId })
  if ('error' in res) return { error: res.error }

  revalidatePath('/admin/users')
  return {}
}

/** Reactivate a previously deactivated user. */
export async function activateUser(userId: string): Promise<{ error?: string }> {
  const res = await activateUserAuthority({ userId })
  if ('error' in res) return { error: res.error }

  revalidatePath('/admin/users')
  return {}
}

// ─────────────────────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────────────────────

export interface ResetPasswordArgs {
  userId: string
}

export interface ResetPasswordResult {
  success?: boolean
  error?: string
}

/**
 * Initiate a password reset for a user.
 *
 * Admin-gated authorization:
 * - system_admin: can reset any user's password
 * - tenant_admin: can reset passwords for users in the same tenant only
 *
 * Sends a Supabase password recovery email (no tokens/links returned).
 * Records an audit event.
 */
export async function resetUserPassword(
  args: ResetPasswordArgs,
): Promise<ResetPasswordResult> {
  // Verify authorization and capture actor once
  let actor: any
  try {
    actor = await requireInternalRole(['system_admin', 'tenant_admin'])
  } catch (e: any) {
    return { error: e.message }
  }

  const admin = createAdminClient()
  const actorRole = actor.profile.role
  const actorTenantId = actor.profile.tenantId
  const actorUserId = actor.userId

  // Verify user exists and enforce tenant isolation for tenant_admin
  try {
   const { data, error: userError } = await admin.auth.admin.getUserById(args.userId)
const user = data.user

if (userError || !user) {
  return { error: 'User not found.' }
}

const targetEmail = user.email
if (!targetEmail) {
  return { error: 'User has no email address.' }
}

    // tenant_admin: can only reset passwords for users in the same tenant
    if (actorRole === 'tenant_admin') {
      const { data: profile } = await admin
        .from('profiles')
        .select('tenant_id')
        .eq('id', args.userId)
        .maybeSingle()

      if (!profile || profile.tenant_id !== actorTenantId) {
        return { error: 'Unauthorized: cannot reset password for users outside your tenant.' }
      }
    }

        // Send password reset email via Supabase Auth
    const { error: resetError } = await admin.auth.resetPasswordForEmail(
      targetEmail,
      {
        redirectTo:
          process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
          'https://www.gridmindepc.com/auth/update-password',
      },
    )

    if (resetError) {
      return { error: resetError.message ?? 'Failed to send password reset email.' }
    }

    // Record audit event after successful email send
    try {
      const auditTenantId = actorRole === 'system_admin' ? null : actorTenantId
      await admin.from('audit_log').insert({
        tenant_id: auditTenantId,
        table_name: 'auth.users',
        record_id: args.userId,
        action: 'update',
        op: 'password_reset_initiated',
        old_values: null,
        new_values: null,
        changed_by: actorUserId,
      })
    } catch {
      // Audit failure should not block the reset
    }

    return { success: true }
  } catch (e: any) {
    return { error: `Password reset failed: ${e.message}` }
  }
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
  try {
    await requireInternalRole(['system_admin', 'tenant_admin'])
  } catch (e: any) {
    return { error: e.message }
  }
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
