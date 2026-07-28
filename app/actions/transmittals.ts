'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/guards'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type TransmittalDirection = 'outgoing' | 'incoming'
export type TransmittalStatus = 'draft' | 'issued' | 'acknowledged' | 'responded' | 'closed'
/** A = approved, B = approved w/ comments, C = revise & resubmit, D = rejected/for-info */
export type TransmittalResponseCode = 'A' | 'B' | 'C' | 'D'

export interface TransmittalItem {
  id: string
  tenant_id: string
  transmittal_id: string
  document_id: string | null
  title: string
  revision: string | null
  copies: number | null
  created_at: string
}

export interface Transmittal {
  id: string
  tenant_id: string
  project_id: string
  transmittal_no: string
  direction: TransmittalDirection
  from_party: string | null
  to_party: string | null
  subject: string
  purpose: string | null
  status: TransmittalStatus
  issue_date: string | null
  response_due: string | null
  response_date: string | null
  response_code: TransmittalResponseCode | null
  notes: string | null
  created_at: string
  updated_at: string
  items: TransmittalItem[]
  /** Derived: issued, response_due set and passed, and not yet responded/closed. */
  overdue: boolean
}

export interface TransmittalStats {
  issuedThisMonth: number
  awaitingResponse: number
  overdue: number
  avgResponseDays: number | null
}

export interface TransmittalsRegister {
  rows: Transmittal[]
  stats: TransmittalStats
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null; fullName: string | null }

/** Best-effort resolve the current authenticated actor + their profile role. */
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

const WRITER_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'engineer']
function canWrite(role: string | null): boolean {
  return role !== null && WRITER_ROLES.includes(role)
}

/** Append an immutable entry to the shared workflow_events audit spine. */
async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  t: { id: string; project_id: string; transmittal_no: string }
  from: TransmittalStatus | null
  to: string
  transition: string
  actorId: string | null
  comment?: string
  metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: {
      module: 'transmittal',
      transmittal_id: args.t.id,
      transmittal_no: args.t.transmittal_no,
      project_id: args.t.project_id,
      ...args.metadata,
    },
  })
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function mapItem(r: any): TransmittalItem {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    transmittal_id: r.transmittal_id,
    document_id: r.document_id ?? null,
    title: r.title,
    revision: r.revision ?? null,
    copies: r.copies ?? null,
    created_at: r.created_at,
  }
}

function mapRow(r: any): Transmittal {
  const status = (r.status ?? 'draft') as TransmittalStatus
  const due = r.response_due ? new Date(r.response_due) : null
  const overdue =
    (status === 'issued' || status === 'acknowledged') &&
    due != null &&
    due.getTime() < Date.now()
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    project_id: r.project_id,
    transmittal_no: r.transmittal_no,
    direction: (r.direction ?? 'outgoing') as TransmittalDirection,
    from_party: r.from_party ?? null,
    to_party: r.to_party ?? null,
    subject: r.subject,
    purpose: r.purpose ?? null,
    status,
    issue_date: r.issue_date ?? null,
    response_due: r.response_due ?? null,
    response_date: r.response_date ?? null,
    response_code: (r.response_code ?? null) as TransmittalResponseCode | null,
    notes: r.notes ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    items: Array.isArray(r.transmittal_items) ? r.transmittal_items.map(mapItem) : [],
    overdue,
  }
}

