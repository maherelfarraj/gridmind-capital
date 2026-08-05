import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeGateReviewGating, mapGateApprovalDetail } from '@/lib/approvals/gate-detail'
import { GATE_APPROVER_ROLES } from '@/lib/auth/roles'

/**
 * Server-computed review gating + the canonical approver-role drift guard.
 * These are the presentation-authorization and single-source-of-truth
 * properties the RPCs independently re-enforce.
 */

const ADMIN = ['system_admin', 'tenant_admin', 'project_director'] as const

describe('computeGateReviewGating', () => {
  it('locks a finalized approval regardless of viewer', () => {
    const g = computeGateReviewGating({
      status: 'approved', currentAssigneeId: 'u1', actorId: 'u1',
      actorRole: 'project_manager', adminRoles: ADMIN,
    })
    expect(g.canDecide).toBe(false)
    expect(g.canDelegate).toBe(false)
    expect(g.readOnlyReason).toMatch(/already been approved/)
  })

  it('locks when there is no current pending step', () => {
    const g = computeGateReviewGating({
      status: 'pending', currentAssigneeId: null, actorId: 'u1',
      actorRole: 'tenant_admin', adminRoles: ADMIN,
    })
    expect(g.canDecide).toBe(false)
    expect(g.readOnlyReason).toMatch(/no pending approval step/i)
  })

  it('allows the assigned approver to decide and delegate', () => {
    const g = computeGateReviewGating({
      status: 'pending', currentAssigneeId: 'u1', actorId: 'u1',
      actorRole: 'project_manager', adminRoles: ADMIN,
    })
    expect(g).toEqual({ canDecide: true, canDelegate: true, readOnlyReason: null })
  })

  it('allows an admin who is NOT the assignee (override)', () => {
    const g = computeGateReviewGating({
      status: 'pending', currentAssigneeId: 'u1', actorId: 'admin-9',
      actorRole: 'tenant_admin', adminRoles: ADMIN,
    })
    expect(g.canDecide).toBe(true)
    expect(g.canDelegate).toBe(true)
  })

  it('locks a non-assignee, non-admin viewer', () => {
    const g = computeGateReviewGating({
      status: 'pending', currentAssigneeId: 'u1', actorId: 'u2',
      actorRole: 'project_manager', adminRoles: ADMIN,
    })
    expect(g.canDecide).toBe(false)
    expect(g.canDelegate).toBe(false)
    expect(g.readOnlyReason).toMatch(/not the assigned approver/i)
  })

  it('locks when the viewer is unknown (no actor id)', () => {
    const g = computeGateReviewGating({
      status: 'pending', currentAssigneeId: 'u1', actorId: null,
      actorRole: null, adminRoles: ADMIN,
    })
    expect(g.canDecide).toBe(false)
  })
})

describe('mapGateApprovalDetail viewerGating default', () => {
  const raw = () => ({
    approval: {
      id: 'a1', tenant_id: 't1', object_type: 'gate', object_id: 'p1', gate_number: 3,
      title: 'G3', status: 'pending', priority: 'normal', created_at: '2026-01-01',
      description: null, decision_note: null, requester_id: null, assignee_id: 'u1',
    },
    project: { id: 'p1', tenant_id: 't1', name: 'P', code: 'P-1', technology: null,
      capacity_mw: null, location: null, country: null, status: 'active', current_phase: 2 },
    phaseGate: { phase_number: 3, phase_name: 'RTB', status: 'in_review' },
    submission: null,
    steps: [{ id: 's1', level: 1, assigned_to: 'u1', assigned_role: 'project_manager', status: 'pending' }],
    requester: null, currentAssignee: null,
    deliverableDocs: [], teamMembers: [], events: [],
  })

  it('defaults to fully locked when no viewer is supplied', () => {
    const v = mapGateApprovalDetail(raw() as any)!
    expect(v.viewerGating).toEqual({
      canDecide: false, canDelegate: false,
      readOnlyReason: 'You are not the assigned approver for the current step.',
    })
  })

  it('unlocks for the assigned viewer', () => {
    const v = mapGateApprovalDetail({
      ...(raw() as any),
      viewer: { actorId: 'u1', actorRole: 'project_manager', adminRoles: ADMIN },
    })!
    expect(v.viewerGating.canDecide).toBe(true)
  })
})

describe('GATE_APPROVER_ROLES drift guard', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

  it('the canonical set is exactly the expected four roles', () => {
    expect([...GATE_APPROVER_ROLES].sort()).toEqual(
      ['project_director', 'project_manager', 'system_admin', 'tenant_admin'],
    )
  })

  it('the delegate RPC v_approver_roles equals the canonical set (order-independent)', () => {
    // The delegate RPC hardcodes v_approver_roles. If someone edits the canonical
    // TS set without updating the RPC (or vice versa), this fails — the picker and
    // the enforcement boundary must never disagree.
    const sql = read('supabase/migrations/20260805190009_delegate_gate_approval_role_check.sql')
    const m = sql.match(/v_approver_roles\s+text\[\]\s*:=\s*ARRAY\[([^\]]+)\]/)
    expect(m, 'v_approver_roles array literal not found').toBeTruthy()
    const rpcRoles = m![1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort()
    expect(rpcRoles).toEqual([...GATE_APPROVER_ROLES].sort())
    // finance_manager must NOT sneak back in without also being added canonically.
    expect(rpcRoles).not.toContain('finance_manager')
  })
})
