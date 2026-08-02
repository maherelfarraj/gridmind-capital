/**
 * Tests for the reversal of an unintended internal → external conversion.
 *
 * The planner is pure, so every refusal rule is asserted directly. The service
 * is driven through an injected client so the ORDER and CONTENT of the writes
 * are asserted too — a reversal that "returns no error" while writing the wrong
 * columns is the exact failure mode this repair exists to undo.
 */

import { describe, it, expect } from 'vitest'

import {
  planConversionReversal,
  verifyReversal,
  REVERSAL_OP,
  type ReversibleProfile,
  type ConversionAuditRow,
} from '@/lib/admin/revert-conversion'
import { revertExternalConversion } from '@/lib/admin/revert-conversion-service'

const TENANT = '00000000-0000-0000-0000-000000000001'

/** The account as production actually left it after the preview test. */
const convertedProfile: ReversibleProfile = {
  id: '77f6c456-885e-4516-8009-c3e7b936d742',
  email: 'ahmad+gcm@gsi.jo',
  role: 'subcontractor',
  user_type: 'external',
  external_org: 'Test Vendor Company',
  tenant_id: TENANT,
  is_active: true,
}

/** The audit row production actually wrote for that conversion. */
const conversionAudit: ConversionAuditRow = {
  changed_at: '2026-08-02T18:41:53.005259+00:00',
  old_values: {
    role: 'engineer',
    is_active: true,
    tenant_id: TENANT,
    user_type: 'internal',
    external_org: null,
  },
  new_values: {
    op: 'provision_external',
    role: 'subcontractor',
    reason: 'reinvite_existing_external',
    is_active: true,
    tenant_id: TENANT,
    user_type: 'external',
    external_org: 'Test Vendor Company',
  },
}

describe('planConversionReversal', () => {
  it('restores the role and user_type recorded in the audit row', () => {
    const res = planConversionReversal({ profile: convertedProfile, auditRow: conversionAudit })
    expect('plan' in res).toBe(true)
    if (!('plan' in res)) return

    expect(res.plan.patch).toEqual({
      role: 'engineer',
      user_type: 'internal',
      external_org: null,
    })
  })

  it('never includes tenant_id or is_active in the patch', () => {
    const res = planConversionReversal({ profile: convertedProfile, auditRow: conversionAudit })
    if (!('plan' in res)) throw new Error('expected a plan')

    // The patch is what gets written. Anything absent here cannot be modified.
    expect(Object.keys(res.plan.patch).sort()).toEqual(['external_org', 'role', 'user_type'])
  })

  it('records a reason that explains the reversal', () => {
    const res = planConversionReversal({ profile: convertedProfile, auditRow: conversionAudit })
    if (!('plan' in res)) throw new Error('expected a plan')
    expect(res.plan.reason).toMatch(/unintended internal-to-external conversion/i)
    expect(res.plan.convertedAt).toBe('2026-08-02T18:41:53.005259+00:00')
  })

  it('refuses when the account is already internal (repeat run is a no-op)', () => {
    const res = planConversionReversal({
      profile: { ...convertedProfile, role: 'engineer', user_type: 'internal', external_org: null },
      auditRow: conversionAudit,
    })
    expect('error' in res).toBe(true)
    if ('error' in res) expect(res.error).toMatch(/already an internal user/i)
  })

  it('refuses when no conversion audit row exists rather than guessing', () => {
    const res = planConversionReversal({ profile: convertedProfile, auditRow: null })
    expect('error' in res).toBe(true)
    if ('error' in res) expect(res.error).toMatch(/cannot be proven|refusing to guess/i)
  })

  it('refuses when the audit row lacks the previous role', () => {
    const res = planConversionReversal({
      profile: convertedProfile,
      auditRow: { ...conversionAudit, old_values: { user_type: 'internal' } },
    })
    expect('error' in res).toBe(true)
    if ('error' in res) expect(res.error).toMatch(/does not record the previous role/i)
  })

  it('refuses to reverse an external → external re-invite', () => {
    const res = planConversionReversal({
      profile: convertedProfile,
      auditRow: {
        ...conversionAudit,
        old_values: { role: 'subcontractor', user_type: 'external', external_org: 'Acme' },
      },
    })
    expect('error' in res).toBe(true)
    if ('error' in res) expect(res.error).toMatch(/nothing to reverse/i)
  })

  it('refuses when the account changed after the conversion (drift)', () => {
    const res = planConversionReversal({
      // A later, possibly deliberate, edit moved them to client_viewer.
      profile: { ...convertedProfile, role: 'client_viewer' },
      auditRow: conversionAudit,
    })
    expect('error' in res).toBe(true)
    if ('error' in res) expect(res.error).toMatch(/changed since|refusing to overwrite/i)
  })
})

