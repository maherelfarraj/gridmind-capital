import {
  REQUIRED_COMMERCIAL_MILESTONES,
  REQUIRED_FINANCIAL_CHECKPOINTS,
  REQUIRED_DELIVERABLES,
  REQUIRED_STAFFING_ROLES,
  type G3FormData,
} from '@/lib/gates/g3-requirements'

/**
 * Gate approval detail plumbing (object_type='gate').
 *
 * ⚠️ WHY THIS EXISTS — read before touching.
 * The /approvals/[id] page always used getOpportunityApprovalDetail +
 * G0ApprovalReview. For a gate approval (object_type='gate') that rendered G0
 * "opportunity" labels, a fabricated opportunity code, and a "linked project
 * unavailable" panel for a project that is perfectly valid — because the loader
 * only ever resolved approvals.object_id as an *opportunity* project, never as
 * the gate's own project.
 *
 * This module is the single source of truth for mapping a gate approval + its
 * project + phase gate + submission form_data + steps + requester + selected
 * deliverable documents + selected staffing people into the G3 review view.
 * Its contract mirrors opportunity-detail.ts:
 *   1. It NEVER fabricates business data. Missing pieces render explicit
 *      "Not completed" / "Not uploaded" / "Unassigned" / unavailable states.
 *   2. It NEVER emits G0 / opportunity labels for a gate.
 *   3. Tenant isolation is enforced: a project or requester whose tenant_id
 *      differs from the approval's resolves to the unavailable state.
 *   4. It is PURE and total — same inputs, same output, never throws.
 */

export interface RawGateApproval {
  id: string
  tenant_id: string | null
  object_type: string | null
  object_id: string | null
  gate_number: number | null
  title: string | null
  status: string | null
  priority: string | null
  created_at: string | null
  description: string | null
  decision_note: string | null
  requester_id?: string | null
  assignee_id?: string | null
}

export interface RawGateProject {
  id: string
  tenant_id: string | null
  name: string | null
  code: string | null
  technology: string | null
  capacity_mw: number | string | null
  location: string | null
  country: string | null
  status: string | null
  current_phase: number | null
}

export interface RawPhaseGate {
  phase_number: number | null
  phase_name: string | null
  status: string | null
}

export interface RawGateSubmission {
  form_data: unknown
  status: string | null
  submitted_at?: string | null
}

export interface RawApprovalStep {
  id: string
  level: number
  assigned_to: string | null
  assigned_role: string | null
  status: string | null
}

export interface RawGateProfile {
  id: string
  tenant_id: string | null
  full_name: string | null
  email: string | null
  role: string | null
}

/** A document_files row selected as a G3 deliverable. */
export interface RawDeliverableDoc {
  id: string
  title: string | null
  file_name: string | null
  category: string | null
  status: string | null
}

/** A project_team member selected for a G3 staffing seat. */
export interface RawTeamMember {
  person_id: string
  full_name: string | null
  role_code: string | null
  role_title: string | null
}

export interface RawGateEvent {
  id: string
  event: string | null
  actor_id: string | null
  from_status: string | null
  to_status: string | null
  detail: Record<string, unknown> | null
  created_at: string | null
}

// ─── View models ───────────────────────────────────────────────

export interface GatePersonView {
  available: boolean
  id: string
  name: string
  email: string
  role: string
  initials: string
}

export interface GateMilestoneView {
  id: string
  name: string
  description: string
  completed: boolean
}

export interface GateDeliverableView {
  id: string
  name: string
  description: string
  /** true when a real, resolvable document_files row is bound. */
  uploaded: boolean
  documentId: string | null
  documentTitle: string | null
  documentCategory: string | null
}

export interface GateStaffingView {
  roleId: string
  roleName: string
  description: string
  assigned: boolean
  personId: string | null
  personName: string | null
  roleCode: string | null
}

export interface GateStepsView {
  totalLevels: number
  /** 1-based level of the current pending step, or null when none pending. */
  currentLevel: number | null
  /** count of still-pending steps = remaining quorum. */
  remainingQuorum: number
  approvedLevels: number
  currentAssigneeId: string | null
}

export interface GateEventView {
  id: string
  event: string
  fromStatus: string | null
  toStatus: string | null
  detail: Record<string, unknown> | null
  createdAt: string | null
}

export interface GateApprovalDetailView {
  approval: {
    id: string
    title: string
    status: 'pending' | 'approved' | 'rejected' | 'delegated'
    priority: string
    gateNumber: number
    createdAt: string
    description: string | null
    decisionNote: string | null
  }
  project: {
    available: boolean
    attemptedId: string | null
    id: string | null
    name: string | null
    code: string | null
    technology: string | null
    capacityMw: string | null
    location: string | null
    country: string | null
    status: string | null
    currentPhase: number | null
  }
  phaseGate: {
    available: boolean
    phaseNumber: number | null
    phaseName: string | null
    status: string | null
  }
  submission: {
    hasSubmission: boolean
    status: string | null
    submittedAt: string | null
  }
  /** The governed G3 content, always the full 5/5/6/4 set (overlaid with real data). */
  g3: {
    commercialMilestones: GateMilestoneView[]
    financialCheckpoints: GateMilestoneView[]
    deliverables: GateDeliverableView[]
    staffingRoles: GateStaffingView[]
    executiveSummary: string | null
  }
  steps: GateStepsView
  requester: GatePersonView
  currentAssignee: GatePersonView
  events: GateEventView[]
  /**
   * SERVER-COMPUTED authorization for the viewing user. The UI MUST use these
   * to enable/disable the decision + delegation controls; they are NOT the
   * security boundary (the RPCs are), but they stop unauthorized users from even
   * seeing actionable controls. Computed by `computeGateReviewGating`.
   */
  viewerGating: GateViewerGating
}

