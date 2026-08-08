/**
 * G3 smoke-fixture teardown — EXECUTABLE database/storage sequence.
 *
 * This is deliberately separate from `./g3-smoke-teardown` (which is pure
 * decision logic) and from the CLI wrapper in `scripts/`. It exists so the
 * ACTUAL sequence of deletions can be driven by an injected client and asserted
 * in a unit test.
 *
 * That separation is the point. The previous drift test compared only the .sql
 * file against `TEARDOWN_DELETE_ORDER` and never touched the TypeScript runner,
 * so a table listed in the order and present in the SQL could be missing from
 * the executable path and every test still passed — which is exactly how the
 * `workflow_events` delete went missing.
 *
 * Nothing here decides WHAT may be deleted; it only performs the deletions the
 * pure module has already authorised, and it fails closed on any error.
 */

import {
  FIXTURE_PROJECT_ID,
  TEARDOWN_DELETE_ORDER,
  planSignatureStorageCleanup,
  verifyFixtureProject,
  type FixtureProjectRow,
  type SignatureRowForCleanup,
} from './g3-smoke-teardown'

export interface TeardownError {
  message: string
}

/**
 * A minimal structural view of the query builder. Only the operations this
 * module actually uses are modelled, so a test double is small and fully typed
 * rather than a sprawling `any`.
 */
export interface TeardownFilterable<R> extends PromiseLike<R> {
  eq(column: string, value: unknown): TeardownFilterable<R>
  in(column: string, values: readonly unknown[]): TeardownFilterable<R>
}

/**
 * A SELECT chain. This is a single interface rather than an intersection of a
 * "countable" and a "readable" one: `.eq()` must return the SAME type it was
 * called on, and an intersection collapses to whichever member declares `.eq`
 * first — silently dropping `.maybeSingle()` after the first filter.
 */
export interface TeardownQuery<Row = Record<string, unknown>>
  extends PromiseLike<{
    data: Row[] | null
    count: number | null
    error: TeardownError | null
  }> {
  eq(column: string, value: unknown): TeardownQuery<Row>
  in(column: string, values: readonly unknown[]): TeardownQuery<Row>
  maybeSingle(): PromiseLike<{ data: Row | null; error: TeardownError | null }>
}

export interface TeardownTable {
  delete(): TeardownFilterable<{ error: TeardownError | null }>
  select(columns: string, options?: { count?: 'exact'; head?: boolean }): TeardownQuery
}

export interface TeardownStorageBucket {
  remove(paths: string[]): PromiseLike<{ error: TeardownError | null }>
  list(
    prefix: string,
    options?: { search?: string },
  ): PromiseLike<{ data: { name: string }[] | null; error: TeardownError | null }>
}

export interface TeardownClient {
  from(table: string): TeardownTable
  storage: { from(bucket: string): TeardownStorageBucket }
}

/** Ids captured BEFORE any delete, so trigger-written rows remain sweepable. */
export interface TeardownIds {
  tenantId: string
  approvalIds: readonly string[]
  gateIds: readonly string[]
}

export type TeardownStepResult =
  | { ok: true; tablesDeleted: string[] }
  | { ok: false; error: string; tablesDeleted: string[] }

export type StorageProbe = { ok: true; alive: string[] } | { ok: false; error: string }

/**
 * The JSON filter that identifies fixture workflow events.
 *
 * `workflow_events` has no `project_id` column — the project is recorded inside
 * `metadata`, so the row is matched through a JSON accessor. Verified against
 * the live schema (columns: id, instance_id, from_state, to_state,
 * transition_code, actor_id, comment, metadata, created_at).
 */
export const WORKFLOW_EVENT_PROJECT_FILTER = 'metadata->>project_id'

/**
 * Report which of `paths` still exist in the bucket.
 *
 * FAIL-CLOSED: every `list` result is checked, and the FIRST error aborts with
 * an explicit verification error. Treating an errored list as "no data, so the
 * object is gone" would let a transient storage fault masquerade as proof of
 * deletion — which would then authorise deleting the database rows that are the
 * only record of which blobs to remove.
 */
