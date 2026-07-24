'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthActor, requireWriter } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResourceMonth {
  /** ISO first-of-month string, e.g. "2025-01" (YYYY-MM) */
  month: string
  /** Human-readable label e.g. "Jan 25" */
  label: string
  /** Planned workforce headcount from resource_plan */
  plannedWorkforce: number
  /** Planned equipment units from resource_plan */
  plannedEquipment: number
  /** Average workforce_count from daily_reports that month (null = no data) */
  actualWorkforce: number | null
  /** Average equipment_count from daily_reports that month (null = no data) */
  actualEquipment: number | null
}

export interface ResourceHistogram {
  months: ResourceMonth[]
  peakPlannedWorkforce: { value: number; month: string } | null
  peakActualWorkforce:  { value: number; month: string } | null
  peakPlannedEquipment: { value: number; month: string } | null
  peakActualEquipment:  { value: number; month: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a Date → "YYYY-MM" key */
function toMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Format a "YYYY-MM" key → short label e.g. "Jan 25" */
function labelFromKey(key: string): string {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── getResourceHistogram ─────────────────────────────────────────────────────

/**
 * Returns per-month planned vs actual workforce and equipment counts for
 * the past `months` months (default 12), ending with the current month.
 *
 * Read-only — accessible to any authenticated user.
 */
export async function getResourceHistogram(
  projectId: string,
  months = 12,
): Promise<ResourceHistogram> {
  const auth = await getAuthActor()
  if ('error' in auth) {
    return { months: [], peakPlannedWorkforce: null, peakActualWorkforce: null, peakPlannedEquipment: null, peakActualEquipment: null }
  }

  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  // ── Build the month range (oldest → newest) ────────────────────────────────
  const now       = new Date()
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
  const endDate   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)) // last day of current month

  const monthKeys: string[] = []
  const cur = new Date(startDate)
  while (cur <= endDate) {
    monthKeys.push(toMonthKey(cur))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }

  // ── Fetch planned data (resource_plan) ────────────────────────────────────
  const startIso = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-01`
  const endIso   = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`

  const { data: planRows } = await supabase
    .from('resource_plan')
    .select('plan_month, planned_workforce, planned_equipment')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .gte('plan_month', startIso)
    .lte('plan_month', endIso)

  // Map plan_month (ISO date) → { planned_workforce, planned_equipment }
  const planMap: Record<string, { workforce: number; equipment: number }> = {}
  for (const row of planRows ?? []) {
    const key = (row.plan_month as string).slice(0, 7) // "YYYY-MM"
    planMap[key] = {
      workforce: (row.planned_workforce as number) ?? 0,
      equipment: (row.planned_equipment as number) ?? 0,
    }
  }

  // ── Fetch actual data (daily_reports) ─────────────────────────────────────
  const { data: reportRows } = await supabase
    .from('daily_reports')
    .select('report_date, workforce_count, equipment_count')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .gte('report_date', startIso)
    .lte('report_date', endIso)
    .not('workforce_count', 'is', null)

  // Aggregate per month: sum + count for averaging
  const actualMap: Record<string, { wfSum: number; eqSum: number; wfCount: number; eqCount: number }> = {}
  for (const row of reportRows ?? []) {
    const key  = (row.report_date as string).slice(0, 7)
    const wf   = (row.workforce_count as number | null) ?? null
    const eq   = (row.equipment_count as number | null) ?? null
    if (!actualMap[key]) actualMap[key] = { wfSum: 0, eqSum: 0, wfCount: 0, eqCount: 0 }
    if (wf !== null) { actualMap[key].wfSum += wf; actualMap[key].wfCount++ }
    if (eq !== null) { actualMap[key].eqSum += eq; actualMap[key].eqCount++ }
  }

  // ── Compose result rows ───────────────────────────────────────────────────
  const resultMonths: ResourceMonth[] = monthKeys.map((key) => {
    const plan   = planMap[key]
    const actual = actualMap[key]
    return {
      month:             key,
      label:             labelFromKey(key),
      plannedWorkforce:  plan?.workforce ?? 0,
      plannedEquipment:  plan?.equipment ?? 0,
      actualWorkforce:   actual && actual.wfCount > 0 ? Math.round(actual.wfSum / actual.wfCount) : null,
      actualEquipment:   actual && actual.eqCount > 0 ? Math.round(actual.eqSum / actual.eqCount) : null,
    }
  })

  // ── Peak calculations ─────────────────────────────────────────────────────
  function peak(
    rows: ResourceMonth[],
    key: keyof ResourceMonth,
  ): { value: number; month: string } | null {
    const filtered = rows.filter((r) => {
      const v = r[key]
      return typeof v === 'number' && v > 0
    })
    if (!filtered.length) return null
    const best = filtered.reduce((a, b) => ((b[key] as number) > (a[key] as number) ? b : a))
    return { value: best[key] as number, month: best.label }
  }

  return {
    months:               resultMonths,
    peakPlannedWorkforce: peak(resultMonths, 'plannedWorkforce'),
    peakActualWorkforce:  peak(resultMonths, 'actualWorkforce'),
    peakPlannedEquipment: peak(resultMonths, 'plannedEquipment'),
    peakActualEquipment:  peak(resultMonths, 'actualEquipment'),
  }
}

// ─── upsertResourcePlan ───────────────────────────────────────────────────────

export interface UpsertResourcePlanResult {
  error: string | null
}

/**
 * Upserts a single month's plan for the given project.
 * Month should be "YYYY-MM" (e.g. "2025-06").
 */
export async function upsertResourcePlan(
  projectId:         string,
  month:             string,   // "YYYY-MM"
  plannedWorkforce:  number,
  plannedEquipment:  number,
): Promise<UpsertResourcePlanResult> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const tenantId  = await getCurrentTenantId()
  const supabase  = createAdminClient()
  const planMonth = `${month}-01` // store as first day of month

  const { error } = await supabase
    .from('resource_plan')
    .upsert(
      {
        tenant_id:         tenantId,
        project_id:        projectId,
        plan_month:        planMonth,
        planned_workforce: plannedWorkforce,
        planned_equipment: plannedEquipment,
        updated_at:        new Date().toISOString(),
      },
      { onConflict: 'project_id,plan_month' },
    )

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/schedule`)
  return { error: null }
}
