import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FIXTURE_PROJECT_CODE,
  FIXTURE_PROJECT_ID,
  TEARDOWN_DELETE_ORDER,
  planSignatureStorageCleanup,
  verifyFixtureProject,
  type FixtureProjectRow,
} from '@/lib/fixtures/g3-smoke-teardown'

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222'

const fixtureRow = (over: Partial<FixtureProjectRow> = {}): FixtureProjectRow => ({
  id: FIXTURE_PROJECT_ID,
  code: FIXTURE_PROJECT_CODE,
  tenant_id: TENANT,
  provenance: { fixture: 'g3-smoke', disposable: true },
  ...over,
})

const gatePath = (tenant = TENANT, file = 'abc-1700000000000.png') =>
  `signatures/${tenant}/gate_approval/${file}`

describe('verifyFixtureProject', () => {
  it('accepts the genuine fixture when every criterion matches', () => {
    expect(verifyFixtureProject(fixtureRow(), TENANT)).toEqual({ ok: true, present: true })
  })

  it('treats an absent project as a valid idempotent re-run, not an error', () => {
    // A previous run may have died after deleting the project but before
    // sweeping residue. The teardown must still be allowed to finish.
    expect(verifyFixtureProject(null, TENANT)).toEqual({ ok: true, present: false })
    expect(verifyFixtureProject(undefined, TENANT)).toEqual({ ok: true, present: false })
  })

  it('REFUSES a row at the fixture id whose code is not the fixture code', () => {
    // The id is just a constant in a file; a real project could occupy it.
    const res = verifyFixtureProject(fixtureRow({ code: 'GMC-REAL-001' }), TENANT)
    expect(res.ok).toBe(false)
    expect('error' in res && res.error).toContain('expected GMC-G3-SMOKE')
  })

  it('REFUSES a row without provenance.fixture=g3-smoke', () => {
    const res = verifyFixtureProject(fixtureRow({ provenance: { fixture: 'other' } }), TENANT)
    expect(res.ok).toBe(false)
    expect('error' in res && res.error).toContain('provenance.fixture=g3-smoke')
  })

  it('REFUSES a null provenance', () => {
    expect(verifyFixtureProject(fixtureRow({ provenance: null }), TENANT).ok).toBe(false)
  })

  it('REFUSES a fixture owned by a DIFFERENT tenant', () => {
    const res = verifyFixtureProject(fixtureRow({ tenant_id: OTHER_TENANT }), TENANT)
    expect(res.ok).toBe(false)
    expect('error' in res && res.error).toContain('belongs to tenant')
  })

  it('REFUSES a row whose id is not the fixture id', () => {
    const res = verifyFixtureProject(fixtureRow({ id: '33333333-3333-4333-8333-333333333333' }), TENANT)
    expect(res.ok).toBe(false)
    expect('error' in res && res.error).toContain('not the fixture id')
  })
})

describe('planSignatureStorageCleanup', () => {
  it('collects validated gate paths', () => {
    const res = planSignatureStorageCleanup(
      [
        { id: 's1', entity_type: 'gate_approval', signature_image_path: gatePath(TENANT, 'a-1.png') },
        { id: 's2', entity_type: 'gate_approval', signature_image_path: gatePath(TENANT, 'b-2.png') },
      ],
      TENANT,
    )
    expect(res.ok).toBe(true)
    expect(res.ok && res.paths).toEqual([gatePath(TENANT, 'a-1.png'), gatePath(TENANT, 'b-2.png')])
    // Non-empty guard: an empty roster would pass a "no bad paths" assertion vacuously.
    expect(res.ok && res.paths.length).toBe(2)
  })

  it('de-duplicates repeated paths so one object is never removed twice', () => {
    const res = planSignatureStorageCleanup(
      [
        { id: 's1', entity_type: 'gate_approval', signature_image_path: gatePath() },
        { id: 's2', entity_type: 'gate_approval', signature_image_path: gatePath() },
      ],
      TENANT,
    )
    expect(res.ok && res.paths).toHaveLength(1)
  })

  it('HARD-FAILS a gate row whose path belongs to another tenant', () => {
    // Skipping would let the teardown claim success while a foreign blob was
    // referenced — and worse, hide that we stored a cross-tenant path at all.
    const res = planSignatureStorageCleanup(
      [{ id: 's1', entity_type: 'gate_approval', signature_image_path: gatePath(OTHER_TENANT) }],
      TENANT,
    )
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('invalid gate path')
  })

  it.each([
    ['traversal', 'signatures/../../etc/passwd'],
    ['encoded traversal', `signatures/${TENANT}/gate_approval/%2e%2e%2ffoo.png`],
    ['absolute path', `/signatures/${TENANT}/gate_approval/a.png`],
    ['backslash', `signatures\\${TENANT}\\gate_approval\\a.png`],
    ['wrong context', `signatures/${TENANT}/other_context/a.png`],
    ['not a png', `signatures/${TENANT}/gate_approval/a.exe`],
  ])('HARD-FAILS a gate path with %s', (_label, path) => {
    const res = planSignatureStorageCleanup(
      [{ id: 's1', entity_type: 'gate_approval', signature_image_path: path }],
      TENANT,
    )
    expect(res.ok).toBe(false)
  })

  it('HARD-FAILS a non-gate signature that still carries a stored path', () => {
    // Previously SKIPPED, which was unsafe: the database step deletes EVERY
    // signature row for this project, so a skipped row with a real path would
    // have its row removed and its blob left behind — the exact orphan this
    // teardown exists to prevent.
    const res = planSignatureStorageCleanup(
      [{ id: 's1', entity_type: 'client_report', signature_image_path: 'signatures/x/client_report/a.png' }],
      TENANT,
    )
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('unexpected')
    expect(!res.ok && res.error).toContain('client_report')
  })

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('SKIPS a row whose path is %s (row-only cleanup, nothing to orphan)', (_label, path) => {
    const res = planSignatureStorageCleanup(
      [{ id: 's1', entity_type: 'gate_approval', signature_image_path: path }],
      TENANT,
    )
    expect(res.ok).toBe(true)
    expect(res.ok && res.paths).toEqual([])
    expect(res.ok && res.skipped[0].reason).toContain('row-only')
  })

  it('a non-gate row with NO path remains a safe row-only skip', () => {
    // The hard failure is specifically about an unreachable BLOB. With no path
    // there is nothing to orphan, so this must not become a false alarm.
    const res = planSignatureStorageCleanup(
      [{ id: 's1', entity_type: 'client_report', signature_image_path: null }],
      TENANT,
    )
    expect(res.ok).toBe(true)
    expect(res.ok && res.paths).toEqual([])
  })

  it('returns an empty plan for no rows (idempotent re-run after cleanup)', () => {
    const res = planSignatureStorageCleanup([], TENANT)
    expect(res).toEqual({ ok: true, paths: [], skipped: [] })
  })
})

