'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/auth/guard'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type RetentionStatus = 'held' | 'release_requested' | 'released'

export interface RetentionRow {
  id: string
  project_id: string
  payment_milestone_id: string | null
  invoice_ref: string | null
  invoice_amount: number
  retention_pct: number
  retention_amount: number
  status: RetentionStatus
  release_date: string | null
  milestone_title: string | null
}

export interface RetentionKpis {
  totalHeld: number
  releaseRequested: number
  released: number
  count: number
}

export interface RetentionData {
  projectName: string
  entries: RetentionRow[]
  kpis: RetentionKpis
  canEdit: boolean
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null }

async function getActor(): Promise<Actor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: tenantId, role: null }
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role').eq('id', user.id).single()
    return { userId: user.id, tenantId: profile?.tenant_id ?? tenantId, role: profile?.role ?? null }
  } catch {
    return { userId: null, tenantId: tenantId, role: null }
  }
}

const WRITER_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'finance_manager']
function canWrite(role: string | null): boolean {
  return role !== null && WRITER_ROLES.includes(role)
}
const PM_ROLES = ['project_manager', 'project_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager']

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  projectId: string; retentionId: string; from: string | null; to: string
  transition: string; actorId: string | null; comment?: string; metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: { module: 'retention', project_id: args.projectId, retention_id: args.retentionId, ...args.metadata },
  })
}

