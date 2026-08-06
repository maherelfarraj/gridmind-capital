'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser, getAuthActor } from '@/lib/auth/guard'
import { isPlatformAdminRole } from '@/lib/auth/roles'
/**
 * Signature blobs are owned by ONE module. This file no longer declares a bucket
 * name of its own — a second declaration is how the upload path and the cleanup
 * path silently drifted onto different buckets.
 */
import {
  buildStagedSignaturePath,
  createSignatureSignedUrl,
  uploadSignatureObject,
} from '@/lib/approvals/signature-storage'

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
  /**
   * How the signature's parent approval was resolved:
   *   - `phase_gate` — the CANONICAL v4 identity (entity_id = phase_gates.id)
   *   - `legacy_approval` — a pre-v4 row keyed directly to approvals.id
   * Surfaced so an operator can tell a genuine regression from a historical row.
   */
  resolvedVia: 'phase_gate' | 'legacy_approval'
}

/**
 * REPORT (never delete) `gate_approval` signatures whose parent approval is
 * still undecided.
 *
 * SECURITY: this runs on the RLS-BYPASSING admin client, so it MUST authorize
 * and tenant-scope itself — RLS will not do it. Previously this function did
 * NEITHER: it was an exported server action that any caller could invoke to
 * enumerate every tenant's signer names and signing times. It now requires an
 * authenticated `system_admin` or `tenant_admin`, and every query below is
 * filtered to that caller's tenant. Unauthorized callers get an empty list
 * (silent deny) rather than a message confirming rows exist.
 *
 * IDENTITY: `decide_gate_approval` v4 writes gate signatures with
 * `entity_id = phase_gates.id`, NOT `approvals.id`. Resolving straight to
 * `approvals.id` — as this function used to — therefore matches NOTHING for
 * canonically-written rows, so it would have reported a clean system while real
 * orphans existed. The canonical path is now:
 *
 *     signatures.entity_id -> phase_gates.id -> project_id + phase_number
 *                          -> matching gate approval
 *
 * A separate, explicitly-flagged compatibility path still resolves pre-v4 rows
 * that were keyed directly to an approval id.
 *
 * Deliberately read-only. `signatures` is an append-only legal record: a row
 * means a real person put pen to paper, and we cannot distinguish "abandoned
 * draft" from "signed, decision still pending" with certainty.
 */
