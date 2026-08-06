/**
 * CANONICAL gate-signature storage module — server-only.
 *
 * ONE module owns every storage interaction for a gate signature: the bucket
 * name, the path shape, the upload, the signed-URL read, and the failed-stage
 * deletion. Before this module the bucket was declared in two places and they
 * DISAGREED — `app/actions/signatures.ts` uploaded to `documents` while the
 * cleanup path deleted from a non-existent `signatures` bucket, so cleanup could
 * never remove the blob it was written to remove. A single owner makes that
 * class of drift impossible: a caller cannot pick the wrong bucket because it
 * cannot name one.
 *
 * NOT a server action. Nothing here is exported to the client — an exported
 * delete-by-path action is an arbitrary-path deletion primitive, which is
 * exactly what item 3 of this correction removes.
 */

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The ONE bucket for signature blobs. Gate signatures live in the existing
 * `documents` bucket alongside every other project artifact; there is no
 * separate `signatures` bucket provisioned in this project.
 */
export const SIGNATURE_BUCKET = 'documents'

/** Every signature object path begins with this segment. */
export const SIGNATURE_PATH_ROOT = 'signatures'

/** The staging context segment for a gate-approval signature. */
export const GATE_SIGNATURE_CONTEXT = 'gate_approval'

/**
 * Canonical staged-path shape:
 *
 *     signatures/<tenant-id>/gate_approval/<filename>.png
 *
 * EXACTLY four segments. A stricter-than-necessary shape is deliberate: the
 * only paths this module will ever delete are ones it could itself have
 * produced, so a caller cannot smuggle in a path pointing at another tenant's
 * data or at an unrelated object.
 */
