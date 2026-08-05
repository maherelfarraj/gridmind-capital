import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server-action tests for the REAL `createApprovalWorkflow` entry point.
 *
 * These prove the action writes approval_events using the ACTUAL production
 * schema (event / detail / from_status / to_status / tenant_id) and NOT the
 * phantom event_type / metadata columns it used to insert -- which silently
 * dropped every workflow-creation event. They also prove a gate workflow
 * produces exactly one approvals row and all approval_steps, and that a failed
 * event insert rolls everything back (no orphaned rows).
 *
 * Everything below the action is mocked at the module boundary; no Supabase
 * connection is opened. Writes are recorded so an insert is observable as a
 * CALL with its payload rather than as a database mutation.
 */

type Write = { table: string; op: string; payload?: any }

const state = vi.hoisted(() => ({
  writes: [] as Write[],
  // Controls the approval_events insert result so a failure path is testable.
  eventInsertError: null as { message: string } | null,
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
      return { data: { id: 'seat-1' }, error: null }
    default:
      return { data: null, error: null }
  }
}

function writeResult(table: string, op: string) {
  if (table === 'approvals' && op === 'insert') {
    return { data: { id: 'appr-1' }, error: null }
  }
  if (table === 'approval_events' && op === 'insert') {
    return { data: null, error: state.eventInsertError }
  }
  // steps insert, all deletes
  return { data: null, error: null }
}

function makeBuilder(table: string) {
  let writeOp: string | null = null
  let writePayload: unknown
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
      writePayload = payload
      state.writes.push({ table, op, payload })
      return b
    }
  }
  function terminal() {
    return writeOp ? writeResult(table, writeOp) : readResult(table)
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => makeBuilder(table) }),
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
vi.mock('@/app/actions/signatures', () => ({ createSignature: vi.fn() }))
vi.mock('@/app/actions/phase-gates', () => ({ advanceProjectGate: vi.fn(async () => ({ error: null })) }))

import { createApprovalWorkflow } from '@/app/actions/approvals'

beforeEach(() => {
  state.writes.length = 0
  state.eventInsertError = null
})

const eventInserts = () => state.writes.filter((w) => w.table === 'approval_events' && w.op === 'insert')
const flatEventRows = () => eventInserts().flatMap((w) => (Array.isArray(w.payload) ? w.payload : [w.payload]))

describe('createApprovalWorkflow — schema-correct events', () => {
  it('creates one approval, all steps, and valid approval_events', async () => {
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500, 3)
    expect(res.error).toBeUndefined()
    expect(res.id).toBe('appr-1')

    // exactly one approvals insert
    const approvalInserts = state.writes.filter((w) => w.table === 'approvals' && w.op === 'insert')
    expect(approvalInserts).toHaveLength(1)
    expect(approvalInserts[0].payload).toMatchObject({
      object_type: 'gate',
      gate_number: 3,
      tenant_id: 'tenant-a',
      status: 'pending',
    })

    // all approval_steps inserted (2 levels -> 2 step rows, in one insert)
    const stepInserts = state.writes.filter((w) => w.table === 'approval_steps' && w.op === 'insert')
    expect(stepInserts).toHaveLength(1)
    expect(stepInserts[0].payload).toHaveLength(2)

    // approval_events use the REAL schema, never event_type / metadata
    const rows = flatEventRows()
    expect(rows.length).toBe(3) // 1 created + 2 assigned
    for (const r of rows) {
      expect(r).toHaveProperty('event')
      expect(r).toHaveProperty('detail')
      expect(r).toHaveProperty('tenant_id', 'tenant-a')
      expect(r).not.toHaveProperty('event_type')
      expect(r).not.toHaveProperty('metadata')
    }
    const created = rows.find((r: any) => r.event === 'created')
    expect(created).toMatchObject({ from_status: null, to_status: 'pending' })
    expect(created.detail).toMatchObject({ levels: 2, amount: 500, gate_number: 3 })
    const assigned = rows.filter((r: any) => r.event === 'assigned')
    expect(assigned).toHaveLength(2)
    for (const a of assigned) {
      expect(a).toMatchObject({ from_status: 'pending', to_status: 'pending' })
      expect(a.detail).toHaveProperty('level')
      expect(a.detail).toHaveProperty('assigned_to')
    }
  })

  it('rolls back (no surviving rows) when the event insert fails', async () => {
    state.eventInsertError = { message: 'events boom' }
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500, 3)
    expect(res.id).toBe('')
    expect(res.error).toContain('Approval events creation failed')

    // rollback must delete events, steps, and the approval row
    const deletes = state.writes.filter((w) => w.op === 'delete')
    const deletedTables = deletes.map((d) => d.table)
    expect(deletedTables).toContain('approval_events')
    expect(deletedTables).toContain('approval_steps')
    expect(deletedTables).toContain('approvals')
  })

  it('rejects a gate workflow with no gate number before any write', async () => {
    const res = await createApprovalWorkflow('gate', 'project-1', 'G3 Gate', 500)
    expect(res.id).toBe('')
    expect(res.error).toBe('A gate workflow requires a gate number')
    expect(state.writes).toHaveLength(0)
  })
})
