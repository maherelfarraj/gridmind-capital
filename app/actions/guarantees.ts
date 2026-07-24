'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type GuaranteeType = 'bid_bond' | 'performance_bond' | 'advance_payment_guarantee' | 'retention_bond'
export type GuaranteeStatus = 'active' | 'released' | 'expired' | 'called'

export interface Guarantee {
  id: string
  project_id: string
  type: GuaranteeType
  bank_name: string | null
  amount: number
  currency: string
  issue_date: string | null
  expiry_date: string | null
  status: GuaranteeStatus
  release_date: string | null
  notes: string | null
  days_to_expiry: number | null   // computed; negative = expired
}

export interface GuaranteeKpis {
  totalActiveValue: number
  activeCount: number
  expiringSoon: number            // active + expiry within 60 days
  releasedOrExpired: number
  total: number
}

export interface GuaranteesData {
  projectName: string
  guarantees: Guarantee[]
  kpis: GuaranteeKpis
  /** G6 closeout gate: true only when every guarantee is released or expired. */
  allDischarged: boolean
  outstanding: { id: string; type: GuaranteeType; status: GuaranteeStatus }[]
  canEdit: boolean
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null; fullName: string | null }

async function getActor(): Promise<Actor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: tenantId, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role, full_name').eq('id', user.id).single()
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

const WRITER_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'finance_manager']
function canWrite(role: string | null): boolean {
  return role == null || WRITER_ROLES.includes(role)
}

const PM_ROLES = ['project_manager', 'project_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager']

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  return Math.ceil((target - Date.now()) / 86400000)
}