async function notify(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string; projectId: string; title: string; body: string; roles: string[]
}) {
  const { data: recipients } = await admin
    .from('profiles').select('id')
    .eq('tenant_id', args.tenantId).eq('is_active', true)
    .in('role', [...new Set(args.roles)])
  if (!recipients?.length) return
  await admin.from('notifications').insert(
    recipients.map((r) => ({
      user_id: r.id, tenant_id: args.tenantId, title: args.title, body: args.body,
      type: 'alert', channel: 'in_app', link: `/projects/${args.projectId}/finance`,
    })),
  )
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/finance`)
  revalidatePath(`/projects/${projectId}/cash-flow`)
}

function mapRow(r: any): RetentionRow {
  return {
    id: r.id,
    project_id: r.project_id,
    payment_milestone_id: r.payment_milestone_id,
    invoice_ref: r.invoice_ref,
    invoice_amount: num(r.invoice_amount),
    retention_pct: num(r.retention_pct),
    retention_amount: num(r.retention_amount),
    status: r.status,
    release_date: r.release_date,
    milestone_title: r.payment_milestones?.title ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function loadRetention(projectId: string): Promise<RetentionData> {
  const admin = createAdminClient()
  const actor = await getActor()

  const [projRes, rRes] = await Promise.all([
    admin.from('projects').select('name').eq('id', projectId).single(),
    admin.from('retention_entries')
      .select('*, payment_milestones(title)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
  ])

  const entries = (rRes.data ?? []).map(mapRow)

  const kpis: RetentionKpis = {
    totalHeld: entries.filter((e) => e.status === 'held').reduce((s, e) => s + e.retention_amount, 0),
    releaseRequested: entries.filter((e) => e.status === 'release_requested').reduce((s, e) => s + e.retention_amount, 0),
    released: entries.filter((e) => e.status === 'released').reduce((s, e) => s + e.retention_amount, 0),
    count: entries.length,
  }

  return {
    projectName: projRes.data?.name ?? 'Project',
    entries,
    kpis,
    canEdit: canWrite(actor.role),
  }
}

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export async function upsertRetention(input: {
  id?: string
  project_id: string
  invoice_ref?: string | null
  invoice_amount?: number
  retention_pct?: number
  retention_amount?: number   // editable; defaults to invoice_amount × pct / 100
}): Promise<ActionResult<RetentionRow>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to edit retention entries.' }

  const admin = createAdminClient()
  const invoiceAmount = num(input.invoice_amount)
  const pct = num(input.retention_pct)
  // Auto-compute when not explicitly provided.
  const retentionAmount = input.retention_amount != null && input.retention_amount !== undefined
    ? num(input.retention_amount)
    : Math.round((invoiceAmount * pct) / 100 * 100) / 100

  const row = {
    tenant_id: actor.tenantId,
    project_id: input.project_id,
    invoice_ref: input.invoice_ref?.trim() || null,
    invoice_amount: invoiceAmount,
    retention_pct: pct,
    retention_amount: retentionAmount,
    updated_at: new Date().toISOString(),
  }

  let retentionId = input.id
  if (input.id) {
    const { error } = await admin.from('retention_entries').update(row).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await admin.from('retention_entries')
      .insert({ ...row, status: 'held' }).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to create retention entry' }
    retentionId = data.id
  }

  await logEvent(admin, {
    projectId: input.project_id, retentionId: retentionId!,
    from: null, to: 'held',
    transition: input.id ? 'RETENTION_UPDATED' : 'RETENTION_CREATED',
    actorId: actor.userId,
    comment: row.invoice_ref ?? 'Retention entry',
    metadata: { invoice_amount: invoiceAmount, retention_pct: pct, retention_amount: retentionAmount },
  })

  revalidate(input.project_id)
  const { data: full } = await admin.from('retention_entries').select('*, payment_milestones(title)').eq('id', retentionId!).single()
  return { data: mapRow(full) }
}

export async function deleteRetention(id: string, projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to delete retention entries.' }
  const admin = createAdminClient()
  const { error } = await admin.from('retention_entries').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}

// ─────────────────────────────────────────────────────────────
// Release workflow
// ─────────────────────────────────────────────────────────────

export async function requestRelease(args: { id: string; projectId: string }): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to request release.' }
  const admin = createAdminClient()
  const { data: r } = await admin.from('retention_entries').select('status, retention_amount, invoice_ref').eq('id', args.id).single()
  if (!r) return { error: 'Retention entry not found' }
  if (r.status !== 'held') return { error: 'Only held retention can be requested for release.' }

  const { error } = await admin.from('retention_entries')
    .update({ status: 'release_requested', updated_at: new Date().toISOString() }).eq('id', args.id)
  if (error) return { error: error.message }

  await logEvent(admin, {
    projectId: args.projectId, retentionId: args.id,
    from: 'held', to: 'release_requested', transition: 'RETENTION_RELEASE_REQUESTED',
    actorId: actor.userId, comment: r.invoice_ref ?? undefined,
    metadata: { retention_amount: num(r.retention_amount) },
  })

  await notify(admin, {
    tenantId: actor.tenantId, projectId: args.projectId,
    title: 'Retention release requested',
    body: `A retention release of ${num(r.retention_amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} has been requested.`,
    roles: [...FINANCE_ROLES, ...PM_ROLES],
  })
  revalidate(args.projectId)
  return {}
}

export async function confirmRelease(args: { id: string; projectId: string }): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to confirm release.' }
  const admin = createAdminClient()
  const { data: r } = await admin.from('retention_entries').select('status, retention_amount').eq('id', args.id).single()
  if (!r) return { error: 'Retention entry not found' }

  const { error } = await admin.from('retention_entries')
    .update({ status: 'released', release_date: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', args.id)
  if (error) return { error: error.message }

  await logEvent(admin, {
    projectId: args.projectId, retentionId: args.id,
    from: r.status, to: 'released', transition: 'RETENTION_RELEASED',
    actorId: actor.userId, metadata: { retention_amount: num(r.retention_amount) },
  })
  await notify(admin, {
    tenantId: actor.tenantId, projectId: args.projectId,
    title: 'Retention released',
    body: `A retention of ${num(r.retention_amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} was released.`,
    roles: [...FINANCE_ROLES, ...PM_ROLES],
  })
  revalidate(args.projectId)
  return {}
}

/**
 * FAC (G6): request release for every held retention entry on the project in one action.
 */
export async function requestReleaseAllHeld(projectId: string): Promise<ActionResult<{ requested: number }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to request release.' }
  const admin = createAdminClient()

  const { data: held } = await admin.from('retention_entries')
    .select('id, retention_amount, invoice_ref').eq('project_id', projectId).eq('status', 'held')
  const rows = held ?? []
  if (!rows.length) return { data: { requested: 0 } }

  const now = new Date().toISOString()
  await admin.from('retention_entries')
    .update({ status: 'release_requested', updated_at: now })
    .eq('project_id', projectId).eq('status', 'held')

  let total = 0
  for (const r of rows) {
    total += num(r.retention_amount)
    await logEvent(admin, {
      projectId, retentionId: r.id, from: 'held', to: 'release_requested',
      transition: 'RETENTION_RELEASE_REQUESTED', actorId: actor.userId,
      comment: `FAC bulk release request${r.invoice_ref ? ` · ${r.invoice_ref}` : ''}`,
      metadata: { retention_amount: num(r.retention_amount), trigger: 'FAC' },
    })
  }

  await notify(admin, {
    tenantId: actor.tenantId, projectId,
    title: 'FAC retention release requested',
    body: `Release requested for ${rows.length} held retention entr${rows.length === 1 ? 'y' : 'ies'} totalling ${total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} at FAC (G6).`,
    roles: [...FINANCE_ROLES, ...PM_ROLES],
  })
  revalidate(projectId)
  return { data: { requested: rows.length } }
}
