'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireRole } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import { maybeCreateQualityInsight } from '@/app/actions/ai-insights'

import { getCurrentTenantId } from '@/lib/tenant'

export type InspectionType = 'HOLD' | 'WITNESS' | 'SURVEILLANCE' | 'REVIEW'
export type ActivityStatus = 'pending' | 'passed' | 'failed' | 'waived'
export type PlanStatus = 'draft' | 'active' | 'complete' | 'void'

// ── DB ↔ app value mapping ───────────────────────────────────────────────────
// The DB stores inspection_type/status as lowercase text under CHECK constraints
// (hold|witness|surveillance|review) and plan status as (draft|active|completed|
// superseded). The app/UI layer uses the uppercase / short forms above. These
// helpers normalize at the DB boundary so neither side has to change.

const INSPECTION_TO_DB: Record<InspectionType, string> = {
  HOLD: 'hold', WITNESS: 'witness', SURVEILLANCE: 'surveillance', REVIEW: 'review',
}
function inspectionToApp(dbValue: unknown): InspectionType {
  switch (String(dbValue ?? '').toLowerCase()) {
    case 'hold': return 'HOLD'
    case 'witness': return 'WITNESS'
    case 'surveillance': return 'SURVEILLANCE'
    default: return 'REVIEW'
  }
}
const PLAN_STATUS_TO_DB: Record<PlanStatus, string> = {
  draft: 'draft', active: 'active', complete: 'completed', void: 'superseded',
}
function planStatusToApp(dbValue: unknown): PlanStatus {
  switch (String(dbValue ?? '').toLowerCase()) {
    case 'active': return 'active'
    case 'completed': return 'complete'
    case 'superseded': return 'void'
    default: return 'draft'
  }
}

export interface ItpActivity {
  id: string
  plan_id: string
  seq: number
  description: string
  inspection_type: InspectionType
  reference_doc: string | null
  responsible: string | null
  status: ActivityStatus
  result_date: string | null
  notes: string | null
}

export interface ItpPlan {
  id: string
  project_id: string
  tenant_id: string
  itp_no: string
  title: string
  work_package: string | null
  discipline: string | null
  status: PlanStatus
  created_at: string
  updated_at: string
  activities: ItpActivity[]
  completion_pct: number
}

export interface ItpKpis {
  active_plans: number
  hold_points_pending: number
  open_ncrs: number          // from ncrs table, non-closed
  critical_or_major_ncrs: number // from_inspection source = critical proxy
  pass_rate_pct: number      // passed / (passed + failed) across all activities
}

export interface ItpDashboard {
  kpis: ItpKpis
  plans: ItpPlan[]
}

// ── helpers ────────────────────────────────────────────────────────────────

function mapPlan(row: Record<string, unknown>, activities: ItpActivity[]): ItpPlan {
  const acts = activities.filter(a => a.plan_id === (row.id as string))
  const completed = acts.filter(a => a.status === 'passed' || a.status === 'waived' || a.status === 'failed').length
  const completion_pct = acts.length ? Math.round((completed / acts.length) * 100) : 0
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    tenant_id: row.tenant_id as string,
    itp_no: row.itp_no as string,
    title: row.title as string,
    work_package: (row.work_package as string) ?? null,
    discipline: (row.discipline as string) ?? null,
    status: planStatusToApp(row.status),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    activities: acts.sort((a, b) => a.seq - b.seq),
    completion_pct,
  }
}

function mapActivity(row: Record<string, unknown>): ItpActivity {
  return {
    id: row.id as string,
    // DB FK column is itp_id; expose it as plan_id to keep the app-facing shape.
    plan_id: row.itp_id as string,
    seq: row.seq as number,
    description: row.description as string,
    inspection_type: inspectionToApp(row.inspection_type),
    reference_doc: (row.reference_doc as string) ?? null,
    responsible: (row.responsible as string) ?? null,
    status: (row.status as ActivityStatus) ?? 'pending',
    result_date: (row.result_date as string) ?? null,
    notes: (row.notes as string) ?? null,
  }
}

