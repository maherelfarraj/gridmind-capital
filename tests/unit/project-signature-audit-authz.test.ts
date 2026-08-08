import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `getProjectSignatureAudit` runs on the RLS-BYPASSING admin client, so these
 * tests exist to prove it authorizes and tenant-scopes ITSELF. Before this fix
 * it did neither: it queried `signatures` by `project_id` alone with no auth
 * check, so any caller could read any tenant's project signatures (and their
 * signed URLs).
 */

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'
const PROJECT = '33333333-3333-4333-8333-333333333333'
const FOREIGN_PROJECT = '44444444-4444-4444-8444-444444444444'

const state = vi.hoisted(() => ({
  actor: null as { userId: string; tenantId: string; role: string } | null,
  tables: {} as Record<string, unknown[]>,
  /** Every filter applied to the `signatures` query, so we can prove scoping happened. */
  signatureFilters: [] as { col: string; value: unknown }[],
  /** Every filter applied to the `projects` ownership check. */
  projectFilters: [] as { col: string; value: unknown }[],
  signedUrlCalls: [] as string[],
}))

vi.mock('@/lib/auth/guard', () => ({
  getAuthActor: async () =>
    state.actor ? { actor: state.actor } : { error: 'Not authenticated' },
  requireUser: async () => ({ user: { id: 'u1' } }),
}))

vi.mock('@/lib/tenant', () => ({ getCurrentTenantId: async () => TENANT }))
vi.mock('next/headers', () => ({ headers: async () => new Map() }))

vi.mock('@/lib/approvals/signature-storage', () => ({
  buildStagedSignaturePath: (tenantId: string, entityId: string, stamp: number) =>
    `signatures/${tenantId}/staged/${entityId}-${stamp}.png`,
  uploadSignatureObject: vi.fn(async () => null),
  createSignatureSignedUrl: vi.fn(async (path: string) => {
    state.signedUrlCalls.push(path)
    return `https://signed.example/${path}`
  }),
  deleteFailedStagedSignature: vi.fn(async () => ({ removed: true })),
}))

vi.mock('@/lib/supabase/admin', () => {
  const makeQuery = (table: string) => {
    let rows = [...(state.tables[table] ?? [])] as Record<string, unknown>[]
    let single = false
    const q: Record<string, unknown> = {
      select: () => q,
      order: () => q,
      eq: (col: string, val: unknown) => {
        if (table === 'signatures') state.signatureFilters.push({ col, value: val })
        if (table === 'projects') state.projectFilters.push({ col, value: val })
        rows = rows.filter((r) => r[col] === val)
        return q
      },
      maybeSingle: async () => {
        single = true
        return { data: rows[0] ?? null, error: null }
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (single) return resolve({ data: rows[0] ?? null, error: null })
        return resolve({ data: rows, error: null })
      },
    }
    return q
  }
  return { createAdminClient: () => ({ from: (table: string) => makeQuery(table) }) }
})

// A static import is safe here: `vi.mock` calls are hoisted above it, so the
// mocks are registered before the module under test is evaluated.
import { getProjectSignatureAudit } from '@/app/actions/signatures'

beforeEach(() => {
  state.actor = { userId: 'u1', tenantId: TENANT, role: 'tenant_admin' }
  state.signatureFilters = []
  state.projectFilters = []
  state.signedUrlCalls = []
  state.tables = {
    projects: [
      { id: PROJECT, tenant_id: TENANT },
      { id: FOREIGN_PROJECT, tenant_id: OTHER_TENANT },
    ],
    signatures: [
      {
        id: 'sig-1',
        tenant_id: TENANT,
        project_id: PROJECT,
        entity_type: 'gate_approval',
        entity_id: 'gate-1',
        signer_id: 'u1',
        signer_name: 'Alice Approver',
        signer_role: 'tenant_admin',
        signature_image_path: `signatures/${TENANT}/gate_approval/gate-1-1.png`,
        signed_at: '2026-01-01T00:00:00Z',
        ip_address: '10.0.0.1',
        statement: 'I endorse this gate decision.',
      },
    ],
  }
})

describe('getProjectSignatureAudit — authentication', () => {
  it('returns [] for an unauthenticated caller', async () => {
    state.actor = null
    await expect(getProjectSignatureAudit(PROJECT)).resolves.toEqual([])
  })

  it('never issues a signature query for an unauthenticated caller', async () => {
    state.actor = null
    await getProjectSignatureAudit(PROJECT)
    expect(state.signatureFilters).toHaveLength(0)
  })

  it('never generates a signed URL for an unauthenticated caller', async () => {
    state.actor = null
    await getProjectSignatureAudit(PROJECT)
    expect(state.signedUrlCalls).toHaveLength(0)
  })
})

