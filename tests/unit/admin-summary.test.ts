import { describe, it, expect } from 'vitest'
import {
  formatAdministratorSummary,
  adminRoleCountsFromUsers,
  totalAdministrators,
} from '@/lib/admin/admin-summary'
import { DB_ADMIN_ROLES } from '@/lib/auth/roles'

/**
 * The "Administrators" tile subtitle was the hardcoded literal "Tenant + 2 PMO"
 * — wrong on every count: production has 2 tenant_admins and 0 system_admins,
 * and no "PMO" role exists. These tests pin the replacement so a literal cannot
 * creep back in, and so the subtitle can never disagree with the number above it.
 */

describe('formatAdministratorSummary — cases required by the spec', () => {
  it('2 tenant_admin, 0 system_admin → "2 Tenant Admins"', () => {
    expect(formatAdministratorSummary({ tenant_admin: 2, system_admin: 0 }))
      .toBe('2 Tenant Admins')
  })

  it('1 tenant_admin, 0 system_admin → "1 Tenant Admin"', () => {
    expect(formatAdministratorSummary({ tenant_admin: 1, system_admin: 0 }))
      .toBe('1 Tenant Admin')
  })

  it('0 tenant_admin, 1 system_admin → "1 System Admin"', () => {
    expect(formatAdministratorSummary({ tenant_admin: 0, system_admin: 1 }))
      .toBe('1 System Admin')
  })

  it('2 tenant_admin, 1 system_admin → "2 Tenant Admins · 1 System Admin"', () => {
    expect(formatAdministratorSummary({ tenant_admin: 2, system_admin: 1 }))
      .toBe('2 Tenant Admins · 1 System Admin')
  })

  it('0 tenant_admin, 0 system_admin → "No administrators"', () => {
    expect(formatAdministratorSummary({ tenant_admin: 0, system_admin: 0 }))
      .toBe('No administrators')
  })
})

describe('formatAdministratorSummary — pluralization', () => {
  it('uses the singular form at exactly one', () => {
    expect(formatAdministratorSummary({ system_admin: 1 })).toBe('1 System Admin')
    expect(formatAdministratorSummary({ project_director: 1 })).toBe('1 Project Director')
  })

  it('uses the plural form above one', () => {
    expect(formatAdministratorSummary({ system_admin: 3 })).toBe('3 System Admins')
    expect(formatAdministratorSummary({ project_director: 2 })).toBe('2 Project Directors')
  })
})

describe('formatAdministratorSummary — project_director is its own category', () => {
  /**
   * project_director is in DB_ADMIN_ROLES, so it is already inside the tile's
   * total. Reporting it separately is what keeps subtitle and total in step;
   * omitting it would make the tile read "3" above "2 Tenant Admins".
   */
  it('reports directors alongside admins', () => {
    expect(formatAdministratorSummary({ tenant_admin: 2, project_director: 1 }))
      .toBe('2 Tenant Admins · 1 Project Director')
  })

  it('orders tenant, then system, then director', () => {
    expect(formatAdministratorSummary({
      tenant_admin: 2, system_admin: 1, project_director: 4,
    })).toBe('2 Tenant Admins · 1 System Admin · 4 Project Directors')
  })
})

describe('formatAdministratorSummary — omits empty categories', () => {
  it('drops zero counts rather than printing "0 System Admins"', () => {
    const out = formatAdministratorSummary({ tenant_admin: 2, system_admin: 0, project_director: 0 })
    expect(out).toBe('2 Tenant Admins')
    expect(out).not.toContain('0 ')
  })

  it('treats an absent key the same as zero', () => {
    expect(formatAdministratorSummary({ tenant_admin: 2 }))
      .toBe(formatAdministratorSummary({ tenant_admin: 2, system_admin: 0 }))
  })

  it('returns the fallback for a completely empty object', () => {
    expect(formatAdministratorSummary({})).toBe('No administrators')
  })
})

