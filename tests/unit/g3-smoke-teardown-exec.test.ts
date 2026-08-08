/**
 * Tests for the EXECUTABLE G3 teardown sequence.
 *
 * The pre-existing drift test compared only the .sql file against
 * TEARDOWN_DELETE_ORDER. It never inspected or ran the TypeScript path, so
 * `workflow_events` could be declared in the order, present in the SQL, and
 * entirely missing from the executable runner while every test passed.
 *
 * These tests drive the real function with a recording client and assert on the
 * OBSERVED behaviour: which tables were deleted, in which order, and whether the
 * run fails closed when storage cannot be verified.
 */

import { describe, expect, it } from 'vitest'

import { SIGNATURE_BUCKET } from '@/lib/approvals/signature-path'
import { FIXTURE_PROJECT_ID, TEARDOWN_DELETE_ORDER } from '@/lib/fixtures/g3-smoke-teardown'
import {
  WORKFLOW_EVENT_PROJECT_FILTER,
  assertZeroResidue,
  executeTeardownDeletes,
  expectedDeleteOrder,
  listSurvivingObjects,
  runTeardown,
  type TeardownClient,
} from '@/lib/fixtures/g3-smoke-teardown-exec'

const TENANT = '11111111-1111-4111-8111-111111111111'
const APPROVAL_IDS = ['aaaa1111-1111-4111-8111-111111111111']
const GATE_IDS = ['bbbb2222-2222-4222-8222-222222222222']

interface Recorded {
  table: string
  op: 'delete' | 'select'
  filters: { method: string; column: string; value: unknown }[]
}

interface MockOptions {
  /** Tables whose DELETE should return an error. */
  deleteErrors?: Record<string, string>
  /** Residue counts returned by head-count SELECTs, keyed by table. */
  counts?: Record<string, number>
  /** Objects the bucket still reports as present. */
  aliveObjects?: string[]
  /** Fail `storage.list` — either always, or only after N successful calls. */
  listError?: { message: string; afterCalls?: number }
  /** Rows returned by non-count SELECTs, keyed by table. */
  rows?: Record<string, Record<string, unknown>[]>
  /** The single row returned by `.maybeSingle()` on `projects`. */
  projectRow?: Record<string, unknown> | null
}

function createMockClient(opts: MockOptions = {}) {
  const recorded: Recorded[] = []
  const deleteOrder: string[] = []
  const removeCalls: string[][] = []
  let listCalls = 0

  const makeChain = (entry: Recorded, result: () => unknown) => {
    const chain: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        entry.filters.push({ method: 'eq', column, value })
        return chain
      },
      in(column: string, values: readonly unknown[]) {
        entry.filters.push({ method: 'in', column, value: values })
        return chain
      },
      maybeSingle() {
        return Promise.resolve({ data: opts.projectRow ?? null, error: null })
      },
      then(resolve: (v: unknown) => unknown) {
        return Promise.resolve(result()).then(resolve)
      },
    }
    return chain
  }

  const client = {
    from(table: string) {
      return {
        delete() {
          const entry: Recorded = { table, op: 'delete', filters: [] }
          recorded.push(entry)
          deleteOrder.push(table)
          return makeChain(entry, () => ({
            error: opts.deleteErrors?.[table] ? { message: opts.deleteErrors[table] } : null,
          }))
        },
        select(_columns: string, _options?: { count?: 'exact'; head?: boolean }) {
          const entry: Recorded = { table, op: 'select', filters: [] }
          recorded.push(entry)
          return makeChain(entry, () => ({
            data: opts.rows?.[table] ?? [],
            count: opts.counts?.[table] ?? 0,
            error: null,
          }))
        },
      }
    },
    storage: {
      from(_bucket: string) {
        return {
          remove: async (paths: string[]) => {
            removeCalls.push(paths)
            return { error: null }
          },
          list: async (dir: string, listOpts?: { search?: string }) => {
            listCalls++
            if (
              opts.listError &&
              (opts.listError.afterCalls === undefined || listCalls > opts.listError.afterCalls)
            ) {
              return { data: null, error: { message: opts.listError.message } }
            }
            const full = `${dir}/${listOpts?.search ?? ''}`
            const present = (opts.aliveObjects ?? []).includes(full)
            return { data: present ? [{ name: listOpts?.search ?? '' }] : [], error: null }
          },
        }
      },
    },
  } as unknown as TeardownClient

  return {
    client,
    recorded,
    deleteOrder,
    removeCalls,
    get listCalls() {
      return listCalls
    },
  }
}

const ids = { tenantId: TENANT, approvalIds: APPROVAL_IDS, gateIds: GATE_IDS }