describe('getProjectSignatureAudit — tenant scoping of the project', () => {
  it('returns [] when the project belongs to another tenant', async () => {
    await expect(getProjectSignatureAudit(FOREIGN_PROJECT)).resolves.toEqual([])
  })

  it('returns [] when the project does not exist at all', async () => {
    await expect(getProjectSignatureAudit('does-not-exist')).resolves.toEqual([])
  })

  it('never reaches the signature query for a cross-tenant project', async () => {
    await getProjectSignatureAudit(FOREIGN_PROJECT)
    expect(state.signatureFilters).toHaveLength(0)
  })

  it('never reaches signed-URL generation for a cross-tenant project', async () => {
    await getProjectSignatureAudit(FOREIGN_PROJECT)
    expect(state.signedUrlCalls).toHaveLength(0)
  })

  it('never discloses another tenant\'s signer information for a cross-tenant project', async () => {
    // Even if a signatures row happened to exist for the foreign project id,
    // the ownership check must refuse before it is ever read.
    state.tables.signatures = [
      {
        id: 'sig-foreign',
        tenant_id: OTHER_TENANT,
        project_id: FOREIGN_PROJECT,
        entity_type: 'gate_approval',
        entity_id: 'gate-2',
        signer_id: 'u2',
        signer_name: 'Foreign Signer',
        signer_role: 'tenant_admin',
        signature_image_path: `signatures/${OTHER_TENANT}/gate_approval/gate-2-1.png`,
        signed_at: '2026-01-01T00:00:00Z',
        ip_address: '10.0.0.2',
        statement: 'Foreign statement.',
      },
    ]
    const res = await getProjectSignatureAudit(FOREIGN_PROJECT)
    expect(res).toEqual([])
    expect(JSON.stringify(res)).not.toContain('Foreign Signer')
  })

  it('the owned-project lookup query is filtered by BOTH id and tenant_id', async () => {
    await getProjectSignatureAudit(PROJECT)
    const cols = state.projectFilters.map((f) => f.col)
    expect(cols).toContain('id')
    expect(cols).toContain('tenant_id')
    expect(state.projectFilters).toContainEqual({ col: 'tenant_id', value: TENANT })
  })
})

describe('getProjectSignatureAudit — tenant scoping of the signature query', () => {
  it('the signature query is filtered by BOTH tenant_id and project_id', async () => {
    await getProjectSignatureAudit(PROJECT)
    const cols = state.signatureFilters.map((f) => f.col)
    expect(cols).toContain('tenant_id')
    expect(cols).toContain('project_id')
    expect(state.signatureFilters).toContainEqual({ col: 'tenant_id', value: TENANT })
    expect(state.signatureFilters).toContainEqual({ col: 'project_id', value: PROJECT })
  })

  it('returns the owned project\'s signatures, converted to signed URLs', async () => {
    const res = await getProjectSignatureAudit(PROJECT)
    expect(res).toEqual([
      expect.objectContaining({
        id: 'sig-1',
        projectId: PROJECT,
        signerName: 'Alice Approver',
        signatureImageUrl: expect.stringContaining('signed.example'),
      }),
    ])
    expect(state.signedUrlCalls).toEqual([`signatures/${TENANT}/gate_approval/gate-1-1.png`])
  })

  it('does not return another tenant\'s signatures even for an owned project id collision', async () => {
    state.tables.signatures = [
      ...state.tables.signatures,
      {
        id: 'sig-cross-tenant',
        tenant_id: OTHER_TENANT,
        project_id: PROJECT, // same project id, different tenant's row (shouldn't exist in practice)
        entity_type: 'gate_approval',
        entity_id: 'gate-3',
        signer_id: 'u3',
        signer_name: 'Cross Tenant Signer',
        signer_role: 'tenant_admin',
        signature_image_path: `signatures/${OTHER_TENANT}/gate_approval/gate-3-1.png`,
        signed_at: '2026-01-02T00:00:00Z',
        ip_address: '10.0.0.3',
        statement: 'Cross tenant statement.',
      },
    ]
    const res = await getProjectSignatureAudit(PROJECT)
    expect(res).toHaveLength(1)
    expect(JSON.stringify(res)).not.toContain('Cross Tenant Signer')
  })
})