export async function listSurvivingObjects(
  client: TeardownClient,
  bucket: string,
  paths: readonly string[],
): Promise<StorageProbe> {
  const alive: string[] = []
  for (const path of paths) {
    const slash = path.lastIndexOf('/')
    const dir = slash >= 0 ? path.slice(0, slash) : ''
    const name = slash >= 0 ? path.slice(slash + 1) : path

    const { data, error } = await client.storage.from(bucket).list(dir, { search: name })
    if (error) {
      return {
        ok: false,
        error:
          `Storage verification failed for "${path}": ${error.message}. ` +
          `Refusing to continue — an unverifiable object must never be treated as absent.`,
      }
    }
    if ((data ?? []).some((o) => o.name === name)) alive.push(path)
  }
  return { ok: true, alive }
}

/** Collapse consecutive repeats so two `audit_log` sweeps read as one table. */
function dedupeConsecutive(values: readonly string[]): string[] {
  return values.filter((v, i) => i === 0 || values[i - 1] !== v)
}

/**
 * Perform the database teardown in the order declared by
 * `TEARDOWN_DELETE_ORDER`, stopping at the first failure.
 *
 * Returns the tables it actually deleted from, in execution order, so a test
 * can assert the observed sequence rather than trusting a comment.
 */
export async function executeTeardownDeletes(
  client: TeardownClient,
  ids: TeardownIds,
  onStep?: (table: string) => void,
): Promise<TeardownStepResult> {
  const { tenantId, approvalIds, gateIds } = ids
  const byProject = (table: string) =>
    client.from(table).delete().eq('project_id', FIXTURE_PROJECT_ID)

  const steps: { table: string; run: () => PromiseLike<{ error: TeardownError | null }> }[] = [
    // Blobs have already been removed and verified; these rows are the only
    // record of which paths those were, so they go first.
    {
      table: 'signatures',
      run: () =>
        client
          .from('signatures')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('project_id', FIXTURE_PROJECT_ID),
    },
  ]

  // Approval CHILDREN before `approvals` (foreign keys).
  if (approvalIds.length) {
    steps.push(
      {
        table: 'approval_conditions',
        run: () => client.from('approval_conditions').delete().in('approval_id', approvalIds),
      },
      {
        table: 'approval_events',
        run: () => client.from('approval_events').delete().in('approval_id', approvalIds),
      },
      {
        table: 'approval_steps',
        run: () => client.from('approval_steps').delete().in('approval_id', approvalIds),
      },
      { table: 'approvals', run: () => client.from('approvals').delete().in('id', approvalIds) },
    )
  }

  steps.push(
    {
      table: 'workflow_events',
      run: () =>
        client
          .from('workflow_events')
          .delete()
          .eq(WORKFLOW_EVENT_PROJECT_FILTER, FIXTURE_PROJECT_ID),
    },
    { table: 'gate_submissions', run: () => byProject('gate_submissions') },
    { table: 'project_team', run: () => byProject('project_team') },
    { table: 'document_files', run: () => byProject('document_files') },
    { table: 'approval_items', run: () => byProject('approval_items') },
  )

  // `gate_signoffs` before `phase_gates` (foreign key).
  if (gateIds.length) {
    steps.push({
      table: 'gate_signoffs',
      run: () => client.from('gate_signoffs').delete().in('phase_gate_id', gateIds),
    })
  }

  steps.push(
    { table: 'phase_gates', run: () => byProject('phase_gates') },
    {
      table: 'projects',
      run: () => client.from('projects').delete().eq('id', FIXTURE_PROJECT_ID),
    },
    // audit_log LAST: the projects/approvals AFTER DELETE triggers have just
    // written to it. Sweeping earlier is the exact bug that left a residual row.
    {
      table: 'audit_log',
      run: () => client.from('audit_log').delete().eq('record_id', FIXTURE_PROJECT_ID),
    },
  )
  if (approvalIds.length) {
    steps.push({
      table: 'audit_log',
      run: () => client.from('audit_log').delete().in('record_id', approvalIds),
    })
  }

  const performed: string[] = []
  for (const s of steps) {
    const { error } = await s.run()
    if (error) {
      return {
        ok: false,
        error: `Teardown step "${s.table}" failed: ${error.message}`,
        tablesDeleted: dedupeConsecutive(performed),
      }
    }
    performed.push(s.table)
    onStep?.(s.table)
  }

  return { ok: true, tablesDeleted: dedupeConsecutive(performed) }
}

/**
 * The relative order the executable path must follow. Exposed so a test can
 * compare the OBSERVED order against the single shared declaration.
 */
