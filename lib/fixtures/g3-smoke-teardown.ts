/**
 * G3 smoke-fixture teardown — PURE decision logic.
 *
 * Everything here is I/O-free so the parts that decide WHAT may be deleted can
 * be tested exhaustively without a database or a storage bucket. The runner
 * (`scripts/g3-smoke-fixture.teardown.ts`) supplies the rows and performs the
 * deletes; it makes no deletion decisions of its own.
 *
 * The teardown is destructive and runs with the service-role key, so the guard
 * rails live here rather than in the script: a fixture is only ever recognised
 * by ALL of id + code + provenance + tenant, and a storage object is only ever
 * removed if its path passes the SAME canonical validator the application uses.
 */

import { validateStagedSignaturePath } from '@/lib/approvals/signature-path'

/** The fixed, disposable fixture project. */
export const FIXTURE_PROJECT_ID = 'aaaaaaaa-0000-4000-8000-000000000003'
export const FIXTURE_PROJECT_CODE = 'GMC-G3-SMOKE'
export const FIXTURE_PROVENANCE_KEY = 'g3-smoke'

export interface FixtureProjectRow {
  id: string
  code: string | null
  tenant_id: string | null
  provenance: { fixture?: string; disposable?: boolean } | null
}

export type FixtureVerification =
  | { ok: true; present: true }
  /**
   * The project row is gone. This is NOT an error: a previous run may have been
   * interrupted after deleting the project but before sweeping its residue, and
   * the teardown must stay idempotent. The runner continues to the sweep.
   */
  | { ok: true; present: false }
  | { ok: false; error: string }

/**
 * Confirm a row is genuinely the disposable fixture before anything is deleted.
 *
 * Every criterion is required. The project id alone is NOT sufficient: an id is
 * just a constant in a file, and a mistyped or rotated environment could hold a
 * real project at that id. Requiring code + provenance + tenant as well means a
 * non-fixture row can never be mistaken for one.
 */
export function verifyFixtureProject(
  row: FixtureProjectRow | null | undefined,
  tenantId: string,
): FixtureVerification {
  if (!row) return { ok: true, present: false }

  if (row.id !== FIXTURE_PROJECT_ID) {
    return { ok: false, error: `Refusing teardown: project id ${row.id} is not the fixture id` }
  }
  if (row.code !== FIXTURE_PROJECT_CODE) {
    return {
      ok: false,
      error: `Refusing teardown: project ${row.id} has code ${row.code ?? 'null'} (expected ${FIXTURE_PROJECT_CODE})`,
    }
  }
  if (row.provenance?.fixture !== FIXTURE_PROVENANCE_KEY) {
    return {
      ok: false,
      error: `Refusing teardown: project ${row.id} is not provenance.fixture=${FIXTURE_PROVENANCE_KEY}`,
    }
  }
  if (row.tenant_id !== tenantId) {
    return {
      ok: false,
      error: `Refusing teardown: project ${row.id} belongs to tenant ${row.tenant_id ?? 'null'}, not ${tenantId}`,
    }
  }
  return { ok: true, present: true }
}

export interface SignatureRowForCleanup {
  id: string
  entity_type: string | null
  signature_image_path: string | null
}

export type StorageCleanupPlan =
  | { ok: true; paths: string[]; skipped: { id: string; reason: string }[] }
  | { ok: false; error: string }

/**
 * Decide which storage objects the teardown may delete.
 *
 * Gate signature paths MUST pass the canonical validator — the same function
 * the application uses — which pins the path to
 * `signatures/<tenant>/gate_approval/<file>.png` and refuses traversal,
 * encoded traversal and any path belonging to another tenant. A gate row whose
 * path fails validation is a HARD FAILURE, not a skip: it means either the row
 * is malformed or the path points somewhere the fixture does not own, and
 * silently ignoring it would let the teardown report success while leaving a
 * blob behind (or, worse, mask a path we should never have stored).
 *
 * Non-gate signature rows (e.g. `client_report`) are skipped rather than
 * failed: they use a different context segment, so the gate validator does not
 * apply to them, and the fixture never creates them.
 *
 * A row with no path at all is skipped — there is no object to remove.
 */
export function planSignatureStorageCleanup(
  rows: readonly SignatureRowForCleanup[],
  tenantId: string,
): StorageCleanupPlan {
  const paths: string[] = []
  const skipped: { id: string; reason: string }[] = []

  for (const row of rows) {
    if (!row.signature_image_path) {
      skipped.push({ id: row.id, reason: 'no signature_image_path' })
      continue
    }
    if (row.entity_type !== 'gate_approval') {
      skipped.push({ id: row.id, reason: `non-gate entity_type ${row.entity_type ?? 'null'}` })
      continue
    }

    const validation = validateStagedSignaturePath(row.signature_image_path, tenantId)
    if (!validation.valid) {
      return {
        ok: false,
        error: `Refusing teardown: signature ${row.id} has an invalid gate path (${validation.reason})`,
      }
    }
    // De-duplicate: two rows referencing one object must not double-delete.
    if (!paths.includes(row.signature_image_path)) paths.push(row.signature_image_path)
  }

  return { ok: true, paths, skipped }
}

/**
 * The DB delete order, shared by the runner and asserted against the .sql file
 * by a drift test.
 *
 * Order is load-bearing, not cosmetic:
 *   - `signatures` first, because the runner has already removed the matching
 *     blobs and the rows are the only record of which paths those were;
 *   - approval CHILDREN before `approvals` (foreign keys);
 *   - `gate_signoffs` before `phase_gates` (foreign key);
 *   - `projects` and `approvals` fire AFTER DELETE audit triggers that INSERT
 *     into audit_log, so `audit_log` is swept LAST — sweeping it earlier is the
 *     exact bug that left a residual row behind a previous teardown.
 */
export const TEARDOWN_DELETE_ORDER: readonly string[] = [
  'signatures',
  'approval_conditions',
  'approval_events',
  'approval_steps',
  'approvals',
  'workflow_events',
  'gate_submissions',
  'project_team',
  'document_files',
  'approval_items',
  'gate_signoffs',
  'phase_gates',
  'projects',
  'audit_log',
]