describe('verifyReversal', () => {
  const expected = { role: 'engineer', user_type: 'internal', external_org: null }

  it('accepts a correctly persisted row', () => {
    expect(verifyReversal({ role: 'engineer', user_type: 'internal', external_org: null }, expected)).toBeNull()
  })

  it('rejects a row where external_org was left behind', () => {
    expect(
      verifyReversal({ role: 'engineer', user_type: 'internal', external_org: 'Test Vendor Company' }, expected),
    ).toMatch(/external_org/)
  })

  it('rejects an unreadable row rather than assuming success', () => {
    expect(verifyReversal(null, expected)).toMatch(/could not be read back/i)
  })
})

// ─────────────────────────────────────────────────────────────
// Service: sequencing and payloads
// ─────────────────────────────────────────────────────────────

function makeClient(opts?: { grants?: number; profileAfter?: Record<string, unknown> }) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = []
  let profile: Record<string, unknown> = { ...convertedProfile }

  const client = {
    from(table: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        order: () => q,
        limit: async () =>
          table === 'audit_log' ? { data: [conversionAudit], error: null } : { data: [], error: null },
        maybeSingle: async () => ({ data: profile, error: null }),
        update: (payload: unknown) => {
          calls.push({ table, op: 'update', payload })
          if (table === 'profiles') profile = { ...profile, ...(payload as object) }
          return q
        },
        insert: async (payload: unknown) => {
          calls.push({ table, op: 'insert', payload })
          return { error: null }
        },
        then: (resolve: (v: unknown) => unknown) => {
          if (table === 'external_access') {
            const rows = Array.from({ length: opts?.grants ?? 0 }, (_, i) => ({ project_id: `p${i}` }))
            return Promise.resolve({ data: rows, error: null }).then(resolve)
          }
          return Promise.resolve({ data: null, error: null }).then(resolve)
        },
      }
      return q
    },
  }

  return { client, calls }
}

describe('revertExternalConversion', () => {
  it('writes only role, user_type and external_org to the profile', async () => {
    const { client, calls } = makeClient()
    const res = await revertExternalConversion(client, {
      email: 'ahmad+gcm@gsi.jo',
      actorId: 'actor-1',
    })

    expect('error' in res).toBe(false)
    const profileUpdate = calls.find((c) => c.table === 'profiles' && c.op === 'update')
    expect(profileUpdate).toBeDefined()
    expect(Object.keys(profileUpdate!.payload as object).sort()).toEqual([
      'external_org',
      'role',
      'user_type',
    ])
    expect(profileUpdate!.payload).toMatchObject({ role: 'engineer', user_type: 'internal', external_org: null })
  })

  it('writes an audit row carrying the reversal op and reason', async () => {
    const { client, calls } = makeClient()
    await revertExternalConversion(client, { email: 'ahmad+gcm@gsi.jo', actorId: 'actor-1' })

    const audit = calls.find((c) => c.table === 'audit_log' && c.op === 'insert')
    expect(audit).toBeDefined()
    const payload = audit!.payload as any
    expect(payload.new_values.op).toBe(REVERSAL_OP)
    expect(payload.new_values.reason).toMatch(/unintended internal-to-external conversion/i)
    expect(payload.old_values).toMatchObject({ role: 'subcontractor', user_type: 'external' })
    expect(payload.changed_by).toBe('actor-1')
  })

  it('revokes external project access before restoring the profile', async () => {
    const { client, calls } = makeClient({ grants: 2 })
    const res = await revertExternalConversion(client, { email: 'ahmad+gcm@gsi.jo', actorId: 'actor-1' })

    if ('error' in res) throw new Error(res.error)
    expect(res.revokedGrants).toBe(2)

    const revokeIdx = calls.findIndex((c) => c.table === 'external_access' && c.op === 'update')
    const profileIdx = calls.findIndex((c) => c.table === 'profiles' && c.op === 'update')
    expect(revokeIdx).toBeGreaterThanOrEqual(0)
    // Privileges must come off before the identity is restored, so a failure
    // between the two leaves less access, never more.
    expect(revokeIdx).toBeLessThan(profileIdx)
  })

  it('dryRun performs no writes at all', async () => {
    const { client, calls } = makeClient({ grants: 3 })
    const res = await revertExternalConversion(client, {
      email: 'ahmad+gcm@gsi.jo',
      actorId: 'actor-1',
      dryRun: true,
    })

    if ('error' in res) throw new Error(res.error)
    expect(res.plan.patch).toEqual({ role: 'engineer', user_type: 'internal', external_org: null })
    expect(res.revokedGrants).toBe(3)
    expect(calls).toHaveLength(0)
  })
})