// ── read functions ─────────────────────────────────────────────────────────

export async function getItpDashboard(projectId: string): Promise<ItpDashboard> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  const [plansRes, ncrsRes] = await Promise.all([
    admin
      .from('itp_plans')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    admin
      .from('ncrs')
      .select('id, status, source, raised_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId),
  ])

  // Fetch activities for the resolved plan ids (FK column is itp_id).
  const planIds = (plansRes.data ?? []).map((p: Record<string, unknown>) => p.id as string)
  const activities: ItpActivity[] = planIds.length
    ? ((await admin
        .from('itp_activities')
        .select('*')
        .in('itp_id', planIds)
        .order('seq', { ascending: true })).data ?? []).map(r => mapActivity(r as Record<string, unknown>))
    : []

  const plans = (plansRes.data ?? []).map(r => mapPlan(r as Record<string, unknown>, activities))

  // KPIs
  const ncrs = ncrsRes.data ?? []
  const openNcrs = ncrs.filter((r: Record<string, unknown>) => r.status !== 'closed').length
  // Use source='failed_inspection' as the "critical/major" proxy (most severe NCR origin)
  const criticalNcrs = ncrs.filter(
    (r: Record<string, unknown>) => r.status !== 'closed' && r.source === 'failed_inspection',
  ).length

  const allActivities = activities
  const passed = allActivities.filter(a => a.status === 'passed' || a.status === 'waived').length
  const resolved = allActivities.filter(a => a.status === 'passed' || a.status === 'waived' || a.status === 'failed').length
  const passRatePct = resolved > 0 ? Math.round((passed / resolved) * 100) : 0

  const holdPending = allActivities.filter(
    a => a.inspection_type === 'HOLD' && a.status === 'pending',
  ).length

  const activePlans = plans.filter(p => p.status === 'active').length

  const kpis: ItpKpis = {
    active_plans: activePlans,
    hold_points_pending: holdPending,
    open_ncrs: openNcrs,
    critical_or_major_ncrs: criticalNcrs,
    pass_rate_pct: passRatePct,
  }

  // Fire-and-forget quality AI insight check.
  const openCriticalNcrs = (ncrsRes.data ?? []).filter(
    (r: Record<string, unknown>) => r.status !== 'closed' && r.source === 'failed_inspection',
  )
  const oldestCriticalDays = openCriticalNcrs.reduce((max: number, r: Record<string, unknown>) => {
    const days = Math.max(0, Math.floor((Date.now() - new Date(r.raised_at as string).getTime()) / 86_400_000))
    return Math.max(max, days)
  }, 0)
  void maybeCreateQualityInsight(projectId, passRatePct, resolved, oldestCriticalDays)

  return { kpis, plans }
}

export async function getItpPlan(planId: string): Promise<ItpPlan | null> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()
  const [planRes, actsRes] = await Promise.all([
    admin.from('itp_plans').select('*').eq('id', planId).eq('tenant_id', tenantId).maybeSingle(),
    admin.from('itp_activities').select('*').eq('itp_id', planId).order('seq', { ascending: true }),
  ])
  if (!planRes.data) return null
  const activities = (actsRes.data ?? []).map(r => mapActivity(r as Record<string, unknown>))
  return mapPlan(planRes.data as Record<string, unknown>, activities)
}

// ── mutations ──────────────────────────────────────────────────────────────

