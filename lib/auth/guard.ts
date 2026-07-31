import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Centralized authentication + role guards for server actions.
 *
 * Every mutating server action uses the service-role admin client (which
 * bypasses RLS) to perform its data operation. Because RLS is bypassed, the
 * action MUST authenticate the caller and check their role BEFORE touching
 * data. These helpers provide that gate.
 *
 * Usage:
 *   const gate = await requireWriter()
 *   if ('error' in gate) return gate   // { error: string }
 *   // ...proceed with createAdminClient() data operation using gate.actor
 */

export interface AuthActor {
  userId: string
  role: string
  tenantId: string | null
  isActive: boolean
}

export type GuardResult = { actor: AuthActor } | { error: string }

/** Canonical whitelist of all valid roles (matches DB CHECK constraint) */
export const CANONICAL_ROLES = [
  'system_admin', 'tenant_admin', 'project_director', 'project_manager',
  'engineer', 'hse_manager', 'commissioning_manager', 'finance_manager',
  'commercial_manager', 'viewer', 'subcontractor', 'client_viewer'
] as const

/** Validator: Is this role in the canonical whitelist? */
export function isDbUserRole(role: unknown): role is typeof CANONICAL_ROLES[number] {
  return typeof role === 'string' && CANONICAL_ROLES.includes(role as typeof CANONICAL_ROLES[number])
}

/** Roles allowed to manage tenant/user administration and override approval assignments. */
export const ADMIN_ROLES = ['system_admin', 'tenant_admin'] as const

/** Roles allowed to decide/delegate approvals. */
export const APPROVER_ROLES = [
  'system_admin',
  'tenant_admin',
  'project_director',
  'project_manager',
  'finance_manager',
] as const

/**
 * Resolve the authenticated caller and their profile role.
 * FAIL-CLOSED: Returns { error } if:
 *   - Not authenticated
 *   - Profile does not exist (signup not yet provisioned)
 *   - Profile is inactive
 *   - Profile has invalid/null tenant_id (unprovisioned)
 *   - Profile role is not in canonical whitelist
 *
 * Wrapped in React cache() to dedupe per HTTP request.
 */
export const getAuthActor = cache(async (): Promise<GuardResult> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Read the caller's profile via the admin client
  // (lookup itself is not subject to RLS visibility rules)
  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    .select('role, tenant_id, is_active')
    .eq('id', user.id)
    .single()

  // FAIL-CLOSED: Profile must exist
  if (error || !profile) {
    return { error: 'User profile not found. Contact administrator.' }
  }

  // FAIL-CLOSED: User must be active
  if (!profile.is_active) {
    return { error: 'User account is inactive. Contact administrator.' }
  }

  // FAIL-CLOSED: User must have a provisioned tenant
  if (!profile.tenant_id) {
    return { error: 'User is not provisioned to any tenant. Contact administrator.' }
  }

  // FAIL-CLOSED: Role must be in canonical whitelist (no silent downgrade to viewer)
  if (!isDbUserRole(profile.role)) {
    return { error: `Invalid or missing role: ${profile.role}` }
  }

  return {
    actor: {
      userId: user.id,
      role: profile.role,
      tenantId: profile.tenant_id,
      isActive: profile.is_active,
    },
  }
})

/** Require an authenticated caller whose role is in `allowed`. */
export async function requireRole(allowed: readonly string[]): Promise<GuardResult> {
  const res = await getAuthActor()
  if ('error' in res) return res
  if (!allowed.includes(res.actor.role)) return { error: 'Not authorized' }
  return res
}

/** Require an authenticated caller who is NOT a read-only viewer. */
export async function requireWriter(): Promise<GuardResult> {
  const res = await getAuthActor()
  if ('error' in res) return res
  
  // Only accept internal roles from DB CHECK constraint
  const INTERNAL_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'engineer', 'hse_manager', 'commissioning_manager', 'finance_manager', 'commercial_manager']
  
  if (!res.actor.role || !INTERNAL_ROLES.includes(res.actor.role)) {
    return { error: 'Not authorized: external roles cannot write' }
  }
  
  return res
}

