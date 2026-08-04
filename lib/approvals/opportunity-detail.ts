import type { G0FormData } from '@/app/actions/gate-submissions'

/**
 * Real project data plumbing for the opportunity approval-detail view.
 *
 * ⚠️ THE PLACEHOLDER TRAP — read before touching this file.
 * The production approval e4aa843b… rendered "Opportunity Name: PRJ-2026-384 /
 * Code: OPP-OPPORTUNITY-2026 / Submitted By: Project Manager / Capacity: blank"
 * because the detail page did NOT resolve approvals.object_id → projects.id.
 * Instead it synthesised a plausible-looking opportunity from approval metadata
 * (`OPP-${object_type}-2026`, hardcoded "Solar PV", a DEFAULT_REQUESTER named
 * "Project Manager"). Those values look real and are entirely fabricated.
 *
 * This module is the single source of truth for that mapping. Its contract:
 *   1. It NEVER fabricates business data. If the linked project is missing it
 *      returns an explicit `available: false` state, not a guess.
 *   2. It NEVER emits an `OPP-…-2026` synthesised code or a generic
 *      "Project Manager" requester. Those exact strings are what the bug
 *      produced, so a regression test asserts they can never appear.
 *   3. Tenant isolation is enforced twice: the query filters by tenant AND this
 *      mapper refuses any project row whose tenant_id differs from the
 *      approval's (a stale/forged object_id pointing at another tenant's
 *      project resolves to the unavailable state, never to that project).
 */

/** Raw approvals row (only the fields this view needs). */
export interface RawApproval {
  id: string
  tenant_id: string | null
  object_type: string | null
  object_id: string | null
  title: string | null
  status: string | null
  priority: string | null
  created_at: string | null
  description: string | null
  requester_id?: string | null
  amount?: number | null
}

/** Raw projects row (only the fields this view needs). */
export interface RawProject {
  id: string
  tenant_id: string | null
  name: string | null
  code: string | null
  technology: string | null
  capacity_mw: number | string | null
  location: string | null
  country: string | null
  target_completion: string | null
  status: string | null
}

/** Raw profiles row for the requester. */
export interface RawRequester {
  id: string
  tenant_id: string | null
  full_name: string | null
  email: string | null
  role: string | null
}

/** The requester shape consumed by G0ApprovalReview's UserProfile. */
export interface RequesterView {
  id: string
  name: string
  email: string
  role: string
  department: string
  initials: string
  avatarColor?: string
  /** false when no requester profile could be resolved (explicit unknown). */
  available: boolean
}

/** Real linked-project panel data, or an explicit unavailable marker. */
export interface LinkedProjectView {
  /** true only when a same-tenant project row was resolved. */
  available: boolean
  /** The object_id we attempted to resolve (shown in the unavailable state). */
  attemptedId: string | null
  id: string | null
  name: string | null
  code: string | null
  technology: string | null
  capacityMw: string | null
  location: string | null
  country: string | null
  targetCompletion: string | null
  status: string | null
}

export interface OpportunityApprovalView {
  /** true only when object_type is 'opportunity' AND a same-tenant project resolved. */
  projectAvailable: boolean
  linkedProject: LinkedProjectView
  requester: RequesterView
  /**
   * Partial G0 form data built from REAL project fields, so the existing
   * G0ApprovalReview surface renders real values. Empty (→ em dashes in the UI)
   * when the project is unavailable — never synthesised.
   */
  opportunity: Partial<G0FormData>
}

const UNAVAILABLE_LINKED_PROJECT = (attemptedId: string | null): LinkedProjectView => ({
  available: false,
  attemptedId,
  id: null,
  name: null,
  code: null,
  technology: null,
  capacityMw: null,
  location: null,
  country: null,
  targetCompletion: null,
  status: null,
})

const UNAVAILABLE_REQUESTER: RequesterView = {
  id: '',
  name: 'Requester unavailable',
  email: '',
  role: '',
  department: '',
  initials: '?',
  available: false,
}

export function computeInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function capacityToString(v: number | string | null): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Resolve the linked project for an approval, enforcing tenant isolation.
 * Returns null (→ unavailable state) when:
 *   - the approval is not an opportunity, or has no object_id;
 *   - no project row was found;
 *   - the found project belongs to a DIFFERENT tenant than the approval.
 * The last check is defense-in-depth: the DB query is already tenant-scoped,
 * but a mapper that trusted its input could leak a cross-tenant project.
 */
export function resolveLinkedProject(
  approval: Pick<RawApproval, 'object_type' | 'object_id' | 'tenant_id'>,
  project: RawProject | null | undefined,
): RawProject | null {
  if (approval.object_type !== 'opportunity') return null
  if (!approval.object_id) return null
  if (!project) return null
  if (project.id !== approval.object_id) return null
  // Tenant isolation: never resolve another tenant's project.
  if (project.tenant_id !== approval.tenant_id) return null
  return project
}

function buildRequester(
  approval: RawApproval,
  requester: RawRequester | null | undefined,
): RequesterView {
  // Only accept a same-tenant requester profile; otherwise stay explicitly unknown.
  if (!requester || requester.tenant_id !== approval.tenant_id) {
    return UNAVAILABLE_REQUESTER
  }
  const name = requester.full_name?.trim() || requester.email?.trim() || 'Unknown user'
  return {
    id: requester.id,
    name,
    email: requester.email ?? '',
    role: requester.role ?? '',
    department: '',
    initials: computeInitials(requester.full_name ?? requester.email),
    available: true,
  }
}

function buildOpportunity(project: RawProject | null): Partial<G0FormData> {
  if (!project) return {}
  const siteLocation = [project.location, project.country].filter(Boolean).join(', ')
  const opp: Partial<G0FormData> = {}
  if (project.name) opp.opportunityName = project.name
  if (project.code) opp.opportunityCode = project.code
  if (project.technology) {
    opp.technologyType = project.technology
    opp.technology = project.technology
  }
  const cap = capacityToString(project.capacity_mw)
  if (cap) {
    opp.estimatedCapacityMw = cap
    opp.capacityMwp = cap
  }
  if (siteLocation) opp.siteLocation = siteLocation
  if (project.country) opp.hostCountry = project.country
  return opp
}

/**
 * Map an opportunity approval + its (possibly missing) linked project + requester
 * profile into the view model consumed by the detail page. Pure and total: given
 * the same inputs it always returns the same output and never throws.
 */
export function mapOpportunityApprovalDetail(input: {
  approval: RawApproval
  project: RawProject | null | undefined
  requester: RawRequester | null | undefined
}): OpportunityApprovalView {
  const { approval } = input
  const project = resolveLinkedProject(approval, input.project)

  const linkedProject: LinkedProjectView = project
    ? {
        available: true,
        attemptedId: approval.object_id,
        id: project.id,
        name: project.name,
        code: project.code,
        technology: project.technology,
        capacityMw: capacityToString(project.capacity_mw),
        location: project.location,
        country: project.country,
        targetCompletion: project.target_completion,
        status: project.status,
      }
    : UNAVAILABLE_LINKED_PROJECT(approval.object_id)

  return {
    projectAvailable: project !== null,
    linkedProject,
    requester: buildRequester(approval, input.requester),
    opportunity: buildOpportunity(project),
  }
}