export async function findOrphanedGateSignatures(
  // Default 0 = report EVERY undecided-parent signature regardless of age.
  // A 7-day default reported zero while 4 real orphans existed (all ~8h old) —
  // an age window silently hides exactly the rows this is meant to surface.
  // Pass a positive value only to ask "which are older than N days?".
  olderThanDays = 0,
  opts: { includeLegacyApprovalKeyed?: boolean } = {},
): Promise<{ orphans: OrphanedSignature[] } | { error: string }> {
  // (1) Authenticate. An unauthenticated caller learns nothing.
  const res = await getAuthActor()
  if ('error' in res) return { orphans: [] }
  const { actor } = res

  // (2) Authorize. This is an operational diagnostic over signer identities;
  //     only platform/tenant administrators may run it.
  if (!isPlatformAdminRole(actor.role)) return { orphans: [] }

  const supabase = createAdminClient()

  // (3) Signatures, ALWAYS tenant-scoped.
  let sigQuery = supabase
    .from('signatures')
    .select('id, entity_id, signer_name, signed_at')
    .eq('tenant_id', actor.tenantId)
    .eq('entity_type', 'gate_approval')
  // Only apply an age window when one was explicitly requested.
  if (olderThanDays > 0) {
    sigQuery = sigQuery.lt('signed_at', new Date(Date.now() - olderThanDays * 86400000).toISOString())
  }

  const { data: sigs, error } = await sigQuery
  if (error) return { error: error.message }
  if (!sigs?.length) return { orphans: [] }

  const entityIds = Array.from(new Set(sigs.map((s) => s.entity_id)))

  // (4) CANONICAL: entity_id -> phase_gates (tenant-verified via the project).
  //     `phase_gates` has NO tenant_id column, so it is scoped through its
  //     tenant-owned project — never by a direct tenant filter.
  const { data: gates, error: gateErr } = await supabase
    .from('phase_gates')
    .select('id, project_id, phase_number')
    .in('id', entityIds)
  if (gateErr) return { error: gateErr.message }

  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('tenant_id', actor.tenantId)
    .in('id', Array.from(new Set((gates ?? []).map((g) => g.project_id))))
  if (projErr) return { error: projErr.message }

  // A gate whose project belongs to ANOTHER tenant is dropped outright. It is
  // not "an orphan we cannot resolve" — it is simply not this caller's row, and
  // surfacing it would leak cross-tenant existence.
  const ownedProjects = new Set((projects ?? []).map((p) => p.id))
  const ownedGates = (gates ?? []).filter((g) => ownedProjects.has(g.project_id))

  // (5) Parent approvals, tenant-scoped. Gate approvals key on
  //     object_id = project id + gate_number = phase_number.
  const { data: approvals, error: apprErr } = await supabase
    .from('approvals')
    .select('id, title, decided_at, object_id, gate_number')
    .eq('tenant_id', actor.tenantId)
    .eq('object_type', 'gate')
  if (apprErr) return { error: apprErr.message }

  // decided_at IS NULL is the reliable test for "no decision was ever recorded".
  // `status` cannot be used: 'pending' is also the resting state of a live approval.
  const undecidedByGateKey = new Map<string, { id: string; title: string | null }>()
  const undecidedById = new Map<string, { id: string; title: string | null }>()
  for (const a of approvals ?? []) {
    if (a.decided_at !== null) continue
    undecidedById.set(a.id, { id: a.id, title: a.title ?? null })
    if (a.object_id && a.gate_number !== null && a.gate_number !== undefined) {
      undecidedByGateKey.set(`${a.object_id}:${a.gate_number}`, { id: a.id, title: a.title ?? null })
    }
  }

  const gateById = new Map(ownedGates.map((g) => [g.id, g]))
  const orphans: OrphanedSignature[] = []

  for (const s of sigs) {
    const gate = gateById.get(s.entity_id)
    let parent: { id: string; title: string | null } | undefined
    let resolvedVia: 'phase_gate' | 'legacy_approval'

    if (gate) {
      parent = undecidedByGateKey.get(`${gate.project_id}:${gate.phase_number}`)
      resolvedVia = 'phase_gate'
    } else if (opts.includeLegacyApprovalKeyed) {
      // COMPATIBILITY PATH (opt-in): pre-v4 rows keyed straight to approvals.id.
      // Off by default so canonical results are never silently mixed with
      // legacy ones. `undecidedById` is already tenant-scoped.
      parent = undecidedById.get(s.entity_id)
      resolvedVia = 'legacy_approval'
    } else {
      continue
    }

    if (!parent) continue
    orphans.push({
      signatureId:   s.id,
      approvalId:    parent.id,
      approvalTitle: parent.title,
      signerName:    s.signer_name,
      signedAt:      s.signed_at,
      ageDays:       Math.floor((Date.now() - new Date(s.signed_at).getTime()) / 86400000),
      resolvedVia,
    })
  }

  return { orphans }
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

  const upErr = await uploadSignatureObject(storagePath, buffer)
  if (upErr) return { error: upErr.error }

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

  const signedUrl = await createSignatureSignedUrl(storagePath)

  return {
    signature: {
      id: data.id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      projectId: data.project_id,
      signerId: data.signer_id,
      signerName: data.signer_name,
      signerRole: data.signer_role,
      signatureImageUrl: signedUrl,
      signatureImagePath: data.signature_image_path,
      signedAt: data.signed_at,
      ipAddress: data.ip_address,
      statement: data.statement,
    },
  }
}

export interface StagedGateSignature {
  imagePath: string
  signerName: string
  signerRole: string | null
  ipAddress: string | null
}

/**
 * Upload a gate-approval signature PNG to storage WITHOUT inserting the
 * `signatures` DB row. The row is inserted inside `decide_gate_approval` so the
 * signature and the endorsement commit atomically.
 *
 * Storage is not transactional with Postgres, so the blob is staged first and
 * the RPC writes only the DB row keyed to the returned `imagePath`.
 *
 * A staged blob left behind by a FAILED decision is NOT an acceptable orphan:
 * `decideApproval` deletes it (via the server-only
 * `deleteFailedStagedSignature` in `lib/approvals/signature-storage.ts`)
 * whenever the RPC returns an error or throws before it can commit. Only a
 * successful, committed decision keeps the blob (its `signatures` row now
 * references it). The earlier "harmless orphan" framing is retired.
 */
export async function stageGateSignatureImage(opts: {
  dataUrl: string
  entityId: string
  signerName?: string
  signerRole?: string | null
}): Promise<{ staged: StagedGateSignature } | { error: string }> {
  await requireUser()
  if (!opts.dataUrl?.startsWith('data:image/')) return { error: 'A signature is required' }

  const supabase = createAdminClient()
  const actor = await getActor()
  const signer = await resolveSignerId(supabase, actor)
  if (!signer) return { error: 'Could not resolve signer identity' }

  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(opts.dataUrl)
  if (!match) return { error: 'Invalid signature image' }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 2 * 1024 * 1024) return { error: 'Signature image too large' }

  // Built by the canonical module so the staged path is EXACTLY the shape
  // `deleteFailedStagedSignature` will accept — the writer and the cleaner share
  // one definition of the path instead of two similar string templates.
  const storagePath = buildStagedSignaturePath(actor.tenantId, opts.entityId, Date.now())
  const upErr = await uploadSignatureObject(storagePath, buffer)
  if (upErr) return { error: upErr.error }

  return {
    staged: {
      imagePath: storagePath,
      signerName: opts.signerName?.trim() || signer.name,
      signerRole: opts.signerRole ?? signer.role,
      ipAddress: await resolveIp(),
    },
  }
}

