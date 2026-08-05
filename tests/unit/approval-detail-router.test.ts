import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * getApprovalDetailRouted is the SINGLE authoritative detail entry point. It
 * reads object_type once and routes to exactly one typed loader, so a gate
 * approval can NEVER render through the opportunity (G0) path and vice versa.
 *
 * The critical safety property proven here: given object_type='gate', the result
 * is `kind:'gate'` (never 'opportunity'), and the opportunity loader itself
 * refuses a gate row (returns null) as defense in depth.
 */

const state = vi.hoisted(() => ({
  // Full approval row returned by every approvals.single()/read. object_type is
  // what the router discriminates on; the rest lets the chosen loader map a view.
  approvalRow: null as any,
}))

function readResult(table: string) {
  if (table === 'approvals') return { data: state.approvalRow, error: state.approvalRow ? null : { message: 'not found' } }
  if (table === 'projects') return { data: null, error: null }
  return { data: null, error: null }
}

function makeBuilder(table: string) {
  const b: Record<string, any> = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    single: async () => readResult(table),
    maybeSingle: async () => readResult(table),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(readResult(table)).then(resolve, reject),
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (t: string) => makeBuilder(t), rpc: async () => ({ data: null, error: null }) }),
}))
vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => 'tenant-a' }))
vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ userId: 'actor-1', profile: {} }),
  requireApprover: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  requireWriter: async () => ({ actor: {} }),
  requireInternalRole: async () => ({ userId: 'actor-1', profile: {} }),
  getAuthActor: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  requireAssignedApprover: async () => ({ actor: {} }),
  ADMIN_ROLES: ['system_admin', 'tenant_admin', 'project_director'],
}))
vi.mock('@/lib/email/send', () => ({ sendApprovalRequestEmail: vi.fn(), sendApprovalDecisionEmail: vi.fn() }))
vi.mock('@/app/actions/signatures', () => ({
  createSignature: vi.fn(), stageGateSignatureImage: vi.fn(), removeStagedGateSignature: vi.fn(),
}))
vi.mock('@/app/actions/phase-gates', () => ({ advanceProjectGate: vi.fn(async () => ({ error: null })) }))

import { getApprovalDetailRouted, getOpportunityApprovalDetail } from '@/app/actions/approvals'

const gateRow = {
  id: 'appr-1', tenant_id: 'tenant-a', object_type: 'gate', object_id: 'proj-1', gate_number: 3,
  title: 'G3', status: 'pending', priority: 'normal', created_at: '2026-01-01',
  description: null, decision_note: null, requester_id: null, assignee_id: 'u1', amount: null,
}
const oppRow = {
  id: 'appr-2', tenant_id: 'tenant-a', object_type: 'opportunity', object_id: 'opp-1', gate_number: null,
  title: 'Opp', status: 'pending', priority: 'normal', created_at: '2026-01-01',
  description: null, requester_id: null, assignee_id: 'u1', amount: 1000,
}

beforeEach(() => { state.approvalRow = null })

describe('getApprovalDetailRouted', () => {
  it('routes a gate object_type to kind:"gate" (never opportunity)', async () => {
    state.approvalRow = gateRow
    const res = await getApprovalDetailRouted('appr-1')
    expect(res.kind).toBe('gate')
    if (res.kind === 'gate') expect(res.gate.approval.id).toBe('appr-1')
  })

  it('routes an opportunity object_type to kind:"opportunity"', async () => {
    state.approvalRow = oppRow
    const res = await getApprovalDetailRouted('appr-2')
    expect(res.kind).toBe('opportunity')
  })

  it('returns not_found when the approval is missing/foreign-tenant', async () => {
    state.approvalRow = null
    const res = await getApprovalDetailRouted('missing')
    expect(res.kind).toBe('not_found')
  })
})

describe('getOpportunityApprovalDetail hard gate guard', () => {
  it('refuses to map a gate approval (defense in depth)', async () => {
    state.approvalRow = gateRow
    const res = await getOpportunityApprovalDetail('appr-1')
    expect(res).toBeNull()
  })
})
