import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The canonical gate-signature storage module.
 *
 * Two properties are proven here:
 *   1. `validateStagedSignaturePath` accepts EXACTLY the canonical shape
 *      `signatures/<tenant-id>/gate_approval/<filename>.png` and refuses every
 *      other input — cross-tenant, traversal, encoded traversal, malformed
 *      tenant ids, and non-PNG files.
 *   2. `deleteFailedStagedSignature` refuses to delete on an invalid path, on a
 *      committed DB reference, AND on a failed verification query (fail-closed
 *      on an UNKNOWN reference state, never "delete because we could not check").
 */

const state = vi.hoisted(() => ({
  count: 0 as number,
  lookupError: null as { message: string } | null,
  removed: [] as string[][],
  removedFrom: [] as string[],
  removeError: null as { message: string } | null,
  uploaded: [] as { bucket: string; path: string }[],
  signedFrom: [] as string[],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: async () => ({ count: state.count, error: state.lookupError }),
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          state.removed.push(paths)
          // Record WHICH bucket the delete was issued against. This is the
          // observation that makes the upload/cleanup drift test meaningful:
          // the original bug was a delete aimed at a bucket that does not exist.
          state.removedFrom.push(bucket)
          return { error: state.removeError }
        },
        upload: async (path: string) => {
          state.uploaded.push({ bucket, path })
          return { error: null }
        },
        createSignedUrl: async (path: string) => {
          state.signedFrom.push(bucket)
          return { data: { signedUrl: `https://signed/${path}` }, error: null }
        },
      }),
    },
  }),
}))

import {
  SIGNATURE_BUCKET,
  buildStagedSignaturePath,
  createSignatureSignedUrl,
  deleteFailedStagedSignature,
  uploadSignatureObject,
  validateStagedSignaturePath,
} from '@/lib/approvals/signature-storage'

const TENANT = '00000000-0000-0000-0000-000000000001'
const OTHER_TENANT = '11111111-1111-1111-1111-111111111111'
const VALID = `signatures/${TENANT}/gate_approval/appr-1-1700000000000.png`

beforeEach(() => {
  state.count = 0
  state.lookupError = null
  state.removed.length = 0
  state.removedFrom.length = 0
  state.removeError = null
  state.uploaded.length = 0
  state.signedFrom.length = 0
})

describe('canonical bucket', () => {
  it('uses the existing documents bucket for signature blobs', () => {
    // A dedicated "signatures" bucket is NOT provisioned; naming one made
    // cleanup silently unable to delete what upload had written.
    expect(SIGNATURE_BUCKET).toBe('documents')
  })

  it('uploads and signs from that same single bucket', async () => {
    await uploadSignatureObject(VALID, Buffer.from('x'))
    await createSignatureSignedUrl(VALID)
    expect(state.uploaded[0].bucket).toBe(SIGNATURE_BUCKET)
    expect(state.signedFrom[0]).toBe(SIGNATURE_BUCKET)
  })

  /**
   * DRIFT TEST (the regression that started all of this).
   *
   * The uploader wrote to 'documents' while cleanup deleted from 'signatures',
   * a bucket this project never provisioned — so every cleanup was a silent
   * no-op and every failed decision orphaned its blob. Asserting the constant
   * alone would NOT have caught that: both sides have to be OBSERVED at runtime
   * issuing their call against the same bucket.
   */
  it('cleanup deletes from the EXACT bucket the uploader wrote to', async () => {
    await uploadSignatureObject(VALID, Buffer.from('x'))
    await deleteFailedStagedSignature(VALID, TENANT)

    expect(state.uploaded).toHaveLength(1)
    expect(state.removedFrom).toHaveLength(1)
    // Non-vacuous: both calls happened, and they addressed one identical bucket.
    expect(state.removedFrom[0]).toBe(state.uploaded[0].bucket)
    expect(state.removedFrom[0]).toBe('documents')
  })

  it('cleanup never addresses a "signatures" bucket', async () => {
    await deleteFailedStagedSignature(VALID, TENANT)
    // The bucket that does not exist must never be named again.
    expect(state.removedFrom).not.toContain('signatures')
  })
})

describe('buildStagedSignaturePath', () => {
  it('produces a path its own validator accepts', () => {
    const path = buildStagedSignaturePath(TENANT, 'appr-1', 1700000000000)
    expect(validateStagedSignaturePath(path, TENANT)).toMatchObject({ valid: true })
  })

  it('strips path separators out of a hostile entity id', () => {
    const path = buildStagedSignaturePath(TENANT, '../../etc/passwd', 1)
    expect(path.split('/')).toHaveLength(4)
    expect(validateStagedSignaturePath(path, TENANT)).toMatchObject({ valid: true })
  })
})