/**
 * NOTE: there is deliberately NO exported staged-signature delete action here.
 *
 * The removed action took a raw storage path and deleted it — an arbitrary-path
 * deletion primitive reachable from any client. It authenticated the caller but
 * never validated the path shape, never bound the path to the caller's tenant,
 * and never checked for a committed `signatures` row, so it could be used to
 * destroy another tenant's signature evidence.
 *
 * Deletion now lives ONLY in the server-only canonical module
 * (`lib/approvals/signature-storage.ts#deleteFailedStagedSignature`), which
 * validates the exact path shape, enforces tenant ownership, and refuses any
 * path a committed signature row references. `decideApproval` is its only caller.
 */

async function toRecords(
  supabase: ReturnType<typeof createAdminClient>,
  rows: Array<Record<string, unknown>>,
): Promise<SignatureRecord[]> {
  return Promise.all(
    rows.map(async (r) => {
      const path = r.signature_image_path as string
      const signedUrl = await createSignatureSignedUrl(path)
      return {
        id: r.id as string,
        entityType: r.entity_type as SignatureEntityType,
        entityId: r.entity_id as string,
        projectId: (r.project_id as string) ?? null,
        signerId: r.signer_id as string,
        signerName: r.signer_name as string,
        signerRole: (r.signer_role as string) ?? null,
        signatureImageUrl: signedUrl,
        signatureImagePath: path,
        signedAt: r.signed_at as string,
        ipAddress: (r.ip_address as string) ?? null,
        statement: r.statement as string,
      }
    }),
  )
}

/**
 * All signatures attached to a specific entity (e.g. a client report), scoped to
 * the authenticated caller's tenant.
 *
 * SECURITY: this runs on the RLS-bypassing admin client, so it MUST authenticate
 * and tenant-scope itself. An unauthenticated caller gets nothing, and the query
 * ALWAYS filters `tenant_id` so signatures and their storage URLs can never be
 * read across tenants. For gate approvals prefer `getGateApprovalSignatures`,
 * which additionally resolves the canonical phase-gate identity.
 */
export async function getSignaturesForEntity(
  entityType: SignatureEntityType,
  entityId: string,
): Promise<SignatureRecord[]> {
  const res = await getAuthActor()
  if ('error' in res) return []
  const { actor } = res

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('signatures')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('signed_at', { ascending: true })
  if (!data) return []
  return toRecords(supabase, data)
}

/**
 * Tenant-scoped signatures for a GATE approval, keyed to the CANONICAL
 * phase-gate identity (not the approval id).
 *
 * The gate-decision RPC (decide_gate_approval v4) writes each endorsement
 * signature with `entity_id = phase_gates.id`, so the read path must resolve
 * that same identity. Guarantees, in order:
 *   1. authenticate the viewer;
 *   2. verify the approval belongs to the viewer's tenant and is a gate;
 *   3. resolve the canonical `phase_gates.id` (via the tenant-owned project);
 *   4. query signatures by tenant_id + entity_type='gate_approval' + that id.
 * Only after all checks pass are signed URLs generated and returned.
 */
export async function getGateApprovalSignatures(approvalId: string): Promise<SignatureRecord[]> {
  const res = await getAuthActor()
  if ('error' in res) return []
  const { actor } = res

  const supabase = createAdminClient()

  // (2) The approval must be visible to this tenant and be a gate workflow.
  const { data: approval } = await supabase
    .from('approvals')
    .select('id, tenant_id, object_type, object_id, gate_number')
    .eq('id', approvalId)
    .eq('tenant_id', actor.tenantId)
    .single()
  if (!approval || approval.object_type !== 'gate') return []
  if (approval.object_id === null || approval.gate_number === null || approval.gate_number === undefined) {
    return []
  }

  // (3) Resolve the canonical phase-gate identity, tenant-verified via project.
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', approval.object_id)
    .eq('tenant_id', actor.tenantId)
    .maybeSingle()
  if (!project) return []

  const { data: gate } = await supabase
    .from('phase_gates')
    .select('id')
    .eq('project_id', project.id)
    .eq('phase_number', approval.gate_number)
    .maybeSingle()
  if (!gate) return []

  // (4) Signatures for THIS gate identity, tenant-scoped.
  const { data } = await supabase
    .from('signatures')
    .select('*')
    .eq('tenant_id', actor.tenantId)
    .eq('entity_type', 'gate_approval')
    .eq('entity_id', gate.id)
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