export async function createItpPlan(input: {
  projectId: string
  title: string
  work_package?: string
  discipline?: string
  activities: Array<{
    description: string
    inspection_type: InspectionType
    reference_doc?: string
    responsible?: string
  }>
}): Promise<{ error?: string; id?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()

  // Auto-number: ITP-001 style, scoped to project
  const { count } = await admin
    .from('itp_plans')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', input.projectId)
    .eq('tenant_id', tenantId)

  const itp_no = `ITP-${String((count ?? 0) + 1).padStart(3, '0')}`

  const { data: plan, error } = await admin
    .from('itp_plans')
    .insert({
      project_id: input.projectId,
      tenant_id: tenantId,
      itp_no,
      title: input.title,
      work_package: input.work_package ?? null,
      discipline: input.discipline ?? null,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !plan) return { error: error?.message ?? 'Failed to create ITP plan' }

  if (input.activities.length > 0) {
    const rows = input.activities.map((a, i) => ({
      itp_id: plan.id,
      tenant_id: tenantId,
      seq: i + 1,
      description: a.description,
      inspection_type: INSPECTION_TO_DB[a.inspection_type] ?? 'review',
      reference_doc: a.reference_doc ?? null,
      responsible: a.responsible ?? null,
      status: 'pending' as ActivityStatus,
    }))
    const { error: actErr } = await admin.from('itp_activities').insert(rows)
    if (actErr) return { error: actErr.message }
  }

  return { id: plan.id }
}

/** Roles permitted to sign off (pass) a HOLD-point activity. */
const HOLD_SIGNOFF_ROLES = [
  'system_admin', 'tenant_admin', 'project_director',
  'project_manager', 'hse_manager', 'commissioning_manager',
] as const

/**
 * Record an inspection result on an ITP activity.
 *  - passed / failed / waived with a result_date.
 *  - HOLD POINT RULE: a 'hold' activity can only be marked `passed` by a role
 *    at hse_manager / project_manager / tenant_admin level or above.
 *  - When a HOLD activity FAILS, an NCR is auto-created (open, source
 *    'failed_inspection', title from the activity description).
 */
export async function recordInspectionResult(
  activityId: string,
  status: Exclude<ActivityStatus, 'pending'>,
  notes?: string,
): Promise<{ error?: string; ncrId?: string }> {
  const admin = createAdminClient()

  // Resolve the activity + its parent plan/project (FK column is itp_id).
  const { data: act } = await admin
    .from('itp_activities')
    .select('id, itp_id, description, inspection_type')
    .eq('id', activityId)
    .maybeSingle()
  if (!act) return { error: 'Inspection activity not found' }

  const isHold = String(act.inspection_type ?? '').toLowerCase() === 'hold'

  // Authorization. Passing a hold point requires elevated sign-off authority;
  // every other write requires a non-viewer writer.
  if (isHold && status === 'passed') {
    const gate = await requireRole(HOLD_SIGNOFF_ROLES)
    if ('error' in gate) {
      return { error: 'Only a Project Manager, HSE Manager, or higher can sign off a hold point' }
    }
  } else {
    const gate = await requireWriter()
    if ('error' in gate) return gate
  }

  const { error } = await admin
    .from('itp_activities')
    .update({
      status,
      notes: notes ?? null,
      result_date: new Date().toISOString().slice(0, 10),
    })
    .eq('id', activityId)
  if (error) return { error: error.message }

  // Auto-raise an NCR when a hold point fails.
  let ncrId: string | undefined
  if (isHold && status === 'failed') {
    const { data: plan } = await admin
      .from('itp_plans')
      .select('project_id, tenant_id')
      .eq('id', act.itp_id as string)
      .maybeSingle()
    if (plan) {
      const projectId = plan.project_id as string
      const tenantId = plan.tenant_id as string
      const { count } = await admin
        .from('ncrs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId)
      const ncr_number = `NCR-${String((count ?? 0) + 1).padStart(3, '0')}`
      const { data: ncr } = await admin
        .from('ncrs')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          ncr_number,
          title: `Failed hold point: ${act.description as string}`,
          description: notes ?? null,
          source: 'failed_inspection',
          status: 'open',
          cycle: 1,
          reinspection_passed: false,
        })
        .select('id')
        .maybeSingle()
      ncrId = (ncr as Record<string, unknown> | null)?.id as string | undefined
      revalidatePath(`/projects/${projectId}/quality`)
      revalidatePath(`/projects/${projectId}/g5`)
    }
  }

  return ncrId ? { ncrId } : {}
}

