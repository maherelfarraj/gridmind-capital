'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleActivity {
  id: string
  project_id: string
  activity_code: string | null
  name: string
  phase: string | null
  discipline: string | null
  gate_number: number | null
  duration_days: number | null
  planned_start: string | null
  planned_finish: string | null
  actual_start: string | null
  actual_finish: string | null
  percent_complete: number | null
  weight: number | null
  is_critical: boolean | null
  is_milestone: boolean | null
  status: string | null
  sort_order: number | null
}

export interface ActivityDependency {
  id: string
  project_id: string
  predecessor_id: string
  successor_id: string
  type: string | null
  lag_days: number | null
}

export interface ScheduleResult {
  activities: ScheduleActivity[]
  dependencies: ActivityDependency[]
}

export interface ActivityInput {
  activity_code?: string | null
  name?: string
  phase?: string | null
  discipline?: string | null
  gate_number?: number | null
  duration_days?: number | null
  planned_start?: string | null
  planned_finish?: string | null
  percent_complete?: number | null
  weight?: number | null
  is_critical?: boolean | null
  is_milestone?: boolean | null
  status?: string | null
  sort_order?: number | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Derive lifecycle status from percent complete. */
function statusFromPercent(pct: number): string {
  if (pct <= 0)   return 'not_started'
  if (pct >= 100) return 'completed'
  return 'in_progress'
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole-week difference (Mondays) helper for the S-curve. */
function weeksBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to   = new Date(toIso   + 'T00:00:00Z').getTime()
  return Math.max(0, Math.ceil((to - from) / (7 * 24 * 3600 * 1000)))
}

// ─── 1. Read schedule ─────────────────────────────────────────────────────────

export async function getSchedule(projectId: string): Promise<ScheduleResult> {
  const sb = createAdminClient()
  const [{ data: activities }, { data: dependencies }] = await Promise.all([
    sb.from('schedule_activities')
      .select('*')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    sb.from('activity_dependencies')
      .select('id, project_id, predecessor_id, successor_id, type, lag_days')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_id', projectId),
  ])

  return {
    activities:   (activities ?? []) as ScheduleActivity[],
    dependencies: (dependencies ?? []) as ActivityDependency[],
  }
}

// ─── 2. Activity CRUD ──────────────────────────────────────────────────────────

export async function createActivity(
  projectId: string,
  data: ActivityInput,
): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { data: inserted, error } = await sb
    .from('schedule_activities')
    .insert({
      tenant_id:        DEMO_TENANT,
      project_id:       projectId,
      activity_code:    data.activity_code ?? null,
      name:             data.name ?? 'New activity',
      phase:            data.phase ?? null,
      discipline:       data.discipline ?? null,
      gate_number:      data.gate_number ?? null,
      duration_days:    data.duration_days ?? 1,
      planned_start:    data.planned_start ?? null,
      planned_finish:   data.planned_finish ?? null,
      percent_complete: data.percent_complete ?? 0,
      weight:           data.weight ?? 1,
      is_critical:      data.is_critical ?? false,
      is_milestone:     data.is_milestone ?? false,
      status:           data.status ?? statusFromPercent(data.percent_complete ?? 0),
      sort_order:       data.sort_order ?? 0,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/schedule`)
  return { id: inserted?.id }
}

export async function updateActivity(
  id: string,
  data: ActivityInput,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()

  // Fetch current row to detect a percent_complete change + project scoping.
  const { data: existing } = await sb
    .from('schedule_activities')
    .select('project_id, percent_complete')
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  if (!existing) return { error: 'Activity not found' }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) patch[k] = v
  }

  const pctChanged =
    data.percent_complete !== undefined &&
    Number(data.percent_complete) !== Number(existing.percent_complete ?? 0)

  if (pctChanged) {
    const pct = Number(data.percent_complete)
    patch.status = statusFromPercent(pct)
    if (pct >= 100) patch.actual_finish = today()
  }

  const { error } = await sb
    .from('schedule_activities')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }

  // Log a progress_updates row whenever percent_complete changed.
  if (pctChanged) {
    await sb.from('progress_updates').insert({
      tenant_id:        DEMO_TENANT,
      project_id:       existing.project_id,
      activity_id:      id,
      update_date:      today(),
      percent_complete: Number(data.percent_complete),
      created_by:       gate.actor.userId,
    })
  }

  revalidatePath(`/projects/${existing.project_id}/schedule`)
  return {}
}

export async function deleteActivity(id: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('schedule_activities')
    .select('project_id')
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  // Remove dependent rows + progress history first, then the activity.
  await sb.from('activity_dependencies')
    .delete()
    .eq('tenant_id', DEMO_TENANT)
    .or(`predecessor_id.eq.${id},successor_id.eq.${id}`)
  await sb.from('progress_updates').delete().eq('tenant_id', DEMO_TENANT).eq('activity_id', id)

  const { error } = await sb
    .from('schedule_activities')
    .delete()
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }
  if (existing?.project_id) revalidatePath(`/projects/${existing.project_id}/schedule`)
  return {}
}

// ─── 3. Dependencies ────────────────────────────────────────────────────────────

/** Depth-first check: is `target` reachable from `start` following successor edges? */
function reachable(
  start: string,
  target: string,
  edges: { predecessor_id: string; successor_id: string }[],
): boolean {
  const adj: Record<string, string[]> = {}
  for (const e of edges) {
    ;(adj[e.predecessor_id] ??= []).push(e.successor_id)
  }
  const stack = [start]
  const seen = new Set<string>()
  while (stack.length) {
    const node = stack.pop() as string
    if (node === target) return true
    if (seen.has(node)) continue
    seen.add(node)
    for (const next of adj[node] ?? []) stack.push(next)
  }
  return false
}

export async function addDependency(
  predecessorId: string,
  successorId: string,
  type: string = 'FS',
  lagDays: number = 0,
): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  if (predecessorId === successorId) return { error: 'Cannot depend on itself' }

  const sb = createAdminClient()

  // Resolve project scope from the predecessor (tables require project_id).
  const { data: pred } = await sb
    .from('schedule_activities')
    .select('project_id')
    .eq('id', predecessorId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  if (!pred) return { error: 'Predecessor not found' }

  // Load existing edges + the proposed edge, then test for a cycle:
  // a cycle exists if `predecessor` is already reachable FROM `successor`.
  const { data: edges } = await sb
    .from('activity_dependencies')
    .select('predecessor_id, successor_id')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', pred.project_id)

  const graph = [...(edges ?? []), { predecessor_id: predecessorId, successor_id: successorId }]
  if (reachable(successorId, predecessorId, graph)) {
    return { error: 'Circular dependency' }
  }

  const { data: inserted, error } = await sb
    .from('activity_dependencies')
    .insert({
      tenant_id:      DEMO_TENANT,
      project_id:     pred.project_id,
      predecessor_id: predecessorId,
      successor_id:   successorId,
      type,
      lag_days:       lagDays,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/projects/${pred.project_id}/schedule`)
  return { id: inserted?.id }
}

export async function removeDependency(id: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { data: existing } = await sb
    .from('activity_dependencies')
    .select('project_id')
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  const { error } = await sb
    .from('activity_dependencies')
    .delete()
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }
  if (existing?.project_id) revalidatePath(`/projects/${existing.project_id}/schedule`)
  return {}
}

