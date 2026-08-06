import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `findOrphanedGateSignatures` runs on the RLS-BYPASSING admin client, so these
 * tests exist to prove it authorizes and tenant-scopes ITSELF. Before this
 * round it did neither: any caller could enumerate every tenant's signer names.
 */

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const PROJECT = '33333333-3333-4333-8333-333333333333'
const OTHER_PROJECT = '44444444-4444-4444-8444-444444444444'
const GATE = '55555555-5555-4555-8555-555555555555'
const OTHER_GATE = '66666666-6666-4666-8666-666666666666'
const APPROVAL = '77777777-7777-4777-8777-777777777777'

const state = vi.hoisted(() => ({
  actor: null as { userId: string; tenantId: string; role: string } | null,
  tables: {} as Record<string, unknown[]>,
  /** Every tenant_id filter applied, so we can prove scoping actually happened. */
  tenantFilters: [] as { table: string; value: unknown }[],
}))

vi.mock('@/lib/auth/guard', () => ({
  getAuthActor: async () =>
    state.actor ? { actor: state.actor } : { error: 'Not authenticated' },
  requireUser: async () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => TENANT }))
vi.mock('next/headers', () => ({ headers: async () => new Map() }))

vi.mock('@/lib/supabase/admin', () => {
  const makeQuery = (table: string) => {
    let rows = [...(state.tables[table] ?? [])] as Record<string, unknown>[]
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      eq: (col: string, val: unknown) => {
        if (col === 'tenant_id') state.tenantFilters.push({ table, value: val })
        rows = rows.filter((r) => r[col] === val)
        return q
      },
      lt: (col: string, val: unknown) => {
        rows = rows.filter((r) => String(r[col]) < String(val))
        return q
      },
      in: (col: string, vals: unknown[]) => {
        rows = rows.filter((r) => vals.includes(r[col]))
        return q
      },
      then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    }
    return q
  }
  return { createAdminClient: () => ({ from: (table: string) => makeQuery(table) }) }
})

// A static import is safe here: `vi.mock` calls are hoisted above it, so the
// mocks are registered before the module under test is evaluated. Top-level
// `await import` would break `tsc` under this tsconfig's module setting.
import { findOrphanedGateSignatures } from '@/app/actions/signatures'

beforeEach(() => {
  state.actor = { userId: 'u1', tenantId: TENANT, role: 'tenant_admin' }
  state.tenantFilters = []
  state.tables = {
    signatures: [
      {
        id: 'sig-canonical',
        tenant_id: TENANT,
        entity_type: 'gate_approval',
        entity_id: GATE, // canonical v4 identity = phase_gates.id
        signer_name: 'Alice Approver',
        signed_at: '2026-01-01T00:00:00Z',
      },
    ],
    phase_gates: [
      { id: GATE, project_id: PROJECT, phase_number: 3 },
      { id: OTHER_GATE, project_id: OTHER_PROJECT, phase_number: 3 },
    ],
    projects: [
      { id: PROJECT, tenant_id: TENANT },
      { id: OTHER_PROJECT, tenant_id: OTHER_TENANT },
    ],
    approvals: [
      {
        id: APPROVAL,
        tenant_id: TENANT,
        object_type: 'gate',
        object_id: PROJECT,
        gate_number: 3,
        title: 'G3 Gate Approval',
        decided_at: null,
      },
    ],
  }
})

describe('findOrphanedGateSignatures — authorization', () => {
  it('returns NOTHING to an unauthenticated caller', async () => {
    state.actor = null
    await expect(findOrphanedGateSignatures()).resolves.toEqual({ orphans: [] })
  })

  it.each(['viewer', 'engineer', 'project_manager', 'project_director', 'finance_manager'])(
    'returns NOTHING to a non-admin caller (%s)',
    async (role) => {
      state.actor = { userId: 'u1', tenantId: TENANT, role }
      await expect(findOrphanedGateSignatures()).resolves.toEqual({ orphans: [] })
    },
  )

  it.each(['system_admin', 'tenant_admin'])('permits %s', async (role) => {
    state.actor = { userId: 'u1', tenantId: TENANT, role }
    const res = await findOrphanedGateSignatures()
    expect('orphans' in res && res.orphans).toHaveLength(1)
  })

  it('never discloses signer identity to an unauthorized caller', async () => {
    state.actor = { userId: 'u1', tenantId: TENANT, role: 'viewer' }
    const res = await findOrphanedGateSignatures()
    expect(JSON.stringify(res)).not.toContain('Alice Approver')
  })
})