export interface GateViewerGating {
  /** May submit a decision (proceed/conditional_proceed/hold/reject). */
  canDecide: boolean
  /** May delegate the current step to another eligible approver. */
  canDelegate: boolean
  /** Non-null ⇒ controls are read-only; human-readable explanation. */
  readOnlyReason: string | null
}

/**
 * Decide, from the viewer's relationship to the CURRENT pending step, whether
 * the review controls are actionable. Pure and deterministic so it can be unit-
 * tested without a DB. This is presentation gating; the RPCs remain the sole
 * enforcement boundary.
 *
 * Rules (first match wins):
 *   - already finalized (not 'pending')      → read-only, both false
 *   - no current pending step                 → read-only, both false
 *   - viewer IS the current-step assignee     → decide + delegate
 *   - viewer holds an admin-override role      → decide + delegate (override)
 *   - otherwise                                → read-only, both false
 */
export function computeGateReviewGating(input: {
  status: 'pending' | 'approved' | 'rejected' | 'delegated'
  currentAssigneeId: string | null
  actorId: string | null
  actorRole: string | null
  adminRoles: readonly string[]
}): GateViewerGating {
  const locked = (readOnlyReason: string): GateViewerGating => ({
    canDecide: false,
    canDelegate: false,
    readOnlyReason,
  })

  if (input.status !== 'pending') {
    return locked(`This gate approval has already been ${input.status}.`)
  }
  if (!input.currentAssigneeId) {
    return locked('There is no pending approval step to act on.')
  }
  if (input.actorId && input.actorId === input.currentAssigneeId) {
    return { canDecide: true, canDelegate: true, readOnlyReason: null }
  }
  if (input.actorRole && input.adminRoles.includes(input.actorRole)) {
    return { canDecide: true, canDelegate: true, readOnlyReason: null }
  }
  return locked('You are not the assigned approver for the current step.')
}

const UNAVAILABLE_PERSON: GatePersonView = {
  available: false,
  id: '',
  name: 'Unavailable',
  email: '',
  role: '',
  initials: '?',
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

function buildPerson(
  approvalTenant: string | null,
  profile: RawGateProfile | null | undefined,
): GatePersonView {
  if (!profile || profile.tenant_id !== approvalTenant) return UNAVAILABLE_PERSON
  const name = profile.full_name?.trim() || profile.email?.trim() || 'Unknown user'
  return {
    available: true,
    id: profile.id,
    name,
    email: profile.email ?? '',
    role: profile.role ?? '',
    initials: computeInitials(profile.full_name ?? profile.email),
  }
}

/** Overlay submitted form_data onto the governed G3 catalog so all items render. */
function buildG3(
  formData: G3FormData | null,
  docsById: Map<string, RawDeliverableDoc>,
  teamByPerson: Map<string, RawTeamMember>,
) {
  const milestoneDone = new Map<string, boolean>()
  const checkpointDone = new Map<string, boolean>()
  const deliverableDoc = new Map<string, string | null>()
  const staffingPerson = new Map<string, string | null>()

  if (formData) {
    for (const m of formData.commercialMilestones ?? []) milestoneDone.set(m.id, !!m.completed)
    for (const c of formData.financialCheckpoints ?? []) checkpointDone.set(c.id, !!c.completed)
    for (const d of formData.deliverables ?? []) deliverableDoc.set(d.id, d.documentId ?? null)
    for (const s of formData.staffingRoles ?? []) staffingPerson.set(s.roleId, s.assignedProfileId ?? null)
  }

  const commercialMilestones: GateMilestoneView[] = REQUIRED_COMMERCIAL_MILESTONES.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    completed: milestoneDone.get(m.id) === true,
  }))

  const financialCheckpoints: GateMilestoneView[] = REQUIRED_FINANCIAL_CHECKPOINTS.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    completed: checkpointDone.get(c.id) === true,
  }))

  const deliverables: GateDeliverableView[] = REQUIRED_DELIVERABLES.map((d) => {
    const docId = deliverableDoc.get(d.id) ?? null
    const doc = docId ? docsById.get(docId) : undefined
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      uploaded: !!doc,
      documentId: doc ? docId : null,
      documentTitle: doc ? (doc.title || doc.file_name || null) : null,
      documentCategory: doc ? (doc.category ?? null) : null,
    }
  })

  const staffingRoles: GateStaffingView[] = REQUIRED_STAFFING_ROLES.map((r) => {
    const personId = staffingPerson.get(r.roleId) ?? null
    const member = personId ? teamByPerson.get(personId) : undefined
    return {
      roleId: r.roleId,
      roleName: r.roleName,
      description: r.description,
      assigned: !!member,
      personId: member ? personId : null,
      personName: member ? (member.full_name ?? null) : null,
      roleCode: member ? (member.role_code ?? null) : null,
    }
  })

  return {
    commercialMilestones,
    financialCheckpoints,
    deliverables,
    staffingRoles,
    executiveSummary: formData?.executiveSummary?.trim() ? formData.executiveSummary : null,
  }
}

