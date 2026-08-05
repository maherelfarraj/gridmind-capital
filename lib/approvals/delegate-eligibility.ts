/**
 * Governed eligibility rules for delegating a gate approval.
 *
 * ⚠️ WHY THIS EXISTS — the delegate picker used to be a hard-coded list of five
 * fake email addresses (ceo@gridmind.capital, cfo@…, …). Those are not real
 * profile ids, so the UI could only ever send a string that `delegate_gate_approval`
 * would reject. This module defines who is a *real* eligible delegate, keyed on
 * UUID profile ids, so the UI offers only people the RPC will actually accept.
 *
 * A delegate is eligible only when ALL hold:
 *   - the profile is active;
 *   - the profile is in the same tenant as the approval;
 *   - the profile is authorized to act on approvals at all (role ∈ approverRoles);
 *   - the profile is eligible for the CURRENT step's required role, i.e. its role
 *     equals the step's required role, OR it is a validated tenant/system admin.
 *
 * Pure and total: same inputs, same output, never throws. The database RPC
 * independently re-verifies every one of these facts, so this is a UX filter,
 * never the security boundary.
 */

export interface DelegateCandidate {
  id: string
  tenantId: string | null
  role: string | null
  isActive: boolean
  name?: string | null
}

export interface EligibilityContext {
  /** Tenant the approval belongs to. */
  tenantId: string
  /** Role required by the current pending step (null when unknown). */
  requiredRole: string | null
  /** Roles authorized to act on approvals at all. */
  approverRoles: readonly string[]
  /** Roles that may act on any step regardless of required role. */
  adminRoles: readonly string[]
  /** Profile id to exclude (e.g. the current approver delegating away). */
  excludeId?: string | null
}

/** UUID (any version) matcher. Email strings and other non-UUIDs fail. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim())
}

/**
 * True iff `candidate` may receive a delegation for the given context.
 */
export function isEligibleDelegate(
  candidate: DelegateCandidate,
  ctx: EligibilityContext,
): boolean {
  if (!candidate) return false
  if (!isUuid(candidate.id)) return false
  if (ctx.excludeId && candidate.id === ctx.excludeId) return false
  if (!candidate.isActive) return false
  if (candidate.tenantId !== ctx.tenantId) return false
  const role = candidate.role
  if (!role) return false
  // Must be authorized to act on approvals at all.
  if (!ctx.approverRoles.includes(role)) return false
  // Admins are eligible for any step; others must match the required role.
  if (ctx.adminRoles.includes(role)) return true
  if (ctx.requiredRole && role === ctx.requiredRole) return true
  return false
}

/**
 * Filter a candidate list down to eligible delegates, preserving input order.
 */
export function filterEligibleDelegates(
  candidates: DelegateCandidate[],
  ctx: EligibilityContext,
): DelegateCandidate[] {
  return candidates.filter((c) => isEligibleDelegate(c, ctx))
}
