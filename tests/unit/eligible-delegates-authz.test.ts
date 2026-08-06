import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `getEligibleDelegates` authorization.
 *
 * The delegate roster must be gated on the CURRENT PENDING STEP's `assigned_to`,
 * never on `approvals.assignee_id`. The latter is a denormalized convenience
 * column that lags the step machine: it is stale mid multi-level progression and
 * immediately after a delegation. Authorizing on it can BOTH deny the person who
 * is genuinely actionable and admit someone who no longer is — while
 * `delegate_gate_approval` locks and checks the step row, so only the step
 * matches the RPC's own boundary.
 */

const state = vi.hoisted(() => ({
  approvalRow: null as any,
  stepRow: null as any,
  profiles: [] as any[],
  actor: { userId: 'assignee-step', role: 'project_manager', tenantId: 'tenant-a' } as any,
}))

function builderFor(table: string) {
  const b: Record<string, any> = {
    select: () => b,
    eq: () => b,
    in: () => b,
    order: () => b,
    limit: () => b,
    single: async () => ({
      data: table === 'approvals' ? state.approvalRow : null,
      error: null,
    }),
    maybeSingle: async () => ({
      data: table === 'approval_steps' ? state.stepRow : null,
      error: null,
    }),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'profiles' ? state.profiles : null,
        error: null,
      }).then(resolve, reject),
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (t: string) => builderFor(t),
    rpc: async () => ({ data: null, error: null }),
  }),
}))
vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => 'tenant-a' }))
vi.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ userId: state.actor.userId, profile: {} }),
  requireApprover: async () => ({ actor: state.actor }),
  requireWriter: async () => ({ actor: state.actor }),
  requireInternalRole: async () => ({ userId: state.actor.userId, profile: {} }),
  getAuthActor: async () => ({ actor: state.actor }),
  requireAssignedApprover: async () => ({ actor: state.actor }),
  ADMIN_ROLES: ['system_admin', 'tenant_admin'],
}))
vi.mock('@/lib/email/send', () => ({
  sendApprovalRequestEmail: vi.fn(async () => {}),
  sendApprovalDecisionEmail: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/app/actions/signatures', () => ({
  createSignature: vi.fn(), stageGateSignatureImage: vi.fn(),
}))
vi.mock('@/lib/approvals/signature-storage', () => ({
  deleteFailedStagedSignature: vi.fn(async () => ({ removed: true })),
}))
vi.mock('@/app/actions/phase-gates', () => ({ advanceProjectGate: vi.fn(async () => ({ error: null })) }))

import { getEligibleDelegates } from '@/app/actions/approvals'

// `filterEligibleDelegates` requires real UUID profile ids — the whole reason it
// exists is that the picker once shipped email strings the RPC could never
// accept. Fixture ids must therefore be UUIDs or every roster is vacuously empty.
const STEP_ASSIGNEE = '00000000-0000-0000-0000-00000000a001'
const PEER = '00000000-0000-0000-0000-00000000a002'
const STALE_ASSIGNEE = '00000000-0000-0000-0000-00000000a003'
const ADMIN = '00000000-0000-0000-0000-00000000a004'
const OUTSIDER = '00000000-0000-0000-0000-00000000a005'

const CANDIDATES = [
  { id: STEP_ASSIGNEE, tenant_id: 'tenant-a', full_name: 'Step Assignee', role: 'project_manager', is_active: true },
  { id: PEER, tenant_id: 'tenant-a', full_name: 'Peer One', role: 'project_manager', is_active: true },
  { id: STALE_ASSIGNEE, tenant_id: 'tenant-a', full_name: 'Stale', role: 'project_manager', is_active: true },
]

beforeEach(() => {
  state.actor = { userId: STEP_ASSIGNEE, role: 'project_manager', tenantId: 'tenant-a' }
  state.profiles = CANDIDATES
  // approvals.assignee_id is deliberately NOT selected by the action any more.
  // The step row below is the only assignment authority in these tests.
  state.approvalRow = { id: 'appr-1', tenant_id: 'tenant-a', status: 'pending' }
  state.stepRow = { assigned_to: STEP_ASSIGNEE, assigned_role: 'project_manager' }
})

describe('authorizes on the current pending step, not approvals.assignee_id', () => {
  it('ALLOWS the current step assignee', async () => {
    state.actor.userId = STEP_ASSIGNEE
    const res = await getEligibleDelegates('appr-1')
    expect(res.length).toBeGreaterThan(0)
  })

  it('DENIES a stale prior assignee who no longer holds the current step', async () => {
    // This identity would have been authorized by the old approvals.assignee_id
    // check; only the step row reflects who is actionable NOW.
    state.actor.userId = STALE_ASSIGNEE
    state.stepRow = { assigned_to: STEP_ASSIGNEE, assigned_role: 'project_manager' }
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })

  it('DENIES an unrelated viewer (silent empty list, not an error)', async () => {
    state.actor = { userId: OUTSIDER, role: 'engineer', tenantId: 'tenant-a' }
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })

  it('ALLOWS a platform admin as an override', async () => {
    state.actor = { userId: ADMIN, role: 'tenant_admin', tenantId: 'tenant-a' }
    const res = await getEligibleDelegates('appr-1')
    expect(res.length).toBeGreaterThan(0)
  })

  it('excludes the CURRENT STEP assignee from the returned roster', async () => {
    const res = await getEligibleDelegates('appr-1')
    // Non-vacuous: the roster is non-empty and simply omits the step holder.
    expect(res.length).toBeGreaterThan(0)
    expect(res.map((d) => d.id)).not.toContain(STEP_ASSIGNEE)
    expect(res.map((d) => d.id)).toContain(PEER)
  })
})

