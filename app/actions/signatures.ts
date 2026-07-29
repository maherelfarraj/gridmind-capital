'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const BUCKET = 'documents'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/guards'

export type SignatureEntityType = 'gate_approval' | 'vo_approval' | 'client_report' | 'certificate'

export interface SignatureRecord {
  id: string
  entityType: SignatureEntityType
  entityId: string
  projectId: string | null
  signerId: string
  signerName: string
  signerRole: string | null
  signatureImageUrl: string
  signatureImagePath: string
  signedAt: string
  ipAddress: string | null
  statement: string
}

/**
 * An UNPERSISTED signature, held in client state until the action it authorizes
 * is actually submitted.
 *
 * `signatures` is append-only by design, so a signature must never be written
 * before the thing it signs. Persisting at sign time let a user sign, abandon the
 * form, and leave a permanent signature row on an approval that was never
 * decided — which then blocks any safe status reconciliation, because an existing
 * signature is (correctly) treated as "a human put pen to paper here".
 */
export interface SignatureDraft {
  /** base64 PNG data URL rendered from the pad. Never leaves the client until submit. */
  dataUrl: string
  statement: string
  signerName?: string
  signerRole?: string | null
}

interface Actor {
  userId: string | null
  tenantId: string
  role: string | null
  fullName: string | null
}

async function getActor(): Promise<Actor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: tenantId, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      tenantId: profile?.tenant_id ?? tenantId,
      role: profile?.role ?? null,
      fullName: profile?.full_name ?? null,
    }
  } catch {
    return { userId: null, tenantId: tenantId, role: null, fullName: null }
  }
}

/** Best-effort client IP from proxy headers. */
async function resolveIp(): Promise<string | null> {
  try {
    const h = await headers()
    const fwd = h.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0].trim()
    return h.get('x-real-ip')
  } catch {
    return null
  }
}

/**
 * Resolve the authenticated user's signer profile.
 * Requires userId from the session (no fallback for unauthenticated).
 */
async function resolveSignerId(
  _supabase: ReturnType<typeof createAdminClient>,
  actor: Actor,
): Promise<{ id: string; name: string; role: string | null } | null> {
  if (!actor.userId) {
    return null // Requires authentication (enforced by requireUser guard)
  }
  return { id: actor.userId, name: actor.fullName ?? 'Authorized Signer', role: actor.role }
}

export interface OrphanedSignature {
  signatureId: string
  approvalId: string
  approvalTitle: string | null
  signerName: string
  signedAt: string
  ageDays: number
}

/**
 * REPORT (never delete) `gate_approval` signatures whose parent approval is still
 * undecided after `olderThanDays`.
 *
 * Deliberately read-only. `signatures` is an append-only legal record: a row means
 * a real person put pen to paper, and we cannot distinguish "abandoned draft" from
 * "signed, decision still pending" with certainty. Deleting would also destroy the
 * only evidence that the signing happened at all.
 *
 * Orphans are now PREVENTED at the source (SignaturePad defers, and createSignature
 * refuses gate_approval writes outside a decision), so this should return an empty
 * list going forward. It exists to surface the historical rows and to detect any
 * regression that starts producing new ones.
 */
export async function findOrphanedGateSignatures(
  // Default 0 = report EVERY undecided-parent signature regardless of age.
  // A 7-day default reported zero while 4 real orphans existed (all ~8h old) —
  // an age window silently hides exactly the rows this is meant to surface.
  // Pass a positive value only to ask "which are older than N days?".
  olderThanDays = 0,
): Promise<{ orphans: OrphanedSignature[] } | { error: string }> {
  const supabase = createAdminClient()

  let sigQuery = supabase
    .from('signatures')
    .select('id, entity_id, signer_name, signed_at')
    .eq('entity_type', 'gate_approval')
  // Only apply an age window when one was explicitly requested.
  if (olderThanDays > 0) {
    sigQuery = sigQuery.lt('signed_at', new Date(Date.now() - olderThanDays * 86400000).toISOString())
  }

  const { data: sigs, error } = await sigQuery
  if (error) return { error: error.message }
  if (!sigs?.length) return { orphans: [] }

  // `signatures.entity_id` is POLYMORPHIC (no FK), so resolve parents explicitly.
  const { data: approvals, error: apprErr } = await supabase
    .from('approvals')
    .select('id, title, decided_at')
    .in('id', Array.from(new Set(sigs.map((s) => s.entity_id))))
  if (apprErr) return { error: apprErr.message }

  // decided_at IS NULL is the reliable test for "no decision was ever recorded".
  // `status` cannot be used: 'pending' is also the resting state of a live approval.
  const undecided = new Map(
    (approvals ?? []).filter((a) => a.decided_at === null).map((a) => [a.id, a]),
  )

  return {
    orphans: sigs
      .filter((s) => undecided.has(s.entity_id))
      .map((s) => ({
        signatureId:   s.id,
        approvalId:    s.entity_id,
        approvalTitle: undecided.get(s.entity_id)?.title ?? null,
        signerName:    s.signer_name,
        signedAt:      s.signed_at,
        ageDays:       Math.floor((Date.now() - new Date(s.signed_at).getTime()) / 86400000),
      })),
  }
}

/**
 * Persist an electronic signature.
 * @param dataUrl base64 PNG data URL of the rendered signature
 */