describe('formatAdministratorSummary — is pure and carries no production numbers', () => {
  it('is deterministic', () => {
    const counts = { tenant_admin: 2, system_admin: 1 }
    expect(formatAdministratorSummary(counts)).toBe(formatAdministratorSummary(counts))
  })

  it('does not mutate its input', () => {
    const counts = { tenant_admin: 2, system_admin: 1 }
    const before = JSON.stringify(counts)
    formatAdministratorSummary(counts)
    expect(JSON.stringify(counts)).toBe(before)
  })

  it('never emits the old hardcoded label', () => {
    for (const n of [0, 1, 2, 5]) {
      const out = formatAdministratorSummary({ tenant_admin: n, system_admin: n })
      expect(out).not.toContain('PMO')
      expect(out).not.toContain('Tenant + ')
    }
  })

  it('tracks the input instead of hardcoding the current production value', () => {
    // Guards against someone "fixing" this by returning a literal '2 Tenant Admins'.
    expect(formatAdministratorSummary({ tenant_admin: 7 })).toBe('7 Tenant Admins')
  })
})

describe('formatAdministratorSummary — defensive against bad counts', () => {
  it('ignores negative counts', () => {
    expect(formatAdministratorSummary({ tenant_admin: -3 })).toBe('No administrators')
  })

  it('ignores NaN', () => {
    expect(formatAdministratorSummary({ tenant_admin: Number.NaN, system_admin: 1 }))
      .toBe('1 System Admin')
  })

  it('floors fractional counts', () => {
    expect(formatAdministratorSummary({ tenant_admin: 2.7 })).toBe('2 Tenant Admins')
  })
})

describe('adminRoleCountsFromUsers', () => {
  const users = [
    { role: 'tenant_admin' },
    { role: 'tenant_admin' },
    { role: 'project_manager' },
    { role: 'engineer' },
    { role: 'viewer' },
    { role: 'subcontractor' },
  ]

  it('counts only administrator roles', () => {
    expect(adminRoleCountsFromUsers(users)).toEqual({ tenant_admin: 2 })
  })

  it('reproduces the current production shape', () => {
    // 2 tenant_admin, 0 system_admin, 0 project_director.
    expect(formatAdministratorSummary(adminRoleCountsFromUsers(users))).toBe('2 Tenant Admins')
    expect(totalAdministrators(adminRoleCountsFromUsers(users))).toBe(2)
  })

  it('ignores unknown roles', () => {
    expect(adminRoleCountsFromUsers([{ role: 'not_a_role' }])).toEqual({})
  })

  it('returns no counts for an empty list', () => {
    expect(formatAdministratorSummary(adminRoleCountsFromUsers([]))).toBe('No administrators')
  })
})

describe('subtitle and total always agree', () => {
  /**
   * The core invariant. The tile renders `totalAdministrators` as the number and
   * `formatAdministratorSummary` beneath it; if a role in DB_ADMIN_ROLES were
   * missing from the summary the two would silently disagree.
   */
  it('every DB_ADMIN_ROLES member appears in the summary', () => {
    for (const role of DB_ADMIN_ROLES) {
      const out = formatAdministratorSummary({ [role]: 1 })
      expect(out).not.toBe('No administrators')
      expect(out.startsWith('1 ')).toBe(true)
    }
  })

  it('the counts named in the subtitle sum to the displayed total', () => {
    const counts = { tenant_admin: 2, system_admin: 1, project_director: 3 }
    const summary = formatAdministratorSummary(counts)
    const summed = [...summary.matchAll(/(\d+)\s/g)].reduce((s, m) => s + Number(m[1]), 0)
    expect(summed).toBe(totalAdministrators(counts))
    expect(summed).toBe(6)
  })

  it('totalAdministrators matches a naive count over the same users', () => {
    const users = [
      { role: 'tenant_admin' }, { role: 'system_admin' },
      { role: 'project_director' }, { role: 'viewer' },
    ]
    const naive = users.filter(u => (DB_ADMIN_ROLES as readonly string[]).includes(u.role)).length
    expect(totalAdministrators(adminRoleCountsFromUsers(users))).toBe(naive)
  })
})
