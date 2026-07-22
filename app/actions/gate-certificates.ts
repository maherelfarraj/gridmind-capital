'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BUCKET = 'documents'
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface CertificateDeliverable {
  label: string
  status: string
}

export interface GateCertificate {
  id: string
  projectId: string
  gateCode: string
  gateName: string | null
  verificationId: string
  deliverables: CertificateDeliverable[]
  storagePath: string | null
  pdfUrl: string | null
  issuedById: string | null
  issuedByName: string | null
  issuedAt: string
}

async function getActor() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null as string | null, tenantId: DEMO_TENANT, fullName: null as string | null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      tenantId: profile?.tenant_id ?? DEMO_TENANT,
      fullName: profile?.full_name ?? null,
    }
  } catch {
    return { userId: null as string | null, tenantId: DEMO_TENANT, fullName: null as string | null }
  }
}

/** Human-readable, collision-resistant verification id, e.g. GC-G5-LZ4F9K2. */
function makeVerificationId(gateCode: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  const stamp = Date.now().toString(36).toUpperCase().slice(-4)
  return `GC-${gateCode.toUpperCase()}-${stamp}${rand}`
}

function mapRow(row: Record<string, unknown>, pdfUrl: string | null): GateCertificate {
  return {
    id:            row.id as string,
    projectId:     row.project_id as string,
    gateCode:      row.gate_code as string,
    gateName:      (row.gate_name as string) ?? null,
    verificationId:row.verification_id as string,
    deliverables:  (row.deliverables as CertificateDeliverable[]) ?? [],
    storagePath:   (row.storage_path as string) ?? null,
    pdfUrl,
    issuedById:    (row.issued_by as string) ?? null,
    issuedByName:  (row.issued_by_name as string) ?? null,
    issuedAt:      row.issued_at as string,
  }
}

/**
 * Issue a gate completion certificate. Creates the immutable register row
 * with a unique verification id and a snapshot of the deliverables. The PDF
 * is uploaded separately from the client via `attachCertificatePdf`.
 */
export async function issueGateCertificate(opts: {
  projectId: string
  gateCode: string
  gateName?: string
  deliverables: CertificateDeliverable[]
}): Promise<{ certificate: GateCertificate } | { error: string }> {
  const supabase = createAdminClient()
  const actor = await getActor()

  const verificationId = makeVerificationId(opts.gateCode)

  const { data, error } = await supabase
    .from('gate_certificates')
    .insert({
      tenant_id:       actor.tenantId,
      project_id:      opts.projectId,
      gate_code:       opts.gateCode,
      gate_name:       opts.gateName ?? null,
      verification_id: verificationId,
      deliverables:    opts.deliverables,
      issued_by:       actor.userId,
      issued_by_name:  actor.fullName ?? 'Authorized Signatory',
    })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/projects/${opts.projectId}`)
  return { certificate: mapRow(data, null) }
}

/** Attach the rendered certificate PDF (base64 data URL) to an issued certificate. */
export async function attachCertificatePdf(opts: {
  certificateId: string
  projectId: string
  dataUrl: string
}): Promise<{ url: string } | { error: string }> {
  const supabase = createAdminClient()

  const match = /^data:(application\/pdf);base64,(.+)$/i.exec(opts.dataUrl)
  if (!match) return { error: 'Invalid PDF data' }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 15 * 1024 * 1024) return { error: 'Certificate PDF too large (max 15 MB)' }

  const { data: cert } = await supabase
    .from('gate_certificates')
    .select('verification_id, project_id')
    .eq('id', opts.certificateId)
    .single()
  const verId = cert?.verification_id ?? opts.certificateId

  const storagePath = `certificates/${DEMO_TENANT}/${opts.projectId}/${verId}.pdf`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
  if (upErr) return { error: upErr.message }

  const { error: updErr } = await supabase
    .from('gate_certificates')
    .update({ storage_path: storagePath })
    .eq('id', opts.certificateId)
  if (updErr) return { error: updErr.message }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  return { url: signed?.signedUrl ?? '' }
}

/** List issued certificates for a project (register), newest first. */
export async function listGateCertificates(projectId: string): Promise<GateCertificate[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('gate_certificates')
    .select('*')
    .eq('project_id', projectId)
    .order('issued_at', { ascending: false })
  if (error || !data) return []

  return Promise.all(
    data.map(async (row) => {
      let url: string | null = null
      if (row.storage_path) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path as string, 3600)
        url = signed?.signedUrl ?? null
      }
      return mapRow(row, url)
    }),
  )
}

/** Public-ish verification lookup by verification id. */
export async function verifyCertificate(verificationId: string): Promise<GateCertificate | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('gate_certificates')
    .select('*')
    .eq('verification_id', verificationId.trim().toUpperCase())
    .maybeSingle()
  if (!data) return null
  return mapRow(data, null)
}