describe('validateStagedSignaturePath — accepts only the canonical shape', () => {
  it('accepts signatures/<tenant-id>/gate_approval/<filename>.png', () => {
    const res = validateStagedSignaturePath(VALID, TENANT)
    expect(res.valid).toBe(true)
    if (res.valid) expect(res.tenantId).toBe(TENANT)
  })

  it('is case-insensitive on the tenant uuid', () => {
    const upper = `signatures/${TENANT.toUpperCase()}/gate_approval/a.png`
    expect(validateStagedSignaturePath(upper, TENANT).valid).toBe(true)
  })
})

describe('validateStagedSignaturePath — rejections', () => {
  const reject = (path: unknown, tenant = TENANT) => {
    const res = validateStagedSignaturePath(path, tenant)
    expect(res.valid).toBe(false)
    return res
  }

  it('rejects empty and non-string input', () => {
    reject('')
    reject('   ')
    reject(null)
    reject(undefined)
    reject(42)
  })

  it('rejects a CROSS-TENANT path even when perfectly well formed', () => {
    const res = reject(`signatures/${OTHER_TENANT}/gate_approval/a.png`)
    if (!res.valid) expect(res.reason).toMatch(/different tenant/i)
  })

  it('rejects literal traversal', () => {
    reject(`signatures/${TENANT}/gate_approval/../../../secret.png`)
    reject(`signatures/${TENANT}/../${OTHER_TENANT}/gate_approval/a.png`)
    reject('../signatures/x/gate_approval/a.png')
  })

  it('rejects ENCODED traversal rather than decoding it', () => {
    reject(`signatures/${TENANT}/gate_approval/%2e%2e%2fsecret.png`)
    reject(`signatures/${TENANT}/gate_approval/%2E%2E/secret.png`)
    reject(`signatures%2f${TENANT}%2fgate_approval%2fa.png`)
    // Double encoding must not survive either.
    reject(`signatures/${TENANT}/gate_approval/%252e%252e.png`)
  })

  it('rejects backslash and absolute paths', () => {
    reject(`signatures\\${TENANT}\\gate_approval\\a.png`)
    reject(`/signatures/${TENANT}/gate_approval/a.png`)
  })

  it('rejects malformed tenant ids in the path', () => {
    reject('signatures/not-a-uuid/gate_approval/a.png')
    reject('signatures//gate_approval/a.png')
    reject(`signatures/${TENANT}x/gate_approval/a.png`)
  })

  it('rejects a malformed EXPECTED tenant id', () => {
    const res = validateStagedSignaturePath(VALID, 'not-a-uuid')
    expect(res.valid).toBe(false)
  })

  it('rejects the wrong root or wrong context segment', () => {
    reject(`documents/${TENANT}/gate_approval/a.png`)
    reject(`signatures/${TENANT}/vo_approval/a.png`)
    reject(`signatures/${TENANT}/gate_approval/nested/a.png`)
    reject(`signatures/${TENANT}/gate_approval`)
  })

  it('rejects non-PNG files', () => {
    reject(`signatures/${TENANT}/gate_approval/a.pdf`)
    reject(`signatures/${TENANT}/gate_approval/a.png.exe`)
    reject(`signatures/${TENANT}/gate_approval/a.PNG.svg`)
    reject(`signatures/${TENANT}/gate_approval/noextension`)
  })
})

describe('deleteFailedStagedSignature', () => {
  it('deletes a valid, uncommitted staged blob', async () => {
    const res = await deleteFailedStagedSignature(VALID, TENANT)
    expect(res).toEqual({ removed: true })
    expect(state.removed).toEqual([[VALID]])
  })

  it('does NOT touch storage when the path is invalid', async () => {
    const res = await deleteFailedStagedSignature(
      `signatures/${OTHER_TENANT}/gate_approval/a.png`,
      TENANT,
    )
    expect('error' in res).toBe(true)
    expect(state.removed).toHaveLength(0)
  })

  it('refuses a path a COMMITTED signature row references', async () => {
    state.count = 1
    const res = await deleteFailedStagedSignature(VALID, TENANT)
    expect(res).toMatchObject({ error: expect.stringMatching(/committed database references/i) })
    expect(state.removed).toHaveLength(0)
  })

  it('FAILS CLOSED when the verification query itself errors', async () => {
    // An unknown reference state must never be treated as "no reference".
    state.lookupError = { message: 'connection reset' }
    const res = await deleteFailedStagedSignature(VALID, TENANT)
    expect(res).toMatchObject({ error: expect.stringMatching(/could not verify/i) })
    expect(state.removed).toHaveLength(0)
  })

  it('surfaces a storage deletion failure as an error, never as success', async () => {
    state.removeError = { message: 'object missing' }
    const res = await deleteFailedStagedSignature(VALID, TENANT)
    expect(res).toMatchObject({ error: expect.stringMatching(/storage deletion failed/i) })
  })
})
