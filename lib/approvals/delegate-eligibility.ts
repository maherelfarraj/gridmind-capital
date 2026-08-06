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
  /**
   * Explicit set of profile ids that must NEVER appear as delegates, whatever
   * their role. Callers pass every disqualified identity here — the approval's
   * requester, the current-step assignee, and the authenticated actor — so a
   * privileged role (e.g. tenant_admin) can never re-admit a person who must be
   * excluded for segregation-of-duties reasons. Normalized to a Set internally;
   * null/undefined/blank entries are ignored. Listing these explicitly (rather
   * than deriving them) is fail-closed: a caller that forgets one still gets a
   * correct-by-construction Set, and the RPC re-enforces the same exclusions.
   */
  excludedIds: readonly string[]
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
  return isEligibleDelegateWith(candidate, ctx, normalizeExcludedIds(ctx.excludedIds))
}

/** Build a Set of the ids to exclude, ignoring null/undefined/blank entries. */
export function normalizeExcludedIds(
  ids: readonly (string | null | undefined)[] | undefined,
): Set<string> {
  const set = new Set<string>()
  for (const id of ids ?? []) {
    if (typeof id === 'string') {
      const trimmed = id.trim()
      if (trimmed) set.add(trimmed)
    }
  }
  return set
}

/**
 * Internal: eligibility check against a pre-built exclusion Set. The exclusion
 * check runs FIRST so no role branch below can re-admit a disqualified id.
 */
function isEligibleDelegateWith(
  candidate: DelegateCandidate,
  ctx: EligibilityContext,
  excluded: Set<string>,
): boolean {
  if (!candidate) return false
  if (!isUuid(candidate.id)) return false
  // Segregation of duties: an explicitly-excluded id is never eligible, no
  // matter its role. Checked before every role branch so admin cannot re-admit.
  if (excluded.has(candidate.id.trim())) return false
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
 * The exclusion Set is built once and shared across all candidates.
 */
export function filterEligibleDelegates(
  candidates: DelegateCandidate[],
  ctx: EligibilityContext,
): DelegateCandidate[] {
  const excluded = normalizeExcludedIds(ctx.excludedIds)
  return candidates.filter((c) => isEligibleDelegateWith(c, ctx, excluded))
}