describe('executeTeardownDeletes — observed behaviour of the executable path', () => {
  it('DELETES workflow_events (the step that was missing entirely)', async () => {
    const mock = createMockClient()
    const res = await executeTeardownDeletes(mock.client, ids)

    expect(res.ok).toBe(true)
    expect(mock.deleteOrder).toContain('workflow_events')
  })

  it('matches workflow_events through metadata->>project_id, not a project_id column', async () => {
    // `workflow_events` has NO project_id column (verified against the live
    // schema: id, instance_id, from_state, to_state, transition_code, actor_id,
    // comment, metadata, created_at). The project lives inside `metadata`, so a
    // plain .eq('project_id', ...) would silently match nothing.
    //
    // The literal is pinned HERE rather than compared to
    // WORKFLOW_EVENT_PROJECT_FILTER: asserting against the constant makes the
    // test move with the bug, so corrupting the constant would still pass.
    // (Proved by mutation — that version survived M6.)
    const mock = createMockClient()
    await executeTeardownDeletes(mock.client, ids)

    const we = mock.recorded.find((r) => r.table === 'workflow_events' && r.op === 'delete')
    expect(we).toBeDefined()
    expect(we!.filters).toEqual([
      { method: 'eq', column: 'metadata->>project_id', value: FIXTURE_PROJECT_ID },
    ])
    // The shared constant must itself be that literal.
    expect(WORKFLOW_EVENT_PROJECT_FILTER).toBe('metadata->>project_id')
  })

  it('the OBSERVED delete order equals TEARDOWN_DELETE_ORDER', async () => {
    const mock = createMockClient()
    const res = await executeTeardownDeletes(mock.client, ids)

    expect(res.ok).toBe(true)
    // Both approval and gate ids are present, so no table is conditionally skipped.
    expect(res.ok && res.tablesDeleted).toEqual([...TEARDOWN_DELETE_ORDER])
    // Non-empty guard: an empty list would satisfy a subset assertion vacuously.
    expect(TEARDOWN_DELETE_ORDER.length).toBeGreaterThan(10)
  })

  it('keeps the declared relative order when approval/gate ids are absent', async () => {
    const mock = createMockClient()
    const bare = { tenantId: TENANT, approvalIds: [], gateIds: [] }
    const res = await executeTeardownDeletes(mock.client, bare)

    expect(res.ok).toBe(true)
    expect(res.ok && res.tablesDeleted).toEqual(expectedDeleteOrder(bare))
    // The approval children and gate_signoffs are genuinely skipped...
    expect(mock.deleteOrder).not.toContain('approval_steps')
    expect(mock.deleteOrder).not.toContain('gate_signoffs')
    // ...but workflow_events is NOT conditional and must still run.
    expect(mock.deleteOrder).toContain('workflow_events')
  })

  it('deletes signatures first and sweeps audit_log last', async () => {
    const mock = createMockClient()
    await executeTeardownDeletes(mock.client, ids)

    expect(mock.deleteOrder[0]).toBe('signatures')
    expect(mock.deleteOrder[mock.deleteOrder.length - 1]).toBe('audit_log')
    expect(mock.deleteOrder.indexOf('workflow_events')).toBeLessThan(
      mock.deleteOrder.indexOf('projects'),
    )
  })

  it('STOPS at the first failing step and reports what had already run', async () => {
    const mock = createMockClient({ deleteErrors: { workflow_events: 'permission denied' } })
    const res = await executeTeardownDeletes(mock.client, ids)

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('workflow_events')
    expect(!res.ok && res.error).toContain('permission denied')
    // Nothing after the failure was attempted.
    expect(mock.deleteOrder).not.toContain('projects')
    expect(mock.deleteOrder).not.toContain('audit_log')
  })

  it('scopes the signatures delete by BOTH tenant and project', async () => {
    const mock = createMockClient()
    await executeTeardownDeletes(mock.client, ids)

    const sig = mock.recorded.find((r) => r.table === 'signatures' && r.op === 'delete')
    expect(sig!.filters).toEqual([
      { method: 'eq', column: 'tenant_id', value: TENANT },
      { method: 'eq', column: 'project_id', value: FIXTURE_PROJECT_ID },
    ])
  })
})