export function expectedDeleteOrder(ids: {
  approvalIds: readonly string[]
  gateIds: readonly string[]
}): string[] {
  const skip = new Set<string>()
  if (!ids.approvalIds.length) {
    for (const t of ['approval_conditions', 'approval_events', 'approval_steps', 'approvals']) {
      skip.add(t)
    }
  }
  if (!ids.gateIds.length) skip.add('gate_signoffs')
  return TEARDOWN_DELETE_ORDER.filter((t) => !skip.has(t))
}

/**
 * Assert zero residue: rows AND storage objects. Storage list errors fail the
 * teardown rather than being read as "nothing left".
 */
export async function assertZeroResidue(
  client: TeardownClient,
  ids: TeardownIds,
  bucket: string,
  storagePaths: readonly string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { tenantId, approvalIds, gateIds } = ids
  // `*` rather than `id`: head+count returns no rows, and it avoids assuming
  // every swept table exposes an `id` column.
  const head = (table: string) => client.from(table).select('*', { count: 'exact', head: true })

  const checks: {
    label: string
    query: TeardownFilterable<{ count: number | null; error: TeardownError | null }>
  }[] = [
    { label: 'projects', query: head('projects').eq('id', FIXTURE_PROJECT_ID) },
    { label: 'phase_gates', query: head('phase_gates').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'document_files', query: head('document_files').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'project_team', query: head('project_team').eq('project_id', FIXTURE_PROJECT_ID) },
    {
      label: 'gate_submissions',
      query: head('gate_submissions').eq('project_id', FIXTURE_PROJECT_ID),
    },
    { label: 'approval_items', query: head('approval_items').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'signatures', query: head('signatures').eq('project_id', FIXTURE_PROJECT_ID) },
    {
      label: 'workflow_events',
      query: head('workflow_events').eq(WORKFLOW_EVENT_PROJECT_FILTER, FIXTURE_PROJECT_ID),
    },
    {
      label: 'approvals',
      query: head('approvals').eq('object_type', 'gate').eq('object_id', FIXTURE_PROJECT_ID),
    },
    { label: 'audit_log(project)', query: head('audit_log').eq('record_id', FIXTURE_PROJECT_ID) },
  ]
  if (approvalIds.length) {
    checks.push(
      { label: 'audit_log(approval)', query: head('audit_log').in('record_id', approvalIds) },
      { label: 'approval_steps', query: head('approval_steps').in('approval_id', approvalIds) },
      { label: 'approval_events', query: head('approval_events').in('approval_id', approvalIds) },
      {
        label: 'approval_conditions',
        query: head('approval_conditions').in('approval_id', approvalIds),
      },
    )
  }
  if (gateIds.length) {
    checks.push({
      label: 'gate_signoffs',
      query: head('gate_signoffs').in('phase_gate_id', gateIds),
    })
  }
  void tenantId

  const residue: string[] = []
  for (const check of checks) {
    const { count, error } = await check.query
    if (error) return { ok: false, error: `Residue check "${check.label}" failed: ${error.message}` }
    if ((count ?? 0) > 0) residue.push(`${check.label}=${count}`)
  }

  const probe = await listSurvivingObjects(client, bucket, storagePaths)
  if (!probe.ok) return { ok: false, error: probe.error }
  if (probe.alive.length) residue.push(`storage_objects=${probe.alive.length}`)

  if (residue.length) {
    return { ok: false, error: `TEARDOWN ASSERT: residue remains — ${residue.join(', ')}` }
  }
  return { ok: true }
}

export type TeardownRunResult =
  | { ok: true; dryRun: true; plannedPaths: string[]; skipped: { id: string; reason: string }[] }
  | { ok: true; dryRun: false; tablesDeleted: string[]; removedPaths: string[] }
  | { ok: false; error: string }

/**
 * The whole teardown, orchestrated.
 *
 * This lives here rather than in the CLI script so the ORDERING GUARANTEES are
 * testable: that a dry run performs no delete and no remove at all, and that a
 * storage verification failure aborts BEFORE the first database write. Those are
 * the properties that keep a blob from being orphaned, and a property that only
 * exists inside a `main()` in scripts/ cannot be asserted by any test.
 */
