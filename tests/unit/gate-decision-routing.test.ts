import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server-action tests proving decideApproval and delegateApproval route GATE
 * workflows through the atomic RPCs and NOT through the stale-assignee code
 * paths.
 *
 * Key guarantees asserted:
 *  - A gate decision calls supabase.rpc('decide_gate_approval', ...) and does
 *    NOT call requireAssignedApprover (the RPC's locked current-step check is the
 *    sole authority). A non-gate decision DOES call requireAssignedApprover.
 *  - The approval lookup is tenant-scoped (eq('tenant_id', <actor tenant>)).
 *  - conditional_proceed forwards conditions to the RPC as p_conditions.
 *  - A gate delegation calls supabase.rpc('delegate_gate_approval', ...) rather
 *    than issuing a bare approvals UPDATE.
 */

type RpcCall = { fn: string; args: any }
type EqCall = { table: string; col: string; val: unknown }

const state = vi.hoisted(() => ({
  rpcCalls: [] as RpcCall[],
  eqCalls: [] as EqCall[],
  updates: [] as { table: string; payload: any }[],
  requireAssignedApproverCalls: 0,
  // The approval row returned by the tenant-scoped lookup.
  approvalRow: null as any,
  rpcResult: 'approved' as string,
}))

function makeBuilder(table: string) {
  let writeOp: string | null = null
  const b: Record<string, any> = {
    select: () => b,
    eq: (col: string, val: unknown) => {
      state.eqCalls.push({ table, col, val })
      return b
    },
    in: () => b,
    order: () => b,
    limit: () => b,
    single: async () => terminal(),
    maybeSingle: async () => terminal(),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(terminal()).then(resolve, reject),
  }
  for (const op of ['insert', 'update', 'delete'] as const) {
    b[op] = (payload?: unknown) => {
      writeOp = op
      if (op === 'update') state.updates.push({ table, payload })
      return b
    }
  }
  function terminal() {
    if (writeOp) return { data: null, error: null }
    if (table === 'approvals') return { data: state.approvalRow, error: null }
    if (table === 'approval_steps') {
      // current pending step assigned to someone OTHER than the actor
      return { data: { id: 'step-1', level: 1, assigned_to: 'other-user', status: 'pending' }, error: null }
    }
    return { data: null, error: null }
  }
  return b
}

const rpc = vi.fn(async (fn: string, args: any): Promise<{ data: unknown; error: { message: string } | null }> => {
  state.rpcCalls.push({ fn, args })
  return { data: state.rpcResult, error: null }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (t: string) => makeBuilder(t), rpc }),
}))
vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => 'tenant-a' }))

vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ userId: 'actor-1', profile: {} }),
  requireApprover: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  requireWriter: async () => ({ actor: {} }),
  requireInternalRole: async () => ({ userId: 'actor-1', profile: {} }),
  getAuthActor: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  // Increments the hoisted counter so tests can assert whether the non-gate
  // local authorization path was exercised.
  requireAssignedApprover: async () => {
    state.requireAssignedApproverCalls += 1
    return { actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }
  },
  ADMIN_ROLES: ['system_admin', 'tenant_admin'],
}))
vi.mock('@/lib/email/send', () => ({
  sendApprovalRequestEmail: vi.fn(async () => {}),
  // Returns a promise because the action calls .catch() on the result.
  sendApprovalDecisionEmail: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/app/actions/signatures', () => ({
  createSignature: vi.fn(async () => ({ id: 'sig-1' })),
  // Gate endorsements stage the signature image, then the RPC persists it
  // atomically. Return the shape decideApproval reads (staged.staged.*).
  stageGateSignatureImage: vi.fn(async () => ({
    staged: {
      signerName: 'Actor One',
      signerRole: 'tenant_admin',
      imagePath: 'signatures/appr-1/sig.png',
      ipAddress: null,
    },
  })),
}))

// Mock the secure cleanup module (server-only, not exported as a client action).
vi.mock('@/lib/approvals/signature-cleanup', () => ({
  deleteFailedStagedSignature: vi.fn(async () => ({ removed: true })),
}))

// A captured-but-unpersisted signature draft, as the review UI would hand off.
const sigDraft = {
  dataUrl: 'data:image/png;base64,AAAA',
  statement: 'I endorse this gate decision.',
  signerName: 'Actor One',
  signerRole: 'tenant_admin',
}
vi.mock('@/app/actions/phase-gates', () => ({ advanceProjectGate: vi.fn(async () => ({ error: null })) }))

import { decideApproval, delegateApproval } from '@/app/actions/approvals'
import { deleteFailedStagedSignature } from '@/lib/approvals/signature-cleanup'

beforeEach(() => {
  state.rpcCalls.length = 0
  state.eqCalls.length = 0
  state.updates.length = 0
  state.requireAssignedApproverCalls = 0
  state.rpcResult = 'approved'
  state.approvalRow = null
  rpc.mockClear()
  ;(deleteFailedStagedSignature as unknown as { mockClear: () => void }).mockClear()
})