describe('assertZeroResidue', () => {
  it('passes when nothing remains', async () => {
    const mock = createMockClient()
    await expect(assertZeroResidue(mock.client, ids, SIGNATURE_BUCKET, [])).resolves.toEqual({
      ok: true,
    })
  })

  it('FAILS when workflow_events residue remains', async () => {
    const mock = createMockClient({ counts: { workflow_events: 3 } })
    const res = await assertZeroResidue(mock.client, ids, SIGNATURE_BUCKET, [])

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('workflow_events=3')
  })

  it('checks workflow_events residue via the metadata accessor', async () => {
    const mock = createMockClient()
    await assertZeroResidue(mock.client, ids, SIGNATURE_BUCKET, [])

    const we = mock.recorded.find((r) => r.table === 'workflow_events' && r.op === 'select')
    expect(we).toBeDefined()
    // Literal pinned, not compared to the constant — see the delete-path test.
    expect(we!.filters).toEqual([
      { method: 'eq', column: 'metadata->>project_id', value: FIXTURE_PROJECT_ID },
    ])
  })

  it('FAILS when a signature blob survives', async () => {
    const path = `signatures/${TENANT}/gate_approval/a-1.png`
    const mock = createMockClient({ aliveObjects: [path] })
    const res = await assertZeroResidue(mock.client, ids, SIGNATURE_BUCKET, [path])

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('storage_objects=1')
  })

  it('FAILS CLOSED when the FINAL storage verification errors', async () => {
    const path = `signatures/${TENANT}/gate_approval/a-1.png`
    const mock = createMockClient({ listError: { message: 'bucket unreachable' } })
    const res = await assertZeroResidue(mock.client, ids, SIGNATURE_BUCKET, [path])

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('Storage verification failed')
    expect(!res.ok && res.error).toContain('bucket unreachable')
  })
})

describe('listSurvivingObjects — fail closed on list errors', () => {
  it('returns an explicit verification error rather than treating data as absent', async () => {
    const mock = createMockClient({ listError: { message: 'network timeout' } })
    const res = await listSurvivingObjects(mock.client, SIGNATURE_BUCKET, [
      `signatures/${TENANT}/gate_approval/a-1.png`,
    ])

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('network timeout')
    expect(!res.ok && res.error).toContain('must never be treated as absent')
  })

  it('STOPS at the first error instead of probing the remaining paths', async () => {
    const mock = createMockClient({ listError: { message: 'boom', afterCalls: 1 } })
    const res = await listSurvivingObjects(mock.client, SIGNATURE_BUCKET, [
      `signatures/${TENANT}/gate_approval/a-1.png`,
      `signatures/${TENANT}/gate_approval/b-2.png`,
      `signatures/${TENANT}/gate_approval/c-3.png`,
    ])

    expect(res.ok).toBe(false)
    // First call succeeded, second errored, third never attempted.
    expect(mock.listCalls).toBe(2)
  })

  it('reports a surviving object without erroring', async () => {
    const path = `signatures/${TENANT}/gate_approval/a-1.png`
    const mock = createMockClient({ aliveObjects: [path] })
    const res = await listSurvivingObjects(mock.client, SIGNATURE_BUCKET, [path])

    expect(res).toEqual({ ok: true, alive: [path] })
  })

  it('reports an empty list when every object is gone', async () => {
    const mock = createMockClient()
    const res = await listSurvivingObjects(mock.client, SIGNATURE_BUCKET, [
      `signatures/${TENANT}/gate_approval/a-1.png`,
    ])

    expect(res).toEqual({ ok: true, alive: [] })
  })
})