/**
 * Backwards-compatible wrapper kept for the existing ITP dashboard component.
 * Delegates to recordInspectionResult (which enforces the hold-point rule and
 * auto-raises NCRs). A 'pending' reset simply clears the result.
 */
export async function updateActivityResult(
  activityId: string,
  result: { status: ActivityStatus; notes?: string },
): Promise<{ error?: string }> {
  if (result.status === 'pending') {
    const gate = await requireWriter()
    if ('error' in gate) return gate
    const admin = createAdminClient()
    const { error } = await admin
      .from('itp_activities')
      .update({ status: 'pending', notes: result.notes ?? null, result_date: null })
      .eq('id', activityId)
    return error ? { error: error.message } : {}
  }
  const res = await recordInspectionResult(activityId, result.status, result.notes)
  return 'error' in res && res.error ? { error: res.error } : {}
}

export async function activateItpPlan(planId: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const admin = createAdminClient()
  const { error } = await admin
    .from('itp_plans')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('tenant_id', tenantId)
  return error ? { error: error.message } : {}
}

/**
 * Complete an ITP plan. Only allowed when NO activity is still 'pending'
 * (i.e. every inspection has a recorded result). DB status = 'completed'.
 */
export async function completeItpPlan(planId: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const admin = createAdminClient()

  const { count: pendingCount } = await admin
    .from('itp_activities')
    .select('id', { count: 'exact', head: true })
    .eq('itp_id', planId)
    .eq('status', 'pending')
  if ((pendingCount ?? 0) > 0) {
    return { error: 'Cannot complete: some activities are still pending an inspection result' }
  }

  const { error } = await admin
    .from('itp_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('tenant_id', tenantId)
  return error ? { error: error.message } : {}
}

export async function voidItpPlan(planId: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireRole(['system_admin', 'tenant_admin', 'project_director'])
  if ('error' in gate) return gate
  const admin = createAdminClient()
  const { error } = await admin
    .from('itp_plans')
    // DB CHECK allows draft|active|completed|superseded — 'void' maps to superseded.
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('tenant_id', tenantId)
  return error ? { error: error.message } : {}
}

export async function seedItpDemoData(projectId: string): Promise<{ error?: string; seeded?: boolean }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const admin = createAdminClient()
  const { count } = await admin
    .from('itp_plans')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
  if ((count ?? 0) > 0) return { seeded: false }

  const plans = [
    {
      itp_no: 'ITP-001', title: 'Pile Foundation Inspection', work_package: 'Civil',
      discipline: 'Structural', status: 'active' as PlanStatus,
      activities: [
        { seq: 1, description: 'Pile boring location survey', inspection_type: 'REVIEW' as InspectionType, responsible: 'Civil Engineer', reference_doc: 'DWG-C-001', status: 'passed' as ActivityStatus, result_date: '2026-06-15' },
        { seq: 2, description: 'Steel reinforcement placement', inspection_type: 'WITNESS' as InspectionType, responsible: 'Site Supervisor', reference_doc: null, status: 'passed' as ActivityStatus, result_date: '2026-06-18' },
        { seq: 3, description: 'Concrete pour — hold for sign-off', inspection_type: 'HOLD' as InspectionType, responsible: 'Project Manager', reference_doc: 'SPEC-STR-02', status: 'pending' as ActivityStatus, result_date: null },
        { seq: 4, description: 'Post-pour cube test results', inspection_type: 'REVIEW' as InspectionType, responsible: 'QA Engineer', reference_doc: null, status: 'pending' as ActivityStatus, result_date: null },
      ],
    },
    {
      itp_no: 'ITP-002', title: 'HV Cable Installation', work_package: 'Electrical',
      discipline: 'Electrical', status: 'active' as PlanStatus,
      activities: [
        { seq: 1, description: 'Cable drum receipt inspection', inspection_type: 'SURVEILLANCE' as InspectionType, responsible: 'Electrical Engineer', reference_doc: 'SPEC-EL-10', status: 'passed' as ActivityStatus, result_date: '2026-07-01' },
        { seq: 2, description: 'Trench depth & bedding', inspection_type: 'WITNESS' as InspectionType, responsible: 'Site Supervisor', reference_doc: null, status: 'failed' as ActivityStatus, result_date: '2026-07-05' },
        { seq: 3, description: 'Cable pull & termination', inspection_type: 'HOLD' as InspectionType, responsible: 'Commissioning Manager', reference_doc: 'SPEC-EL-12', status: 'pending' as ActivityStatus, result_date: null },
      ],
    },
    {
      itp_no: 'ITP-003', title: 'BESS Module Installation', work_package: 'Mechanical',
      discipline: 'BESS', status: 'draft' as PlanStatus,
      activities: [
        { seq: 1, description: 'Module unboxing visual inspection', inspection_type: 'SURVEILLANCE' as InspectionType, responsible: 'OEM Rep', reference_doc: 'OEM-ITP-001', status: 'pending' as ActivityStatus, result_date: null },
        { seq: 2, description: 'Torque check on bus-bar connections', inspection_type: 'WITNESS' as InspectionType, responsible: 'Commissioning Manager', reference_doc: null, status: 'pending' as ActivityStatus, result_date: null },
        { seq: 3, description: 'Cell voltage pre-charge hold', inspection_type: 'HOLD' as InspectionType, responsible: 'Project Director', reference_doc: 'SPEC-BESS-07', status: 'pending' as ActivityStatus, result_date: null },
        { seq: 4, description: 'Thermal imaging sign-off', inspection_type: 'REVIEW' as InspectionType, responsible: 'QA Engineer', reference_doc: null, status: 'pending' as ActivityStatus, result_date: null },
      ],
    },
  ]

  for (const p of plans) {
    const { data: plan } = await admin
      .from('itp_plans')
      .insert({ project_id: projectId, tenant_id: tenantId, itp_no: p.itp_no, title: p.title, work_package: p.work_package, discipline: p.discipline, status: PLAN_STATUS_TO_DB[p.status] })
      .select('id')
      .single()
    if (!plan) continue
    await admin.from('itp_activities').insert(
      p.activities.map(a => ({
        itp_id: plan.id, tenant_id: tenantId,
        seq: a.seq, description: a.description, inspection_type: INSPECTION_TO_DB[a.inspection_type],
        reference_doc: a.reference_doc ?? null, responsible: a.responsible ?? null,
        status: a.status, result_date: a.result_date ?? null,
      }))
    )
  }

  return { seeded: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// NCR REGISTER  (thin view layer on top of the existing ncrs table)
// ═══════════════════════════════════════════════════════════════════════════

export type NcrSeverity = 'critical' | 'major' | 'minor'
export type NcrCategory = 'failed_inspection' | 'audit' | 'site_observation'
export type QualityNcrStatus = 'open' | 'in_rectification' | 're_inspection' | 'closed'

/** Severity is derived from source — the ncrs table has no dedicated column. */
function deriveSeverity(source: string): NcrSeverity {
  if (source === 'failed_inspection') return 'critical'
  if (source === 'audit') return 'major'
  return 'minor'
}

/** Days between raised_at and now (or closed_at when closed). */
function ncrDaysOpen(raisedAt: string, status: string, closedAt: string | null): number {
  const end = status === 'closed' && closedAt ? new Date(closedAt).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(raisedAt).getTime()) / 86400000))
}

