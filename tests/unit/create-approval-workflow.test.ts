import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server-action tests for the REAL `createApprovalWorkflow` entry point.
 *
 * createApprovalWorkflow no longer inserts approvals/steps/events itself with
 * app-side compensation. It now:
 *   1. resolves ONE seat per level via fail-closed resolveApproveeSeat
 *      (an active same-tenant profile, or an active tenant_admin, or null), and
 *   2. hands the whole write to the transactional RPC
 *      `create_approval_workflow_tx`, which commits approvals + approval_steps
 *      (with tenant_id) + approval_events atomically or not at all.
 *
 * These tests prove: the RPC is called exactly once with the right arguments and
 * a fully-resolved step set (each carrying assigned_role); an RPC error is
 * surfaced; and — the important safety property — if ANY level cannot be
 * resolved to a real profile, the action ABORTS before calling the RPC (no
 * workflow assigned to a non-person).
 *
 * Everything below the action is mocked at the module boundary; no Supabase
 * connection is opened.
 */

type Write = { table: string; op: string; payload?: any }

const state = vi.hoisted(() => ({
  writes: [] as Write[],
  rpcCalls: [] as Array<{ fn: string; args: any }>,
  rpcResult: { data: 'appr-1' as unknown, error: null as { message: string } | null },
  // When false, the profiles seat lookups return null (no active profile),
  // which must make resolveApproveeSeat fail closed.
  seatResolves: true,
}))

function readResult(table: string) {
  switch (table) {
    case 'approvals':
      // duplicate-detection read: no existing pending workflow
      return { data: null, error: null }
    case 'approval_rules':
      return {
        data: {
          id: 'rule-1',
          required_roles: ['project_manager', 'tenant_admin'],
          approval_levels: 2,
          min_amount: 0,
          max_amount: 1000000,
        },
        error: null,
      }
    case 'profiles':
      return { data: state.seatResolves ? { id: 'seat-1' } : null, error: null }
    default:
      return { data: null, error: null }
  }
}

function makeBuilder(table: string) {
  let writeOp: string | null = null
  const b: Record<string, any> = {
    select: () => b,
    eq: () => b,
    in: () => b,
    lte: () => b,
    gte: () => b,
    order: () => b,
    limit: () => b,
    single: async () => terminal(),
    maybeSingle: async () => terminal(),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(terminal()).then(resolve, reject),
  }
  for (const op of ['insert', 'update', 'upsert', 'delete'] as const) {
    b[op] = (payload?: unknown) => {
      writeOp = op
      state.writes.push({ table, op, payload })
      return b
    }
  }
  function terminal() {
    return writeOp ? { data: null, error: null } : readResult(table)
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeBuilder(table),
    rpc: async (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args })
      return state.rpcResult
    },
  }),
}))
vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => 'tenant-a' }))
vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ userId: 'actor-1', profile: {} }),
  requireApprover: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  requireWriter: async () => ({ actor: {} }),
  requireInternalRole: async () => ({ userId: 'actor-1', profile: {} }),
  getAuthActor: async () => ({ actor: { userId: 'actor-1', role: 'tenant_admin', tenantId: 'tenant-a' } }),
  requireAssignedApprover: async () => ({ actor: {} }),
  ADMIN_ROLES: ['system_admin', 'tenant_admin'],
}))
vi.mock('@/lib/email/send', () => ({
  sendApprovalRequestEmail: vi.fn(),
  sendApprovalDecisionEmail: vi.fn(),
}))
vi.mock('@/app/actions/signatures', () => ({
  createSignature: vi.fn(),
  stageGateSignatureImage: vi.fn(),
}))
vi.mock('@/app/actions/phase-gates', () => ({ advanceProjectGate: vi.fn(async () => ({ error: null })) }))

import { createApprovalWorkflow } from '@/app/actions/approvals'

beforeEach(() => {
  state.writes.length = 0
  state.rpcCalls.length = 0
  state.rpcResult = { data: 'appr-1', error: null }
  state.seatResolves = true
})

const wfCalls = () => state.rpcCalls.filter((c) => c.fn === 'create_approval_workflow_tx')

describe('createApprovalWorkflow — transactional RPC', () => {
  it('resolves seats and hands the whole workflow to create_approval_workflow_tx', async () => {
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500, 3)
    expect(res.error).toBeUndefined()
    expect(res.id).toBe('appr-1')

    // exactly one transactional call — no app-side approvals/steps/events inserts
    const calls = wfCalls()
    expect(calls).toHaveLength(1)
    expect(state.writes.some((w) => w.op === 'insert')).toBe(false)

    const args = calls[0].args
    expect(args).toMatchObject({
      p_tenant_id: 'tenant-a',
      p_object_type: 'gate',
      p_object_id: 'project-1',
      p_gate_number: 3,
      p_amount: 500,
      p_requester: 'actor-1',
    })
    // one step per level, each with a resolved assignee AND its assigned_role
    expect(args.p_steps).toHaveLength(2)
    for (const s of args.p_steps) {
      expect(s).toHaveProperty('level')
      expect(s).toHaveProperty('assigned_to', 'seat-1')
      expect(typeof s.assigned_role).toBe('string')
      expect(s.assigned_role.length).toBeGreaterThan(0)
    }
    expect(args.p_steps.map((s: any) => s.level)).toEqual([1, 2])
  })

  it('surfaces an RPC failure and never claims success', async () => {
    state.rpcResult = { data: null, error: { message: 'tx boom' } }
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500, 3)
    expect(res.id).toBe('')
    expect(res.error).toContain('tx boom')
  })

  it('FAILS CLOSED: aborts before the RPC when a level has no resolvable seat', async () => {
    // No active profile exists for the requested role or tenant_admin fallback.
    state.seatResolves = false
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500, 3)
    expect(res.id).toBe('')
    expect(res.error).toMatch(/no active .* exists to fill level/i)
    // The safety property: no workflow was created (RPC never called).
    expect(wfCalls()).toHaveLength(0)
  })

  it('rejects a gate workflow with no gate number before any work', async () => {
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500)
    expect(res.id).toBe('')
    expect(res.error).toBe('A gate workflow requires a gate number')
    expect(state.writes).toHaveLength(0)
    expect(state.rpcCalls).toHaveLength(0)
  })
})