/** Generate the next transmittal number for a project + direction: TR-OUT-001 / TR-IN-001. */
async function nextTransmittalNo(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  projectId: string,
  direction: TransmittalDirection,
): Promise<string> {
  const prefix = direction === 'incoming' ? 'TR-IN-' : 'TR-OUT-'
  const { data } = await admin
    .from('transmittals')
    .select('transmittal_no')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('direction', direction)
    .like('transmittal_no', `${prefix}%`)
  let max = 0
  for (const row of data ?? []) {
    const n = parseInt(String(row.transmittal_no).slice(prefix.length), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

// ─────────────────────────────────────────────────────────────
// 1. Register + stats
// ─────────────────────────────────────────────────────────────

export async function getTransmittalsRegister(projectId: string): Promise<TransmittalsRegister> {
  const { tenantId } = await getActor() // reads allowed for viewers
  const admin = createAdminClient()

  const { data } = await admin
    .from('transmittals')
    .select('*, transmittal_items(*)')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []).map(mapRow)

  // Stats
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let issuedThisMonth = 0
  let awaitingResponse = 0
  let overdue = 0
  const responseDurations: number[] = []

  for (const t of rows) {
    if (t.issue_date && new Date(t.issue_date) >= monthStart) issuedThisMonth++
    if (t.status === 'issued' || t.status === 'acknowledged') {
      awaitingResponse++
      if (t.overdue) overdue++
    }
    if (t.issue_date && t.response_date) {
      const days = Math.round(
        (new Date(t.response_date).getTime() - new Date(t.issue_date).getTime()) / 86_400_000,
      )
      if (days >= 0) responseDurations.push(days)
    }
  }

  const avgResponseDays = responseDurations.length
    ? Math.round((responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length) * 10) / 10
    : null

  return { rows, stats: { issuedThisMonth, awaitingResponse, overdue, avgResponseDays } }
}

// ─────────────────────────────────────────────────────────────
// 2. Create
// ─────────────────────────────────────────────────────────────

export interface CreateTransmittalInput {
  direction: TransmittalDirection
  from_party?: string | null
  to_party?: string | null
  subject: string
  purpose?: string | null
  response_due?: string | null
  notes?: string | null
}

export interface CreateTransmittalItemInput {
  title: string
  revision?: string | null
  document_id?: string | null
  copies?: number | null
}

export async function createTransmittal(
  projectId: string,
  data: CreateTransmittalInput,
  items: CreateTransmittalItemInput[] = [],
): Promise<ActionResult<{ id: string; transmittal_no: string }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to create transmittals.' }
  if (!data.subject?.trim()) return { error: 'Subject is required.' }

  const admin = createAdminClient()
  const direction: TransmittalDirection = data.direction === 'incoming' ? 'incoming' : 'outgoing'
  const transmittal_no = await nextTransmittalNo(admin, actor.tenantId, projectId, direction)

  const { data: inserted, error } = await admin
    .from('transmittals')
    .insert({
      tenant_id: actor.tenantId,
      project_id: projectId,
      transmittal_no,
      direction,
      from_party: data.from_party ?? null,
      to_party: data.to_party ?? null,
      subject: data.subject.trim(),
      purpose: data.purpose ?? 'for_information',
      status: 'draft',
      response_due: data.response_due ?? null,
      notes: data.notes ?? null,
    })
    .select('id, project_id, transmittal_no')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Failed to create transmittal.' }

  const cleanItems = items.filter((i) => i.title?.trim())
  if (cleanItems.length > 0) {
    const { error: itemsError } = await admin.from('transmittal_items').insert(
      cleanItems.map((i) => ({
        tenant_id: actor.tenantId,
        transmittal_id: inserted.id,
        document_id: i.document_id ?? null,
        title: i.title.trim(),
        revision: i.revision ?? 'A',
        copies: i.copies ?? 1,
      })),
    )
    if (itemsError) return { error: itemsError.message }
  }

  await logEvent(admin, {
    t: inserted, from: null, to: 'draft', transition: 'CREATE', actorId: actor.userId,
    metadata: { direction, item_count: cleanItems.length },
  })

  revalidatePath(`/projects/${projectId}/transmittals`)
  return { data: { id: inserted.id, transmittal_no: inserted.transmittal_no } }
}

// ─────────────────────────────────────────────────────────────
// 3–6. Lifecycle transitions
// ─────────────────────────────────────────────────────────────

/** Shared: fetch a transmittal, guard write access, run an update, log, revalidate. */
async function transition(
  id: string,
  expectFrom: TransmittalStatus[] | null,
  patch: Record<string, unknown>,
  transitionCode: string,
  toState: string,
  extraMeta?: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to update transmittals.' }

  const admin = createAdminClient()
  const { data: current, error: fetchError } = await admin
    .from('transmittals')
    .select('id, project_id, transmittal_no, status')
    .eq('id', id)
    .single()

  if (fetchError || !current) return { error: 'Transmittal not found.' }
  if (expectFrom && !expectFrom.includes(current.status as TransmittalStatus)) {
    return { error: `Cannot perform this action on a ${current.status} transmittal.` }
  }

  const { error } = await admin
    .from('transmittals')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await logEvent(admin, {
    t: current, from: current.status as TransmittalStatus, to: toState,
    transition: transitionCode, actorId: actor.userId, metadata: extraMeta,
  })

  revalidatePath(`/projects/${current.project_id}/transmittals`)
  return { data: { id } }
}

/** 3. draft → issued (stamps issue_date). */
export async function issueTransmittal(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, ['draft'],
    { status: 'issued', issue_date: todayIso() },
    'ISSUE', 'issued',
  )
}

