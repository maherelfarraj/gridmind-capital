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
}

export type GuardResult = { actor: AuthActor } | { error: string }

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
 * Returns { error } when not authenticated.
 *
 * Wrapped in React cache() to dedupe per HTTP request.
 */
export const getAuthActor = cache(async (): Promise<GuardResult> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Read the caller's role via the admin client so the lookup itself
  // is not subject to RLS visibility rules.
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  return {
    actor: {
      userId: user.id,
      role: profile?.role ?? 'viewer',
      tenantId: profile?.tenant_id ?? null,
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
  
  // Only accept internal roles: system_admin, tenant_admin, staff, approver, project_director, project_manager
  const INTERNAL_ROLES = ['system_admin', 'tenant_admin', 'staff', 'approver', 'project_director', 'project_manager']
  
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