export interface QualityNcr {
  id: string
  ncr_number: string
  title: string
  description: string | null
  /** Maps to source column — free text category label */
  category: NcrCategory
  severity: NcrSeverity
  status: QualityNcrStatus
  root_cause: string | null
  /** disposition = closure_note (required to close per existing state machine) */
  disposition: string | null
  /** Estimated cost impact in USD (nullable — no value recorded yet) */
  cost_impact: number | null
  raised_at: string
  closed_at: string | null
  days_open: number
  /** Aging bucket derived from days_open (only set when status != 'closed') */
  aging: 'none' | 'amber' | 'red'
  /** ITP activity that caused this NCR (if auto-created from a failed HOLD point) */
  linked_activity_id: string | null
}

export interface QualityNcrRegister {
  rows: QualityNcr[]
  open_count: number
  critical_count: number
}

function mapNcrRow(r: Record<string, unknown>): QualityNcr {
  const status = (r.status as string) ?? 'open'
  const raisedAt = (r.raised_at as string) ?? (r.created_at as string)
  const closedAt = (r.closed_at as string | null) ?? null
  const daysOpen = ncrDaysOpen(raisedAt, status, closedAt)
  const isOpen = status !== 'closed'
  const aging: QualityNcr['aging'] = !isOpen ? 'none' : daysOpen > 30 ? 'red' : daysOpen > 14 ? 'amber' : 'none'
  const source = (r.source as string) ?? 'site_observation'
  return {
    id: r.id as string,
    ncr_number: r.ncr_number as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    category: source as NcrCategory,
    // Explicit severity wins; fall back to the category-derived value.
    severity: (r.severity as NcrSeverity | null) ?? deriveSeverity(source),
    status: status as QualityNcrStatus,
    root_cause: (r.root_cause as string | null) ?? null,
    disposition: (r.closure_note as string | null) ?? null,
    cost_impact: r.cost_impact != null ? Number(r.cost_impact) : null,
    raised_at: raisedAt,
    closed_at: closedAt,
    days_open: daysOpen,
    aging,
    linked_activity_id: null, // populated below when available
  }
}

