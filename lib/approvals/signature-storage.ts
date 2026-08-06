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

// Local bindings for this module's own use. `export ... from` below re-exports
// the same symbols for callers but does NOT bring them into local scope.
import { SIGNATURE_BUCKET, validateStagedSignaturePath } from './signature-path'

/**
 * The bucket name, the path shape and the validator are defined ONCE in
 * `./signature-path`, which is free of `server-only` so the fixture teardown
 * CLI can enforce the identical rule. They are re-exported here so every
 * existing import of this module keeps working, and so there is still exactly
 * one definition rather than a server copy and a script copy.
 */
export {
  SIGNATURE_BUCKET,
  SIGNATURE_PATH_ROOT,
  GATE_SIGNATURE_CONTEXT,
  validateStagedSignaturePath,
  buildStagedSignaturePath,
  type PathValidation,
} from './signature-path'

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