/** 4. issued → acknowledged (marks receipt for incoming transmittals). */
export async function acknowledgeTransmittal(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, ['issued'],
    { status: 'acknowledged' },
    'ACKNOWLEDGE', 'acknowledged',
  )
}

/**
 * 5. issued/acknowledged → responded (sets response_code A/B/C/D + response_date).
 * When response_code is 'C' (revise & resubmit), returns needsResubmit so the UI
 * can prompt the user to raise a follow-up transmittal.
 */
export async function respondTransmittal(
  id: string,
  responseCode: TransmittalResponseCode,
  responseDate?: string,
): Promise<ActionResult<{ id: string; needsResubmit: boolean }>> {
  if (!['A', 'B', 'C', 'D'].includes(responseCode)) {
    return { error: 'Invalid response code. Expected A, B, C or D.' }
  }
  const res = await transition(
    id, ['issued', 'acknowledged'],
    { status: 'responded', response_code: responseCode, response_date: responseDate ?? todayIso() },
    'RESPOND', 'responded',
    { response_code: responseCode },
  )
  if (res.error) return { error: res.error }
  return { data: { id, needsResubmit: responseCode === 'C' } }
}

/** 6. any → closed. */
export async function closeTransmittal(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, null,
    { status: 'closed' },
    'CLOSE', 'closed',
  )
}

// ─────────────────────────────────────────────────────────────
// 7. Document linking helpers (transmittal_items.document_id → document_files.id)
// ─────────────────────────────────────────────────────────────

export interface LinkableDocument {
  id: string
  title: string
  code: string | null
}

/** List registered document files for a project, for the item-link select. */
export async function listLinkableDocuments(projectId: string): Promise<LinkableDocument[]> {
  const { tenantId } = await getActor()
  const admin = createAdminClient()
  const { data } = await admin
    .from('document_files')
    .select('id, title, file_name, code')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  return (data ?? []).map((d) => ({
    id: d.id,
    title: (d.title as string) ?? (d.file_name as string) ?? 'Untitled document',
    code: (d.code as string) ?? null,
  }))
}

/** Resolve a short-lived signed download URL for a linked document. */
export async function getLinkedDocumentUrl(
  documentId: string,
): Promise<{ url?: string; error?: string }> {
  try {
    await requireUser()
  } catch (e: any) {
    return { error: 'Unauthorized' }
  }

  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()
  
  // Fetch document by id WITH tenant predicate
  const { data, error } = await admin
    .from('document_files')
    .select('storage_path')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data?.storage_path) return { error: 'Document not found or access denied.' }
  const { data: signed, error: signErr } = await admin.storage
    .from('documents')
    .createSignedUrl(data.storage_path as string, 300)
  if (signErr || !signed) return { error: signErr?.message ?? 'Could not generate download URL.' }
  return { url: signed.signedUrl }
}