export async function getNcrRegister(projectId: string): Promise<QualityNcrRegister> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ncrs')
    .select('id, ncr_number, title, description, source, severity, cost_impact, root_cause, corrective_action, closure_note, status, raised_at, closed_at, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('ncr_number', { ascending: true })

  const rows = (error || !data ? [] : data).map(r => mapNcrRow(r as Record<string, unknown>))
  const open_count = rows.filter(r => r.status !== 'closed').length
  const critical_count = rows.filter(r => r.status !== 'closed' && r.severity === 'critical').length
  return { rows, open_count, critical_count }
}

export async function createNcr(input: {
  projectId: string
  title: string
  category: NcrCategory
  severity?: NcrSeverity
  cost_impact?: number
  description?: string
}): Promise<{ error?: string; id?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()
  const { error, data } = await admin
    .from('ncrs')
    .insert({
      project_id: input.projectId,
      tenant_id: tenantId,
      title: input.title,
      source: input.category,
      // Explicit severity wins; otherwise derive from the category.
      severity: input.severity ?? deriveSeverity(input.category),
      cost_impact:
        input.cost_impact != null && !Number.isNaN(input.cost_impact)
          ? input.cost_impact
          : null,
      description: input.description ?? null,
      status: 'open',
      cycle: 1,
      reinspection_passed: false,
    })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create NCR' }
  revalidatePath(`/projects/${input.projectId}/quality`)
  revalidatePath(`/projects/${input.projectId}/g5`)
  return { id: (data as Record<string, unknown>).id as string }
}

/**
 * Set root_cause + disposition (stored in closure_note) — a prerequisite to
 * closing the NCR. Any supplied cost impact is persisted to the dedicated
 * cost_impact column.
 */
export type NcrDisposition = 'rework' | 'repair' | 'use_as_is' | 'scrap'

