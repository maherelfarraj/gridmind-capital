/**
 * G3 smoke-fixture teardown RUNNER — zero-residue, idempotent, service-role.
 *
 * SQL alone cannot finish this job: signature BLOBS live in the `documents`
 * bucket and are invisible to Postgres. Deleting the `signatures` rows first
 * would discard the only record of which object paths exist, permanently
 * orphaning them. So the order here is fixed:
 *
 *   1. verify the fixture (id + code + provenance + tenant — all four)
 *   2. read the signature rows and collect their object paths
 *   3. validate every gate path with the CANONICAL application validator
 *   4. delete those objects from SIGNATURE_BUCKET, stopping on any failure
 *   5. delete the database rows in FK/trigger-safe order
 *   6. assert zero residue — rows AND storage objects
 *
 * Dry run (default, writes NOTHING):
 *   node --env-file-if-exists=/vercel/share/.env.project \
 *     node_modules/.bin/tsx scripts/g3-smoke-fixture.teardown.ts --tenant <uuid>
 *
 * Apply:
 *   ... --tenant <uuid> --apply
 *
 * There is NO tenant fallback. Omitting --tenant aborts.
 *
 * Idempotent: safe to re-run after a partial teardown. Every step is keyed to
 * ids rather than to the project row still being present, so a run that died
 * midway is simply completed by the next one.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SIGNATURE_BUCKET } from '../lib/approvals/signature-path'
import {
  FIXTURE_PROJECT_ID,
  planSignatureStorageCleanup,
  verifyFixtureProject,
  type FixtureProjectRow,
  type SignatureRowForCleanup,
} from '../lib/fixtures/g3-smoke-teardown'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function parseArgs(argv: string[]): { tenantId: string; apply: boolean } {
  let tenantId = ''
  let apply = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--tenant') tenantId = argv[++i] ?? ''
    else if (argv[i].startsWith('--tenant=')) tenantId = argv[i].slice('--tenant='.length)
    else if (argv[i] === '--apply') apply = true
  }
  if (!tenantId) {
    fail('--tenant <uuid> is required. There is no fallback: the teardown will not guess a tenant.')
  }
  if (!UUID_RE.test(tenantId)) fail(`--tenant must be a UUID, received "${tenantId}"`)
  return { tenantId, apply }
}

/** Objects that still exist in the bucket, from a captured path list. */
async function survivingObjects(
  supabase: SupabaseClient,
  paths: string[],
): Promise<string[]> {
  const alive: string[] = []
  for (const path of paths) {
    const slash = path.lastIndexOf('/')
    const dir = path.slice(0, slash)
    const name = path.slice(slash + 1)
    const { data } = await supabase.storage.from(SIGNATURE_BUCKET).list(dir, { search: name })
    if ((data ?? []).some((o) => o.name === name)) alive.push(path)
  }
  return alive
}

