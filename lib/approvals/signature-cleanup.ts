/**
 * Server-only module for secure staged-signature deletion.
 * NOT EXPORTED as a client-callable server action to prevent arbitrary path deletion.
 * All callers must run within the approval decision workflow and enforce path validation.
 */

import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'signatures'
const PATH_PREFIX = 'signatures/' // all gate signatures must start with this

/**
 * Delete a staged gate-signature PNG from storage, with strict path + commit validation.
 *
 * Enforces:
 *   1. Path begins with "signatures/" (bucket-scoped standard)
 *   2. Path belongs to a gate approval staging context (contains 'gate_approval')
 *   3. No committed signatures row in the DB references this path
 *
 * Called ONLY by `decideApproval` when the decision RPC errors/throws.
 * Never called after a successful, committed decision.
 */
export async function deleteFailedStagedSignature(
  imagePath: string,
  tenantId: string,
): Promise<{ removed: true } | { error: string }> {
  if (!imagePath?.trim()) {
    return { error: 'No staged signature path provided' }
  }

  // Enforce path prefix to prevent deletion outside the signatures namespace.
  if (!imagePath.startsWith(PATH_PREFIX)) {
    return { error: 'Staged path must be within signatures namespace' }
  }

  // Ensure path belongs to the gate-approval staging context (contains 'gate_approval').
  // Paths like "signatures/tenant-xxx/gate_approval/appr-yyy/sig.png" are valid staging paths.
  if (!imagePath.includes('gate_approval')) {
    return { error: 'Staged path must belong to gate approval context' }
  }

  const supabase = createAdminClient()

  // CRITICAL GUARD: No committed signatures row must reference this path.
  // A path with a committed row cannot be deleted (it's referenced by live data).
  const { count: existingCount } = await supabase
    .from('signatures')
    .select('id', { count: 'exact', head: true })
    .eq('signature_image_path', imagePath)

  if ((existingCount ?? 0) > 0) {
    return { error: 'Cannot delete a signature path with committed DB references' }
  }

  // Attempt deletion. Storage is not transactional, so the RPC may have rolled back
  // but the blob persists — we're cleaning it up now.
  const { error } = await supabase.storage.from(BUCKET).remove([imagePath])
  if (error) {
    return { error: `Storage deletion failed: ${error.message}` }
  }

  return { removed: true }
}