// ─── 4. Record progress ──────────────────────────────────────────────────────

export async function recordProgress(
  activityId: string,
  updateDate: string,
  percentComplete: number,
  note?: string,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { data: activity } = await sb
    .from('schedule_activities')
    .select('project_id')
    .eq('id', activityId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  if (!activity) return { error: 'Activity not found' }

  const pct  = Math.max(0, Math.min(100, percentComplete))
  const date = updateDate || today()

  // Upsert: one progress row per (activity, date).
  const { data: prior } = await sb
    .from('progress_updates')
    .select('id')
    .eq('tenant_id', DEMO_TENANT)
    .eq('activity_id', activityId)
    .eq('update_date', date)
    .maybeSingle()

  if (prior?.id) {
    const { error } = await sb
      .from('progress_updates')
      .update({ percent_complete: pct, note: note ?? null })
      .eq('id', prior.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await sb.from('progress_updates').insert({
      tenant_id:        DEMO_TENANT,
      project_id:       activity.project_id,
      activity_id:      activityId,
      update_date:      date,
      percent_complete: pct,
      note:             note ?? null,
      created_by:       gate.actor.userId,
    })
    if (error) return { error: error.message }
  }

  // Sync the activity's rolled-up percent + status.
  const patch: Record<string, unknown> = {
    percent_complete: pct,
    status:           statusFromPercent(pct),
    updated_at:       new Date().toISOString(),
  }
  if (pct >= 100) patch.actual_finish = today()

  const { error: syncErr } = await sb
    .from('schedule_activities')
    .update(patch)
    .eq('id', activityId)
    .eq('tenant_id', DEMO_TENANT)

  if (syncErr) return { error: syncErr.message }
  revalidatePath(`/projects/${activity.project_id}/schedule`)
  return {}
}

// ─── 5. Weighted project progress ────────────────────────────────────────────

export interface ProjectProgress {
  percentComplete: number
  byStatus: { not_started: number; in_progress: number; completed: number }
  totalActivities: number
}

export async function getProjectProgress(projectId: string): Promise<ProjectProgress> {
  const sb = createAdminClient()
  const { data } = await sb
    .from('schedule_activities')
    .select('percent_complete, weight, status')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const rows = data ?? []
  const totalWeight = rows.reduce((s, r) => s + Number(r.weight ?? 1), 0)
  const weighted    = rows.reduce((s, r) => s + Number(r.weight ?? 1) * Number(r.percent_complete ?? 0), 0)

  const byStatus = { not_started: 0, in_progress: 0, completed: 0 }
  for (const r of rows) {
    const key = (r.status ?? 'not_started') as keyof typeof byStatus
    if (key in byStatus) byStatus[key]++
    else byStatus.not_started++
  }

  return {
    percentComplete: totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : 0,
    byStatus,
    totalActivities: rows.length,
  }
}

// ─── 6. S-curve (planned vs actual) ────────────────────────────────────────────

export interface SCurvePoint {
  week: string        // ISO date of the week bucket
  planned: number     // cumulative planned %
  actual: number | null // cumulative actual % (null for future weeks)
}

export async function getSCurveData(projectId: string): Promise<SCurvePoint[]> {
  const sb = createAdminClient()
  const [{ data: acts }, { data: updates }] = await Promise.all([
    sb.from('schedule_activities')
      .select('id, weight, planned_start, planned_finish')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_id', projectId),
    sb.from('progress_updates')
      .select('activity_id, update_date, percent_complete')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_id', projectId)
      .order('update_date', { ascending: true }),
  ])

  const activities = (acts ?? []).filter(a => a.planned_start && a.planned_finish)
  if (!activities.length) return []

  const totalWeight = activities.reduce((s, a) => s + Number(a.weight ?? 1), 0) || 1
  const weightById  = Object.fromEntries(activities.map(a => [a.id, Number(a.weight ?? 1)]))

  const starts = activities.map(a => a.planned_start as string).sort()
  const finishes = activities.map(a => a.planned_finish as string).sort()
  const earliest = starts[0]
  const latest   = finishes[finishes.length - 1]

  const weekCount = Math.max(1, weeksBetween(earliest, latest))
  const points: SCurvePoint[] = []
  const nowIso = today()

  for (let w = 0; w <= weekCount; w++) {
    const weekIso = addDays(earliest, w * 7)

    // Planned cumulative %: each activity spreads its weight linearly across
    // its planned duration.
    let plannedWeight = 0
    for (const a of activities) {
      const ps = a.planned_start as string
      const pf = a.planned_finish as string
      const wgt = Number(a.weight ?? 1)
      if (weekIso >= pf) {
        plannedWeight += wgt
      } else if (weekIso > ps) {
        const span    = Math.max(1, weeksBetween(ps, pf))
        const elapsed = weeksBetween(ps, weekIso)
        plannedWeight += wgt * Math.min(1, elapsed / span)
      }
    }

    // Actual cumulative %: latest known percent per activity up to this week.
    let actualWeight = 0
    let hasActual = false
    for (const a of activities) {
      const rows = (updates ?? []).filter(
        u => u.activity_id === a.id && (u.update_date as string) <= weekIso,
      )
      if (rows.length) {
        hasActual = true
        const latestPct = Number(rows[rows.length - 1].percent_complete ?? 0)
        actualWeight += (weightById[a.id] ?? 1) * (latestPct / 100)
      }
    }

    points.push({
      week:    weekIso,
      planned: Math.round((plannedWeight / totalWeight) * 1000) / 10,
      actual:  weekIso <= nowIso && hasActual
        ? Math.round((actualWeight / totalWeight) * 1000) / 10
        : (weekIso <= nowIso ? 0 : null),
    })
  }

  return points
}

// ─── 7. Baseline + variance ─────────────────────────────────────────────────

export async function createBaseline(
  projectId: string,
  name: string,
): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { data: acts } = await sb
    .from('schedule_activities')
    .select('id, activity_code, name, planned_start, planned_finish, duration_days')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const snapshot = (acts ?? []).map(a => ({
    id:             a.id,
    activity_code:  a.activity_code,
    name:           a.name,
    planned_start:  a.planned_start,
    planned_finish: a.planned_finish,
    duration_days:  a.duration_days,
  }))

  const { data: inserted, error } = await sb
    .from('schedule_baselines')
    .insert({
      tenant_id:  DEMO_TENANT,
      project_id: projectId,
      name:       name || 'Baseline 1',
      snapshot,
      created_by: gate.actor.userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/schedule`)
  return { id: inserted?.id }
}

export interface BaselineVarianceRow {
  activityId: string
  activityCode: string | null
  name: string
  baselineStart: string | null
  baselineFinish: string | null
  currentStart: string | null
  currentFinish: string | null
  startVarianceDays: number | null
  finishVarianceDays: number | null
}

export interface BaselineVariance {
  baselineName: string | null
  baselineDate: string | null
  rows: BaselineVarianceRow[]
}

function dayDiff(fromIso: string | null, toIso: string | null): number | null {
  if (!fromIso || !toIso) return null
  const from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to   = new Date(toIso   + 'T00:00:00Z').getTime()
  return Math.round((to - from) / (24 * 3600 * 1000))
}

export async function getBaselineVariance(projectId: string): Promise<BaselineVariance> {
  const sb = createAdminClient()

  const { data: baseline } = await sb
    .from('schedule_baselines')
    .select('name, snapshot, created_at')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!baseline) return { baselineName: null, baselineDate: null, rows: [] }

  const { data: current } = await sb
    .from('schedule_activities')
    .select('id, activity_code, name, planned_start, planned_finish')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)

  const currentById = Object.fromEntries((current ?? []).map(a => [a.id, a]))

  const snapshot = (baseline.snapshot ?? []) as {
    id: string; activity_code: string | null; name: string
    planned_start: string | null; planned_finish: string | null
  }[]

  const rows: BaselineVarianceRow[] = snapshot.map(base => {
    const cur = currentById[base.id]
    return {
      activityId:         base.id,
      activityCode:       base.activity_code,
      name:               base.name,
      baselineStart:      base.planned_start,
      baselineFinish:     base.planned_finish,
      currentStart:       cur?.planned_start ?? null,
      currentFinish:      cur?.planned_finish ?? null,
      startVarianceDays:  dayDiff(base.planned_start, cur?.planned_start ?? null),
      finishVarianceDays: dayDiff(base.planned_finish, cur?.planned_finish ?? null),
    }
  })

  return {
    baselineName: baseline.name,
    baselineDate: baseline.created_at as string,
    rows,
  }
}

// ─── 8. Seed a standard PV + BESS template ─────────────────────────────────────

interface TemplateActivity {
  code: string; name: string; phase: string; discipline: string
  gate: number; duration: number; weight: number; milestone?: boolean
  predecessor?: string   // code of the FS predecessor
  lag?: number
}

const PV_BESS_TEMPLATE: TemplateActivity[] = [
  // Development
  { code: 'DEV-010', name: 'Site survey',              phase: 'Development',   discipline: 'Development', gate: 1, duration: 20, weight: 2 },
  { code: 'DEV-020', name: 'Environmental permitting', phase: 'Development',   discipline: 'Development', gate: 1, duration: 45, weight: 3, predecessor: 'DEV-010' },
  { code: 'DEV-030', name: 'Grid connection agreement',phase: 'Development',   discipline: 'Electrical',  gate: 2, duration: 60, weight: 4, predecessor: 'DEV-010' },
  { code: 'DEV-040', name: 'FID / Financial close',    phase: 'Development',   discipline: 'Commercial',  gate: 2, duration: 10, weight: 3, milestone: true, predecessor: 'DEV-030' },
  // Engineering
  { code: 'ENG-010', name: '30% design',               phase: 'Engineering',   discipline: 'Engineering', gate: 3, duration: 30, weight: 4, predecessor: 'DEV-040' },
  { code: 'ENG-020', name: '60% design',               phase: 'Engineering',   discipline: 'Engineering', gate: 3, duration: 30, weight: 4, predecessor: 'ENG-010' },
  { code: 'ENG-030', name: 'IFC design',               phase: 'Engineering',   discipline: 'Engineering', gate: 3, duration: 25, weight: 5, predecessor: 'ENG-020' },
  // Procurement
  { code: 'PRC-010', name: 'Module procurement',       phase: 'Procurement',   discipline: 'Procurement', gate: 4, duration: 90, weight: 6, predecessor: 'ENG-010' },
  { code: 'PRC-020', name: 'Inverter procurement',     phase: 'Procurement',   discipline: 'Procurement', gate: 4, duration: 80, weight: 4, predecessor: 'ENG-010' },
  { code: 'PRC-030', name: 'BESS procurement',         phase: 'Procurement',   discipline: 'Procurement', gate: 4, duration: 120, weight: 7, predecessor: 'ENG-020' },
  { code: 'PRC-040', name: 'MV equipment procurement', phase: 'Procurement',   discipline: 'Electrical',  gate: 4, duration: 100, weight: 4, predecessor: 'ENG-020' },
  // Construction
  { code: 'CON-010', name: 'Mobilization',             phase: 'Construction',  discipline: 'Construction',gate: 5, duration: 15, weight: 2, predecessor: 'ENG-030' },
  { code: 'CON-020', name: 'Civil works',              phase: 'Construction',  discipline: 'Civil',       gate: 5, duration: 60, weight: 6, predecessor: 'CON-010' },
  { code: 'CON-030', name: 'Pile installation',        phase: 'Construction',  discipline: 'Civil',       gate: 5, duration: 45, weight: 5, predecessor: 'CON-020' },
  { code: 'CON-040', name: 'Module installation',      phase: 'Construction',  discipline: 'Mechanical',  gate: 5, duration: 70, weight: 8, predecessor: 'CON-030', lag: 0 },
  { code: 'CON-050', name: 'BESS installation',        phase: 'Construction',  discipline: 'Electrical',  gate: 5, duration: 40, weight: 6, predecessor: 'CON-030' },
  { code: 'CON-060', name: 'DC/AC cabling',            phase: 'Construction',  discipline: 'Electrical',  gate: 5, duration: 50, weight: 5, predecessor: 'CON-040' },
  { code: 'CON-070', name: 'MV station construction',  phase: 'Construction',  discipline: 'Electrical',  gate: 5, duration: 45, weight: 5, predecessor: 'CON-020' },
  { code: 'CON-080', name: 'Grid connection works',    phase: 'Construction',  discipline: 'Electrical',  gate: 5, duration: 30, weight: 4, predecessor: 'CON-070' },
  // Commissioning
  { code: 'COM-010', name: 'Cold commissioning',       phase: 'Commissioning', discipline: 'Commissioning',gate: 6, duration: 20, weight: 3, predecessor: 'CON-060' },
  { code: 'COM-020', name: 'Hot commissioning',        phase: 'Commissioning', discipline: 'Commissioning',gate: 6, duration: 25, weight: 4, predecessor: 'COM-010' },
  { code: 'COM-030', name: 'Performance test',         phase: 'Commissioning', discipline: 'Commissioning',gate: 6, duration: 20, weight: 4, predecessor: 'COM-020' },
  { code: 'COM-040', name: 'Provisional acceptance',   phase: 'Commissioning', discipline: 'Commissioning',gate: 6, duration: 5,  weight: 2, milestone: true, predecessor: 'COM-030' },
  { code: 'COM-050', name: 'Commercial operation (COD)',phase: 'Commissioning',discipline: 'Commercial',  gate: 6, duration: 1,  weight: 2, milestone: true, predecessor: 'COM-040' },
]

export async function seedScheduleTemplate(projectId: string): Promise<{ seeded: boolean; error?: string; count?: number }> {
  const gate = await requireWriter()
  if ('error' in gate) return { seeded: false, error: gate.error }

  const sb = createAdminClient()

  // Idempotent: skip if this project already has activities.
  const { data: existing } = await sb
    .from('schedule_activities')
    .select('id')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .limit(1)
  if (existing && existing.length > 0) return { seeded: false }

  // Roll planned dates forward per FS chain from a common start.
  const startBase = today()
  const finishByCode: Record<string, string> = {}
  const rows = PV_BESS_TEMPLATE.map((t, i) => {
    const start = t.predecessor && finishByCode[t.predecessor]
      ? addDays(finishByCode[t.predecessor], (t.lag ?? 0) + 1)
      : startBase
    const finish = addDays(start, t.duration)
    finishByCode[t.code] = finish
    return {
      tenant_id:        DEMO_TENANT,
      project_id:       projectId,
      activity_code:    t.code,
      name:             t.name,
      phase:            t.phase,
      discipline:       t.discipline,
      gate_number:      t.gate,
      duration_days:    t.duration,
      planned_start:    start,
      planned_finish:   finish,
      percent_complete: 0,
      weight:           t.weight,
      is_critical:      false,
      is_milestone:     t.milestone ?? false,
      status:           'not_started',
      sort_order:       i * 10,
    }
  })

  const { data: inserted, error } = await sb
    .from('schedule_activities')
    .insert(rows)
    .select('id, activity_code')

  if (error) return { seeded: false, error: error.message }

  // Wire up FS dependencies now that activity ids exist.
  const idByCode = Object.fromEntries((inserted ?? []).map(r => [r.activity_code as string, r.id as string]))
  const depRows = PV_BESS_TEMPLATE
    .filter(t => t.predecessor && idByCode[t.predecessor] && idByCode[t.code])
    .map(t => ({
      tenant_id:      DEMO_TENANT,
      project_id:     projectId,
      predecessor_id: idByCode[t.predecessor as string],
      successor_id:   idByCode[t.code],
      type:           'FS',
      lag_days:       t.lag ?? 0,
    }))

  if (depRows.length) await sb.from('activity_dependencies').insert(depRows)

  revalidatePath(`/projects/${projectId}/schedule`)
  return { seeded: true, count: rows.length }
}
