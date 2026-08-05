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
