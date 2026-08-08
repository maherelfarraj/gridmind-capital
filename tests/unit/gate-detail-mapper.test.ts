import { describe, expect, it } from 'vitest'
import { mapGateApprovalDetail, computeInitials } from '@/lib/approvals/gate-detail'
import {
  REQUIRED_COMMERCIAL_MILESTONES,
  REQUIRED_FINANCIAL_CHECKPOINTS,
  REQUIRED_DELIVERABLES,
  REQUIRED_STAFFING_ROLES,
} from '@/lib/gates/g3-requirements'

/**
 * Pure-mapper tests for the G3 gate-approval detail view. No DB — the server
 * loader hands already-fetched rows to this mapper. The critical properties:
 *   - a non-gate / gate-number-less approval maps to null (so the route falls
 *     back to the opportunity view rather than mis-rendering);
 *   - tenant isolation: a project/profile from another tenant is dropped;
 *   - the governed G3 catalog ALWAYS renders in full, with submitted form_data
 *     overlaid (a completed milestone / uploaded deliverable / staffed role);
 *   - step math (current level, remaining quorum, approved count).
 */

const TENANT = 'tenant-a'
const base = () => ({
  approval: {
    id: 'appr-1',
    tenant_id: TENANT,
    object_type: 'gate',
    object_id: 'project-1',
    gate_number: 3,
    title: 'G3 Gate',
    status: 'pending',
    priority: 'normal',
    created_at: '2026-08-01T00:00:00Z',
    description: null,
    decision_note: null,
  },
  project: {
    id: 'project-1',
    tenant_id: TENANT,
    name: 'Solar One',
    code: 'SOL-1',
    technology: 'solar',
    capacity_mw: 120,
    location: 'Aqaba',
    country: 'JO',
    status: 'active',
    current_phase: 2,
  },
  phaseGate: { phase_number: 3, phase_name: 'RTB', status: 'in_review' },
  submission: { form_data: null, status: 'submitted', submitted_at: '2026-08-02T00:00:00Z' },
  steps: [
    { id: 's1', level: 1, assigned_to: 'u1', assigned_role: 'project_manager', status: 'approved' },
    { id: 's2', level: 2, assigned_to: 'u2', assigned_role: 'tenant_admin', status: 'pending' },
  ],
  requester: { id: 'u0', tenant_id: TENANT, full_name: 'Req Uester', email: 'r@x.io', role: 'developer' },
  currentAssignee: { id: 'u2', tenant_id: TENANT, full_name: 'Al Approver', email: 'a@x.io', role: 'tenant_admin' },
  deliverableDocs: [],
  teamMembers: [],
  events: [],
})

describe('mapGateApprovalDetail', () => {
  it('returns null for a non-gate approval', () => {
    const input = base()
    input.approval.object_type = 'opportunity'
    expect(mapGateApprovalDetail(input as any)).toBeNull()
  })

  it('returns null when the gate number is missing (0 is still valid elsewhere, null is not)', () => {
    const input = base()
    ;(input.approval as any).gate_number = null
    expect(mapGateApprovalDetail(input as any)).toBeNull()
  })

  it('renders the FULL governed G3 catalog regardless of submission', () => {
    const view = mapGateApprovalDetail(base() as any)!
    expect(view.g3.commercialMilestones).toHaveLength(REQUIRED_COMMERCIAL_MILESTONES.length)
    expect(view.g3.financialCheckpoints).toHaveLength(REQUIRED_FINANCIAL_CHECKPOINTS.length)
    expect(view.g3.deliverables).toHaveLength(REQUIRED_DELIVERABLES.length)
    expect(view.g3.staffingRoles).toHaveLength(REQUIRED_STAFFING_ROLES.length)
    // nothing completed/uploaded/assigned when form_data is null
    expect(view.g3.commercialMilestones.every((m) => !m.completed)).toBe(true)
    expect(view.g3.deliverables.every((d) => !d.uploaded)).toBe(true)
    expect(view.g3.staffingRoles.every((s) => !s.assigned)).toBe(true)
  })

  it('overlays submitted form_data onto the governed catalog', () => {
    const input = base()
    const firstMilestone = REQUIRED_COMMERCIAL_MILESTONES[0].id
    const firstDeliverable = REQUIRED_DELIVERABLES[0].id
    const firstRole = REQUIRED_STAFFING_ROLES[0].roleId
    input.submission = {
      status: 'submitted',
      submitted_at: '2026-08-02T00:00:00Z',
      form_data: {
        commercialMilestones: [{ id: firstMilestone, completed: true }],
        deliverables: [{ id: firstDeliverable, documentId: 'doc-1' }],
        staffingRoles: [{ roleId: firstRole, assignedProfileId: 'p-1' }],
        executiveSummary: 'All clear for RTB.',
      },
    } as any
    input.deliverableDocs = [{ id: 'doc-1', title: 'Signed PPA', file_name: 'ppa.pdf', category: 'commercial', status: 'final' }] as any
    input.teamMembers = [{ person_id: 'p-1', full_name: 'Team Person', role_code: 'PM', role_title: 'PM' }] as any

    const view = mapGateApprovalDetail(input as any)!
    expect(view.g3.commercialMilestones.find((m) => m.id === firstMilestone)!.completed).toBe(true)
    const d = view.g3.deliverables.find((x) => x.id === firstDeliverable)!
    expect(d.uploaded).toBe(true)
    expect(d.documentTitle).toBe('Signed PPA')
    const s = view.g3.staffingRoles.find((x) => x.roleId === firstRole)!
    expect(s.assigned).toBe(true)
    expect(s.personName).toBe('Team Person')
    expect(view.g3.executiveSummary).toBe('All clear for RTB.')
  })

  it('drops a project belonging to another tenant (isolation)', () => {
    const input = base()
    input.project.tenant_id = 'tenant-b'
    const view = mapGateApprovalDetail(input as any)!
    expect(view.project.available).toBe(false)
    expect(view.project.attemptedId).toBe('project-1')
  })

  it('marks a person from another tenant as unavailable', () => {
    const input = base()
    input.currentAssignee.tenant_id = 'tenant-b'
    const view = mapGateApprovalDetail(input as any)!
    expect(view.currentAssignee.available).toBe(false)
  })

  it('computes step quorum: current level, remaining, approved', () => {
    const view = mapGateApprovalDetail(base() as any)!
    expect(view.steps.totalLevels).toBe(2)
    expect(view.steps.currentLevel).toBe(2)
    expect(view.steps.remainingQuorum).toBe(1)
    expect(view.steps.approvedLevels).toBe(1)
    expect(view.steps.currentAssigneeId).toBe('u2')
  })
})

describe('computeInitials', () => {
  it('handles empty, single, and multi-word names', () => {
    expect(computeInitials(null)).toBe('?')
    expect(computeInitials('Cher')).toBe('CH')
    expect(computeInitials('Al Approver')).toBe('AA')
    expect(computeInitials('  many   spaced  words ')).toBe('MW')
  })
})