export async function setNcrDisposition(
  ncrId: string,
  input: { root_cause: string; disposition: string; cost_impact?: number },
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  const patch: Record<string, unknown> = {
    root_cause: input.root_cause,
    closure_note: input.disposition,
    updated_at: new Date().toISOString(),
  }
  if (input.cost_impact != null && !Number.isNaN(input.cost_impact)) {
    patch.cost_impact = input.cost_impact
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ncrs')
    .update(patch)
    .eq('id', ncrId)
    .eq('tenant_id', tenantId)

  return error ? { error: error.message } : {}
}

/**
 * Advance NCR status. The spec's open → in_progress → closed lifecycle maps
 * onto the real ncr_status enum (open | in_rectification | re_inspection |
 * closed): 'in_progress' → 'in_rectification'. Closing requires that a root
 * cause AND disposition (closure_note) have already been recorded.
 */
export async function updateNcrStatus(
  ncrId: string,
  status: 'open' | 'in_progress' | 'in_rectification' | 're_inspection' | 'closed',
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  const dbStatus = status === 'in_progress' ? 'in_rectification' : status

  if (dbStatus === 'closed') {
    const { data: ncr } = await admin
      .from('ncrs')
      .select('root_cause, closure_note, project_id')
      .eq('id', ncrId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!ncr) return { error: 'NCR not found' }
    if (!ncr.root_cause || !ncr.closure_note) {
      return { error: 'Cannot close: record a root cause and disposition first' }
    }
  }

  const { error } = await admin
    .from('ncrs')
    .update({
      status: dbStatus,
      closed_at: dbStatus === 'closed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ncrId)
    .eq('tenant_id', tenantId)

  return error ? { error: error.message } : {}
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY DASHBOARD  (combined ITP completion + hold points + NCR stats)
// ═══════════════════════════════════════════════════════════════════════════

export interface QualityDashboard {
  plans: Array<{
    id: string
    itp_no: string
    title: string
    status: PlanStatus
    passed: number
    total: number
    completion_pct: number
  }>
  hold_points_pending: number
  ncr: {
    open_by_severity: { critical: number; major: number; minor: number }
    open_total: number
    closed_this_month: number
  }
}

export async function getQualityDashboard(projectId: string): Promise<QualityDashboard> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  const { data: planRows } = await admin
    .from('itp_plans')
    .select('id, itp_no, title, status')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('itp_no', { ascending: true })

  const planIds = (planRows ?? []).map(p => p.id as string)
  const { data: actRows } = planIds.length
    ? await admin
        .from('itp_activities')
        .select('itp_id, inspection_type, status')
        .in('itp_id', planIds)
    : { data: [] as Record<string, unknown>[] }

  const acts = (actRows ?? []) as Record<string, unknown>[]

  const plans = (planRows ?? []).map(p => {
    const mine = acts.filter(a => a.itp_id === p.id)
    const passed = mine.filter(a => a.status === 'passed').length
    const total = mine.length
    return {
      id: p.id as string,
      itp_no: p.itp_no as string,
      title: p.title as string,
      status: planStatusToApp(p.status),
      passed,
      total,
      completion_pct: total ? Math.round((passed / total) * 100) : 0,
    }
  })

  // Hold points pending = 'hold' activities still 'pending'.
  const hold_points_pending = acts.filter(
    a => String(a.inspection_type ?? '').toLowerCase() === 'hold' && a.status === 'pending',
  ).length

  // NCR stats.
  const { data: ncrRows } = await admin
    .from('ncrs')
    .select('source, status, closed_at')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)

  const ncrs = (ncrRows ?? []) as Record<string, unknown>[]
  const open = ncrs.filter(n => n.status !== 'closed')
  const open_by_severity = { critical: 0, major: 0, minor: 0 }
  for (const n of open) {
    open_by_severity[deriveSeverity(String(n.source ?? 'site_observation'))] += 1
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const closed_this_month = ncrs.filter(
    n => n.status === 'closed' && n.closed_at && new Date(n.closed_at as string).getTime() >= monthStart,
  ).length

  return {
    plans,
    hold_points_pending,
    ncr: { open_by_severity, open_total: open.length, closed_this_month },
  }
}