export async function createSignature(opts: {
  dataUrl: string
  entityType: SignatureEntityType
  entityId: string
  projectId?: string | null
  statement: string
  signerName?: string
  signerRole?: string | null
  /**
   * Set ONLY by `decideApproval`, which writes the signature inside the same call
   * that records the decision. Any other caller writing a `gate_approval`
   * signature would be creating an orphan on an undecided approval — see the
   * guard below.
   */
  allowUndecided?: boolean
}): Promise<{ signature: SignatureRecord } | { error: string }> {
  const session = await requireUser()
  
  if (!opts.dataUrl?.startsWith('data:image/')) return { error: 'A signature is required' }
  if (!opts.statement?.trim()) return { error: 'Consent statement missing' }

  const supabase = createAdminClient()

  // ── Orphan prevention (preferred over cleanup) ──────────────────────────────
  // `signatures` is append-only by design, so the only safe fix for orphaned rows
  // is to never create them. A `gate_approval` signature is only legitimate as
  // part of recording a decision, so refuse to write one unless the caller is
  // actually deciding now (`allowUndecided`, set by decideApproval).
  //
  // This is a backstop for the real fix — SignaturePad no longer persists at sign
  // time — and it catches any FUTURE call site that forgets to defer.
  if (opts.entityType === 'gate_approval' && !opts.allowUndecided) {
    console.error(
      '[v0] createSignature: refused a gate_approval signature written outside a decision.',
      'Pass the signature as a SignatureDraft to decideApproval instead.',
    )
    return {
      error:
        'A gate approval signature can only be saved together with its decision. ' +
        'Submit your decision to record the signature.',
    }
  }

  const actor = await getActor()
  const signer = await resolveSignerId(supabase, actor)
  if (!signer) return { error: 'Could not resolve signer identity' }

  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(opts.dataUrl)
  if (!match) return { error: 'Invalid signature image' }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 2 * 1024 * 1024) return { error: 'Signature image too large' }

  const stamp = Date.now()
  const storagePath = `signatures/${actor.tenantId}/${opts.entityType}/${opts.entityId}-${stamp}.png`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: false })
  if (upErr) return { error: upErr.message }

  const ip = await resolveIp()
  const signerName = opts.signerName?.trim() || signer.name
  const signerRole = opts.signerRole ?? signer.role

  const { data, error } = await supabase
    .from('signatures')
    .insert({
      tenant_id: actor.tenantId,
      project_id: opts.projectId ?? null,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      signer_id: signer.id,
      signer_name: signerName,
      signer_role: signerRole,
      signature_image_path: storagePath,
      ip_address: ip,
      statement: opts.statement,
    })
    .select('id, entity_type, entity_id, project_id, signer_id, signer_name, signer_role, signature_image_path, signed_at, ip_address, statement')
    .single()
  if (error) return { error: error.message }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)

  return {
    signature: {
      id: data.id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      projectId: data.project_id,
      signerId: data.signer_id,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      signatureImageUrl: signed?.signedUrl ?? '',
      signatureImagePath: data.signature_image_path,
      signedAt: data.signed_at,
      ipAddress: data.ip_address,
      statement: data.statement,
    },
  }
}

async function toRecords(
  supabase: ReturnType<typeof createAdminClient>,
  rows: Array<Record<string, unknown>>,
): Promise<SignatureRecord[]> {
  return Promise.all(
    rows.map(async (r) => {
      const path = r.signature_image_path as string
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
      return {
        id: r.id as string,
        entityType: r.entity_type as SignatureEntityType,
        entityId: r.entity_id as string,
        projectId: (r.project_id as string) ?? null,
        signerId: r.signer_id as string,
        signerName: r.signer_name as string,
        signerRole: (r.signer_role as string) ?? null,
        signatureImageUrl: signed?.signedUrl ?? '',
        signatureImagePath: path,
        signedAt: r.signed_at as string,
        ipAddress: (r.ip_address as string) ?? null,
        statement: r.statement as string,
      }
    }),
  )
}

/** All signatures attached to a specific entity (e.g. a gate approval). */
export async function getSignaturesForEntity(
  entityType: SignatureEntityType,
  entityId: string,
): Promise<SignatureRecord[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('signatures')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('signed_at', { ascending: true })
  if (!data) return []
  return toRecords(supabase, data)
}

/** Full signature audit trail for a project (admin view). */
export async function getProjectSignatureAudit(projectId: string): Promise<SignatureRecord[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('signatures')
    .select('*')
    .eq('project_id', projectId)
    .order('signed_at', { ascending: false })
  if (!data) return []
  return toRecords(supabase, data)
}

export interface SignatureAuditRow extends SignatureRecord {
  projectName: string
  projectCode: string
  entityLabel: string
}

const ENTITY_LABEL: Record<string, string> = {
  gate_approval: 'Gate Approval',
  vo_approval: 'Variation Order',
  client_report: 'Client Report',
  certificate: 'Gate Certificate',
}

/**
 * Tenant-wide signature audit trail for the admin console: who signed what,
 * when, and from which IP — enriched with project name/code and entity label.
 */
export async function getSignatureAudit(): Promise<SignatureAuditRow[]> {
  const actor = await getActor()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('signatures')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .order('signed_at', { ascending: false })
    .limit(500)
  if (!data) return []

  // Resolve project name/code in one round-trip.
  const projectIds = Array.from(new Set(data.map((d) => d.project_id).filter(Boolean)))
  const { data: projects } = projectIds.length
    ? await supabase.from('projects').select('id, name, code').in('id', projectIds)
    : { data: [] as { id: string; name: string; code: string }[] }
  const projMap = new Map((projects ?? []).map((p) => [p.id, p]))

  const records = await toRecords(supabase, data)
  return records.map((rec, i) => {
    const proj = projMap.get(data[i].project_id as string)
    return {
      ...rec,
      projectName: proj?.name ?? '—',
      projectCode: proj?.code ?? '—',
      entityLabel: ENTITY_LABEL[rec.entityType] ?? rec.entityType,
    }
  })
}
