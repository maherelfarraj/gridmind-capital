'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter }     from '@/lib/auth/guard'
import { revalidatePath }    from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

/** ISO date string for N days ago (UTC). */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

/** First day of the current calendar month (UTC). */
function startOfMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/** First day of the current calendar year (UTC). */
function startOfYear(): string {
  return `${new Date().getUTCFullYear()}-01-01`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProductionRow {
  id:               string
  project_id:       string
  date:             string          // YYYY-MM-DD
  energy_mwh:       number
  availability_pct: number | null
  curtailment_mwh:  number | null
  p50_mwh:          number | null
  p90_mwh:          number | null
}

export interface EnergyDashboard {
  /** Raw production rows, newest-first, limited to 90 days. */
  history:   ProductionRow[]
  /** Aggregated KPIs */
  kpis: {
    mtd_actual:        number   // MWh month-to-date
    ytd_actual:        number   // MWh year-to-date
    p50_total:         number   // YTD P50 target
    p90_total:         number   // YTD P90 target
    pct_of_p50:        number   // ytd_actual / p50_total × 100, or null when p50=0
    availability_avg:  number   // average availability_pct over history window
    curtailment_total: number   // YTD curtailment MWh
  }
}

export interface BessRow {
  id:                   string
  project_id:           string
  date:                 string
  soc_pct:              number | null
  cycles_cumulative:    number | null
  throughput_mwh:       number | null
  soh_pct:              number | null
  warranty_cycle_limit: number | null
}

export interface BessDashboard {
  latest:  BessRow | null
  history: BessRow[]           // 90-day window, newest-first
  warranty: {
    cycles_used:          number   // latest cycles_cumulative
    warranty_cycle_limit: number   // from latest row (or 0)
    pct_consumed:         number   // cycles_used / limit × 100
    /** ISO date string (or null when rate is 0 / no history) */
    projected_limit_date: string | null
  }
  throughput_total: number       // sum of throughput_mwh over history
}

export type ComplianceResult   = 'pass' | 'fail' | 'conditional_pass' | null
export type ComplianceCategory = 'freq_response' | 'voltage_ride_through' | 'power_factor' | 'ramp_rate' | 'anti_islanding' | 'scada_comms' | 'protection' | 'other'

export interface GridComplianceTest {
  id:               string
  project_id:       string
  category:         ComplianceCategory
  test_name:        string
  scheduled_date:   string | null
  completed_date:   string | null
  result:           ComplianceResult
  certificate_ref:  string | null
  notes:            string | null
}

export interface GridComplianceDashboard {
  tests:   GridComplianceTest[]
  summary: {
    total:     number
    passed:    number
    failed:    number
    scheduled: number   // not yet completed
    pass_rate: number   // passed / (passed + failed) × 100
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getEnergyDashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getEnergyDashboard(projectId: string): Promise<EnergyDashboard> {
  const sb      = createAdminClient()
  const since90 = daysAgo(90)
  const since0m = startOfMonth()
  const since0y = startOfYear()

  // Fetch 90-day history, newest first.
  const { data: rows } = await sb
    .from('energy_production')
    .select('id, project_id, date, energy_mwh, availability_pct, curtailment_mwh, p50_mwh, p90_mwh')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .gte('date', since90)
    .order('date', { ascending: false })

  const history: ProductionRow[] = (rows ?? []).map(r => ({
    id:               r.id as string,
    project_id:       r.project_id as string,
    date:             r.date as string,
    energy_mwh:       num(r.energy_mwh),
    availability_pct: r.availability_pct != null ? num(r.availability_pct) : null,
    curtailment_mwh:  r.curtailment_mwh  != null ? num(r.curtailment_mwh)  : null,
    p50_mwh:          r.p50_mwh          != null ? num(r.p50_mwh)          : null,
    p90_mwh:          r.p90_mwh          != null ? num(r.p90_mwh)          : null,
  }))

  // YTD rows (may overlap with history; fetch separately for accuracy).
  const { data: ytdRows } = await sb
    .from('energy_production')
    .select('date, energy_mwh, availability_pct, curtailment_mwh, p50_mwh, p90_mwh')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .gte('date', since0y)

  const allYtd = ytdRows ?? []

  // MTD is a subset of YTD rows.
  const mtdRows = allYtd.filter(r => (r.date as string) >= since0m)

  const mtd_actual        = mtdRows.reduce((s, r) => s + num(r.energy_mwh),       0)
  const ytd_actual        = allYtd.reduce((s, r)  => s + num(r.energy_mwh),       0)
  const p50_total         = allYtd.reduce((s, r)  => s + num(r.p50_mwh),          0)
  const p90_total         = allYtd.reduce((s, r)  => s + num(r.p90_mwh),          0)
  const curtailment_total = allYtd.reduce((s, r)  => s + num(r.curtailment_mwh),  0)

  const availRows         = history.filter(r => r.availability_pct != null)
  const availability_avg  = availRows.length > 0
    ? availRows.reduce((s, r) => s + num(r.availability_pct), 0) / availRows.length
    : 0

  const pct_of_p50 = p50_total > 0 ? (ytd_actual / p50_total) * 100 : 0

  return {
    history,
    kpis: {
      mtd_actual,
      ytd_actual,
      p50_total,
      p90_total,
      pct_of_p50,
      availability_avg,
      curtailment_total,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. logProduction
// ─────────────────────────────────────────────────────────────────────────────

export async function logProduction(
  projectId: string,
  date: string,   // YYYY-MM-DD
  data: {
    energy_mwh:       number
    availability_pct?: number | null
    curtailment_mwh?:  number | null
    p50_mwh?:          number | null
    p90_mwh?:          number | null
  },
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date must be YYYY-MM-DD.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('energy_production')
    .upsert(
      {
        tenant_id:        DEMO_TENANT,
        project_id:       projectId,
        date,
        energy_mwh:       data.energy_mwh,
        availability_pct: data.availability_pct ?? null,
        curtailment_mwh:  data.curtailment_mwh  ?? null,
        p50_mwh:          data.p50_mwh           ?? null,
        p90_mwh:          data.p90_mwh           ?? null,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'project_id,date' },
    )

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/energy`)
  return { error: undefined }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. importProductionCsv
// ─────────────────────────────────────────────────────────────────────────────

/** One row from a meter-export CSV. date must be YYYY-MM-DD. */
export interface ProductionCsvRow {
  date:             string
  energy_mwh:       number
  availability_pct?: number | null
  curtailment_mwh?:  number | null
}

export async function importProductionCsv(
  projectId: string,
  rows: ProductionCsvRow[],
): Promise<{ imported: number; skipped: number; error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { imported: 0, skipped: 0, error: gate.error }

  if (!rows.length) return { imported: 0, skipped: 0 }

  // Validate and normalise rows; skip malformed dates.
  const valid: Record<string, unknown>[] = []
  let skipped = 0
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { skipped++; continue }
    const mwh = num(r.energy_mwh)
    if (mwh < 0) { skipped++; continue }
    valid.push({
      tenant_id:        DEMO_TENANT,
      project_id:       projectId,
      date:             r.date,
      energy_mwh:       mwh,
      availability_pct: r.availability_pct != null ? num(r.availability_pct) : null,
      curtailment_mwh:  r.curtailment_mwh  != null ? num(r.curtailment_mwh)  : null,
      updated_at:       new Date().toISOString(),
    })
  }

  if (!valid.length) return { imported: 0, skipped }

  const admin = createAdminClient()

  // Supabase upsert supports bulk arrays; conflict on (project_id, date).
  const { data, error } = await admin
    .from('energy_production')
    .upsert(valid, { onConflict: 'project_id,date' })
    .select('id')

  if (error) return { imported: 0, skipped, error: error.message }

  revalidatePath(`/projects/${projectId}/energy`)
  return { imported: (data ?? []).length, skipped }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getBessDashboard
// ─────────────────────────────────────────────────────────────────────────────

export async function getBessDashboard(projectId: string): Promise<BessDashboard> {
  const sb      = createAdminClient()
  const since90 = daysAgo(90)

  const { data: rows } = await sb
    .from('bess_metrics')
    .select('id, project_id, date, soc_pct, cycles_cumulative, throughput_mwh, soh_pct, warranty_cycle_limit')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .gte('date', since90)
    .order('date', { ascending: false })

  const history: BessRow[] = (rows ?? []).map(r => ({
    id:                   r.id as string,
    project_id:           r.project_id as string,
    date:                 r.date as string,
    soc_pct:              r.soc_pct              != null ? num(r.soc_pct)              : null,
    cycles_cumulative:    r.cycles_cumulative    != null ? num(r.cycles_cumulative)    : null,
    throughput_mwh:       r.throughput_mwh       != null ? num(r.throughput_mwh)       : null,
    soh_pct:              r.soh_pct              != null ? num(r.soh_pct)              : null,
    warranty_cycle_limit: r.warranty_cycle_limit != null ? num(r.warranty_cycle_limit) : null,
  }))

  const latest = history[0] ?? null

  // ── Warranty tracking ──────────────────────────────────────────────────────
  const cycles_used          = num(latest?.cycles_cumulative)
  const warranty_cycle_limit = num(latest?.warranty_cycle_limit)
  const pct_consumed         = warranty_cycle_limit > 0
    ? (cycles_used / warranty_cycle_limit) * 100
    : 0

  // Cycling rate: delta cycles / delta days using first vs last history row.
  let projected_limit_date: string | null = null
  if (warranty_cycle_limit > 0 && history.length >= 2) {
    const newest = history[0]
    const oldest = history[history.length - 1]
    const deltaCycles = num(newest.cycles_cumulative) - num(oldest.cycles_cumulative)
    const deltaDays   = (new Date(newest.date).getTime() - new Date(oldest.date).getTime()) / 86_400_000
    const ratePerDay  = deltaDays > 0 ? deltaCycles / deltaDays : 0
    if (ratePerDay > 0) {
      const cyclesRemaining = warranty_cycle_limit - cycles_used
      const daysToLimit     = Math.max(0, Math.ceil(cyclesRemaining / ratePerDay))
      projected_limit_date  = new Date(Date.now() + daysToLimit * 86_400_000)
        .toISOString().slice(0, 10)
    }
  }

  const throughput_total = history.reduce((s, r) => s + num(r.throughput_mwh), 0)

  return {
    latest,
    history,
    warranty: { cycles_used, warranty_cycle_limit, pct_consumed, projected_limit_date },
    throughput_total,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. logBessMetrics
// ─────────────────────────────────────────────────────────────────────────────

export async function logBessMetrics(
  projectId: string,
  date: string,   // YYYY-MM-DD
  data: {
    soc_pct?:              number | null
    cycles_cumulative?:    number | null
    throughput_mwh?:       number | null
    soh_pct?:              number | null
    warranty_cycle_limit?: number | null
  },
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date must be YYYY-MM-DD.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('bess_metrics')
    .upsert(
      {
        tenant_id:            DEMO_TENANT,
        project_id:           projectId,
        date,
        soc_pct:              data.soc_pct              ?? null,
        cycles_cumulative:    data.cycles_cumulative    ?? null,
        throughput_mwh:       data.throughput_mwh       ?? null,
        soh_pct:              data.soh_pct              ?? null,
        warranty_cycle_limit: data.warranty_cycle_limit ?? null,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'project_id,date' },
    )

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/energy`)
  return { error: undefined }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6a. getGridCompliance
// ─────────────────────────────────────────────────────────────────────────────

export async function getGridCompliance(projectId: string): Promise<GridComplianceDashboard> {
  const sb = createAdminClient()

  const { data: rows } = await sb
    .from('grid_compliance_tests')
    .select('id, project_id, category, test_name, scheduled_date, completed_date, result, certificate_ref, notes')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: true })

  const tests: GridComplianceTest[] = (rows ?? []).map(r => ({
    id:              r.id             as string,
    project_id:      r.project_id     as string,
    category:        r.category        as ComplianceCategory,
    test_name:       r.test_name       as string,
    scheduled_date:  r.scheduled_date  as string | null,
    completed_date:  r.completed_date  as string | null,
    result:          r.result          as ComplianceResult,
    certificate_ref: r.certificate_ref as string | null,
    notes:           r.notes           as string | null,
  }))

  const passed    = tests.filter(t => t.result === 'pass' || t.result === 'conditional_pass').length
  const failed    = tests.filter(t => t.result === 'fail').length
  const scheduled = tests.filter(t => !t.completed_date).length
  const pass_rate = (passed + failed) > 0 ? (passed / (passed + failed)) * 100 : 0

  return {
    tests,
    summary: { total: tests.length, passed, failed, scheduled, pass_rate },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6b. addComplianceTest
// ─────────────────────────────────────────────────────────────────────────────

export async function addComplianceTest(
  projectId: string,
  data: {
    category:       ComplianceCategory
    test_name:      string
    scheduled_date?: string | null
    notes?:          string | null
  },
): Promise<{ id?: string; error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  if (!data.test_name.trim()) return { error: 'Test name is required.' }

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('grid_compliance_tests')
    .insert({
      tenant_id:      DEMO_TENANT,
      project_id:     projectId,
      category:       data.category,
      test_name:      data.test_name.trim(),
      scheduled_date: data.scheduled_date ?? null,
      notes:          data.notes          ?? null,
      result:         null,
      completed_date: null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/energy`)
  return { id: (inserted as Record<string, unknown>).id as string }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6c. updateComplianceResult
// ─────────────────────────────────────────────────────────────────────────────

export async function updateComplianceResult(
  id: string,
  result: NonNullable<ComplianceResult>,
  certificateRef?: string | null,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()
  const { error } = await admin
    .from('grid_compliance_tests')
    .update({
      result,
      certificate_ref: certificateRef ?? null,
      completed_date:  new Date().toISOString().slice(0, 10),
      updated_at:      new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }

  // Refresh the energy page (project_id unknown at this call site; global revalidation).
  revalidatePath('/projects', 'layout')
  return { error: undefined }
}
