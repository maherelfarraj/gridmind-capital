'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getProjectProgress, getSCurveData } from '@/app/actions/schedule'
import { loadFinanceEvmDashboard } from '@/app/actions/finance-evm'
import { getPaymentCertificates } from '@/app/actions/payments'
import { getVariationOrders } from '@/app/actions/variation-orders'
import { getClaims } from '@/app/actions/claims'
import { getProjectGateState } from '@/app/actions/phase-gates'
import { sendEmail, NOTIFICATION_EMAIL, wrapHtml, heading, para, kvTable, btn } from '@/lib/email/send'
import { maybeCreateLenderRiskInsight } from '@/app/actions/ai-insights'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gridmind-gules.vercel.app'

// Roles allowed to distribute a lender report to the lender by email.
const LENDER_DISTRIBUTION_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'finance_manager']

// ─── Auth ────────────────────────────────────────────────────────────────────
// READ actions allow viewers; mutations reject them (mirrors existing actions).

interface Actor { userId: string | null; role: string | null; tenantId: string }

async function getUser(): Promise<Actor> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, role: null, tenantId: DEMO_TENANT }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      role: profile?.role ?? 'viewer',
      tenantId: profile?.tenant_id ?? DEMO_TENANT,
    }
  } catch {
    return { userId: null, role: null, tenantId: DEMO_TENANT }
  }
}

