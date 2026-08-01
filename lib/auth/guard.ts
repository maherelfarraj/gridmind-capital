import 'server-only'
import {
  resolveActorState,
  actorFailureMessage,
  type ResolvedActor,
} from '@/lib/auth/actor'
import {
  isDbUserRole,
  isWriterRole,
  PLATFORM_ADMIN_ROLES,
  WRITER_ROLES,
  type DbUserRole,
} from '@/lib/auth/roles'

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
 *
 * ── Role vocabulary ──
 * This module owns NO role list. `lib/auth/roles.ts` is the single canonical
 * source for the `profiles.role` vocabulary; `isDbUserRole` and `DbUserRole`
 * are re-exported below purely so existing importers keep working.
 */

// Re-export (do not redefine) the canonical role validator and type.
export { isDbUserRole }
export type { DbUserRole }

/**
 * A validated caller. Every field is guaranteed non-null and in-vocabulary:
 * `getAuthActor()` returns `{ error }` rather than a partially valid actor.
 */
export type AuthActor = ResolvedActor

export type GuardResult = { actor: AuthActor } | { error: string }

/**
 * Roles allowed to manage tenant/user administration and override approval
 * assignments. Aliased to the canonical platform-admin group so the /admin
 * layout and the server-action guards cannot drift apart.
 */
export const ADMIN_ROLES: readonly DbUserRole[] = PLATFORM_ADMIN_ROLES

/** Roles allowed to decide/delegate approvals. */
export const APPROVER_ROLES: readonly DbUserRole[] = [
  'system_admin',
  'tenant_admin',
  'project_director',
  'project_manager',
  'finance_manager',
]

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
export async function getAuthActor(): Promise<GuardResult> {
  const state = await resolveActorState()

  // Distinct internal reasons (not_authenticated, profile_lookup_failed,
  // profile_missing, profile_inactive, tenant_missing, role_invalid) are
  // mapped to safe messages. Raw database errors are never surfaced, and the
  // invalid role value itself is not echoed back to the browser.
  if (state.kind === 'invalid') {
    return { error: actorFailureMessage(state.reason) }
  }

  return { actor: state.actor }
}

/**
 * Require an authenticated caller whose role is in `allowed`.
 * `allowed` is typed to the canonical vocabulary so a typo or a retired role
 * name is a compile error rather than a permanently-denying guard.
 */
export async function requireRole(allowed: readonly DbUserRole[]): Promise<GuardResult> {
  const res = await getAuthActor()
  if ('error' in res) return res
  if (!allowed.includes(res.actor.role)) return { error: 'Not authorized' }
  return res
}

/**
 * Backward-compatible alias for the canonical writer group.
 *
 * There is exactly ONE writer classification, the exhaustive
 * `WRITE_ACCESS_BY_ROLE` record in lib/auth/roles.ts. This module re-exports it
 * and derives nothing of its own — an exclusion-based derivation here would be
 * fail-open for any role added to DB_USER_ROLES later.
 */
export const INTERNAL_ROLES: readonly DbUserRole[] = WRITER_ROLES
export { WRITER_ROLES }

/**
 * Require an authenticated caller whose role is classified as a writer.
 * Read-only roles (viewer, subcontractor, client_viewer) are rejected.
 */
export async function requireWriter(): Promise<GuardResult> {
  const res = await getAuthActor()
  if ('error' in res) return res

  // res.actor.role is a validated DbUserRole, so no null check is needed.
  if (!isWriterRole(res.actor.role)) {
    return { error: 'Not authorized: this role cannot write' }
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
  if (ADMIN_ROLES.includes(res.actor.role)) {
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
export async function requireInternalRole(
  allowed: readonly DbUserRole[],
): Promise<{ userId: string; profile: AuthActor }> {
  const res = await getAuthActor()
  if ('error' in res) {
    throw new Error(res.error)
  }

  const actor = res.actor

  // actor.role and actor.tenantId are already validated non-null by
  // getAuthActor(); re-querying or re-deriving a weaker value here would
  // reintroduce the second authorization algorithm this batch removed.
  if (!allowed.includes(actor.role)) {
    throw new Error(
      `Unauthorized: User role '${actor.role}' not in allowed list [${allowed.join(', ')}]`,
    )
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
