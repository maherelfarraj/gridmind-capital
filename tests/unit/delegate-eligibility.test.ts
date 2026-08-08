import { describe, expect, it } from 'vitest'
import {
  isUuid,
  isEligibleDelegate,
  filterEligibleDelegates,
  type DelegateCandidate,
  type EligibilityContext,
} from '@/lib/approvals/delegate-eligibility'

/**
 * The delegate picker used to render five HARD-CODED email strings as the
 * `delegateId`. delegate_gate_approval needs a real profile UUID, so every one
 * of those picks was structurally un-actionable. These tests pin the rule that
 * now gates the picker AND mirrors what the DB RPC will accept: real UUID, same
 * tenant, active, an approver role, and either an admin or the required role.
 */

const TENANT = 'tenant-a'
const U1 = '20000000-0000-0000-0000-000000000001'
const U2 = '20000000-0000-0000-0000-000000000002'
const U3 = '20000000-0000-0000-0000-000000000003'

const ctx: EligibilityContext = {
  tenantId: TENANT,
  requiredRole: 'project_manager',
  approverRoles: ['project_manager', 'tenant_admin', 'system_admin', 'project_director'],
  adminRoles: ['system_admin', 'tenant_admin'],
  excludedIds: [],
}

const cand = (over: Partial<DelegateCandidate>): DelegateCandidate => ({
  id: U1,
  tenantId: TENANT,
  role: 'project_manager',
  isActive: true,
  name: 'Person',
  ...over,
})

describe('isUuid', () => {
  it('accepts real UUIDs and rejects emails / junk', () => {
    expect(isUuid(U1)).toBe(true)
    expect(isUuid('maher@gsi.jo')).toBe(false)
    expect(isUuid('tenant_admin')).toBe(false)
    expect(isUuid('')).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('isEligibleDelegate', () => {
  it('accepts an active same-tenant profile holding the required role', () => {
    expect(isEligibleDelegate(cand({}), ctx)).toBe(true)
  })

  it('rejects a non-UUID id (the old hard-coded-email bug)', () => {
    expect(isEligibleDelegate(cand({ id: 'maher@gsi.jo' as any }), ctx)).toBe(false)
  })

  it('rejects a different tenant', () => {
    expect(isEligibleDelegate(cand({ id: U2, tenantId: 'tenant-b' }), ctx)).toBe(false)
  })

  it('rejects an inactive profile', () => {
    expect(isEligibleDelegate(cand({ id: U2, isActive: false }), ctx)).toBe(false)
  })

  it('rejects a role not authorized to approve at all', () => {
    expect(isEligibleDelegate(cand({ id: U2, role: 'viewer' }), ctx)).toBe(false)
  })

  it('accepts an admin for any required role', () => {
    expect(isEligibleDelegate(cand({ id: U2, role: 'tenant_admin' }), ctx)).toBe(true)
  })

  it('rejects a non-admin approver whose role != the required role', () => {
    expect(isEligibleDelegate(cand({ id: U2, role: 'project_director' }), ctx)).toBe(false)
  })

  it('excludes any id in excludedIds, even an otherwise-eligible one', () => {
    expect(isEligibleDelegate(cand({ id: U1 }), { ...ctx, excludedIds: [U1] })).toBe(false)
  })

  it('excludes an admin-role id when it is in excludedIds (no role re-admit)', () => {
    // A tenant_admin would normally pass the admin branch; being excluded wins.
    expect(
      isEligibleDelegate(cand({ id: U1, role: 'tenant_admin' }), { ...ctx, excludedIds: [U1] }),
    ).toBe(false)
  })

  it('ignores null / blank entries in excludedIds', () => {
    expect(
      isEligibleDelegate(cand({ id: U1 }), { ...ctx, excludedIds: [null as any, '', '   ', U2] }),
    ).toBe(true)
  })
})

describe('filterEligibleDelegates', () => {
  it('keeps only eligible candidates, preserving order', () => {
    const list: DelegateCandidate[] = [
      cand({ id: U1, role: 'project_manager' }), // eligible (required role)
      cand({ id: 'bob@x.io' as any, role: 'project_manager' }), // non-uuid
      cand({ id: U2, role: 'tenant_admin' }), // eligible (admin)
      cand({ id: U3, role: 'viewer' }), // not an approver
    ]
    const out = filterEligibleDelegates(list, { ...ctx, excludedIds: ['someone-else'] })
    expect(out.map((c) => c.id)).toEqual([U1, U2])
  })

  it('drops every excluded id while keeping the rest (multi-exclusion)', () => {
    const list: DelegateCandidate[] = [
      cand({ id: U1, role: 'project_manager' }), // excluded below
      cand({ id: U2, role: 'tenant_admin' }), // excluded below
      cand({ id: U3, role: 'project_manager' }), // survives
    ]
    const out = filterEligibleDelegates(list, { ...ctx, excludedIds: [U1, U2] })
    expect(out.map((c) => c.id)).toEqual([U3])
  })
})