function buildSteps(steps: RawApprovalStep[]): GateStepsView {
  const sorted = [...steps].sort((a, b) => a.level - b.level)
  const pending = sorted.filter((s) => s.status === 'pending')
  const approved = sorted.filter((s) => s.status === 'approved')
  const current = pending[0] ?? null
  return {
    totalLevels: sorted.length,
    currentLevel: current ? current.level : null,
    remainingQuorum: pending.length,
    approvedLevels: approved.length,
    currentAssigneeId: current?.assigned_to ?? null,
  }
}

/**
 * Map a gate approval + its resolved rows into the G3 review view.
 * Returns null when the approval is not a gate workflow — the caller then knows
 * this id is not a gate and can fall back to the opportunity path.
 */
export function mapGateApprovalDetail(input: {
  approval: RawGateApproval
  project: RawGateProject | null | undefined
  phaseGate: RawPhaseGate | null | undefined
  submission: RawGateSubmission | null | undefined
  steps: RawApprovalStep[]
  requester: RawGateProfile | null | undefined
  currentAssignee: RawGateProfile | null | undefined
  deliverableDocs: RawDeliverableDoc[]
  teamMembers: RawTeamMember[]
  events: RawGateEvent[]
  /**
   * The viewing user's identity + admin roles, used to compute `viewerGating`.
   * Optional so pure mapping tests need not supply it; when omitted the view is
   * fully locked (nothing actionable), which is the safe default.
   */
  viewer?: { actorId: string | null; actorRole: string | null; adminRoles: readonly string[] }
}): GateApprovalDetailView | null {
  const { approval } = input
  if (approval.object_type !== 'gate') return null
  if (approval.gate_number === null || approval.gate_number === undefined) return null

  // Tenant isolation: never resolve another tenant's project.
  const project =
    input.project &&
    input.project.id === approval.object_id &&
    input.project.tenant_id === approval.tenant_id
      ? input.project
      : null

  const formData = (input.submission?.form_data ?? null) as G3FormData | null

  const docsById = new Map(input.deliverableDocs.map((d) => [d.id, d]))
  const teamByPerson = new Map(input.teamMembers.map((m) => [m.person_id, m]))

  const stepsView = buildSteps(input.steps)
  const status = (approval.status ?? 'pending') as 'pending' | 'approved' | 'rejected' | 'delegated'
  const viewerGating = computeGateReviewGating({
    status,
    currentAssigneeId: stepsView.currentAssigneeId,
    actorId: input.viewer?.actorId ?? null,
    actorRole: input.viewer?.actorRole ?? null,
    adminRoles: input.viewer?.adminRoles ?? [],
  })

  return {
    approval: {
      id: approval.id,
      title: approval.title ?? 'Gate Approval',
      status: (approval.status ?? 'pending') as 'pending' | 'approved' | 'rejected' | 'delegated',
      priority: approval.priority ?? 'normal',
      gateNumber: approval.gate_number,
      createdAt: approval.created_at ?? new Date(0).toISOString(),
      description: approval.description ?? null,
      decisionNote: approval.decision_note ?? null,
    },
    project: project
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
          status: project.status,
          currentPhase: project.current_phase,
        }
      : {
          available: false,
          attemptedId: approval.object_id,
          id: null,
          name: null,
          code: null,
          technology: null,
          capacityMw: null,
          location: null,
          country: null,
          status: null,
          currentPhase: null,
        },
    phaseGate: input.phaseGate
      ? {
          available: true,
          phaseNumber: input.phaseGate.phase_number,
          phaseName: input.phaseGate.phase_name,
          status: input.phaseGate.status,
        }
      : { available: false, phaseNumber: null, phaseName: null, status: null },
    submission: {
      hasSubmission: !!input.submission,
      status: input.submission?.status ?? null,
      submittedAt: input.submission?.submitted_at ?? null,
    },
    g3: buildG3(formData, docsById, teamByPerson),
    steps: stepsView,
    requester: buildPerson(approval.tenant_id, input.requester),
    currentAssignee: buildPerson(approval.tenant_id, input.currentAssignee),
    events: input.events.map((e) => ({
      id: e.id,
      event: e.event ?? 'event',
      fromStatus: e.from_status,
      toStatus: e.to_status,
      detail: e.detail,
      createdAt: e.created_at,
    })),
    viewerGating,
  }
}
