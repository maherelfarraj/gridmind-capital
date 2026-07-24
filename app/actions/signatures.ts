'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const BUCKET = 'documents'
import { DEMO_TENANT_FALLBACK } from '@/lib/tenant'

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

interface Actor {
  userId: string | null
  tenantId: string
  role: string | null
  fullName: string | null
}

async function getActor(): Promise<Actor> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: DEMO_TENANT_FALLBACK, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      tenantId: profile?.tenant_id ?? DEMO_TENANT_FALLBACK,
      role: profile?.role ?? null,
      fullName: profile?.full_name ?? null,
    }
  } catch {
    return { userId: null, tenantId: DEMO_TENANT_FALLBACK, role: null, fullName: null }
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
 * Resolve a valid profiles.id to satisfy the signer_id FK.
 * In production the caller is authenticated; this only falls back
 * for local/dev sessions without an auth cookie.
 */
async function resolveSignerId(
  supabase: ReturnType<typeof createAdminClient>,
  actor: Actor,
): Promise<{ id: string; name: string; role: string | null } | null> {
  if (actor.userId) {
    return { id: actor.userId, name: actor.fullName ?? 'Authorized Signer', role: actor.role }
  }
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('tenant_id', actor.tenantId)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, name: data.full_name ?? 'Authorized Signer', role: data.role }
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
}): Promise<{ signature: SignatureRecord } | { error: string }> {
  if (!opts.dataUrl?.startsWith('data:image/')) return { error: 'A signature is required' }
  if (!opts.statement?.trim()) return { error: 'Consent statement missing' }

  const supabase = createAdminClient()
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