/** Reject viewers (and unresolved-role users default to viewer = fail closed). */
function rejectViewer(actor: Actor): { error: string } | null {
  if (actor.role === 'viewer') return { error: 'You do not have permission to perform this action.' }
  return null
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LenderFacility {
  lender_name: string
  facility_amount: number
  currency: string
  reporting_frequency: string
  contact_email: string
}

export interface LenderReportData {
  generatedAt: string
  period: { start: string; end: string }
  project: {
    id: string
    name: string
    code: string
    technology: string | null
    capacity_mw: number | null
    country: string | null
    location: string | null
    budget_usd: number
    health: string | null
    current_phase: number
  }
  facility: LenderFacility | null
  progress: {
    overallPct: number
    completedActivities: number
    inProgressActivities: number
    totalActivities: number
    sCurve: { week: string; planned: number; actual: number | null }[]
    completedInPeriod: { name: string; finish: string | null }[]
    lookAhead30d: { name: string; start: string | null; finish: string | null }[]
    latestDailyReport: { report_date: string; workforce_count: number | null; work_performed: string | null } | null
  }
  gates: {
    currentGate: string
    completedGates: string[]
    approvedThrough: number
    totalGates: number
  }
  cost: {
    pv: number
    ev: number
    ac: number
    spi: number
    cpi: number
    bac: number
    eac: number   // BAC / CPI
    vac: number   // BAC - EAC
    acSource: 'certificates' | 'finance_records'
    approvedVoCount: number
  }
  payments: {
    certificatesInPeriod: {
      pc_number: string
      period_start: string | null
      period_end: string | null
      this_period: number
      net_amount: number
      status: string
    }[]
    cumulativeCertified: number
    cumulativePaid: number
    retentionHeld: number
    contractValue: number
  }
  variations: {
    approvedValue: number
    pendingValue: number
    approvedEotDays: number
    totalCount: number
    byStatus: { name: string; value: number }[]
    rows: {
      vo_number: string
      title: string
      cost_impact: number | null
      schedule_impact_days: number | null
      status: string
    }[]
  }
  claims: {
    totalCount: number
    rows: {
      claim_number: string
      title: string
      type: string
      amount: number
      eot_days: number
      status: string
    }[]
  }
  hse: {
    incidentsInPeriod: number
    incidentsBySeverity: { severity: string; count: number }[]
    openIncidents: number
    activePermits: number
    permitsExpiring30d: number
  }
  risks: {
    risk_number: string
    title: string
    category: string | null
    probability: string | null
    impact: string | null
    status: string | null
    mitigation: string | null
    owner: string | null
    exposure: number
  }[]
  quality: {
    openPunchItems: number
    openInspections: number
    ncrByStatus: { status: string; count: number }[]
    /** Optional ITP block — only present when itp_plans exist for the project */
    itpCompletionPct?: number       // average across all plans
    activePlans?: number
    ncrBySeverity?: { severity: string; count: number }[]
  }
  preparedBy: string | null
}

export interface LenderReportListItem {
  id: string
  title: string
  period_end: string | null
  created_at: string
  generated_by: string | null
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>
const num = (v: unknown): number => (v == null ? 0 : Number(v))

/**
 * Score a text probability/impact value (1-5). Accepts numeric strings or
 * words (low/medium/high/…) and maps them onto a 1-5 scale for exposure.
 */
function scoreText(v: unknown): number {
  if (v == null) return 3
  const raw = String(v).trim().toLowerCase()
  const asNum = Number(raw)
  if (!Number.isNaN(asNum) && asNum > 0) return Math.min(5, Math.max(1, asNum))
  const map: Record<string, number> = {
    'very low': 1, 'rare': 1, 'negligible': 1, low: 2, minor: 2,
    medium: 3, moderate: 3, possible: 3,
    high: 4, major: 4, likely: 4,
    'very high': 5, critical: 5, severe: 5, 'almost certain': 5, catastrophic: 5,
  }
  return map[raw] ?? 3
}

/** Best-effort parse of an HSE date which may be ISO or free-text ("19 Jul 2025"). */
function parseLooseDate(v: unknown): number | null {
  if (!v) return null
  const t = Date.parse(String(v))
  return Number.isNaN(t) ? null : t
}

// ─── 1. Facility ────────────────────────────────────────────────────────────────

export async function getFacility(projectId: string): Promise<LenderFacility | null> {
  await getUser() // reads allow viewers
  const admin = createAdminClient()
  const { data } = await admin
    .from('lender_facilities')
    .select('lender_name, facility_amount, currency, reporting_frequency, contact_email')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .maybeSingle()

  if (!data) return null
  return {
    lender_name: (data.lender_name as string) ?? '',
    facility_amount: num(data.facility_amount),
    currency: (data.currency as string) ?? 'USD',
    reporting_frequency: (data.reporting_frequency as string) ?? 'quarterly',
    contact_email: (data.contact_email as string) ?? '',
  }
}

export async function upsertFacility(
  projectId: string,
  data: Partial<LenderFacility>,
): Promise<{ error?: string }> {
  const actor = await getUser()
  const denied = rejectViewer(actor)
  if (denied) return denied

  const admin = createAdminClient()
  const payload = {
    lender_name: data.lender_name ?? null,
    facility_amount: data.facility_amount ?? null,
    currency: data.currency ?? 'USD',
    reporting_frequency: data.reporting_frequency ?? 'quarterly',
    contact_email: data.contact_email ?? null,
    updated_at: new Date().toISOString(),
  }

  // The unique key is (project_id, lender_name), but the app treats a project as
  // having a single facility — so update the existing project row if present,
  // otherwise insert. This lets the lender_name change without orphaning rows.
  const { data: existing } = await admin
    .from('lender_facilities')
    .select('id')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .maybeSingle()

  const { error } = existing?.id
    ? await admin.from('lender_facilities').update(payload).eq('id', existing.id)
    : await admin.from('lender_facilities').insert({ tenant_id: DEMO_TENANT, project_id: projectId, ...payload })

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/lender-report`)
  return {}
}

// ─── 2. Full report dataset ──────────────────────────────────────────────────────

export async function getLenderReportData(
  projectId: string,
  periodStart: string,
  periodEnd: string,
): Promise<LenderReportData> {
  const actor = await getUser() // reads allow viewers
  const admin = createAdminClient()

  const startMs = parseLooseDate(periodStart)
  const endMs = parseLooseDate(periodEnd)
  const inPeriod = (v: unknown): boolean => {
    const t = parseLooseDate(v)
    if (t == null) return false
    if (startMs != null && t < startMs) return false
    if (endMs != null && t > endMs) return false
    return true
  }

  // Fetch project + facility + the reusable module datasets in parallel.
  const [
    { data: projRow },
    facility,
    progress,
    sCurve,
    evm,
    payments,
    variations,
    claims,
    gateState,
  ] = await Promise.all([
    admin.from('projects')
      .select('id, name, code, technology, capacity_mw, country, location, budget_usd, health, current_phase')
      .eq('id', projectId).eq('tenant_id', DEMO_TENANT).maybeSingle(),
    getFacility(projectId),
    getProjectProgress(projectId),
    getSCurveData(projectId),
    loadFinanceEvmDashboard(),
    getPaymentCertificates(projectId),
    getVariationOrders(projectId),
    getClaims(projectId),
    getProjectGateState(projectId),
  ])

  const projectCode = (projRow?.code as string) ?? '—'

  // ── Schedule activities: completed-in-period + 30-day look-ahead ────────────
  const now = Date.now()
  const in30 = now + 30 * 24 * 60 * 60 * 1000
  const { data: acts } = await admin
    .from('schedule_activities')
    .select('name, planned_start, planned_finish, actual_finish, status, percent_complete')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const activities = acts ?? []
  const completedInPeriod = activities
    .filter((a) => {
      const done = String(a.status) === 'completed' || num(a.percent_complete) >= 100
      return done && inPeriod(a.actual_finish ?? a.planned_finish)
    })
    .map((a) => ({ name: (a.name as string) ?? 'Activity', finish: (a.actual_finish as string) ?? (a.planned_finish as string) ?? null }))

  const lookAhead30d = activities
    .filter((a) => {
      const done = String(a.status) === 'completed' || num(a.percent_complete) >= 100
      if (done) return false
      const startT = parseLooseDate(a.planned_start)
      return startT != null && startT >= now && startT <= in30
    })
    .sort((a, b) => (parseLooseDate(a.planned_start) ?? 0) - (parseLooseDate(b.planned_start) ?? 0))
    .map((a) => ({
      name: (a.name as string) ?? 'Activity',
      start: (a.planned_start as string) ?? null,
      finish: (a.planned_finish as string) ?? null,
    }))

  // ── Latest field daily report (optional; renders only when present) ─────────
  const { data: latestReportRow } = await admin
    .from('daily_reports')
    .select('report_date, workforce_count, work_performed')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .eq('status', 'submitted')
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestDailyReport = latestReportRow
    ? {
        report_date: latestReportRow.report_date as string,
        workforce_count: (latestReportRow.workforce_count as number) ?? null,
        work_performed: (latestReportRow.work_performed as string) ?? null,
      }
    : null

  // ── Cost / EVM ──────────────────────────────────────────────────────────────
  const s = evm.summary
  const cpi = s.avgCPI > 0 ? s.avgCPI : 1
  const eac = cpi > 0 ? s.totalBAC / cpi : s.totalBAC
  const cost = {
    pv: evm.evmTrend.reduce((acc, t) => acc + (t.pv ?? 0), 0),
    ev: s.totalEV,
    ac: s.totalAC,
    spi: s.avgSPI,
    cpi: s.avgCPI,
    bac: s.totalBAC,
    eac: Math.round(eac),
    vac: Math.round(s.totalBAC - eac),
    acSource: s.acSource,
    approvedVoCount: s.approvedVoCount,
  }

  // ── Payments: certificates within period ────────────────────────────────────
  const certsInPeriod = payments.rows
    .filter((r) => inPeriod(r.period_end) || inPeriod(r.period_start))
    .map((r) => ({
      pc_number: r.pc_number,
      period_start: r.period_start,
      period_end: r.period_end,
      this_period: r.this_period,
      net_amount: r.net_amount,
      status: r.status,
    }))

  // ── HSE (keyed by project_code, dates may be free-text) ──────────────────────
  const [{ data: incRows }, { data: permRows }] = await Promise.all([
    admin.from('hse_incidents')
      .select('severity, status, incident_date')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_code', projectCode),
    admin.from('hse_permits')
      .select('status, expiry_date')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_code', projectCode),
  ])

  const incidents = incRows ?? []
  const incidentsInPeriodRows = incidents.filter((i) => inPeriod(i.incident_date))
  const sevCount: Record<string, number> = {}
  for (const i of incidentsInPeriodRows) {
    const sev = (i.severity as string) ?? 'observation'
    sevCount[sev] = (sevCount[sev] ?? 0) + 1
  }
  const permits = permRows ?? []
  const permitsExpiring30d = permits.filter((p) => {
    if (String(p.status) !== 'active') return false
    const t = parseLooseDate(p.expiry_date)
    return t != null && t >= now && t <= in30
  }).length

  const hse = {
    incidentsInPeriod: incidentsInPeriodRows.length,
    incidentsBySeverity: Object.entries(sevCount).map(([severity, count]) => ({ severity, count })),
    openIncidents: incidents.filter((i) => !['closed'].includes(String(i.status))).length,
    activePermits: permits.filter((p) => String(p.status) === 'active').length,
    permitsExpiring30d,
  }

  // ── Risks: top 8 by exposure (probability × impact, text-scored) ─────────────
  const { data: riskRows } = await admin
    .from('risks')
    .select('risk_number, title, category, probability, impact, status, mitigation, owner_id')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const topRisks = (riskRows ?? [])
    .filter((r) => !['closed', 'resolved'].includes(String(r.status ?? '').toLowerCase()))
    .map((r) => ({
      risk_number: (r.risk_number as string) ?? '—',
      title: (r.title as string) ?? 'Untitled risk',
      category: (r.category as string) ?? null,
      probability: (r.probability as string) ?? null,
      impact: (r.impact as string) ?? null,
      status: (r.status as string) ?? null,
      mitigation: (r.mitigation as string) ?? null,
      owner_id: (r.owner_id as string) ?? null,
      exposure: scoreText(r.probability) * scoreText(r.impact),
    }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 8)

  // Resolve owner display names in one batched query.
  const ownerIds = [...new Set(topRisks.map((r) => r.owner_id).filter((id): id is string => !!id))]
  const ownerNames: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await admin.from('profiles').select('id, full_name').in('id', ownerIds)
    for (const o of owners ?? []) ownerNames[o.id as string] = (o.full_name as string) ?? '—'
  }
  const risks = topRisks.map(({ owner_id, ...r }) => ({
    ...r,
    owner: owner_id ? (ownerNames[owner_id] ?? null) : null,
  }))

  // ── NCRs by status (quality) ─────────────────────────────────────────────────
  const { data: ncrRows } = await admin
    .from('ncrs')
    .select('status, source')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
  const ncrCount: Record<string, number> = {}
  const ncrSevCount: Record<string, number> = { critical: 0, major: 0, minor: 0 }
  for (const n of ncrRows ?? []) {
    const st = String(n.status ?? 'open')
    ncrCount[st] = (ncrCount[st] ?? 0) + 1
    if (n.status !== 'closed') {
      const sev = n.source === 'failed_inspection' ? 'critical' : n.source === 'audit' ? 'major' : 'minor'
      ncrSevCount[sev] = (ncrSevCount[sev] ?? 0) + 1
    }
  }
  const ncrByStatus = Object.entries(ncrCount).map(([status, count]) => ({ status, count }))
  const ncrBySeverity = Object.entries(ncrSevCount)
    .filter(([, c]) => c > 0)
    .map(([severity, count]) => ({ severity, count }))

  // ── ITP completion (optional) ────────────────────────────────────────────────
  let itpCompletionPct: number | undefined
  let activePlans: number | undefined
  const { data: itpPlanRows } = await admin
    .from('itp_plans')
    .select('id, status')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
  if (itpPlanRows && itpPlanRows.length > 0) {
    activePlans = itpPlanRows.filter((p) => p.status === 'active').length
    const planIds = itpPlanRows.map((p) => p.id as string)
    const { data: actRows } = await admin
      .from('itp_activities')
      .select('status')
      .in('plan_id', planIds)
    const acts = actRows ?? []
    const completed = acts.filter((a) => ['passed', 'waived', 'failed'].includes(String(a.status ?? ''))).length
    itpCompletionPct = acts.length > 0 ? Math.round((completed / acts.length) * 100) : 0
  }

  // ── Prepared-by (current user's display name) ────────────────────────────────
  let preparedBy: string | null = null
  if (actor.userId) {
    const { data: me } = await admin.from('profiles').select('full_name').eq('id', actor.userId).maybeSingle()
    preparedBy = (me?.full_name as string) ?? null
  }

  // ── Quality: open punch items + open inspections (tickets.type) ──────────────
  const { data: qualityRows } = await admin
    .from('tickets')
    .select('type, status')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const qTickets = qualityRows ?? []
  const isOpen = (st: unknown) => !['closed', 'done', 'resolved'].includes(String(st ?? '').toLowerCase())
  const openPunchItems = qTickets.filter((t) => String(t.type ?? '').toLowerCase() === 'punch' && isOpen(t.status)).length
  const openInspections = qTickets.filter((t) => String(t.type ?? '').toLowerCase() === 'inspection' && isOpen(t.status)).length

  return {
    generatedAt: new Date().toISOString(),
    period: { start: periodStart, end: periodEnd },
    project: {
      id: (projRow?.id as string) ?? projectId,
      name: (projRow?.name as string) ?? 'Untitled project',
      code: projectCode,
      technology: (projRow?.technology as string) ?? null,
      capacity_mw: projRow?.capacity_mw == null ? null : num(projRow.capacity_mw),
      country: (projRow?.country as string) ?? null,
      location: (projRow?.location as string) ?? null,
      budget_usd: num(projRow?.budget_usd),
      health: (projRow?.health as string) ?? null,
      current_phase: num(projRow?.current_phase),
    },
    facility,
    progress: {
      overallPct: progress.percentComplete,
      completedActivities: progress.byStatus.completed,
      inProgressActivities: progress.byStatus.in_progress,
      totalActivities: progress.totalActivities,
      sCurve: sCurve.map((p) => ({ week: p.week, planned: p.planned, actual: p.actual })),
      completedInPeriod,
      lookAhead30d,
      latestDailyReport,
    },
    gates: {
      currentGate: gateState.currentGate,
      completedGates: gateState.completedGates,
      approvedThrough: gateState.approvedThrough,
      totalGates: 7,
    },
    cost,
    payments: {
      certificatesInPeriod: certsInPeriod,
      cumulativeCertified: payments.kpis.certifiedToDate,
      cumulativePaid: payments.kpis.paidToDate,
      retentionHeld: payments.kpis.retentionHeld,
      contractValue: payments.kpis.contractValue,
    },
    variations: {
      approvedValue: variations.kpis.approvedValue,
      pendingValue: variations.kpis.pendingValue,
      approvedEotDays: variations.kpis.approvedTimeImpactDays,
      totalCount: variations.kpis.totalCount,
      byStatus: variations.kpis.byStatus.map((b) => ({ name: b.name, value: b.value })),
      rows: variations.rows.map((r) => ({
        vo_number: r.vo_number,
        title: r.title,
        cost_impact: r.cost_impact,
        schedule_impact_days: r.time_impact_days,
        status: r.status,
      })),
    },
    claims: {
      totalCount: claims.rows.length,
      rows: claims.rows.map((r) => ({
        claim_number: r.claim_number,
        title: r.title,
        type: r.type,
        amount: r.amount,
        eot_days: r.eot_days,
        status: r.status,
      })),
    },
    hse,
    risks,
    quality: { openPunchItems, openInspections, ncrByStatus, ncrBySeverity: ncrBySeverity.length > 0 ? ncrBySeverity : undefined, itpCompletionPct, activePlans },
    preparedBy,
  }
}

// ─── 3. Save report snapshot ──────────────────────────────────────────────────

export async function saveLenderReport(
  projectId: string,
  periodStart: string,
  periodEnd: string,
  title: string,
): Promise<{ error?: string; id?: string }> {
  const actor = await getUser()
  const denied = rejectViewer(actor)
  if (denied) return denied

  const snapshot = await getLenderReportData(projectId, periodStart, periodEnd)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lender_reports')
    .insert({
      tenant_id: DEMO_TENANT,
      project_id: projectId,
      period_start: periodStart,
      period_end: periodEnd,
      title,
      snapshot,
      generated_by: actor.userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Fire-and-forget AI insight check: flag cost/schedule risk off the fresh snapshot.
  void maybeCreateLenderRiskInsight(projectId, snapshot.cost.cpi, snapshot.cost.spi)

  revalidatePath(`/projects/${projectId}/lender-report`)
  return { id: data?.id as string }
}

// ─── 6. Executive-summary bullets (shared by email + report body) ────────────────

/** Compose the factual executive-summary bullets from a report snapshot. */
function executiveBullets(data: LenderReportData): string[] {
  const b: string[] = []
  b.push(`Overall completion reached ${data.progress.overallPct}% by the end of the reporting period, with ${data.progress.completedActivities} of ${data.progress.totalActivities} scheduled activities complete.`)
  b.push(`The project is currently at gate ${data.gates.currentGate}, having secured approval through ${data.gates.approvedThrough} of ${data.gates.totalGates} stage gates.`)
  b.push(`Cost performance (CPI) is ${data.cost.cpi.toFixed(2)} and schedule performance (SPI) is ${data.cost.spi.toFixed(2)}.`)
  if (data.variations.totalCount > 0) {
    const approved = data.variations.byStatus.find((s) => s.name === 'approved')?.value ?? 0
    b.push(`${approved} variation order(s) approved; further variations remain pending.`)
  }
  b.push(`Health & safety: ${data.hse.openIncidents} open incident(s) and ${data.hse.activePermits} active permit(s).`)
  return b
}

// ─── 7. Email a saved report snapshot to the lender ──────────────────────────────

export async function sendLenderReportEmail(
  projectId: string,
  reportId: string,
): Promise<{ error?: string; sentTo?: string }> {
  const actor = await getUser()
  if (!actor.role || !LENDER_DISTRIBUTION_ROLES.includes(actor.role)) {
    return { error: 'You do not have permission to distribute lender reports.' }
  }

  const snapshot = await getLenderReportSnapshot(reportId)
  if (!snapshot) return { error: 'Report snapshot not found.' }

  const recipient = snapshot.facility?.contact_email || NOTIFICATION_EMAIL
  const periodLabel = `${snapshot.period.start} — ${snapshot.period.end}`
  const bullets = executiveBullets(snapshot)
  const archiveUrl = `${SITE_URL}/projects/${projectId}/lender-report?archive=${reportId}`

  const html = wrapHtml([
    heading('Lender Progress Report'),
    para(`Please find the latest lender progress report for <strong style="color:#e6f1ff">${snapshot.project.name}</strong> (${snapshot.project.code}), covering ${periodLabel}.`),
    `<ul style="margin:0 0 16px;padding-left:18px;color:#8892b0;font-size:14px;line-height:1.6">${bullets.map((x) => `<li style="margin-bottom:6px">${x}</li>`).join('')}</ul>`,
    kvTable([
      ['Project', `${snapshot.project.code} — ${snapshot.project.name}`],
      ['Reporting period', periodLabel],
      ['Overall progress', `${snapshot.progress.overallPct}%`],
      ['CPI / SPI', `${snapshot.cost.cpi.toFixed(2)} / ${snapshot.cost.spi.toFixed(2)}`],
    ]),
    btn('View full report', archiveUrl),
  ].join('\n'))

  // Fire-and-forget: a failed send must never break the caller.
  const res = await sendEmail({
    to: recipient,
    type: 'general',
    subject: `Lender Progress Report — ${snapshot.project.name} — ${periodLabel}`,
    html,
  })
  if (res.status === 'failed') return { error: res.error ?? 'Email could not be sent.' }
  return { sentTo: recipient }
}

// ─── 8. Recent reports across all projects (dashboard widget) ────────────────────

export interface RecentLenderReport {
  id: string
  title: string
  period_end: string | null
  created_at: string
  project_id: string
  project_name: string
}

export async function listRecentLenderReports(limit = 3): Promise<RecentLenderReport[]> {
  await getUser() // reads allow viewers
  const admin = createAdminClient()
  const { data } = await admin
    .from('lender_reports')
    .select('id, title, period_end, created_at, project_id')
    .eq('tenant_id', DEMO_TENANT)
    .order('created_at', { ascending: false })
    .limit(limit)

  const rows = data ?? []
  const projectIds = [...new Set(rows.map((r) => r.project_id as string).filter(Boolean))]
  const names: Record<string, string> = {}
  if (projectIds.length > 0) {
    const { data: projs } = await admin.from('projects').select('id, name').in('id', projectIds)
    for (const p of projs ?? []) names[p.id as string] = (p.name as string) ?? 'Untitled project'
  }

  return rows.map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? 'Untitled report',
    period_end: (r.period_end as string) ?? null,
    created_at: r.created_at as string,
    project_id: (r.project_id as string) ?? '',
    project_name: names[r.project_id as string] ?? 'Unknown project',
  }))
}

// ─── 4. List archived reports ──────────────────────────────────────────────────

export async function listLenderReports(projectId: string): Promise<LenderReportListItem[]> {
  await getUser() // reads allow viewers
  const admin = createAdminClient()
  const { data } = await admin
    .from('lender_reports')
    .select('id, title, period_end, created_at, generated_by')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? 'Untitled report',
    period_end: (r.period_end as string) ?? null,
    created_at: r.created_at as string,
    generated_by: (r.generated_by as string) ?? null,
  }))
}

// ─── 5. Single archived snapshot ────────────────────────────────────────────────

export async function getLenderReportSnapshot(
  reportId: string,
): Promise<LenderReportData | null> {
  await getUser() // reads allow viewers
  const admin = createAdminClient()
  const { data } = await admin
    .from('lender_reports')
    .select('snapshot')
    .eq('tenant_id', DEMO_TENANT)
    .eq('id', reportId)
    .maybeSingle()

  if (!data?.snapshot) return null
  return data.snapshot as unknown as LenderReportData
}
