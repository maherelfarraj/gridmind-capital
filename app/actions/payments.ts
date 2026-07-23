'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireRole, getAuthActor } from '@/lib/auth/guard'
import { getProjectProgress } from '@/app/actions/schedule'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// Roles allowed to certify a certificate and to mark it paid.
const CERTIFY_ROLES = ['finance_manager', 'project_director', 'tenant_admin', 'system_admin'] as const

export type PcStatus = 'draft' | 'submitted' | 'certified' | 'invoiced' | 'paid'

export interface PaymentCertificate {
  id: string
  project_id: string
  pc_number: string
  period_start: string | null
  period_end: string | null
  progress_pct: number
  contract_value: number
  gross_amount: number
  previous_certified: number
  this_period: number
  retention_pct: number
  retention_amount: number
  advance_recovery: number
  net_amount: number
  status: PcStatus
  submitted_date: string | null
  certified_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
}

export interface PaymentKpis {
  contractValue: number
  certifiedToDate: number
  paidToDate: number
  retentionHeld: number
}

export interface PaymentCurvePoint {
  period: string
  certified: number
  paid: number
}

export interface PaymentRegister {
  rows: PaymentCertificate[]
  kpis: PaymentKpis
  curve: PaymentCurvePoint[]
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>
const num = (v: unknown): number => (v == null ? 0 : Number(v))

function mapRow(r: Row): PaymentCertificate {
  return {
    id:                 r.id as string,
    project_id:         r.project_id as string,
    pc_number:          r.pc_number as string,
    period_start:       (r.period_start as string) ?? null,
    period_end:         (r.period_end as string) ?? null,
    progress_pct:       num(r.progress_pct),
    contract_value:     num(r.contract_value),
    gross_amount:       num(r.gross_amount),
    previous_certified: num(r.previous_certified),
    this_period:        num(r.this_period),
    retention_pct:      num(r.retention_pct),
    retention_amount:   num(r.retention_amount),
    advance_recovery:   num(r.advance_recovery),
    net_amount:         num(r.net_amount),
    status:             ((r.status as PcStatus) ?? 'draft'),
    submitted_date:     (r.submitted_date as string) ?? null,
    certified_date:     (r.certified_date as string) ?? null,
    paid_date:          (r.paid_date as string) ?? null,
    notes:              (r.notes as string) ?? null,
    created_at:         r.created_at as string,
  }
}

/** Contract value = baseline budget (budget_usd) + approved VO cost impact. */
async function computeContractValue(projectId: string): Promise<number> {
  const admin = createAdminClient()
  const [{ data: proj }, { data: vos }] = await Promise.all([
    admin.from('projects').select('budget_usd').eq('id', projectId).maybeSingle(),
    admin.from('variation_orders').select('cost_impact').eq('project_id', projectId).eq('status', 'approved'),
  ])
  const baseline = num(proj?.budget_usd)
  const approvedVo = (vos ?? []).reduce((s, v) => s + num((v as Row).cost_impact), 0)
  return baseline + approvedVo
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getPaymentCertificates(projectId: string): Promise<PaymentRegister> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('payment_certificates')
    .select('*')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const rows = (data ?? []).map(mapRow)
  const contractValue = await computeContractValue(projectId)

  // Certified-onward statuses count toward "certified to date".
  const certifiedStatuses: PcStatus[] = ['certified', 'invoiced', 'paid']
  const certifiedToDate = rows
    .filter(r => certifiedStatuses.includes(r.status))
    .reduce((s, r) => s + r.this_period, 0)
  const paidToDate = rows
    .filter(r => r.status === 'paid')
    .reduce((s, r) => s + r.net_amount, 0)
  const retentionHeld = rows
    .filter(r => certifiedStatuses.includes(r.status))
    .reduce((s, r) => s + r.retention_amount, 0)

  // Payment curve — cumulative certified vs cumulative paid, ordered by period end.
  const ordered = [...rows].sort((a, b) =>
    (a.period_end ?? a.created_at).localeCompare(b.period_end ?? b.created_at))
  let cumCert = 0
  let cumPaid = 0
  const curve: PaymentCurvePoint[] = ordered.map((r) => {
    if (certifiedStatuses.includes(r.status)) cumCert += r.this_period
    if (r.status === 'paid') cumPaid += r.net_amount
    const label = r.period_end
      ? new Date(r.period_end + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      : r.pc_number
    return { period: label, certified: Math.round(cumCert), paid: Math.round(cumPaid) }
  })

  return {
    rows,
    kpis: { contractValue, certifiedToDate, paidToDate, retentionHeld },
    curve,
  }
}

// ─── Portfolio cost exposure (dashboard widget) ─────────────────────────────────

export interface ProjectCostExposure {
  projectId: string
  code: string
  name: string
  /** budget_usd + approved VO cost impact */
  contractValue: number
  certifiedToDate: number
  /** certified / contract value, 0-100 */
  certifiedPct: number
  /** sum of submitted (pending) VO cost impact — the "exposure" */
  pendingVoImpact: number
}

export interface PortfolioCostExposure {
  projects: ProjectCostExposure[]
  totals: {
    contractValue: number
    certifiedToDate: number
    certifiedPct: number
    pendingVoImpact: number
  }
}

/**
 * Aggregate per-project cost exposure across the portfolio for the dashboard
 * widget: contract value (budget + approved VOs), % certified (from payment
 * certificates) and pending VO impact ("exposure"). Uses 3 batched queries
 * rather than an N+1 per project.
 */
export async function getPortfolioCostExposure(): Promise<PortfolioCostExposure> {
  const admin = createAdminClient()
  const certifiedStatuses = ['certified', 'invoiced', 'paid']

  const [{ data: projects }, { data: vos }, { data: certs }] = await Promise.all([
    admin.from('projects').select('id, code, name, budget_usd').eq('tenant_id', DEMO_TENANT),
    admin.from('variation_orders').select('project_id, cost_impact, status').eq('tenant_id', DEMO_TENANT),
    admin.from('payment_certificates').select('project_id, this_period, status').eq('tenant_id', DEMO_TENANT),
  ])

  // Per-project approved / pending VO impact.
  const approvedVo: Record<string, number> = {}
  const pendingVo: Record<string, number> = {}
  for (const v of vos ?? []) {
    const pid = (v as Row).project_id as string
    const amt = num((v as Row).cost_impact)
    if ((v as Row).status === 'approved') approvedVo[pid] = (approvedVo[pid] ?? 0) + amt
    else if ((v as Row).status === 'submitted') pendingVo[pid] = (pendingVo[pid] ?? 0) + amt
  }

  // Per-project certified-to-date (this_period for certified-onward statuses).
  const certified: Record<string, number> = {}
  for (const c of certs ?? []) {
    const pid = (c as Row).project_id as string
    if (certifiedStatuses.includes((c as Row).status as string)) {
      certified[pid] = (certified[pid] ?? 0) + num((c as Row).this_period)
    }
  }

  const rows: ProjectCostExposure[] = (projects ?? []).map((p) => {
    const pid = (p as Row).id as string
    const contractValue = num((p as Row).budget_usd) + (approvedVo[pid] ?? 0)
    const certifiedToDate = certified[pid] ?? 0
    return {
      projectId: pid,
      code: ((p as Row).code as string) ?? '—',
      name: ((p as Row).name as string) ?? 'Untitled',
      contractValue,
      certifiedToDate,
      certifiedPct: contractValue > 0 ? Math.round((certifiedToDate / contractValue) * 1000) / 10 : 0,
      pendingVoImpact: pendingVo[pid] ?? 0,
    }
  })
  // Most exposed / largest contract first for a meaningful widget view.
  .sort((a, b) => b.contractValue - a.contractValue)

  const totContract = rows.reduce((s, r) => s + r.contractValue, 0)
  const totCertified = rows.reduce((s, r) => s + r.certifiedToDate, 0)
  const totPending = rows.reduce((s, r) => s + r.pendingVoImpact, 0)

  return {
    projects: rows,
    totals: {
      contractValue: totContract,
      certifiedToDate: totCertified,
      certifiedPct: totContract > 0 ? Math.round((totCertified / totContract) * 1000) / 10 : 0,
      pendingVoImpact: totPending,
    },
  }
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Create a draft payment certificate. Progress % is pulled automatically from
 * the project schedule (weighted activity completion). The gross/net breakdown
 * is derived from the contract value, prior certified amounts, retention and
 * advance recovery.
 */
export async function draftPaymentCertificate(opts: {
  projectId: string
  period_start: string
  period_end: string
  retention_pct?: number
  advance_recovery?: number
}): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()

  // Auto-pull progress from the schedule (Batch 16 weighted roll-up).
  const progress = await getProjectProgress(opts.projectId)
  const progressPct = progress.percentComplete

  const contractValue = await computeContractValue(opts.projectId)

  // Prior certified (cumulative this_period across non-draft certs) → running total.
  const { data: priorRows } = await admin
    .from('payment_certificates')
    .select('this_period, status, pc_number')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', opts.projectId)

  const prior = priorRows ?? []
  const previousCertified = prior
    .filter(r => (r.status as string) !== 'draft')
    .reduce((s, r) => s + num((r as Row).this_period), 0)

  const grossAmount = Math.round((contractValue * progressPct) / 100)
  const thisPeriod = Math.max(0, grossAmount - previousCertified)
  const retentionPct = opts.retention_pct ?? 5
  const retentionAmount = Math.round((thisPeriod * retentionPct) / 100)
  const advanceRecovery = Math.max(0, opts.advance_recovery ?? 0)
  const netAmount = thisPeriod - retentionAmount - advanceRecovery

  // Generate the next IPC-#### number (unique per project).
  const pcNumber = `IPC-${String(prior.length + 1).padStart(3, '0')}`

  const { data: inserted, error } = await admin
    .from('payment_certificates')
    .insert({
      tenant_id:          DEMO_TENANT,
      project_id:         opts.projectId,
      pc_number:          pcNumber,
      period_start:       opts.period_start,
      period_end:         opts.period_end,
      progress_pct:       progressPct,
      contract_value:     contractValue,
      gross_amount:       grossAmount,
      previous_certified: previousCertified,
      this_period:        thisPeriod,
      retention_pct:      retentionPct,
      retention_amount:   retentionAmount,
      advance_recovery:   advanceRecovery,
      net_amount:         netAmount,
      status:             'draft',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/projects/${opts.projectId}/payments`)
  return { id: inserted?.id as string }
}

const VALID_TRANSITIONS: Record<PcStatus, PcStatus[]> = {
  draft:     ['submitted'],
  submitted: ['certified'],
  certified: ['invoiced'],
  invoiced:  ['paid'],
  paid:      [],
}

/**
 * Advance a certificate through its lifecycle. Certifying and marking paid are
 * restricted to finance_manager / project_director / tenant_admin / system_admin.
 */
export async function updatePaymentCertificateStatus(
  id: string,
  next: PcStatus,
): Promise<{ error?: string }> {
  // Role-gate the privileged transitions; others just require a writer.
  const gate = next === 'certified' || next === 'paid'
    ? await requireRole(CERTIFY_ROLES)
    : await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  const { data: current, error: readErr } = await admin
    .from('payment_certificates')
    .select('status, project_id, pc_number, net_amount')
    .eq('id', id)
    .single()
  if (readErr || !current) return { error: 'Certificate not found' }

  const from = current.status as PcStatus
  if (!VALID_TRANSITIONS[from]?.includes(next)) {
    return { error: `Cannot move a ${from} certificate to ${next}` }
  }

  const today = new Date().toISOString().slice(0, 10)
  const patch: Record<string, unknown> = { status: next, updated_at: new Date().toISOString() }
  if (next === 'submitted') patch.submitted_date = today
  if (next === 'certified') patch.certified_date = today
  if (next === 'paid')      patch.paid_date = today

  const { error } = await admin.from('payment_certificates').update(patch).eq('id', id)
  if (error) return { error: error.message }

  // On final payment, record a paid client-payment cashflow entry so the money
  // shows up in the finance / cashflow roll-ups. Best-effort: never block the
  // status change if the ledger insert fails.
  if (next === 'paid') {
    const { error: finErr } = await admin.from('finance_records').insert({
      tenant_id:   DEMO_TENANT,
      project_id:  current.project_id,
      type:        'cashflow',
      category:    'client_payment',
      description: `Payment received — ${current.pc_number as string}`,
      amount:      num(current.net_amount),
      status:      'paid',
      period:      today.slice(0, 7),
    })
    if (finErr) console.warn('[payments] cashflow record insert skipped:', finErr.message)
  }

  revalidatePath(`/projects/${current.project_id}/payments`)
  return {}
}

/**
 * Whether the current user may certify / mark-paid (finance_manager,
 * project_director, tenant_admin, system_admin). Used to gate those buttons in
 * the UI — the server still enforces the same rule on every mutation.
 */
export async function canCertifyPayments(): Promise<boolean> {
  const res = await getAuthActor()
  if ('error' in res) return false
  return (CERTIFY_ROLES as readonly string[]).includes(res.actor.role)
}
