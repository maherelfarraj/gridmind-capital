/**
 * G3 smoke-fixture teardown RUNNER — zero-residue, idempotent, service-role.
 *
 * WHAT THIS ACTUALLY DOES: it performs the teardown ITSELF over supabase-js.
 * It does NOT shell out to, or execute, scripts/g3-smoke-fixture.teardown.sql.
 * (There is no `psql` and no `pg` driver in this environment, so the .sql file
 * is the reference/documented form and this path is the executable one. A drift
 * test asserts the two cover the same tables in the same relative order,
 * because two implementations of one contract will otherwise diverge — that is
 * exactly how the `workflow_events` delete went missing from the runner while
 * remaining present in the SQL and in TEARDOWN_DELETE_ORDER.)
 *
 * SQL alone cannot finish the job regardless: signature BLOBS live in the
 * `documents` bucket and are invisible to Postgres. Deleting the `signatures`
 * rows first would discard the only record of which object paths exist,
 * permanently orphaning them.
 *
 * This file is a THIN CLI SHELL on purpose. Argument parsing and printing live
 * here; every decision and every write lives in:
 *   - lib/fixtures/g3-smoke-teardown.ts       (pure: what may be deleted)
 *   - lib/fixtures/g3-smoke-teardown-exec.ts  (executable: the ordered writes)
 * so the destructive sequence — including "dry run writes nothing" and "a
 * storage verification failure aborts before the first database write" — is
 * unit-tested rather than trusted.
 *
 * Dry run (default, writes NOTHING):
 *   set -a && source /vercel/share/.env.project && set +a && \
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

import { createClient } from '@supabase/supabase-js'

import { SIGNATURE_BUCKET } from '../lib/approvals/signature-path'
import { FIXTURE_PROJECT_ID } from '../lib/fixtures/g3-smoke-teardown'
import { runTeardown, type TeardownClient } from '../lib/fixtures/g3-smoke-teardown-exec'

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

async function main() {
  const { tenantId, apply } = parseArgs(process.argv.slice(2))

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  // The exec module models only the operations it uses, so the concrete client
  // is adapted to that narrower structural type.
  const client = supabase as unknown as TeardownClient

  console.log(`\nG3 smoke fixture teardown — ${apply ? 'APPLY' : 'DRY RUN (no writes)'}`)
  console.log(`  tenant:  ${tenantId}`)
  console.log(`  project: ${FIXTURE_PROJECT_ID}\n`)

  const result = await runTeardown(
    client,
    { tenantId, apply, bucket: SIGNATURE_BUCKET },
    (line) => console.log(line),
  )

  if (!result.ok) fail(result.error)

  if (result.dryRun) {
    console.log('\nDry run complete. Nothing was deleted. Re-run with --apply to execute.\n')
    return
  }

  console.log(
    `\n✓ Zero residue: fixture rows (${result.tablesDeleted.join(', ')}), ` +
      `approval-keyed audit rows and ${result.removedPaths.length} signature blob(s) are gone.\n`,
  )
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