async function main() {
  const { tenantId, apply } = parseArgs(process.argv.slice(2))

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const mode = apply ? 'APPLY' : 'DRY RUN (no writes)'
  console.log(`\nG3 smoke fixture teardown — ${mode}`)
  console.log(`  tenant:  ${tenantId}`)
  console.log(`  project: ${FIXTURE_PROJECT_ID}\n`)

  // ── 1. Verify the fixture ──────────────────────────────────────────────────
  const { data: projectRow, error: projectErr } = await supabase
    .from('projects')
    .select('id, code, tenant_id, provenance')
    .eq('id', FIXTURE_PROJECT_ID)
    .maybeSingle()
  if (projectErr) fail(`Could not read the fixture project: ${projectErr.message}`)

  const verdict = verifyFixtureProject(projectRow as FixtureProjectRow | null, tenantId)
  if (!verdict.ok) fail(verdict.error)
  console.log(
    verdict.present
      ? '✓ Fixture verified (id + code + provenance + tenant all match).'
      : '• Fixture project row already absent — sweeping residue only (idempotent re-run).',
  )

  // ── 2. Collect signature rows + their object paths ─────────────────────────
  const { data: sigRows, error: sigErr } = await supabase
    .from('signatures')
    .select('id, entity_type, signature_image_path')
    .eq('tenant_id', tenantId)
    .eq('project_id', FIXTURE_PROJECT_ID)
  if (sigErr) fail(`Could not read fixture signatures: ${sigErr.message}`)

  // ── 3. Validate every gate path with the canonical validator ───────────────
  const plan = planSignatureStorageCleanup((sigRows ?? []) as SignatureRowForCleanup[], tenantId)
  if (!plan.ok) fail(plan.error)

  console.log(`✓ ${sigRows?.length ?? 0} signature row(s); ${plan.paths.length} validated object path(s).`)
  for (const p of plan.paths) console.log(`    - ${p}`)
  for (const s of plan.skipped) console.log(`    (skipped ${s.id}: ${s.reason})`)

  if (!apply) {
    console.log('\nDry run complete. Nothing was deleted. Re-run with --apply to execute.\n')
    return
  }

  // ── 4. Delete storage objects FIRST, stopping on any failure ───────────────
  if (plan.paths.length) {
    const { error: rmErr } = await supabase.storage.from(SIGNATURE_BUCKET).remove(plan.paths)
    if (rmErr) fail(`Storage deletion failed (database left untouched): ${rmErr.message}`)

    // `remove()` can report success per-request while an object survives, so
    // verify rather than trust. Doing this BEFORE the row delete means a
    // surviving blob is still traceable to its row.
    const alive = await survivingObjects(supabase, plan.paths)
    if (alive.length) fail(`Storage objects still present after deletion: ${alive.join(', ')}`)
    console.log(`✓ Removed ${plan.paths.length} storage object(s) from "${SIGNATURE_BUCKET}".`)
  } else {
    console.log('• No storage objects to remove.')
  }

  // ── 5. Database teardown, FK/trigger-safe order ────────────────────────────
  // Approval ids are captured BEFORE the deletes: the approvals AFTER DELETE
  // audit trigger writes rows keyed to these ids, and they must be swept after.
  const { data: apprRows, error: apprErr } = await supabase
    .from('approvals')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('object_type', 'gate')
    .eq('object_id', FIXTURE_PROJECT_ID)
  if (apprErr) fail(`Could not read fixture approvals: ${apprErr.message}`)
  const approvalIds = (apprRows ?? []).map((a) => a.id as string)

  const { data: gateRows, error: gateErr } = await supabase
    .from('phase_gates')
    .select('id')
    .eq('project_id', FIXTURE_PROJECT_ID)
  if (gateErr) fail(`Could not read fixture phase gates: ${gateErr.message}`)
  const gateIds = (gateRows ?? []).map((g) => g.id as string)

  const step = async (label: string, run: () => Promise<{ error: { message: string } | null }>) => {
    const { error } = await run()
    if (error) fail(`Teardown step "${label}" failed: ${error.message}`)
    console.log(`  ✓ ${label}`)
  }

  await step('signatures', () =>
    supabase.from('signatures').delete().eq('tenant_id', tenantId).eq('project_id', FIXTURE_PROJECT_ID),
  )

  if (approvalIds.length) {
    await step('approval_conditions', () =>
      supabase.from('approval_conditions').delete().in('approval_id', approvalIds),
    )
    await step('approval_events', () =>
      supabase.from('approval_events').delete().in('approval_id', approvalIds),
    )
    await step('approval_steps', () =>
      supabase.from('approval_steps').delete().in('approval_id', approvalIds),
    )
    await step('approvals', () => supabase.from('approvals').delete().in('id', approvalIds))
  }

  await step('gate_submissions', () =>
    supabase.from('gate_submissions').delete().eq('project_id', FIXTURE_PROJECT_ID),
  )
  await step('project_team', () =>
    supabase.from('project_team').delete().eq('project_id', FIXTURE_PROJECT_ID),
  )
  await step('document_files', () =>
    supabase.from('document_files').delete().eq('project_id', FIXTURE_PROJECT_ID),
  )
  await step('approval_items', () =>
    supabase.from('approval_items').delete().eq('project_id', FIXTURE_PROJECT_ID),
  )
  if (gateIds.length) {
    await step('gate_signoffs', () =>
      supabase.from('gate_signoffs').delete().in('phase_gate_id', gateIds),
    )
  }
  await step('phase_gates', () =>
    supabase.from('phase_gates').delete().eq('project_id', FIXTURE_PROJECT_ID),
  )
  await step('projects', () => supabase.from('projects').delete().eq('id', FIXTURE_PROJECT_ID))

  // audit_log LAST: the projects/approvals delete triggers have just written to it.
  await step('audit_log (project-keyed)', () =>
    supabase.from('audit_log').delete().eq('record_id', FIXTURE_PROJECT_ID),
  )
  if (approvalIds.length) {
    await step('audit_log (approval-keyed)', () =>
      supabase.from('audit_log').delete().in('record_id', approvalIds),
    )
  }

  // ── 6. Assert zero residue ─────────────────────────────────────────────────
  const residue: string[] = []
  const head = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true })

  const checks: { label: string; query: PromiseLike<{ count: number | null; error: { message: string } | null }> }[] = [
    { label: 'projects', query: head('projects').eq('id', FIXTURE_PROJECT_ID) },
    { label: 'phase_gates', query: head('phase_gates').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'document_files', query: head('document_files').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'project_team', query: head('project_team').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'gate_submissions', query: head('gate_submissions').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'approval_items', query: head('approval_items').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'signatures', query: head('signatures').eq('project_id', FIXTURE_PROJECT_ID) },
    { label: 'approvals', query: head('approvals').eq('object_type', 'gate').eq('object_id', FIXTURE_PROJECT_ID) },
    { label: 'audit_log(project)', query: head('audit_log').eq('record_id', FIXTURE_PROJECT_ID) },
  ]
  if (approvalIds.length) {
    checks.push(
      { label: 'audit_log(approval)', query: head('audit_log').in('record_id', approvalIds) },
      { label: 'approval_steps', query: head('approval_steps').in('approval_id', approvalIds) },
      { label: 'approval_events', query: head('approval_events').in('approval_id', approvalIds) },
      { label: 'approval_conditions', query: head('approval_conditions').in('approval_id', approvalIds) },
    )
  }
  if (gateIds.length) {
    checks.push({ label: 'gate_signoffs', query: head('gate_signoffs').in('phase_gate_id', gateIds) })
  }

  for (const check of checks) {
    const { count, error } = await check.query
    if (error) fail(`Residue check "${check.label}" failed: ${error.message}`)
    if ((count ?? 0) > 0) residue.push(`${check.label}=${count}`)
  }

  const aliveAfter = await survivingObjects(supabase, plan.paths)
  if (aliveAfter.length) residue.push(`storage_objects=${aliveAfter.length}`)

  if (residue.length) fail(`TEARDOWN ASSERT: residue remains — ${residue.join(', ')}`)

  console.log('\n✓ Zero residue: all fixture rows, approval-keyed audit rows and signature blobs are gone.\n')
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
