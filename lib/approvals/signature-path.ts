/**
 * CANONICAL signature path rules — PURE, and deliberately free of `server-only`.
 *
 * The bucket name, the path shape and the validator live here, apart from
 * `signature-storage.ts`, for one reason: `signature-storage.ts` imports
 * `server-only`, which THROWS the moment it is loaded outside a React Server
 * Component. The fixture teardown runner is a plain Node script, so it could
 * not import the validator at all — and the obvious workaround (re-typing the
 * rule in the script) is precisely the duplicate-declaration mistake that let
 * the upload path and the cleanup path drift onto different buckets.
 *
 * Splitting the PURE rules out means the server module, the app and the CLI
 * runner all enforce ONE definition. `signature-storage.ts` re-exports
 * everything here, so existing imports keep working unchanged.
 *
 * There is no I/O in this file. That is what makes it importable everywhere and
 * exhaustively unit-testable without a Supabase client.
 */

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
 * Canonical path shape:
 *
 *     signatures/<tenant-id>/gate_approval/<filename>.png
 *
 * EXACTLY four segments. A stricter-than-necessary shape is deliberate: the
 * only paths this module will ever authorize for deletion are ones it could
 * itself have produced, so a caller cannot smuggle in a path pointing at
 * another tenant's data or at an unrelated object.
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
 * Validate a gate-signature path against the canonical shape AND against the
 * tenant that is allowed to act on it.
 *
 * PURE: no I/O, no database, no storage.
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