export async function runTeardown(
  client: TeardownClient,
  options: { tenantId: string; apply: boolean; bucket: string },
  log: (line: string) => void = () => {},
): Promise<TeardownRunResult> {
  const { tenantId, apply, bucket } = options

  // ── 1. Verify the fixture: id + code + provenance + tenant, all four ───────
  const { data: projectRow, error: projectErr } = await client
    .from('projects')
    .select('id, code, tenant_id, provenance')
    .eq('id', FIXTURE_PROJECT_ID)
    .maybeSingle()
  if (projectErr) return { ok: false, error: `Could not read the fixture project: ${projectErr.message}` }

  const verdict = verifyFixtureProject(projectRow as FixtureProjectRow | null, tenantId)
  if (!verdict.ok) return { ok: false, error: verdict.error }
  log(
    verdict.present
      ? '✓ Fixture verified (id + code + provenance + tenant all match).'
      : '• Fixture project row already absent — sweeping residue only (idempotent re-run).',
  )

  // ── 2. Read the signature rows: the ONLY record of which blobs exist ───────
  const { data: sigRows, error: sigErr } = await client
    .from('signatures')
    .select('id, entity_type, signature_image_path')
    .eq('tenant_id', tenantId)
    .eq('project_id', FIXTURE_PROJECT_ID)
  if (sigErr) return { ok: false, error: `Could not read fixture signatures: ${sigErr.message}` }

  // ── 3. Authorise blob deletion via the canonical validator ────────────────
  const plan = planSignatureStorageCleanup(
    (sigRows ?? []) as unknown as SignatureRowForCleanup[],
    tenantId,
  )
  if (!plan.ok) return { ok: false, error: plan.error }

  log(`✓ ${sigRows?.length ?? 0} signature row(s); ${plan.paths.length} validated object path(s).`)
  for (const p of plan.paths) log(`    - ${p}`)
  for (const s of plan.skipped) log(`    (skipped ${s.id}: ${s.reason})`)

  if (!apply) {
    return { ok: true, dryRun: true, plannedPaths: plan.paths, skipped: plan.skipped }
  }

  // ── 4. Blobs FIRST — and verify, do not trust ──────────────────────────────
  if (plan.paths.length) {
    const { error: rmErr } = await client.storage.from(bucket).remove([...plan.paths])
    if (rmErr) {
      return { ok: false, error: `Storage deletion failed (database left untouched): ${rmErr.message}` }
    }

    // `remove()` can report success while an object survives, so verify. A LIST
    // ERROR ABORTS HERE, before any row is deleted: an unverifiable object must
    // never be read as an absent one, or a transient storage fault would
    // authorise deleting the rows that record which blobs to remove.
    const probe = await listSurvivingObjects(client, bucket, plan.paths)
    if (!probe.ok) return { ok: false, error: `${probe.error} (database left untouched)` }
    if (probe.alive.length) {
      return {
        ok: false,
        error: `Storage objects still present after deletion: ${probe.alive.join(', ')} (database left untouched)`,
      }
    }
    log(`✓ Removed ${plan.paths.length} storage object(s) from "${bucket}".`)
  } else {
    log('• No storage objects to remove.')
  }

  // ── 5. Capture ids BEFORE the deletes ─────────────────────────────────────
  // The approvals AFTER DELETE audit trigger writes rows keyed to these ids;
  // reading them afterwards would be too late to sweep them.
  const { data: apprRows, error: apprErr } = await client
    .from('approvals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'gate')
    .eq('object_id', FIXTURE_PROJECT_ID)
  if (apprErr) return { ok: false, error: `Could not read fixture approvals: ${apprErr.message}` }
  const approvalIds = (apprRows ?? []).map((a) => a.id as string)

  const { data: gateRows, error: gateErr } = await client
    .from('phase_gates')
    .select('id')
    .eq('project_id', FIXTURE_PROJECT_ID)
  if (gateErr) return { ok: false, error: `Could not read fixture phase gates: ${gateErr.message}` }
  const gateIds = (gateRows ?? []).map((g) => g.id as string)

  const ids: TeardownIds = { tenantId, approvalIds, gateIds }

  // ── 6. Database teardown in TEARDOWN_DELETE_ORDER ─────────────────────────
  const outcome = await executeTeardownDeletes(client, ids, (table) => log(`  ✓ ${table}`))
  if (!outcome.ok) return { ok: false, error: outcome.error }

  // ── 7. Assert zero residue — rows AND blobs ───────────────────────────────
  const residue = await assertZeroResidue(client, ids, bucket, plan.paths)
  if (!residue.ok) return { ok: false, error: residue.error }

  return {
    ok: true,
    dryRun: false,
    tablesDeleted: outcome.tablesDeleted,
    removedPaths: plan.paths,
  }
}