describe('decideApproval — gate routing', () => {
  beforeEach(() => {
    state.approvalRow = {
      title: 'G3', object_type: 'gate', object_id: 'proj-1', description: null,
      assignee_id: 'other-user', status: 'pending', gate_number: 3, tenant_id: 'tenant-a',
    }
  })

  it('routes a gate decision through the decide_gate_approval RPC', async () => {
    const res = await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    expect(res.error).toBeNull()
    const call = state.rpcCalls.find((c) => c.fn === 'decide_gate_approval')
    expect(call).toBeTruthy()
    expect(call!.args).toMatchObject({
      p_approval_id: 'appr-1', p_tenant_id: 'tenant-a', p_actor: 'actor-1', p_decision: 'proceed',
    })
  })

  it('requires a signature to endorse a gate decision', async () => {
    // proceed / conditional_proceed are endorsements: no draft ⇒ refuse BEFORE
    // touching the RPC, so no partial write can occur.
    const res = await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok' })
    expect(res.error).toContain('signature is required')
    expect(state.rpcCalls.find((c) => c.fn === 'decide_gate_approval')).toBeUndefined()
  })

  it('does NOT pre-authorize a gate with requireAssignedApprover', async () => {
    await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    expect(state.requireAssignedApproverCalls).toBe(0)
  })

  it('scopes the approval lookup to the actor tenant', async () => {
    await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    const tenantScoped = state.eqCalls.some((e) => e.table === 'approvals' && e.col === 'tenant_id' && e.val === 'tenant-a')
    expect(tenantScoped).toBe(true)
  })

  it('forwards conditions to the RPC for conditional_proceed', async () => {
    await decideApproval({
      id: 'appr-1', decision: 'conditional_proceed', rationale: 'cond', signatureDraft: sigDraft,
      conditions: [{ title: 'Land title', due_date: '2026-09-01' }],
    })
    const call = state.rpcCalls.find((c) => c.fn === 'decide_gate_approval')
    expect(call!.args.p_conditions).toEqual([{ title: 'Land title', due_date: '2026-09-01' }])
  })

  it('surfaces an RPC error and performs no bare approvals update', async () => {
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'sign-off pending' } }))
    const res = await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    expect(res.error).toContain('sign-off pending')
    expect(state.updates.filter((u) => u.table === 'approvals')).toHaveLength(0)
  })

  it('removes the staged signature when the decision RPC fails', async () => {
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'sign-off pending' } }))
    await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    // Cleanup must target the exact staged path and tenant so no orphan blob survives.
    expect(deleteFailedStagedSignature).toHaveBeenCalledWith('signatures/appr-1/sig.png', 'tenant-a')
  })

  it('does NOT remove the staged signature on a successful decision', async () => {
    await decideApproval({ id: 'appr-1', decision: 'proceed', rationale: 'ok', signatureDraft: sigDraft })
    // A committed decision keeps its signature image (a row now references it).
    expect(deleteFailedStagedSignature).not.toHaveBeenCalled()
  })
})

describe('decideApproval — non-gate path still authorizes locally', () => {
  it('calls requireAssignedApprover for an opportunity approval', async () => {
    state.approvalRow = {
      title: 'Opp', object_type: 'opportunity', object_id: 'opp-1', description: null,
      assignee_id: 'other-user', status: 'pending', gate_number: null, tenant_id: 'tenant-a',
    }
    await decideApproval({ id: 'appr-2', decision: 'proceed', rationale: 'ok' })
    expect(state.requireAssignedApproverCalls).toBeGreaterThan(0)
    // and it must NOT have called the gate RPC
    expect(state.rpcCalls.find((c) => c.fn === 'decide_gate_approval')).toBeUndefined()
  })
})

describe('delegateApproval — gate routing', () => {
  it('routes a gate delegation through the delegate_gate_approval RPC', async () => {
    state.approvalRow = {
      description: null, assignee_id: 'other-user', object_type: 'gate', gate_number: 3,
    }
    state.rpcResult = 'delegated'
    const res = await delegateApproval({ id: 'appr-1', delegateId: 'delegate-1', reason: 'busy' })
    expect(res.error).toBeNull()
    const call = state.rpcCalls.find((c) => c.fn === 'delegate_gate_approval')
    expect(call).toBeTruthy()
    expect(call!.args).toMatchObject({
      p_approval_id: 'appr-1', p_tenant_id: 'tenant-a', p_actor: 'actor-1', p_delegate: 'delegate-1',
    })
    // no bare approvals UPDATE for a gate delegation
    expect(state.updates.filter((u) => u.table === 'approvals')).toHaveLength(0)
  })

  it('uses a bare tenant-scoped UPDATE for a non-gate delegation', async () => {
    state.approvalRow = {
      description: null, assignee_id: 'actor-1', object_type: 'opportunity', gate_number: null,
    }
    const res = await delegateApproval({ id: 'appr-2', delegateId: 'delegate-1', reason: 'busy' })
    expect(res.error).toBeNull()
    expect(state.rpcCalls.find((c) => c.fn === 'delegate_gate_approval')).toBeUndefined()
    expect(state.updates.filter((u) => u.table === 'approvals')).toHaveLength(1)
    // the update lookup was tenant-scoped
    expect(state.eqCalls.some((e) => e.table === 'approvals' && e.col === 'tenant_id' && e.val === 'tenant-a')).toBe(true)
  })
})