describe('runTeardown — end-to-end ordering guarantees', () => {
  const GATE_PATH = `signatures/${TENANT}/gate_approval/a-1700000000000.png`

  const fixtureProject = {
    id: FIXTURE_PROJECT_ID,
    code: 'GMC-G3-SMOKE',
    tenant_id: TENANT,
    provenance: { fixture: 'g3-smoke', disposable: true },
  }

  const gateSignature = {
    id: 'sig-1',
    entity_type: 'gate_approval',
    signature_image_path: GATE_PATH,
  }

  const baseMock = (extra: MockOptions = {}) =>
    createMockClient({
      projectRow: fixtureProject,
      rows: {
        signatures: [gateSignature],
        approvals: [{ id: APPROVAL_IDS[0] }],
        phase_gates: [{ id: GATE_IDS[0] }],
      },
      ...extra,
    })

  it('DRY RUN is strictly read-only — no delete, no storage remove', async () => {
    const mock = baseMock()
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: false,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(true)
    expect(res.ok && res.dryRun).toBe(true)
    expect(res.ok && res.dryRun && res.plannedPaths).toEqual([GATE_PATH])
    // The two assertions that matter: nothing was written, anywhere.
    expect(mock.deleteOrder).toEqual([])
    expect(mock.removeCalls).toEqual([])
  })

  it('an ordinary governed gate signature completes the full cleanup', async () => {
    const mock = baseMock()
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(true)
    expect(res.ok && !res.dryRun && res.removedPaths).toEqual([GATE_PATH])
    expect(res.ok && !res.dryRun && res.tablesDeleted).toEqual([...TEARDOWN_DELETE_ORDER])
    expect(mock.removeCalls).toEqual([[GATE_PATH]])
  })

  it('removes the BLOB before the first database delete', async () => {
    // Ordering is the whole safety property: the signature rows are the only
    // record of which blobs exist, so a row deleted first orphans its object.
    const order: string[] = []
    const mock = createMockClient({
      projectRow: fixtureProject,
      rows: {
        signatures: [gateSignature],
        approvals: [{ id: APPROVAL_IDS[0] }],
        phase_gates: [{ id: GATE_IDS[0] }],
      },
    })
    const spy = new Proxy(mock.client, {
      get(target, prop, receiver) {
        if (prop === 'from') {
          return (table: string) => {
            const t = Reflect.get(target, 'from', receiver)(table)
            return {
              ...t,
              delete: () => {
                order.push(`db:${table}`)
                return t.delete()
              },
            }
          }
        }
        if (prop === 'storage') {
          return {
            from: (bucket: string) => {
              const b = target.storage.from(bucket)
              return {
                ...b,
                remove: (paths: string[]) => {
                  order.push('storage:remove')
                  return b.remove(paths)
                },
              }
            },
          }
        }
        return Reflect.get(target, prop, receiver)
      },
    }) as TeardownClient

    const res = await runTeardown(spy, { tenantId: TENANT, apply: true, bucket: SIGNATURE_BUCKET })
    expect(res.ok).toBe(true)
    expect(order[0]).toBe('storage:remove')
    expect(order.filter((o) => o.startsWith('db:')).length).toBeGreaterThan(0)
  })

  it('FAILS CLOSED on a pre-database storage list error — NO database write happens', async () => {
    const mock = baseMock({ listError: { message: 'storage 503' } })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('Storage verification failed')
    expect(!res.ok && res.error).toContain('database left untouched')
    // The decisive assertion: not a single row was deleted.
    expect(mock.deleteOrder).toEqual([])
  })

  it('FAILS the teardown when a surviving blob is detected before the deletes', async () => {
    const mock = baseMock({ aliveObjects: [GATE_PATH] })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('still present after deletion')
    expect(mock.deleteOrder).toEqual([])
  })

  it('FAILS when the FINAL storage verification errors after the deletes', async () => {
    // First list (pre-database) succeeds; the final verification errors.
    const mock = baseMock({ listError: { message: 'bucket gone', afterCalls: 1 } })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('Storage verification failed')
    // The deletes DID run — this proves the failure came from the final check,
    // not the pre-database one.
    expect(mock.deleteOrder).toContain('projects')
  })

  it('FAILS when workflow_event residue remains after the deletes', async () => {
    const mock = baseMock({ counts: { workflow_events: 2 } })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('workflow_events=2')
  })

  it('ABORTS on unexpected non-gate signature contamination WITHOUT deleting the row', async () => {
    const mock = baseMock({
      rows: {
        signatures: [
          { id: 'sig-x', entity_type: 'client_report', signature_image_path: 'signatures/x/client_report/a.png' },
        ],
        approvals: [{ id: APPROVAL_IDS[0] }],
        phase_gates: [{ id: GATE_IDS[0] }],
      },
    })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toContain('unexpected')
    // Neither the blob nor the row was touched: the row is the only pointer to
    // the blob, so deleting it would have orphaned the object permanently.
    expect(mock.deleteOrder).toEqual([])
    expect(mock.removeCalls).toEqual([])
  })

  it('REFUSES a project that is not the verified fixture', async () => {
    const mock = baseMock({ projectRow: { ...fixtureProject, code: 'GMC-REAL-001' } })
    const res = await runTeardown(mock.client, {
      tenantId: TENANT,
      apply: true,
      bucket: SIGNATURE_BUCKET,
    })

    expect(res.ok).toBe(false)
    expect(mock.deleteOrder).toEqual([])
    expect(mock.removeCalls).toEqual([])
  })
})

describe('runner <-> executable consistency', () => {
  it('the runner does NOT claim to execute the .sql file', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'scripts/g3-smoke-fixture.teardown.ts'), 'utf8')

    // The old comment said the runner "executes this file", which was false and
    // is how the missing workflow_events step stayed plausible for a reader.
    expect(src).toMatch(/does NOT shell out to, or execute/)
    expect(src).toContain('performs the teardown ITSELF')
  })

  it('the runner delegates to the tested executable module, not its own inline deletes', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(process.cwd(), 'scripts/g3-smoke-fixture.teardown.ts'), 'utf8')

    expect(src).toContain('runTeardown')
    // NO inline `.delete()` anywhere in the script. Any delete written here
    // would be outside the tested path — which is precisely how the missing
    // workflow_events step escaped every test.
    expect(src).not.toMatch(/\.delete\(\)/)
    expect(src).not.toMatch(/storage\.from\([^)]*\)\.remove/)
  })
})
