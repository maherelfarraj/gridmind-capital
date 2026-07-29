'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/auth/guard'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export const COST_CATEGORIES = [
  'engineering', 'procurement', 'subcontracts', 'construction', 'overhead', 'contingency',
] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

/** Realistic EPC solar cost-weighting used to seed the first month's budget baseline from project capex. */
const BASELINE_WEIGHTS: Record<CostCategory, number> = {
  engineering: 0.08,
  procurement: 0.45,
  subcontracts: 0.12,
  construction: 0.25,
  overhead: 0.06,
  contingency: 0.04,
}

export interface CostEntry {
  id: string
  project_id: string
  period: string
  category: CostCategory
  budgeted_amount: number
  actual_amount: number
}

export interface CostControlSummary {
  baselineBudget: number      // projects.budget_usd (capex baseline)
  approvedVoTotal: number     // sum of approved variation_orders.cost_impact
  adjustedBudget: number      // baseline + approved VOs
  cumulativeBudgeted: number  // sum of all budgeted_amount
  cumulativeActual: number    // sum of all actual_amount
  cumulativeVariance: number  // actual - budgeted
  pctBudgetConsumed: number   // cumulativeActual / adjustedBudget * 100
  pctDeliverablesComplete: number // approved phase_gates / total * 100
  marginErosionRisk: boolean  // budget consumed exceeds deliverables complete by > 10 pts
}

export interface MonthChartPoint {
  period: string
  budget: number   // cumulative budgeted up to & including this period
  actual: number   // cumulative actual up to & including this period
}

export interface CostControlData {
  projectName: string
  currency: string
  periods: string[]                         // sorted ascending 'YYYY-MM'
  entries: CostEntry[]
  summary: CostControlSummary
  chart: MonthChartPoint[]
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
  return role !== null && WRITER_ROLES.includes(role)
}

async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  projectId: string; to: string; transition: string; actorId: string | null
  comment?: string; metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: null,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: { module: 'cost_control', project_id: args.projectId, ...args.metadata },
  })
}