describe('findOrphanedGateSignatures — tenant scoping', () => {
  it('filters signatures, projects and approvals by the caller tenant', async () => {
    await findOrphanedGateSignatures()
    const scoped = state.tenantFilters.filter((f) => f.value === TENANT).map((f) => f.table)
    expect(scoped).toContain('signatures')
    expect(scoped).toContain('projects')
    expect(scoped).toContain('approvals')
  })

  it('EXCLUDES a signature whose phase gate belongs to another tenant', async () => {
    state.tables.signatures = [
      {
        id: 'sig-foreign',
        tenant_id: TENANT,
        entity_type: 'gate_approval',
        entity_id: OTHER_GATE, // gate hangs off a project in OTHER_TENANT
        signer_name: 'Foreign Signer',
        signed_at: '2026-01-01T00:00:00Z',
      },
    ]
    // An approval in OUR tenant that points at the FOREIGN project. Without
    // this row the exclusion would be enforced by the approvals tenant filter
    // alone, so deleting the project-ownership filter would still "pass" — the
    // test would prove nothing about the guard it claims to cover. With it, the
    // project filter is the ONLY thing standing between the caller and another
    // tenant's signer name.
    state.tables.approvals = [
      ...state.tables.approvals,
      {
        id: 'appr-foreign-ref',
        tenant_id: TENANT,
        object_type: 'gate',
        object_id: OTHER_PROJECT,
        gate_number: 3,
        title: 'Stale cross-tenant reference',
        decided_at: null,
      },
    ]

    const res = await findOrphanedGateSignatures()
    // Dropped outright — not surfaced as an "unresolvable orphan", which would
    // leak the existence of another tenant's row.
    expect(res).toEqual({ orphans: [] })
    expect(JSON.stringify(res)).not.toContain('Foreign Signer')
  })

  it('does not return another tenant\'s signer information', async () => {
    state.actor = { userId: 'u1', tenantId: OTHER_TENANT, role: 'tenant_admin' }
    const res = await findOrphanedGateSignatures()
    expect(JSON.stringify(res)).not.toContain('Alice Approver')
  })
})

describe('findOrphanedGateSignatures — identity resolution', () => {
  it('resolves the CANONICAL phase-gate identity (entity_id -> phase_gates.id)', async () => {
    // Regression guard: resolving entity_id straight to approvals.id matches
    // nothing for v4-written rows, so the report would look clean while real
    // orphans existed.
    const res = await findOrphanedGateSignatures()
    expect('orphans' in res && res.orphans).toEqual([
      expect.objectContaining({
        signatureId: 'sig-canonical',
        approvalId: APPROVAL,
        approvalTitle: 'G3 Gate Approval',
        signerName: 'Alice Approver',
        resolvedVia: 'phase_gate',
      }),
    ])
  })

  it('excludes a canonical signature whose parent approval is DECIDED', async () => {
    state.tables.approvals = [
      { ...(state.tables.approvals[0] as object), decided_at: '2026-02-01T00:00:00Z' },
    ]
    await expect(findOrphanedGateSignatures()).resolves.toEqual({ orphans: [] })
  })

  it('resolves a legacy approval-keyed signature ONLY through the compatibility path', async () => {
    state.tables.signatures = [
      {
        id: 'sig-legacy',
        tenant_id: TENANT,
        entity_type: 'gate_approval',
        entity_id: APPROVAL, // pre-v4: keyed straight to the approval id
        signer_name: 'Legacy Signer',
        signed_at: '2026-01-01T00:00:00Z',
      },
    ]

    // Default: legacy rows are NOT mixed into canonical results.
    await expect(findOrphanedGateSignatures()).resolves.toEqual({ orphans: [] })

    // Opt-in compatibility path resolves it, and labels how.
    const legacy = await findOrphanedGateSignatures(0, { includeLegacyApprovalKeyed: true })
    expect('orphans' in legacy && legacy.orphans).toEqual([
      expect.objectContaining({
        signatureId: 'sig-legacy',
        approvalId: APPROVAL,
        resolvedVia: 'legacy_approval',
      }),
    ])
  })

  it('does not resolve a legacy row belonging to another tenant even with the flag on', async () => {
    state.tables.signatures = [
      {
        id: 'sig-legacy-foreign',
        tenant_id: OTHER_TENANT,
        entity_type: 'gate_approval',
        entity_id: APPROVAL,
        signer_name: 'Foreign Legacy',
        signed_at: '2026-01-01T00:00:00Z',
      },
    ]
    const res = await findOrphanedGateSignatures(0, { includeLegacyApprovalKeyed: true })
    expect(res).toEqual({ orphans: [] })
  })
})