/** Convenience: admin-only (system_admin / tenant_admin). */
export function requireAdmin(): Promise<GuardResult> {
  return requireRole(ADMIN_ROLES)
}

/** Convenience: approval decision/delegation roles. */
export function requireApprover(): Promise<GuardResult> {
  return requireRole(APPROVER_ROLES)
}

/** Convenience: project deletion — restricted to admins and project director. */
export function requireProjectDirector(): Promise<GuardResult> {
  return requireRole(['system_admin', 'tenant_admin', 'project_director'] as const)
}

/**
 * Verify that the caller is authorized to act on an approval.
 *
 * Authorization is granted if:
 * 1. Caller is the assigned approver (approval.assignee_id === actor.userId), OR
 * 2. Caller is system_admin or tenant_admin (admin override)
 *
 * Admin overrides are logged with a note for audit trail.
 * Returns { error: 'Not the assigned approver' } if unauthorized.
 */
export async function requireAssignedApprover(
  approval: { assignee_id?: string | null } | null,
): Promise<GuardResult> {
  const res = await getAuthActor()
  if ('error' in res) return res

  if (!approval?.assignee_id) {
    return { error: 'Approval has no assigned approver' }
  }

  // Caller is the assigned approver — authorized.
  if (res.actor.userId === approval.assignee_id) {
    return res
  }

  // Admin override check.
  if (ADMIN_ROLES.includes(res.actor.role as typeof ADMIN_ROLES[number])) {
    // Admin is allowed; caller should log this as an override in the action.
    return res
  }

  return { error: 'Not the assigned approver' }
}

/**
 * Guard: Require authenticated, active, provisioned user.
 * FAIL-CLOSED: Throws if user is missing, unprovisioned, inactive, or invalid.
 *
 * Use at the start of every exported mutation to ensure:
 * 1. User is authenticated (session exists)
 * 2. User profile exists and is active
 * 3. User is provisioned (tenant_id is not null)
 * 4. User has canonical role
 *
 * getAuthActor() already enforces all these checks; requireUser() adds explicit guard.
 * Returns { userId, profile } on success, throws on error.
 */
export async function requireUser(): Promise<{ userId: string; profile: AuthActor }> {
  const res = await getAuthActor()
  if ('error' in res) {
    throw new Error(res.error)
  }
  return { userId: res.actor.userId, profile: res.actor }
}

/**
 * Guard: Require user with one of the specified internal roles.
 * FAIL-CLOSED: Throws if user is not authenticated, inactive, unprovisioned, or role not allowed.
 *
 * Use this for operations restricted to admins or staff.
 * Never pass untrusted user-submitted role values.
 *
 * Returns { userId, profile } on success, throws on error.
 */
export async function requireInternalRole(allowed: readonly string[]): Promise<{ userId: string; profile: AuthActor }> {
  const res = await getAuthActor()
  if ('error' in res) {
    throw new Error(res.error)
  }

  const actor = res.actor
  
  // Verify role is in allowed list
  if (!actor.role || !allowed.includes(actor.role)) {
    throw new Error(`Unauthorized: User role '${actor.role}' not in allowed list [${allowed.join(', ')}]`)
  }

  // Verify tenant (getAuthActor already checked, but be explicit)
  if (!actor.tenantId) {
    throw new Error('User is not provisioned to any tenant.')
  }

  return { userId: actor.userId, profile: actor }
}

/**
 * Verify role argument is in the whitelist for external user invites.
 * Prevents callers from self-assigning admin roles.
 * Allowed: 'subcontractor', 'client_viewer' (no 'vendor' — removed in Batch 18 Phase 1).
 *
 * Throws error if role is not in the allowed list.
 */
export async function validateExternalRole(role: string): Promise<string> {
  const allowed = ['subcontractor', 'client_viewer']
  const valid = allowed.includes(role)
  if (!valid) {
    throw new Error(`Invalid external role '${role}'. Allowed: ${allowed.join(', ')}`)
  }
  return role
}