async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  projectId: string; guaranteeId: string; from: string | null; to: string
  transition: string; actorId: string | null; comment?: string; metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: { module: 'guarantees', project_id: args.projectId, guarantee_id: args.guaranteeId, ...args.metadata },
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
      user_id: r.id,
      tenant_id: args.tenantId,
      title: args.title,
      body: args.body,
      type: 'alert',
      channel: 'in_app',
      link: `/projects/${args.projectId}/finance`,
    })),
  )
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/finance`)
}

/** Auto-flip an active guarantee to 'expired' once its expiry date has passed. */
function effectiveStatus(row: { status: GuaranteeStatus; expiry_date: string | null }): GuaranteeStatus {
  if (row.status === 'active' && row.expiry_date) {
    const d = daysUntil(row.expiry_date)
    if (d != null && d < 0) return 'expired'
  }
  return row.status
}

function mapGuarantee(r: any): Guarantee {
  const status = effectiveStatus(r)
  return {
    id: r.id,
    project_id: r.project_id,
    type: r.type,
    bank_name: r.bank_name,
    amount: num(r.amount),
    currency: r.currency ?? 'USD',
    issue_date: r.issue_date,
    expiry_date: r.expiry_date,
    status,
    release_date: r.release_date,
    notes: r.notes,
    days_to_expiry: daysUntil(r.expiry_date),
  }
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function loadGuarantees(projectId: string): Promise<GuaranteesData> {
  const admin = createAdminClient()
  const actor = await getActor()

  const [projRes, gRes] = await Promise.all([
    admin.from('projects').select('name').eq('id', projectId).single(),
    admin.from('guarantees').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
  ])

  const guarantees = (gRes.data ?? []).map(mapGuarantee)

  const kpis: GuaranteeKpis = {
    totalActiveValue: guarantees.filter((g) => g.status === 'active').reduce((s, g) => s + g.amount, 0),
    activeCount: guarantees.filter((g) => g.status === 'active').length,
    expiringSoon: guarantees.filter((g) => g.status === 'active' && g.days_to_expiry != null && g.days_to_expiry <= 60 && g.days_to_expiry >= 0).length,
    releasedOrExpired: guarantees.filter((g) => g.status === 'released' || g.status === 'expired').length,
    total: guarantees.length,
  }

  const outstanding = guarantees
    .filter((g) => g.status !== 'released' && g.status !== 'expired')
    .map((g) => ({ id: g.id, type: g.type, status: g.status }))

  return {
    projectName: projRes.data?.name ?? 'Project',
    guarantees,
    kpis,
    allDischarged: guarantees.length > 0 && outstanding.length === 0,
    outstanding,
    canEdit: canWrite(actor.role),
  }
}

/**
 * G6 closeout gate helper: can the "Bank guarantees discharged" deliverable be marked complete?
 * Requires every guarantee on the project to be released or expired.
 */
export async function canDischargeGuarantees(projectId: string): Promise<{ ok: boolean; outstanding: { id: string; type: GuaranteeType; status: GuaranteeStatus }[] }> {
  const admin = createAdminClient()
  const { data } = await admin.from('guarantees').select('*').eq('project_id', projectId)
  const guarantees = (data ?? []).map(mapGuarantee)
  const outstanding = guarantees
    .filter((g) => g.status !== 'released' && g.status !== 'expired')
    .map((g) => ({ id: g.id, type: g.type, status: g.status }))
  return { ok: outstanding.length === 0, outstanding }
}

/** Are there any active performance bonds to discharge? (G5/PAC prompt) */
export async function getPerformanceBonds(projectId: string): Promise<{ id: string; bank_name: string | null; amount: number; status: GuaranteeStatus }[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('guarantees')
    .select('*').eq('project_id', projectId).eq('type', 'performance_bond')
  return (data ?? [])
    .map(mapGuarantee)
    .filter((g) => g.status === 'active')
    .map((g) => ({ id: g.id, bank_name: g.bank_name, amount: g.amount, status: g.status }))
}

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export async function upsertGuarantee(input: {
  id?: string
  project_id: string
  type: GuaranteeType
  bank_name?: string | null
  amount?: number
  currency?: string
  issue_date?: string | null
  expiry_date?: string | null
  status?: GuaranteeStatus
  notes?: string | null
}): Promise<ActionResult<Guarantee>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to edit guarantees.' }

  const admin = createAdminClient()
  const row = {
    tenant_id: actor.tenantId,
    project_id: input.project_id,
    type: input.type,
    bank_name: input.bank_name?.trim() || null,
    amount: num(input.amount),
    currency: input.currency || 'USD',
    issue_date: input.issue_date || null,
    expiry_date: input.expiry_date || null,
    status: input.status ?? 'active',
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  let guaranteeId = input.id
  let fromStatus: string | null = null

  if (input.id) {
    const { data: prev } = await admin.from('guarantees').select('status').eq('id', input.id).single()
    fromStatus = prev?.status ?? null
    const { error } = await admin.from('guarantees').update(row).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await admin.from('guarantees').insert(row).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to create guarantee' }
    guaranteeId = data.id
  }

  await logEvent(admin, {
    projectId: input.project_id,
    guaranteeId: guaranteeId!,
    from: fromStatus,
    to: row.status,
    transition: input.id ? 'GUARANTEE_UPDATED' : 'GUARANTEE_CREATED',
    actorId: actor.userId,
    comment: `${row.type.replace(/_/g, ' ')}${row.bank_name ? ` · ${row.bank_name}` : ''}`,
    metadata: { type: row.type, amount: row.amount, currency: row.currency },
  })

  revalidate(input.project_id)
  const { data: full } = await admin.from('guarantees').select('*').eq('id', guaranteeId!).single()
  return { data: mapGuarantee(full) }
}

/** Explicit status change (release / mark called / discharge) with logging + notification. */
export async function setGuaranteeStatus(args: {
  id: string; projectId: string; status: GuaranteeStatus
}): Promise<ActionResult<Guarantee>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to change guarantee status.' }

  const admin = createAdminClient()
  const { data: prev } = await admin.from('guarantees').select('status, type, bank_name').eq('id', args.id).single()
  if (!prev) return { error: 'Guarantee not found' }

  const patch: Record<string, unknown> = { status: args.status, updated_at: new Date().toISOString() }
  if (args.status === 'released') patch.release_date = new Date().toISOString()

  const { error } = await admin.from('guarantees').update(patch).eq('id', args.id)
  if (error) return { error: error.message }

  await logEvent(admin, {
    projectId: args.projectId,
    guaranteeId: args.id,
    from: prev.status,
    to: args.status,
    transition: 'GUARANTEE_STATUS_CHANGED',
    actorId: actor.userId,
    comment: `${(prev.type as string).replace(/_/g, ' ')} → ${args.status}`,
  })

  await notify(admin, {
    tenantId: actor.tenantId,
    projectId: args.projectId,
    title: `Guarantee ${args.status}`,
    body: `A ${(prev.type as string).replace(/_/g, ' ')}${prev.bank_name ? ` (${prev.bank_name})` : ''} was marked ${args.status}.`,
    roles: [...PM_ROLES, ...FINANCE_ROLES],
  })

  revalidate(args.projectId)
  const { data: full } = await admin.from('guarantees').select('*').eq('id', args.id).single()
  return { data: mapGuarantee(full) }
}

/**
 * Start the discharge process for all active performance bonds (invoked from the G5/PAC prompt).
 * Marks them released and logs/notifies.
 */
export async function startPerformanceBondDischarge(projectId: string): Promise<ActionResult<{ discharged: number }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to discharge guarantees.' }

  const admin = createAdminClient()
  const { data } = await admin.from('guarantees')
    .select('*').eq('project_id', projectId).eq('type', 'performance_bond').eq('status', 'active')
  const bonds = data ?? []
  if (!bonds.length) return { data: { discharged: 0 } }

  const now = new Date().toISOString()
  for (const b of bonds) {
    await admin.from('guarantees').update({ status: 'released', release_date: now, updated_at: now }).eq('id', b.id)
    await logEvent(admin, {
      projectId,
      guaranteeId: b.id,
      from: 'active',
      to: 'released',
      transition: 'PERFORMANCE_BOND_DISCHARGED',
      actorId: actor.userId,
      comment: `Performance bond discharge started at PAC${b.bank_name ? ` · ${b.bank_name}` : ''}`,
    })
  }

  await notify(admin, {
    tenantId: actor.tenantId,
    projectId,
    title: 'Performance bond discharge started',
    body: `${bonds.length} performance bond(s) marked for release at PAC (G5).`,
    roles: [...PM_ROLES, ...FINANCE_ROLES],
  })

  revalidate(projectId)
  return { data: { discharged: bonds.length } }
}

export async function deleteGuarantee(id: string, projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to delete guarantees.' }
  const admin = createAdminClient()
  const { error } = await admin.from('guarantees').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}

// ─────────────────────────────────────────────────────────────
// Demo seed
// ─────────────────────────────────────────────────────────────

export async function seedGuaranteesDemo(projectId: string): Promise<ActionResult<{ created: number }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to seed data.' }
  const admin = createAdminClient()

  const { count } = await admin.from('guarantees')
    .select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  if ((count ?? 0) > 0) return { error: 'Guarantees already exist for this project.' }

  const today = new Date()
  const iso = (offsetDays: number) => {
    const d = new Date(today); d.setDate(d.getDate() + offsetDays); return d.toISOString().slice(0, 10)
  }

  const rows = [
    { type: 'bid_bond', bank_name: 'Emirates NBD', amount: 2_500_000, issue_date: iso(-400), expiry_date: iso(-30), status: 'expired' },
    { type: 'advance_payment_guarantee', bank_name: 'First Abu Dhabi Bank', amount: 24_000_000, issue_date: iso(-300), expiry_date: iso(20), status: 'active' },
    { type: 'performance_bond', bank_name: 'HSBC', amount: 48_000_000, issue_date: iso(-300), expiry_date: iso(50), status: 'active' },
    { type: 'retention_bond', bank_name: 'Standard Chartered', amount: 12_000_000, issue_date: iso(-200), expiry_date: iso(200), status: 'active' },
  ]

  for (const r of rows) {
    const { data } = await admin.from('guarantees').insert({
      tenant_id: actor.tenantId, project_id: projectId, currency: 'USD', ...r,
    }).select('id').single()
    if (data) {
      await logEvent(admin, {
        projectId, guaranteeId: data.id, from: null, to: r.status,
        transition: 'GUARANTEE_CREATED', actorId: actor.userId,
        comment: `${r.type.replace(/_/g, ' ')} · ${r.bank_name}`,
        metadata: { type: r.type, amount: r.amount, currency: 'USD' },
      })
    }
  }

  revalidate(projectId)
  return { data: { created: rows.length } }
}