function num(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/cost-control`)
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function loadCostControl(projectId: string): Promise<CostControlData> {
  const admin = createAdminClient()
  const actor = await getActor()

  const [projectRes, entriesRes, voRes, gatesRes] = await Promise.all([
    admin.from('projects').select('name, budget_usd').eq('id', projectId).single(),
    admin.from('cost_entries').select('*').eq('project_id', projectId),
    admin.from('variation_orders').select('cost_impact, status').eq('project_id', projectId).eq('status', 'approved'),
    admin.from('phase_gates').select('status').eq('project_id', projectId),
  ])

  const baselineBudget = num(projectRes.data?.budget_usd)
  const approvedVoTotal = (voRes.data ?? []).reduce((s, v) => s + num(v.cost_impact), 0)
  const adjustedBudget = baselineBudget + approvedVoTotal

  const entries: CostEntry[] = (entriesRes.data ?? []).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    period: r.period,
    category: r.category,
    budgeted_amount: num(r.budgeted_amount),
    actual_amount: num(r.actual_amount),
  }))

  const periods = [...new Set(entries.map((e) => e.period))].sort()

  const cumulativeBudgeted = entries.reduce((s, e) => s + e.budgeted_amount, 0)
  const cumulativeActual = entries.reduce((s, e) => s + e.actual_amount, 0)
  const cumulativeVariance = cumulativeActual - cumulativeBudgeted
  const pctBudgetConsumed = adjustedBudget > 0 ? (cumulativeActual / adjustedBudget) * 100 : 0

  // Deliverable/phase completion proxy: approved phase gates / total gates
  const gates = gatesRes.data ?? []
  const approvedGates = gates.filter((g) => g.status === 'approved').length
  const pctDeliverablesComplete = gates.length > 0 ? (approvedGates / gates.length) * 100 : 0

  const marginErosionRisk = pctBudgetConsumed - pctDeliverablesComplete > 10

  // Cumulative budget vs actual per month
  const chart: MonthChartPoint[] = []
  let runBudget = 0
  let runActual = 0
  for (const p of periods) {
    const monthEntries = entries.filter((e) => e.period === p)
    runBudget += monthEntries.reduce((s, e) => s + e.budgeted_amount, 0)
    runActual += monthEntries.reduce((s, e) => s + e.actual_amount, 0)
    chart.push({ period: p, budget: runBudget, actual: runActual })
  }

  return {
    projectName: projectRes.data?.name ?? 'Project',
    currency: 'USD',
    periods,
    entries,
    summary: {
      baselineBudget,
      approvedVoTotal,
      adjustedBudget,
      cumulativeBudgeted,
      cumulativeActual,
      cumulativeVariance,
      pctBudgetConsumed,
      pctDeliverablesComplete,
      marginErosionRisk,
    },
    chart,
    canEdit: canWrite(actor.role),
  }
}

// ─────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────

/** Update a single cell (budgeted or actual) for a category/period. */
export async function saveCostEntry(args: {
  projectId: string
  period: string
  category: CostCategory
  budgeted_amount: number
  actual_amount: number
}): Promise<ActionResult<CostEntry>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to edit cost entries.' }
  if (!/^\d{4}-\d{2}$/.test(args.period)) return { error: 'Period must be in YYYY-MM format.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cost_entries')
    .upsert(
      {
        project_id: args.projectId,
        tenant_id: actor.tenantId,
        period: args.period,
        category: args.category,
        budgeted_amount: args.budgeted_amount,
        actual_amount: args.actual_amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,period,category' },
    )
    .select('*')
    .single()

  if (error) return { error: error.message }

  await logEvent(admin, {
    projectId: args.projectId,
    to: 'updated',
    transition: 'COST_ENTRY_SAVED',
    actorId: actor.userId,
    comment: `${args.category} / ${args.period}`,
    metadata: {
      period: args.period,
      category: args.category,
      budgeted_amount: args.budgeted_amount,
      actual_amount: args.actual_amount,
    },
  })

  revalidate(args.projectId)
  return {
    data: {
      id: data.id,
      project_id: data.project_id,
      period: data.period,
      category: data.category,
      budgeted_amount: num(data.budgeted_amount),
      actual_amount: num(data.actual_amount),
    },
  }
}

/**
 * Create a new period column. Budgeted amounts are pre-filled from the budget baseline:
 * the most recent existing period's budgeted values are carried forward; if this is the
 * first period, the project capex (budget_usd) is distributed across categories by EPC weight.
 * Actuals start at 0.
 */
export async function addCostPeriod(args: { projectId: string; period: string }): Promise<ActionResult<{ period: string }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to add periods.' }
  if (!/^\d{4}-\d{2}$/.test(args.period)) return { error: 'Period must be in YYYY-MM format.' }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('cost_entries').select('period, category, budgeted_amount').eq('project_id', args.projectId)

  if ((existing ?? []).some((e) => e.period === args.period)) {
    return { error: `Period ${args.period} already exists.` }
  }

  // Determine baseline budgeted amounts per category
  const periods = [...new Set((existing ?? []).map((e) => e.period))].sort()
  const latest = periods[periods.length - 1]

  let budgetByCategory: Record<CostCategory, number>
  if (latest) {
    // carry forward the most recent month's budget
    budgetByCategory = COST_CATEGORIES.reduce((acc, c) => {
      const row = (existing ?? []).find((e) => e.period === latest && e.category === c)
      acc[c] = num(row?.budgeted_amount)
      return acc
    }, {} as Record<CostCategory, number>)
  } else {
    // first month: distribute project capex baseline by EPC weighting
    const { data: proj } = await admin.from('projects').select('budget_usd').eq('id', args.projectId).single()
    const capex = num(proj?.budget_usd)
    budgetByCategory = COST_CATEGORIES.reduce((acc, c) => {
      acc[c] = Math.round(capex * BASELINE_WEIGHTS[c])
      return acc
    }, {} as Record<CostCategory, number>)
  }

  const rows = COST_CATEGORIES.map((c) => ({
    project_id: args.projectId,
    tenant_id: actor.tenantId,
    period: args.period,
    category: c,
    budgeted_amount: budgetByCategory[c],
    actual_amount: 0,
  }))

  const { error } = await admin.from('cost_entries').insert(rows)
  if (error) return { error: error.message }

  await logEvent(admin, {
    projectId: args.projectId,
    to: 'created',
    transition: 'COST_PERIOD_ADDED',
    actorId: actor.userId,
    comment: `Added period ${args.period}`,
    metadata: { period: args.period, prefilled_from: latest ?? 'capex_baseline' },
  })

  revalidate(args.projectId)
  return { data: { period: args.period } }
}

/** Record a CSV export to the shared audit trail. */
export async function logCostExport(args: { projectId: string; rowCount: number; period?: string }): Promise<ActionResult> {
  const actor = await getActor()
  const admin = createAdminClient()
  await logEvent(admin, {
    projectId: args.projectId,
    to: 'exported',
    transition: 'COST_CONTROL_EXPORTED',
    actorId: actor.userId,
    comment: `Exported ${args.rowCount} cost rows to CSV`,
    metadata: { row_count: args.rowCount, period: args.period ?? 'all', exported_by: actor.fullName },
  })
  return {}
}