describe('teardown SQL <-> runner drift', () => {
  const sql = readFileSync(
    join(process.cwd(), 'scripts/g3-smoke-fixture.teardown.sql'),
    'utf8',
  )

  it('deletes signatures scoped by BOTH tenant and project', () => {
    expect(sql).toMatch(/DELETE FROM public\.signatures\s+WHERE tenant_id = v_tenant AND project_id = v_project/)
  })

  it('sweeps audit_log rows keyed to fixture APPROVAL ids, not just the project', () => {
    // The approvals AFTER DELETE trigger writes rows keyed to approval ids;
    // sweeping only the project id is what left residue behind before.
    expect(sql).toContain('DELETE FROM public.audit_log WHERE record_id = v_project::text')
    expect(sql).toMatch(/DELETE FROM public\.audit_log WHERE record_id = ANY\(v_approval_texts\)/)
  })

  it('requires an explicit tenant with no fallback', () => {
    expect(sql).toContain("\\if :{?tenant_id}")
    expect(sql).toContain('TEARDOWN: tenant_id is required')
  })

  it('verifies code, provenance and tenant before deleting', () => {
    expect(sql).toContain('TEARDOWN REFUSED')
    expect(sql).toContain('GMC-G3-SMOKE')
    expect(sql).toContain("v_provenance->>'fixture'")
  })

  it('asserts zero signature rows and zero approval-keyed audit rows', () => {
    expect(sql).toContain('TEARDOWN ASSERT: % signature row(s) still present')
    // The signature assertion spans lines (`count(*) INTO v_n` / `FROM ...`),
    // so match the two halves rather than assuming they are contiguous.
    expect(sql).toMatch(
      /SELECT count\(\*\) INTO v_n\s+FROM public\.signatures WHERE tenant_id = v_tenant AND project_id = v_project/,
    )
    expect(sql).toMatch(/count\(\*\) FROM public\.signatures\s+WHERE project_id = v_project/)
    expect(sql).toMatch(/audit_log\s+WHERE record_id = ANY\(v_approval_texts\)/)
  })

  it('deletes every table the runner deletes, in the same relative order', () => {
    // A table added to one implementation and forgotten in the other is exactly
    // how residue survives. Derive the SQL order and compare against the shared
    // constant rather than eyeballing two files.
    const sqlOrder = Array.from(sql.matchAll(/DELETE FROM public\.(\w+)/g))
      .map((m) => m[1])
      .filter((t, i, arr) => arr.indexOf(t) === i)

    expect(sqlOrder).toEqual([...TEARDOWN_DELETE_ORDER])
  })

  it('sweeps audit_log LAST so delete-trigger rows are also removed', () => {
    expect(TEARDOWN_DELETE_ORDER[TEARDOWN_DELETE_ORDER.length - 1]).toBe('audit_log')
    expect(TEARDOWN_DELETE_ORDER.indexOf('projects')).toBeLessThan(
      TEARDOWN_DELETE_ORDER.indexOf('audit_log'),
    )
    expect(TEARDOWN_DELETE_ORDER.indexOf('approvals')).toBeLessThan(
      TEARDOWN_DELETE_ORDER.indexOf('audit_log'),
    )
  })

  it('deletes approval children before approvals, and gate_signoffs before phase_gates', () => {
    expect(TEARDOWN_DELETE_ORDER.indexOf('approval_steps')).toBeLessThan(
      TEARDOWN_DELETE_ORDER.indexOf('approvals'),
    )
    expect(TEARDOWN_DELETE_ORDER.indexOf('gate_signoffs')).toBeLessThan(
      TEARDOWN_DELETE_ORDER.indexOf('phase_gates'),
    )
  })

  it('deletes signatures FIRST, before the rows that record their paths are gone', () => {
    expect(TEARDOWN_DELETE_ORDER[0]).toBe('signatures')
  })
})
