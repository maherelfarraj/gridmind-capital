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

/** Roles allowed to manage tenant/user administration. */
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
 */
export async function getAuthActor(): Promise<GuardResult> {
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
}

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
  if (res.actor.role === 'viewer') return { error: 'Not authorized' }
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
