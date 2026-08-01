import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  DB_USER_ROLES,
  assignableRolesFor,
  assignableRoleOptionsFor,
  isDbUserRole,
  type DbUserRole,
} from '@/lib/auth/roles'

/**
 * Regression cover for the Invite User role dropdown.
 *
 * Two distinct defects are guarded here:
 *
 *  1. The dropdown rendered NO options to the admin — it opened but painted
 *     behind the modal (a z-index/stacking bug in components/ui/select.tsx).
 *     Covered by the stacking assertions at the bottom.
 *  2. The dropdown offered `system_admin` to a tenant_admin, an action the
 *     server always rejects. Covered by the assignability assertions.
 */

describe('assignableRolesFor — who may grant what', () => {
  it('offers every canonical role to system_admin', () => {
    expect(assignableRolesFor('system_admin')).toEqual(DB_USER_ROLES)
  })

  it('offers a non-empty set to tenant_admin', () => {
    // The original bug was an EMPTY dropdown, so "non-empty" is the assertion
    // that would actually have failed. Never let this reduce to nothing.
    expect(assignableRolesFor('tenant_admin').length).toBeGreaterThan(0)
  })

  it('never offers system_admin to a tenant_admin', () => {
    expect(assignableRolesFor('tenant_admin')).not.toContain('system_admin')
  })

  it('offers tenant_admin every role except system_admin', () => {
    expect(assignableRolesFor('tenant_admin')).toEqual(
      DB_USER_ROLES.filter((r) => r !== 'system_admin'),
    )
  })

  it.each([
    'project_manager',
    'engineer',
    'finance_manager',
    'viewer',
    'subcontractor',
    'client_viewer',
  ] as const)('offers nothing to non-provisioner role %s', (role) => {
    expect(assignableRolesFor(role)).toEqual([])
  })

  it.each([null, undefined, '', 'not_a_role', 'SYSTEM_ADMIN'])(
    'offers nothing for invalid actor role %p',
    (role) => {
      expect(assignableRolesFor(role as string | null | undefined)).toEqual([])
    },
  )

  it('only ever returns canonical roles the database will accept', () => {
    for (const actor of DB_USER_ROLES) {
      for (const assignable of assignableRolesFor(actor)) {
        expect(isDbUserRole(assignable)).toBe(true)
      }
    }
  })
})

describe('assignableRoleOptionsFor — Select option shape', () => {
  it('renders 12 options for system_admin and 11 for tenant_admin', () => {
    expect(assignableRoleOptionsFor('system_admin')).toHaveLength(12)
    expect(assignableRoleOptionsFor('tenant_admin')).toHaveLength(11)
  })

  it('gives every option a non-empty human label', () => {
    for (const opt of assignableRoleOptionsFor('system_admin')) {
      expect(opt.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('exposes the exact roles a tenant_admin may invite', () => {
    expect(assignableRoleOptionsFor('tenant_admin').map((o) => o.value)).toEqual([
      'tenant_admin',
      'project_director',
      'project_manager',
      'engineer',
      'hse_manager',
      'commissioning_manager',
      'finance_manager',
      'commercial_manager',
      'viewer',
      'subcontractor',
      'client_viewer',
    ])
  })

  it('preserves DB_USER_ROLES ordering', () => {
    const values = assignableRoleOptionsFor('system_admin').map((o) => o.value)
    expect(values).toEqual([...DB_USER_ROLES])
  })
})

/**
 * The UI filter must never disagree with the server. `authorizeTargetMutation`
 * in lib/auth/provisioning.ts is the real boundary; this replicates its rule so
 * a change to one side without the other fails loudly.
 */
describe('client filter agrees with server authority', () => {
  function serverWouldReject(actor: DbUserRole, nextRole: DbUserRole): boolean {
    if (actor === 'system_admin') return false
    if (actor !== 'tenant_admin') return true
    return nextRole === 'system_admin'
  }

  it('never offers a role the server would reject', () => {
    for (const actor of DB_USER_ROLES) {
      for (const offered of assignableRolesFor(actor)) {
        expect(serverWouldReject(actor, offered)).toBe(false)
      }
    }
  })

  it('offers everything the server would accept — no silent under-offering', () => {
    // Guards the opposite failure: a filter so aggressive the admin cannot
    // invite anyone, which is indistinguishable from the empty-dropdown bug.
    for (const actor of DB_USER_ROLES) {
      const allowed = DB_USER_ROLES.filter((r) => !serverWouldReject(actor, r))
      expect([...assignableRolesFor(actor)]).toEqual(allowed)
    }
  })

  it("still enforces the server's system_admin rule verbatim", () => {
    expect(serverWouldReject('tenant_admin', 'system_admin')).toBe(true)
    expect(assignableRolesFor('tenant_admin')).not.toContain('system_admin')
  })
})

/**
 * Root-cause guard for the empty dropdown.
 *
 * Base UI renders `Select.Popup` with `position: static`, and `z-index` has no
 * effect on a statically-positioned element. Putting the layer class on the
 * Popup is therefore inert: the portalled subtree paints at `z-index: auto` and
 * any `z-50` modal covers it. The class must sit on the Positioner, which IS
 * positioned. Asserted against source because jsdom does not do layout or
 * stacking, so a render test cannot observe this.
 */
describe('select popup stacking (root cause of the empty dropdown)', () => {
  const source = readFileSync(
    path.resolve(__dirname, '../../components/ui/select.tsx'),
    'utf8',
  )

  const positioners = source.match(/<SelectPrimitive\.Positioner[^>]*>/g) ?? []

  it('has both Positioner call sites', () => {
    expect(positioners).toHaveLength(2)
  })

  it('puts an explicit z-index on every Positioner', () => {
    for (const tag of positioners) {
      expect(tag).toMatch(/className=\{?SELECT_POPUP_Z/)
    }
  })

  it('layers the popup above the z-50 modal layer', () => {
    const declared = source.match(/const SELECT_POPUP_Z = 'z-\[(\d+)\]'/)
    expect(declared).not.toBeNull()
    expect(Number(declared![1])).toBeGreaterThan(50)
  })

  it('does not put a z-index on the statically-positioned Popup', () => {
    const popups = source.match(/<SelectPrimitive\.Popup[\s\S]*?>/g) ?? []
    expect(popups.length).toBeGreaterThan(0)
    for (const tag of popups) {
      expect(tag).not.toMatch(/'z-\d|\sz-\d|z-\[\d/)
    }
  })
})
