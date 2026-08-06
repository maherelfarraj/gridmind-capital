/**
 * Pure, dependency-free helpers for gate-approval routing decisions.
 *
 * These encode the branch conditions used by app/actions/approvals.ts so they
 * can be unit-tested in the `node` vitest environment without a database, a
 * Supabase client, or Next.js request context. The server action imports these
 * and must not re-implement the logic inline (a divergence would be caught by
 * the drift test in tests/unit/gate-routing.test.ts).
 */

export type GateDecision = 'proceed' | 'conditional_proceed' | 'hold' | 'reject'

/**
 * True when a gate workflow is missing its gate number.
 *
 * Uses an EXPLICIT null/undefined check, never truthiness, so that gate
 * number 0 is treated as present. Only meaningful for object_type === 'gate';
 * non-gate objects never require a gate number.
 */
export function isGateNumberMissing(
  objectType: string,
  gateNumber: number | null | undefined,
): boolean {
  if (objectType !== 'gate') return false
  return gateNumber === null || gateNumber === undefined
}

/**
 * The duplicate-workflow message. Gate workflows get a gate-specific message
 * naming the exact gate; every other object type gets a generic message that
 * names the object type instead.
 */
export function duplicateWorkflowMessage(
  objectType: string,
  gateNumber: number | null | undefined,
): string {
  if (objectType === 'gate') {
    return `Workflow already pending or delegated for gate ${gateNumber}`
  }
  return `Workflow already pending or delegated for this ${objectType}`
}

/**
 * Whether a decision on a gate approval should be routed through the atomic
 * decide_gate_approval RPC. Every gate decision must be, so that the whole
 * transition is one transaction; non-gate objects use the legacy path.
 */
export function shouldRouteGateDecisionToRpc(objectType: string | null | undefined): boolean {
  return objectType === 'gate'
}

/**
 * Whether the acting user is exercising an admin override: an admin deciding an
 * approval they are not themselves assigned to. Requires BOTH an admin role and
 * that the actor is not the assignee — an admin who IS the assignee is on the
 * normal path, not an override.
 */
export function isAdminOverride(
  actorRole: string | null | undefined,
  actorUserId: string,
  assigneeId: string | null | undefined,
  adminRoles: readonly string[],
): boolean {
  if (!actorRole) return false
  if (!adminRoles.includes(actorRole)) return false
  return actorUserId !== assigneeId
}

/**
 * The single, canonical error/message for a requester attempting to act on
 * their own gate approval. Segregation of duties: the person who REQUESTED a
 * gate decision may never decide, hold, reject, or delegate it — not even a
 * system_admin / tenant_admin exercising an "admin override". This one string is
 * shared by the UI gating, the server action, and (in spirit) the RPC error so
 * the boundaries never present divergent language for the same refusal.
 */
export const REQUESTER_SELF_ACTION_MESSAGE =
  'You cannot act on an approval you requested.'

/**
 * True when the acting user is the requester of the approval. Pure and total.
 *
 * This is a SEGREGATION-OF-DUTIES check, entirely independent of assignment and
 * admin-override: an admin override lets an admin act on a step assigned to
 * someone else, but it must NEVER let anyone act on an approval they themselves
 * requested. Callers must therefore evaluate this BEFORE any assignment/override
 * logic. Returns false only when either id is missing (nothing to compare) —
 * the real enforcement boundaries (server action + RPC) always supply both.
 */
export function isRequesterSelfAction(
  actorUserId: string | null | undefined,
  requesterId: string | null | undefined,
): boolean {
  if (!actorUserId || !requesterId) return false
  return actorUserId === requesterId
}