const TENANT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Filename charset is restricted to characters this module emits. Notably it
 * excludes `/`, `\`, `%`, and `.` (other than the single `.png` suffix), so
 * traversal and encoded traversal cannot survive validation even if the
 * segment-count check were somehow bypassed.
 */
const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*\.png$/

export type PathValidation =
  | { valid: true; tenantId: string; filename: string }
  | { valid: false; reason: string }

/**
 * Validate a staged gate-signature path against the canonical shape AND against
 * the tenant that is allowed to act on it.
 *
 * PURE: no I/O, no database, no storage. It is exported so it can be unit
 * tested exhaustively without a Supabase client, and so both the upload path and
 * the cleanup path enforce the identical rule rather than two similar ones.
 *
 * Rejects, in order:
 *   - empty / non-string input
 *   - absolute paths and backslashes (Windows-style traversal)
 *   - literal `..` traversal
 *   - percent-encoded traversal (`%2e`, `%2f`, `%5c`, and any `%` at all)
 *   - wrong segment count / wrong root / wrong context segment
 *   - a tenant segment that is not a well-formed UUID
 *   - a tenant segment belonging to a DIFFERENT tenant (cross-tenant access)
 *   - a filename that is not a plain `.png`
 */
export function validateStagedSignaturePath(
  imagePath: unknown,
  expectedTenantId: string,
): PathValidation {
  if (typeof imagePath !== 'string' || !imagePath.trim()) {
    return { valid: false, reason: 'No staged signature path provided' }
  }
  if (typeof expectedTenantId !== 'string' || !TENANT_ID_RE.test(expectedTenantId)) {
    return { valid: false, reason: 'Malformed tenant id' }
  }

  const path = imagePath.trim()

  // Reject anything that is not a plain relative POSIX path. `%` is refused
  // outright rather than decoded: decoding then re-checking invites a
  // double-encoding bypass, and no legitimate path this module writes contains one.
  if (path.startsWith('/') || path.includes('\\') || path.includes('%')) {
    return { valid: false, reason: 'Staged path contains an illegal character sequence' }
  }
  if (path.includes('..')) {
    return { valid: false, reason: 'Staged path traversal is not permitted' }
  }

  const segments = path.split('/')
  if (segments.length !== 4) {
    return {
      valid: false,
      reason: 'Staged path must be signatures/<tenant-id>/gate_approval/<filename>.png',
    }
  }

  const [root, tenantSegment, context, filename] = segments

  if (root !== SIGNATURE_PATH_ROOT) {
    return { valid: false, reason: 'Staged path must be within the signatures namespace' }
  }
  if (!TENANT_ID_RE.test(tenantSegment)) {
    return { valid: false, reason: 'Staged path has a malformed tenant id' }
  }
  // Cross-tenant containment: a well-formed path for ANOTHER tenant is still a
  // refusal. This is the check that stops a caller deleting a foreign blob.
  if (tenantSegment.toLowerCase() !== expectedTenantId.toLowerCase()) {
    return { valid: false, reason: 'Staged path belongs to a different tenant' }
  }
  if (context !== GATE_SIGNATURE_CONTEXT) {
    return { valid: false, reason: 'Staged path must belong to the gate approval context' }
  }
  if (!FILENAME_RE.test(filename)) {
    return { valid: false, reason: 'Staged signature must be a .png file' }
  }

  return { valid: true, tenantId: tenantSegment, filename }
}

/** Build the canonical staged path. The only place this shape is constructed. */
export function buildStagedSignaturePath(tenantId: string, entityId: string, stamp: number): string {
  const safeEntity = String(entityId).replace(/[^A-Za-z0-9_-]/g, '')
  return `${SIGNATURE_PATH_ROOT}/${tenantId}/${GATE_SIGNATURE_CONTEXT}/${safeEntity}-${stamp}.png`
}

/** Upload a staged signature PNG. Callers never name the bucket themselves. */
export async function uploadSignatureObject(
  path: string,
  body: Buffer,
): Promise<{ error: string } | null> {
  const supabase = createAdminClient()
  const { error } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .upload(path, body, { contentType: 'image/png', upsert: false })
  return error ? { error: error.message } : null
}

/** Signed read URL for a signature object, from the same canonical bucket. */
export async function createSignatureSignedUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = createAdminClient()
  const { data } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .createSignedUrl(path, expiresInSeconds)
  return data?.signedUrl ?? ''
}

/**
 * Delete a staged gate-signature PNG whose decision FAILED to commit.
 *
 * Called ONLY by `decideApproval`, and only when the decision RPC returned an
 * error or threw. Never after a committed decision: a successful decision has a
 * `signatures` row referencing this blob, and the committed-reference check
 * below is the hard guard that enforces it even if a caller got that wrong.
 *
 * Every refusal returns `{ error }` rather than throwing, so the caller can
 * report it ALONGSIDE the original decision error instead of losing one of them.
 */
export async function deleteFailedStagedSignature(
  imagePath: string,
  tenantId: string,
): Promise<{ removed: true } | { error: string }> {
  const validation = validateStagedSignaturePath(imagePath, tenantId)
  if (!validation.valid) {
    return { error: validation.reason }
  }

  const supabase = createAdminClient()

  // COMMITTED-REFERENCE GUARD: if any signatures row references this path, the
  // decision DID commit and the blob is live legal evidence — never delete it.
  // A failed verification query is also a refusal (fail-closed): we must not
  // delete on an UNKNOWN reference state.
  const { count, error: lookupError } = await supabase
    .from('signatures')
    .select('id', { count: 'exact', head: true })
    .eq('signature_image_path', imagePath)

  if (lookupError) {
    return { error: `Could not verify staged signature before deletion: ${lookupError.message}` }
  }
  if ((count ?? 0) > 0) {
    return { error: 'Cannot delete a signature path with committed database references' }
  }

  const { error } = await supabase.storage.from(SIGNATURE_BUCKET).remove([imagePath])
  if (error) {
    return { error: `Storage deletion failed: ${error.message}` }
  }

  return { removed: true }
}
