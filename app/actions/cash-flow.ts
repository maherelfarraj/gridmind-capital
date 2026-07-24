'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEscalationEmail } from '@/lib/email/send'
import { revalidatePath } from 'next/cache'

import { DEMO_TENANT_FALLBACK } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type MilestoneStatus = 'planned' | 'invoiced' | 'overdue' | 'paid'
export type RetentionStatus = 'held' | 'release_requested' | 'released'

export interface PaymentMilestone {
  id: string
  project_id: string
  title: string
  planned_date: string | null
  planned_amount: number
  invoiced_at: string | null
  invoice_amount: number | null
  due_date: string | null
  paid_at: string | null
  paid_amount: number | null
  status: MilestoneStatus
  escalation_level: number
  retention_pct: number
  days_overdue: number
  retention: RetentionEntry | null
  client_visible: boolean
}

export interface RetentionEntry {
  id: string
  project_id: string
  payment_milestone_id: string | null
  invoice_ref: string | null
  invoice_amount: number
  retention_pct: number
  retention_amount: number
  status: RetentionStatus
  release_date: string | null
}

export interface EscalationStep {
  level: number
  label: string
  triggerDays: number          // days after due_date this level is suggested
  templateTitle: string
  templateBody: string
}

export interface CashFlowKpis {
  totalContractValue: number   // sum of planned_amount
  invoicedToDate: number       // sum of invoice_amount where invoiced
  receivedToDate: number       // sum of paid_amount where paid
  overdueAmount: number        // sum of outstanding on overdue milestones
  retentionHeld: number        // sum of retention_entries.retention_amount where held
}

export interface CashFlowPoint {
  period: string               // YYYY-MM
  planned: number              // cumulative planned
  invoiced: number             // cumulative invoiced
  received: number             // cumulative received
}

export interface CashFlowData {
  projectName: string
  currency: string
  milestones: PaymentMilestone[]
  kpis: CashFlowKpis
  chart: CashFlowPoint[]
  canEdit: boolean
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Escalation ladder (levels 1–4)
// ─────────────────────────────────────────────────────────────

export const ESCALATION_LADDER: EscalationStep[] = [
  {
    level: 1,
    label: 'Formal follow-up',
    triggerDays: 7,
    templateTitle: 'Formal follow-up',
    templateBody:
      'Dear Sir/Madam,\n\nWe refer to invoice {{invoiceRef}} in the amount of {{amount}}, which fell due on {{dueDate}} and remains outstanding as of {{today}} ({{daysOverdue}} days overdue).\n\nWe kindly request that payment be arranged within 7 days of this notice. Please treat this as a formal follow-up on the above receivable.\n\nYours faithfully,\nGridMind Capital — Project Finance',
  },
  {
    level: 2,
    label: 'Management escalation letter',
    triggerDays: 30,
    templateTitle: 'Management escalation letter',
    templateBody:
      'Dear Sir/Madam,\n\nDespite our previous follow-up, invoice {{invoiceRef}} ({{amount}}), due {{dueDate}}, remains unpaid and is now {{daysOverdue}} days overdue.\n\nThis matter has been escalated to project management. We request immediate settlement and a written response within 7 days confirming the payment date. Continued non-payment may trigger contractual remedies.\n\nYours faithfully,\nGridMind Capital — Project Director',
  },
  {
    level: 3,
    label: 'Contractual remedy: interest / claim notice',
    triggerDays: 60,
    templateTitle: 'Notice of contractual remedy — interest & claim',
    templateBody:
      'NOTICE OF CONTRACTUAL REMEDY\n\nRe: Invoice {{invoiceRef}} — {{amount}} — due {{dueDate}} — now {{daysOverdue}} days overdue.\n\nPursuant to the Contract, GridMind Capital hereby gives notice of its intention to (a) apply interest on the overdue sum at the contractual rate and (b) advance a formal claim for the outstanding amount. Legal and Finance have been notified. Please remit payment in full within 14 days to avoid further action.\n\nGridMind Capital — Commercial & Legal',
  },
  {
    level: 4,
    label: 'Dispute resolution per contract',
    triggerDays: 90,
    templateTitle: 'Referral to dispute resolution',
    templateBody:
      'REFERRAL TO DISPUTE RESOLUTION\n\nRe: Invoice {{invoiceRef}} — {{amount}} — due {{dueDate}} — {{daysOverdue}} days overdue.\n\nAs the outstanding sum remains unpaid despite prior notices, GridMind Capital refers this matter to dispute resolution in accordance with the dispute resolution provisions of the Contract. All rights and remedies are expressly reserved.\n\nGridMind Capital — Commercial & Legal',
  },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null; fullName: string | null }

async function getActor(): Promise<Actor> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: DEMO_TENANT_FALLBACK, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles').select('tenant_id, role, full_name').eq('id', user.id).single()
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

const WRITER_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'finance_manager']
function canWrite(role: string | null): boolean {
  return role == null || WRITER_ROLES.includes(role)
}

