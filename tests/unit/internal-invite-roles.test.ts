import { describe, it, expect } from 'vitest'

import {
  DB_USER_ROLES,
  DB_EXTERNAL_ROLES,
  DB_INTERNAL_ROLES,
  isDbExternalRole,
  assignableRolesFor,
  internalAssignableRolesFor,
  internalAssignableRoleOptionsFor,
  type DbUserRole,
} from '@/lib/auth/roles'

/**
 * Regression cover for: the /admin/users Invite User modal offered
 * `subcontractor`, but that form posts to `provisionInternalUser`, which
 * rejects every external role:
 *
 *     "subcontractor" is not a valid internal role.
 *
 * Every option the modal shows must be one the internal service accepts. The
 * server remains the boundary — these assertions only stop the UI from
 * advertising an action that is guaranteed to fail.
 */

const ADMINS = ['system_admin', 'tenant_admin'] as const

describe('external role classification (client-safe mirror)', () => {
  it('classifies subcontractor and client_viewer as external', () => {
    expect([...DB_EXTERNAL_ROLES].sort()).toEqual(['client_viewer', 'subcontractor'])
  })

  it('partitions the canonical role list exactly, with no overlap', () => {
    expect([...DB_INTERNAL_ROLES, ...DB_EXTERNAL_ROLES].sort()).toEqual([...DB_USER_ROLES].sort())
    expect(DB_INTERNAL_ROLES.filter((r) => DB_EXTERNAL_ROLES.includes(r))).toEqual([])
  })

  it('agrees with the canonical server classification (drift fails CI)', async () => {
    // `server-only` is aliased to a no-op stub in vitest.config.ts, so the
    // canonical service can be imported directly. This is the assertion that
    // makes the client mirror safe to exist at all.
    const provisioning = await import('@/lib/auth/provisioning')

    expect([...DB_EXTERNAL_ROLES].sort()).toEqual([...provisioning.EXTERNAL_ROLES].sort())
    expect([...DB_INTERNAL_ROLES].sort()).toEqual([...provisioning.INTERNAL_ROLES].sort())
  })

  it('isDbExternalRole matches the canonical predicate for every role', async () => {
    const { isExternalRole } = await import('@/lib/auth/provisioning')
    for (const role of DB_USER_ROLES) {
      expect(isDbExternalRole(role), `${role} disagrees`).toBe(isExternalRole(role))
    }
  })

  it('rejects unknown and empty values rather than defaulting to external', () => {
    for (const v of ['', 'pmo', 'admin', null, undefined, 0, {}]) {
      expect(isDbExternalRole(v)).toBe(false)
    }
  })
})

describe('internalAssignableRolesFor — the invite dropdown', () => {
  it.each(ADMINS)('never offers subcontractor to %s', (actor) => {
    expect(internalAssignableRolesFor(actor)).not.toContain('subcontractor')
  })

  it.each(ADMINS)('never offers client_viewer to %s', (actor) => {
    expect(internalAssignableRolesFor(actor)).not.toContain('client_viewer')
  })

  it.each(ADMINS)('offers %s no external role at all', (actor) => {
    const offered = internalAssignableRolesFor(actor)
    expect(offered.filter((r) => DB_EXTERNAL_ROLES.includes(r))).toEqual([])
  })

  it.each(ADMINS)('every role offered to %s is accepted by the internal service', async (actor) => {
    const { isInternalRole } = await import('@/lib/auth/provisioning')
    const offered = internalAssignableRolesFor(actor)

    // The whole point: no option can exist that the server would refuse.
    expect(offered.length).toBeGreaterThan(0)
    for (const role of offered) {
      expect(isInternalRole(role), `${role} would be rejected by provisionInternalUser`).toBe(true)
    }
  })

  it('still refuses system_admin to a tenant_admin', () => {
    expect(internalAssignableRolesFor('tenant_admin')).not.toContain('system_admin')
  })

  it('offers system_admin every internal role, including system_admin', () => {
    expect(internalAssignableRolesFor('system_admin')).toEqual(DB_INTERNAL_ROLES)
  })

  it('offers tenant_admin every internal role except system_admin', () => {
    expect(internalAssignableRolesFor('tenant_admin')).toEqual(
      DB_INTERNAL_ROLES.filter((r) => r !== 'system_admin'),
    )
  })

  it('offers nothing to a non-provisioner', () => {
    for (const actor of ['project_manager', 'engineer', 'viewer', 'subcontractor', null, undefined]) {
      expect(internalAssignableRolesFor(actor)).toEqual([])
    }
  })

  it('removes exactly the external roles and nothing else', () => {
    // Guards against over-filtering: the fix must not quietly drop an internal
    // role such as project_director along with the external ones.
    for (const actor of ADMINS) {
      const before = assignableRolesFor(actor)
      const after = internalAssignableRolesFor(actor)
      const removed = before.filter((r) => !after.includes(r))
      expect([...removed].sort()).toEqual([...DB_EXTERNAL_ROLES].sort())
    }
  })

  it('preserves canonical ordering', () => {
    const offered = internalAssignableRolesFor('system_admin')
    const canonical = DB_USER_ROLES.filter((r) => offered.includes(r))
    expect(offered).toEqual(canonical)
  })

  it('is a non-empty dropdown for tenant_admin — the real production actor', () => {
    // Production has 0 system_admins, so this is the only path a human uses.
    // An over-eager filter that emptied it would be a new outage.
    expect(internalAssignableRolesFor('tenant_admin').length).toBeGreaterThan(0)
  })
})

describe('internalAssignableRoleOptionsFor — rendered options', () => {
  it.each(ADMINS)('renders no external option for %s', (actor) => {
    const values = internalAssignableRoleOptionsFor(actor).map((o) => o.value)
    expect(values).not.toContain('subcontractor')
    expect(values).not.toContain('client_viewer')
  })

  it('labels every option with a non-empty string', () => {
    for (const opt of internalAssignableRoleOptionsFor('tenant_admin')) {
      expect(opt.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('mirrors internalAssignableRolesFor exactly', () => {
    for (const actor of ADMINS) {
      expect(internalAssignableRoleOptionsFor(actor).map((o) => o.value as DbUserRole)).toEqual(
        internalAssignableRolesFor(actor),
      )
    }
  })
})
