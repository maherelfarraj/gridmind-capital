import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DB_USER_ROLES, isDbUserRole } from '@/lib/auth/roles'

const repoRoot = path.resolve(__dirname, '../../')
const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8')

/**
 * Strip block and line comments so these source scans assert on executable
 * code only. Without this, prose describing a banned pattern (e.g. a comment
 * documenting that there is no `?? 'viewer'` fallback) would trip the scan.
 */
const readCode = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * Guards the "one canonical role authority" invariant. These are source-level
 * assertions on purpose: a duplicate role array is a structural regression that
 * behavioural tests would not catch until the two lists drifted apart.
 */
describe('canonical role source', () => {
  it('lib/auth/roles.ts declares the 12 database roles', () => {
    expect(DB_USER_ROLES).toHaveLength(12)
  })

  it('guard.ts declares no duplicate role array', () => {
    const guard = readCode('lib/auth/guard.ts')

    expect(guard).not.toMatch(/const\s+CANONICAL_ROLES/)
    expect(guard).not.toMatch(/const\s+DB_USER_ROLES/)
  })

  it('guard.ts APPROVER_ROLES is an ALIAS, not a duplicated literal', () => {
    const guard = readCode('lib/auth/guard.ts')

    // A byte-identical duplicate is still a second source of truth: editing one
    // copy would silently authorize a different population in the guard than in
    // the delegate pool and the gate RPCs. Require the alias form specifically.
    expect(guard).toMatch(/APPROVER_ROLES:\s*readonly DbUserRole\[\]\s*=\s*GATE_APPROVER_ROLES/)
    // ...and forbid re-listing the members inline.
    expect(guard).not.toMatch(/APPROVER_ROLES[^\n]*=\s*\[/)
  })

  it('guard.ts does not reimplement isDbUserRole', () => {
    const guard = readCode('lib/auth/guard.ts')

    expect(guard).not.toMatch(/function\s+isDbUserRole/)
    expect(guard).toMatch(/from '@\/lib\/auth\/roles'/)
  })

  it('no authorization file falls back to a default viewer role', () => {
    for (const file of [
      'lib/auth/guard.ts',
      'lib/auth/actor.ts',
      'lib/auth/resolve-session.ts',
      'lib/db/queries.ts',
      'lib/tenant.ts',
    ]) {
      expect(readCode(file)).not.toMatch(/\?\?\s*['"]viewer['"]/)
    }
  })

  it('no authorization file declares a nullable tenant', () => {
    for (const file of ['lib/auth/guard.ts', 'lib/auth/actor.ts', 'lib/db/queries.ts']) {
      expect(readCode(file)).not.toMatch(/tenantId:\s*string\s*\|\s*null/)
    }
  })

  it('the comment stripper does not hide real code', () => {
    // Sanity check: a banned pattern in executable code is still detected.
    const stripped = readCode('lib/auth/actor.ts')
    expect(stripped).toContain('isDbUserRole')
    expect(stripped).not.toContain('THE canonical server-side identity resolver')
  })

  it('accepts every canonical role', () => {
    for (const role of DB_USER_ROLES) {
      expect(isDbUserRole(role)).toBe(true)
    }
  })

  it('rejects invalid, empty, and non-string roles', () => {
    for (const value of ['', 'admin', 'superuser', 'Viewer', null, undefined, 42, {}]) {
      expect(isDbUserRole(value)).toBe(false)
    }
  })

  it('re-exports the same validator from guard.ts', async () => {
    const guard = await import('@/lib/auth/guard')

    expect(guard.isDbUserRole).toBe(isDbUserRole)
  })

  it('guard.APPROVER_ROLES IS the canonical GATE_APPROVER_ROLES object', async () => {
    const guard = await import('@/lib/auth/guard')
    const { GATE_APPROVER_ROLES } = await import('@/lib/auth/roles')

    // Reference identity, not deep equality: a copied array can drift, the same
    // object cannot. This is what makes the two sets impossible to desynchronize.
    expect(guard.APPROVER_ROLES).toBe(GATE_APPROVER_ROLES)
  })
})

/**
 * Tenant isolation. `getCurrentTenantId()` and `actor.tenantId` are both
 * non-null-or-throw, so a `if (tenantId) query.eq('tenant_id', ...)` guard is
 * dead code whose only reachable effect is an UNFILTERED cross-tenant read.
 */
describe('tenant filters are unconditional', () => {
  it('no server action guards a tenant filter behind a truthiness check', () => {
    const code = readCode('app/actions/approvals.ts')

    expect(code).not.toMatch(/if\s*\(\s*tenantId\s*\)/)
    expect(code).not.toMatch(/if\s*\(\s*scope\.tenantId\s*\)/)
  })

  it('still applies a tenant filter to the approvals queries', () => {
    const code = readCode('app/actions/approvals.ts')

    // Guard against "fixing" the above by deleting the filter entirely.
    expect(code).toMatch(/\.eq\('tenant_id', tenantId\)/)
    expect(code).toMatch(/\.eq\('tenant_id', scope\.tenantId\)/)
  })
})