// PM + Financial cohorts; Legal cohort added at escalation level 3+
const PM_ROLES = ['project_manager', 'project_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager']
const LEGAL_ROLES = ['commercial_manager']

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  const due = new Date(dateStr).getTime()
  return Math.floor((Date.now() - due) / 86400000)
}

/** Auto-derive status from the milestone's dates. paid > (unpaid past due = overdue) > invoiced > planned. */
function deriveStatus(m: {
  invoiced_at: string | null; paid_at: string | null; due_date: string | null
}): MilestoneStatus {
  if (m.paid_at) return 'paid'
  if (m.invoiced_at) {
    if (m.due_date && daysSince(m.due_date) > 0) return 'overdue'
    return 'invoiced'
  }
  return 'planned'
}

async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  projectId: string; milestoneId: string; from: string | null; to: string
  transition: string; actorId: string | null; comment?: string; metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: { module: 'cash_flow', project_id: args.projectId, milestone_id: args.milestoneId, ...args.metadata },
  })
}

async function notify(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string; projectId: string; milestoneId: string
  title: string; body: string; roles: string[]
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
      link: `/projects/${args.projectId}/cash-flow`,
    })),
  )
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/cash-flow`)
}

function mapRetention(r: any): RetentionEntry {
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
  }
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function loadCashFlow(projectId: string): Promise<CashFlowData> {
  const admin = createAdminClient()
  const actor = await getActor()

  const [projRes, msRes, retRes] = await Promise.all([
    admin.from('projects').select('name').eq('id', projectId).single(),
    admin.from('payment_milestones').select('*').eq('project_id', projectId),
    admin.from('retention_entries').select('*').eq('project_id', projectId),
  ])

  const retentions = (retRes.data ?? []).map(mapRetention)
  const retByMilestone = new Map<string, RetentionEntry>()
  for (const r of retentions) if (r.payment_milestone_id) retByMilestone.set(r.payment_milestone_id, r)

  const milestones: PaymentMilestone[] = (msRes.data ?? [])
    .map((r) => {
      const status = deriveStatus(r)
      const outstanding = num(r.invoice_amount) - num(r.paid_amount)
      return {
        id: r.id,
        project_id: r.project_id,
        title: r.title,
        planned_date: r.planned_date,
        planned_amount: num(r.planned_amount),
        invoiced_at: r.invoiced_at,
        invoice_amount: r.invoice_amount == null ? null : num(r.invoice_amount),
        due_date: r.due_date,
        paid_at: r.paid_at,
        paid_amount: r.paid_amount == null ? null : num(r.paid_amount),
        status,
        escalation_level: r.escalation_level ?? 0,
        retention_pct: num(r.retention_pct),
        days_overdue: status === 'overdue' ? daysSince(r.due_date) : 0,
        retention: retByMilestone.get(r.id) ?? null,
        client_visible: r.client_visible ?? false,
        _outstanding: outstanding,
      } as PaymentMilestone & { _outstanding: number }
    })
    .sort((a, b) => {
      const ad = a.planned_date ?? a.due_date ?? ''
      const bd = b.planned_date ?? b.due_date ?? ''
      return ad.localeCompare(bd)
    })

  // KPIs
  const kpis: CashFlowKpis = {
    totalContractValue: milestones.reduce((s, m) => s + m.planned_amount, 0),
    invoicedToDate: milestones.reduce((s, m) => s + (m.invoice_amount ?? 0), 0),
    receivedToDate: milestones.reduce((s, m) => s + (m.paid_amount ?? 0), 0),
    overdueAmount: milestones
      .filter((m) => m.status === 'overdue')
      .reduce((s, m) => s + ((m.invoice_amount ?? 0) - (m.paid_amount ?? 0)), 0),
    retentionHeld: retentions.filter((r) => r.status === 'held').reduce((s, r) => s + r.retention_amount, 0),
  }

  // Cumulative cash-flow curve by month (planned uses planned_date, invoiced/received use their dates)
  const monthKey = (d: string | null) => (d ? d.slice(0, 7) : null)
  const monthSet = new Set<string>()
  for (const m of milestones) {
    for (const d of [m.planned_date, m.invoiced_at, m.paid_at]) {
      const k = monthKey(d)
      if (k) monthSet.add(k)
    }
  }
  const months = [...monthSet].sort()
  const chart: CashFlowPoint[] = []
  let cp = 0, ci = 0, cr = 0
  for (const mo of months) {
    cp += milestones.filter((m) => monthKey(m.planned_date) === mo).reduce((s, m) => s + m.planned_amount, 0)
    ci += milestones.filter((m) => monthKey(m.invoiced_at) === mo).reduce((s, m) => s + (m.invoice_amount ?? 0), 0)
    cr += milestones.filter((m) => monthKey(m.paid_at) === mo).reduce((s, m) => s + (m.paid_amount ?? 0), 0)
    chart.push({ period: mo, planned: cp, invoiced: ci, received: cr })
  }

  // strip the internal _outstanding field
  const cleanMilestones = milestones.map(({ ...m }) => {
    delete (m as any)._outstanding
    return m as PaymentMilestone
  })

  return {
    projectName: projRes.data?.name ?? 'Project',
    currency: 'USD',
    milestones: cleanMilestones,
    kpis,
    chart,
    canEdit: canWrite(actor.role),
  }
}

// ─────────────────────────────────────────────────────────────
// Create / Update milestone
// ─────────────────────────────────────────────────────────────

/** Sync (create/update) the retention entry linked to a milestone when invoice_amount + retention_pct are set. */
async function syncRetention(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string; projectId: string; milestoneId: string
  invoiceRef: string | null; invoiceAmount: number | null; retentionPct: number
}) {
  const { invoiceAmount, retentionPct } = args
  if (!invoiceAmount || invoiceAmount <= 0 || !retentionPct || retentionPct <= 0) return

  const { data: existing } = await admin
    .from('retention_entries').select('id, status').eq('payment_milestone_id', args.milestoneId).maybeSingle()

  const retentionAmount = Math.round((invoiceAmount * retentionPct) / 100 * 100) / 100

  if (existing) {
    // Do not overwrite a manually-edited retention amount once release has been requested/released.
    if (existing.status !== 'held') return
    await admin.from('retention_entries').update({
      invoice_ref: args.invoiceRef,
      invoice_amount: invoiceAmount,
      retention_pct: retentionPct,
      retention_amount: retentionAmount,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await admin.from('retention_entries').insert({
      tenant_id: args.tenantId,
      project_id: args.projectId,
      payment_milestone_id: args.milestoneId,
      invoice_ref: args.invoiceRef,
      invoice_amount: invoiceAmount,
      retention_pct: retentionPct,
      retention_amount: retentionAmount,
      status: 'held',
    })
  }
}

export async function upsertMilestone(input: {
  id?: string
  project_id: string
  title: string
  planned_date?: string | null
  planned_amount?: number
  invoiced_at?: string | null
  invoice_amount?: number | null
  due_date?: string | null
  paid_at?: string | null
  paid_amount?: number | null
  retention_pct?: number
}): Promise<ActionResult<PaymentMilestone>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to edit payment milestones.' }
  if (!input.title?.trim()) return { error: 'Milestone title is required.' }

  const admin = createAdminClient()

  const row = {
    tenant_id: actor.tenantId,
    project_id: input.project_id,
    title: input.title.trim(),
    planned_date: input.planned_date || null,
    planned_amount: num(input.planned_amount),
    invoiced_at: input.invoiced_at || null,
    invoice_amount: input.invoice_amount == null ? null : num(input.invoice_amount),
    due_date: input.due_date || null,
    paid_at: input.paid_at || null,
    paid_amount: input.paid_amount == null ? null : num(input.paid_amount),
    retention_pct: num(input.retention_pct),
    updated_at: new Date().toISOString(),
  }
  // Persist the auto-derived status so queries/badges are consistent server-side.
  const status = deriveStatus(row)

  let milestoneId = input.id
  let fromStatus: string | null = null

  if (input.id) {
    const { data: prev } = await admin.from('payment_milestones').select('status').eq('id', input.id).single()
    fromStatus = prev?.status ?? null
    const { error } = await admin.from('payment_milestones')
      .update({ ...row, status }).eq('id', input.id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await admin.from('payment_milestones')
      .insert({ ...row, status, escalation_level: 0 }).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to create milestone' }
    milestoneId = data.id
  }

  // Auto-create/refresh the linked retention entry
  await syncRetention(admin, {
    tenantId: actor.tenantId,
    projectId: input.project_id,
    milestoneId: milestoneId!,
    invoiceRef: (input.invoice_amount ? row.title : null),
    invoiceAmount: row.invoice_amount,
    retentionPct: row.retention_pct,
  })

  await logEvent(admin, {
    projectId: input.project_id,
    milestoneId: milestoneId!,
    from: fromStatus,
    to: status,
    transition: input.id ? 'MILESTONE_UPDATED' : 'MILESTONE_CREATED',
    actorId: actor.userId,
    comment: row.title,
    metadata: { status, planned_amount: row.planned_amount, invoice_amount: row.invoice_amount, paid_amount: row.paid_amount },
  })

  if (input.id && fromStatus !== status) {
    await notify(admin, {
      tenantId: actor.tenantId, projectId: input.project_id, milestoneId: milestoneId!,
      title: `Milestone "${row.title}" is now ${status}`,
      body: `Payment milestone status changed from ${fromStatus ?? 'n/a'} to ${status}.`,
      roles: [...PM_ROLES, ...FINANCE_ROLES],
    })
  }

  revalidate(input.project_id)
  const { data: full } = await admin.from('payment_milestones').select('*').eq('id', milestoneId!).single()
  const derived = deriveStatus(full)
  return {
    data: {
      id: full.id,
      project_id: full.project_id,
      title: full.title,
      planned_date: full.planned_date,
      planned_amount: num(full.planned_amount),
      invoiced_at: full.invoiced_at,
      invoice_amount: full.invoice_amount == null ? null : num(full.invoice_amount),
      due_date: full.due_date,
      paid_at: full.paid_at,
      paid_amount: full.paid_amount == null ? null : num(full.paid_amount),
      status: derived,
      escalation_level: full.escalation_level ?? 0,
      retention_pct: num(full.retention_pct),
      days_overdue: derived === 'overdue' ? daysSince(full.due_date) : 0,
      retention: null,
      client_visible: full.client_visible ?? false,
    },
  }
}

export async function deleteMilestone(id: string, projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to delete milestones.' }
  const admin = createAdminClient()
  const { error } = await admin.from('payment_milestones').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}

// ─────────────────────────────────────────────────────────────
// Escalation ladder
// ─────────────────────────────────────────────────────────────

/** Move a milestone up the escalation ladder (manual level-up). Logs + notifies. */
export async function escalateMilestone(args: {
  id: string
  projectId: string
  toLevel: number
}): Promise<ActionResult<{ escalation_level: number }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to escalate.' }
  if (args.toLevel < 1 || args.toLevel > 4) return { error: 'Escalation level must be between 1 and 4.' }

  const admin = createAdminClient()
  const { data: m } = await admin.from('payment_milestones')
    .select('title, escalation_level, invoice_amount, paid_amount, due_date').eq('id', args.id).single()
  if (!m) return { error: 'Milestone not found' }

  const { error } = await admin.from('payment_milestones')
    .update({ escalation_level: args.toLevel, updated_at: new Date().toISOString() }).eq('id', args.id)
  if (error) return { error: error.message }

  const step = ESCALATION_LADDER.find((s) => s.level === args.toLevel)!
  // Level 3+ notifies Legal + Financial in addition to PM.
  const roles = args.toLevel >= 3
    ? [...PM_ROLES, ...FINANCE_ROLES, ...LEGAL_ROLES]
    : [...PM_ROLES, ...FINANCE_ROLES]

  await logEvent(admin, {
    projectId: args.projectId,
    milestoneId: args.id,
    from: `L${m.escalation_level}`,
    to: `L${args.toLevel}`,
    transition: 'MILESTONE_ESCALATED',
    actorId: actor.userId,
    comment: `${step.label} (level ${args.toLevel})`,
    metadata: { level: args.toLevel, label: step.label },
  })

  await notify(admin, {
    tenantId: actor.tenantId, projectId: args.projectId, milestoneId: args.id,
    title: `Escalation L${args.toLevel}: ${step.label}`,
    body: `"${m.title}" escalated to level ${args.toLevel} — ${step.label}.`,
    roles,
  })

  // Email the escalation cohort (prefs-aware, logged) — fire-and-forget.
  void (async () => {
    const [{ data: emailRecipients }, { data: proj }] = await Promise.all([
      admin.from('profiles').select('id, email')
        .eq('tenant_id', actor.tenantId).eq('is_active', true).in('role', [...new Set(roles)]),
      admin.from('projects').select('code').eq('id', args.projectId).maybeSingle(),
    ])
    const outstanding = num(m.invoice_amount) - num(m.paid_amount)
    const daysOverdue = m.due_date
      ? Math.max(0, Math.floor((Date.now() - new Date(m.due_date).getTime()) / 86400000))
      : 0
    await Promise.all(
      (emailRecipients ?? []).filter((r) => r.email).map((r) =>
        sendEscalationEmail({
          to: r.email as string,
          userId: r.id,
          milestoneTitle: m.title,
          amount: outstanding,
          daysOverdue,
          level: args.toLevel,
          projectCode: proj?.code ?? 'PROJECT',
          projectId: args.projectId,
        }),
      ),
    )
  })().catch((e) => console.error('[cash-flow] escalation email failed:', e))

  revalidate(args.projectId)
  return { data: { escalation_level: args.toLevel } }
}

// ─────────────────────────────────────────────────────────────
// Retention release
// ─────────────────────────────────────────────────────────────

export async function requestRetentionRelease(args: { id: string; projectId: string }): Promise<ActionResult> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to request retention release.' }
  const admin = createAdminClient()
  const { data: r } = await admin.from('retention_entries').select('status, retention_amount').eq('id', args.id).single()
  if (!r) return { error: 'Retention entry not found' }
  if (r.status !== 'held') return { error: 'Retention is not in a held state.' }

  const { error } = await admin.from('retention_entries')
    .update({ status: 'release_requested', updated_at: new Date().toISOString() }).eq('id', args.id)
  if (error) return { error: error.message }

  await notify(admin, {
    tenantId: actor.tenantId, projectId: args.projectId, milestoneId: args.id,
    title: 'Retention release requested',
    body: `A retention release of ${num(r.retention_amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} has been requested.`,
    roles: [...FINANCE_ROLES, ...PM_ROLES],
  })
  revalidate(args.projectId)
  return {}
}

// ─────────────────────────────────────────────────────────────
// Demo seed
// ─────────────────────────────────────────────────────────────

export async function seedCashFlowDemo(projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  const admin = createAdminClient()

  const { count } = await admin
    .from('payment_milestones').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  if ((count ?? 0) > 0) return { error: 'This project already has payment milestones.' }

  const today = new Date()
  const d = (offsetDays: number) => {
    const x = new Date(today); x.setDate(x.getDate() + offsetDays)
    return x.toISOString().slice(0, 10)
  }
  const ts = (offsetDays: number) => {
    const x = new Date(today); x.setDate(x.getDate() + offsetDays)
    return x.toISOString()
  }

  const seeds = [
    { title: 'Advance payment (10%)', planned_date: d(-150), planned_amount: 4_000_000, invoiced_at: ts(-150), invoice_amount: 4_000_000, due_date: d(-120), paid_at: ts(-118), paid_amount: 4_000_000, retention_pct: 0 },
    { title: 'Mobilisation & site establishment', planned_date: d(-120), planned_amount: 6_000_000, invoiced_at: ts(-118), invoice_amount: 6_000_000, due_date: d(-88), paid_at: ts(-80), paid_amount: 6_000_000, retention_pct: 5 },
    { title: 'Modules delivered to site', planned_date: d(-80), planned_amount: 12_000_000, invoiced_at: ts(-78), invoice_amount: 12_000_000, due_date: d(-48), paid_at: ts(-40), paid_amount: 11_400_000, retention_pct: 5 },
    { title: 'Mechanical completion — Block A', planned_date: d(-40), planned_amount: 8_000_000, invoiced_at: ts(-38), invoice_amount: 8_000_000, due_date: d(-8), paid_at: null, paid_amount: null, retention_pct: 5 },
    { title: 'Mechanical completion — Block B', planned_date: d(-20), planned_amount: 8_000_000, invoiced_at: ts(-18), invoice_amount: 8_000_000, due_date: d(-45), paid_at: null, paid_amount: null, retention_pct: 5 },
    { title: 'Provisional acceptance (PAC)', planned_date: d(30), planned_amount: 6_000_000, invoiced_at: null, invoice_amount: null, due_date: null, paid_at: null, paid_amount: null, retention_pct: 0 },
  ]

  const { data: inserted, error } = await admin.from('payment_milestones').insert(
    seeds.map((s) => ({
      tenant_id: actor.tenantId,
      project_id: projectId,
      title: s.title,
      planned_date: s.planned_date,
      planned_amount: s.planned_amount,
      invoiced_at: s.invoiced_at,
      invoice_amount: s.invoice_amount,
      due_date: s.due_date,
      paid_at: s.paid_at,
      paid_amount: s.paid_amount,
      status: deriveStatus(s),
      escalation_level: 0,
      retention_pct: s.retention_pct,
    })),
  ).select('id, title, invoice_amount, retention_pct')
  if (error) return { error: error.message }

  // Auto-create retention entries for invoiced milestones with retention
  for (const m of inserted ?? []) {
    await syncRetention(admin, {
      tenantId: actor.tenantId,
      projectId,
      milestoneId: m.id,
      invoiceRef: m.title,
      invoiceAmount: m.invoice_amount == null ? null : num(m.invoice_amount),
      retentionPct: num(m.retention_pct),
    })
  }

  revalidate(projectId)
  return {}
}