describe('returns [] when there is no pending step', () => {
  it('returns [] for an approval with no current pending step', async () => {
    state.stepRow = null
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })

  it('returns [] with no pending step EVEN for a platform admin', async () => {
    // Nothing is actionable, so there is nothing to delegate — and the tenant's
    // approver roster is not disclosed for an already-decided approval.
    state.stepRow = null
    state.actor = { userId: ADMIN, role: 'tenant_admin', tenantId: 'tenant-a' }
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })

  it('returns [] when the approval itself is missing or foreign-tenant', async () => {
    state.approvalRow = null
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })

  it('returns [] when a pending step exists but is unassigned', async () => {
    state.stepRow = { assigned_to: null, assigned_role: 'project_manager' }
    state.actor = { userId: STEP_ASSIGNEE, role: 'project_manager', tenantId: 'tenant-a' }
    // A null assigned_to must never match a null/undefined actor id by accident.
    expect(await getEligibleDelegates('appr-1')).toEqual([])
  })
})

/**
 * Integration/action-level segregation of duties: the roster must never contain
 * the approval's REQUESTER, the current-step assignee, or the authenticated
 * actor — even when the requester holds a privileged (admin) role that would
 * otherwise pass the admin branch. Uses DISTINCT requester / assignee / delegate
 * UUIDs so no single omission can pass vacuously.
 */
const REQUESTER = '00000000-0000-0000-0000-00000000b001'
const ASSIGNEE = '00000000-0000-0000-0000-00000000b002'
const DELEGATE = '00000000-0000-0000-0000-00000000b003'
const DELEGATE2 = '00000000-0000-0000-0000-00000000b004'

describe('excludes requester, current-step assignee, and actor from the roster', () => {
  beforeEach(() => {
    // Actor is the current step assignee (authorized). Requester is a DIFFERENT
    // person who also happens to be a tenant_admin (the production leak shape).
    state.actor = { userId: ASSIGNEE, role: 'project_manager', tenantId: 'tenant-a' }
    state.approvalRow = { id: 'appr-9', tenant_id: 'tenant-a', status: 'pending', requester_id: REQUESTER }
    state.stepRow = { assigned_to: ASSIGNEE, assigned_role: 'project_manager' }
    state.profiles = [
      { id: REQUESTER, tenant_id: 'tenant-a', full_name: 'Requester Admin', role: 'tenant_admin', is_active: true },
      { id: ASSIGNEE, tenant_id: 'tenant-a', full_name: 'Assignee', role: 'project_manager', is_active: true },
      { id: DELEGATE, tenant_id: 'tenant-a', full_name: 'Eligible PM', role: 'project_manager', is_active: true },
      { id: DELEGATE2, tenant_id: 'tenant-a', full_name: 'Eligible Admin', role: 'tenant_admin', is_active: true },
    ]
  })

  it('returns a NON-EMPTY roster (exclusions are not vacuous)', async () => {
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain(DELEGATE) // matching-role non-admin remains available
    expect(ids).toContain(DELEGATE2) // a different eligible tenant_admin remains
  })

  it('NEVER includes the requester (tenant_admin)', async () => {
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids).not.toContain(REQUESTER)
  })

  it('NEVER includes the requester when they are a system_admin', async () => {
    state.profiles = state.profiles.map((p) =>
      p.id === REQUESTER ? { ...p, role: 'system_admin' } : p,
    )
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids).not.toContain(REQUESTER)
    expect(ids.length).toBeGreaterThan(0)
  })

  it('NEVER includes the current-step assignee', async () => {
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids).not.toContain(ASSIGNEE)
  })

  it('NEVER includes the authenticated actor (admin override case)', async () => {
    // A platform admin who is ALSO the requester views the roster: they must not
    // see themselves, and must not see the requester (which is themselves here).
    state.actor = { userId: REQUESTER, role: 'tenant_admin', tenantId: 'tenant-a' }
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids).not.toContain(REQUESTER)
    expect(ids.length).toBeGreaterThan(0) // still offers the genuine delegates
  })

  it('still excludes unrelated-role, inactive, and cross-tenant candidates', async () => {
    state.profiles = [
      { id: DELEGATE, tenant_id: 'tenant-a', full_name: 'Eligible PM', role: 'project_manager', is_active: true },
      { id: '00000000-0000-0000-0000-00000000b010', tenant_id: 'tenant-a', full_name: 'Viewer', role: 'viewer', is_active: true },
      { id: '00000000-0000-0000-0000-00000000b011', tenant_id: 'tenant-a', full_name: 'Inactive PM', role: 'project_manager', is_active: false },
      { id: '00000000-0000-0000-0000-00000000b012', tenant_id: 'tenant-b', full_name: 'Foreign PM', role: 'project_manager', is_active: true },
    ]
    const ids = (await getEligibleDelegates('appr-9')).map((d) => d.id)
    expect(ids).toEqual([DELEGATE])
  })
})
