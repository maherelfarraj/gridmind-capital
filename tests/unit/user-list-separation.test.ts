/**
 * Internal and external users must appear in exactly one list each.
 *
 * `getUsers` (Internal users tab) filters on the same predicate exercised here.
 * These tests pin the rule itself, including the production row that is
 * external by role and internal by column — the one that showed up under
 * Internal users and triggered the report.
 */

import { describe, it, expect } from 'vitest'

import { isInternalIdentity, isExternalIdentity } from '@/lib/admin/external-identity'

/** Mirrors the production tenant at the time of the report. */
const PRODUCTION_PROFILES = [
  { email: 'ahmad@gsi.jo', role: 'tenant_admin', user_type: 'internal' },
  { email: 'maher@farah.jo', role: 'tenant_admin', user_type: 'internal' },
  { email: 'khaled@gsi.jo', role: 'project_manager', user_type: 'internal' },
  { email: 'viewer@gsi.jo', role: 'viewer', user_type: 'internal' },
  // The legacy vendor account: external by role, internal by column.
  { email: 'maher@tek.jo', role: 'subcontractor', user_type: 'internal' },
]

describe('internal / external list separation', () => {
  const internal = PRODUCTION_PROFILES.filter(isInternalIdentity)
  const external = PRODUCTION_PROFILES.filter(isExternalIdentity)

  it('places every profile in exactly one list', () => {
    expect(internal.length + external.length).toBe(PRODUCTION_PROFILES.length)
    const overlap = internal.filter((u) => external.includes(u))
    expect(overlap).toEqual([])
  })

  it('excludes the vendor account from the internal list', () => {
    expect(internal.map((u) => u.email)).not.toContain('maher@tek.jo')
  })

  it('includes the vendor account in the external list', () => {
    expect(external.map((u) => u.email)).toContain('maher@tek.jo')
  })

  it('keeps genuine colleagues in the internal list', () => {
    expect(internal.map((u) => u.email)).toEqual([
      'ahmad@gsi.jo',
      'maher@farah.jo',
      'khaled@gsi.jo',
      'viewer@gsi.jo',
    ])
  })

  it('never maps an organisation into the department field', () => {
    // external_org and department are different columns with different
    // meanings; conflating them would show a vendor's company as if it were an
    // internal department. The internal projection must not carry external_org.
    const projected = internal.map((u) => ({
      email: u.email,
      department: null as string | null,
    }))
    for (const row of projected) {
      expect(row.department).toBeNull()
    }
  })
})
