'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNcrEmail } from '@/lib/email/send'
import { revalidatePath } from 'next/cache'

import { DEMO_TENANT_FALLBACK } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type NcrSource = 'failed_inspection' | 'audit' | 'site_observation'
export type NcrStatus = 'open' | 'in_rectification' | 're_inspection' | 'closed'

export interface Ncr {
  id: string
  tenant_id: string
  project_id: string
  ncr_number: string
  title: string
  description: string | null
  raised_by: string | null
  raised_by_name: string | null
  source: NcrSource
  root_cause: string | null
  corrective_action: string | null
  status: NcrStatus
  cycle: number
  reinspection_passed: boolean
  closure_note: string | null
  raised_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
  days_open: number
}

export interface NcrCycleEvent {
  id: string
  from_state: string | null
  to_state: string | null
  transition_code: string | null
  comment: string | null
  created_at: string
  cycle: number | null
}

export interface NcrKpis {
  open: number
  avgDaysToClose: number | null
  total: number
  byStatus: { name: NcrStatus; value: number }[]
}

export interface NcrRegister {
  rows: Ncr[]
  kpis: NcrKpis
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null; fullName: string | null }

async function getActor(): Promise<Actor> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: DEMO_TENANT_FALLBACK, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()
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

// Quality/QA-QC cohort + PM cohort receive notifications on every status change.
const PM_ROLES = ['project_manager', 'project_director', 'tenant_admin', 'system_admin']
const QAQC_ROLES = ['hse_manager', 'commissioning_manager', 'engineer']

function daysBetween(fromIso: string, toIso: string | null): number {
  const end = toIso ? new Date(toIso).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 86400000))
}

async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  ncr: { id: string; project_id: string; ncr_number: string; cycle: number }
  from: NcrStatus | null
  to: string
  transition: string
  actorId: string | null
  comment?: string
  metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from,
    to_state: args.to,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: args.comment ?? null,
    metadata: {
      module: 'ncr',
      ncr_id: args.ncr.id,
      ncr_number: args.ncr.ncr_number,
      project_id: args.ncr.project_id,
      cycle: args.ncr.cycle,
      ...args.metadata,
    },
  })
}

async function notifyStakeholders(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string; projectId: string; ncrId: string; ncrNumber: string
  title: string; body: string; type?: string; ncrTitle?: string; status?: string
}) {
  const { data: recipients } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('tenant_id', args.tenantId)
    .eq('is_active', true)
    .in('role', [...new Set([...PM_ROLES, ...QAQC_ROLES])])

  if (!recipients?.length) return
  await admin.from('notifications').insert(
    recipients.map((r) => ({
      user_id: r.id,
      tenant_id: args.tenantId,
      title: args.title,
      body: args.body,
      type: args.type ?? 'alert',
      channel: 'in_app',
      link: `/projects/${args.projectId}/ncrs/${args.ncrId}`,
    })),
  )

  // Email each recipient (prefs-aware, logged) — fire-and-forget.
  const { data: proj } = await admin.from('projects').select('code').eq('id', args.projectId).maybeSingle()
  const projectCode = proj?.code ?? 'PROJECT'
  void Promise.all(
    recipients
      .filter((r) => r.email)
      .map((r) =>
        sendNcrEmail({
          to: r.email as string,
          userId: r.id,
          ncrNumber: args.ncrNumber,
          title: args.ncrTitle ?? args.body,
          status: args.status ?? args.title,
          projectCode,
          projectId: args.projectId,
          ncrId: args.ncrId,
        }),
      ),
  ).catch((e) => console.error('[ncr] email failed:', e))
}

function mapRow(r: any): Ncr {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    project_id: r.project_id,
    ncr_number: r.ncr_number,
    title: r.title,
    description: r.description,
    raised_by: r.raised_by,
    raised_by_name: r.profiles?.full_name ?? null,
    source: r.source,
    root_cause: r.root_cause,
    corrective_action: r.corrective_action,
    status: r.status,
    cycle: r.cycle,
    reinspection_passed: r.reinspection_passed,
    closure_note: r.closure_note,
    raised_at: r.raised_at,
    closed_at: r.closed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    days_open: daysBetween(r.raised_at, r.status === 'closed' ? r.closed_at : null),
  }
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/ncrs`)
  revalidatePath(`/projects/${projectId}/g5`)
  revalidatePath('/', 'layout')
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function getNcrs(projectId: string): Promise<NcrRegister> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ncrs')
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .eq('project_id', projectId)
    .order('ncr_number', { ascending: true })

  const rows = (error || !data ? [] : data).map(mapRow)

  const closed = rows.filter(r => r.status === 'closed' && r.closed_at)
  const avgDaysToClose = closed.length
    ? Math.round(closed.reduce((s, r) => s + daysBetween(r.raised_at, r.closed_at), 0) / closed.length)
    : null
  const statusOrder: NcrStatus[] = ['open', 'in_rectification', 're_inspection', 'closed']
  const byStatus = statusOrder.map(s => ({ name: s, value: rows.filter(r => r.status === s).length }))

  return {
    rows,
    kpis: {
      open: rows.filter(r => r.status !== 'closed').length,
      avgDaysToClose,
      total: rows.length,
      byStatus,
    },
  }
}

export async function getNcr(id: string): Promise<Ncr | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ncrs')
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data)
}

/** Full audit/cycle history for one NCR from the shared workflow_events spine. */
export async function getNcrHistory(id: string): Promise<NcrCycleEvent[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('workflow_events')
    .select('id, from_state, to_state, transition_code, comment, created_at, metadata')
    .eq('metadata->>module', 'ncr')
    .eq('metadata->>ncr_id', id)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((e: any) => ({
    id: e.id,
    from_state: e.from_state,
    to_state: e.to_state,
    transition_code: e.transition_code,
    comment: e.comment,
    created_at: e.created_at,
    cycle: e.metadata?.cycle ?? null,
  }))
}

/**
 * G5 gate guard: returns NCR numbers on the project that are NOT closed.
 * Gate G5 (PAC) cannot be submitted for approval while any of these exist.
 */
export async function getOpenNcrsForProject(
  projectId: string,
): Promise<{ blocking: boolean; open: { id: string; ncr_number: string; title: string; status: NcrStatus }[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ncrs')
    .select('id, ncr_number, title, status')
    .eq('project_id', projectId)
    .neq('status', 'closed')
    .order('ncr_number', { ascending: true })
  const open = error || !data ? [] : data
  return { blocking: open.length > 0, open: open as any }
}

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export async function createNcr(input: {
  project_id: string
  title: string
  description?: string
  source: NcrSource
  root_cause?: string
  corrective_action?: string
}): Promise<ActionResult<Ncr>> {
  if (!input.title?.trim()) return { error: 'Title is required' }
  const actor = await getActor()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ncrs')
    .insert({
      tenant_id: actor.tenantId,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      source: input.source,
      root_cause: input.root_cause?.trim() || null,
      corrective_action: input.corrective_action?.trim() || null,
      status: 'open',
      cycle: 1,
      raised_by: actor.userId,
    })
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to raise NCR' }
  const ncr = mapRow(data)
  await logEvent(admin, { ncr, from: null, to: 'open', transition: 'NCR_RAISE', actorId: actor.userId })
  await notifyStakeholders(admin, {
    tenantId: ncr.tenant_id, projectId: ncr.project_id, ncrId: ncr.id, ncrNumber: ncr.ncr_number,
    title: `${ncr.ncr_number} raised`,
    body: `New non-conformance "${ncr.title}" raised (${input.source.replace('_', ' ')}).`,
    type: 'alert',
    ncrTitle: ncr.title,
    status: 'Raised',
  })
  revalidate(input.project_id)
  return { data: ncr }
}

export async function updateNcr(id: string, patch: {
  title?: string
  description?: string
  source?: NcrSource
  root_cause?: string
  corrective_action?: string
}): Promise<ActionResult<Ncr>> {
  const admin = createAdminClient()
  const existing = await getNcr(id)
  if (!existing) return { error: 'NCR not found' }
  if (existing.status === 'closed') return { error: 'Closed NCRs cannot be edited' }

  const updates: Record<string, unknown> = {}
  if (patch.title !== undefined)             updates.title = patch.title.trim()
  if (patch.description !== undefined)       updates.description = patch.description?.trim() || null
  if (patch.source !== undefined)            updates.source = patch.source
  if (patch.root_cause !== undefined)        updates.root_cause = patch.root_cause?.trim() || null
  if (patch.corrective_action !== undefined) updates.corrective_action = patch.corrective_action?.trim() || null
  if (Object.keys(updates).length === 0)     return { data: existing }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('ncrs')
    .update(updates)
    .eq('id', id)
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Update failed' }
  revalidate(existing.project_id)
  return { data: mapRow(data) }
}

// ─────────────────────────────────────────────────────────────
// State machine
//   open → in_rectification → re_inspection → (pass → closed | fail → open, cycle++)
// ─────────────────────────────────────────────────────────────

/** open → in_rectification. Requires root cause + corrective action. */
export async function startRectification(id: string): Promise<ActionResult<Ncr>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const ncr = await getNcr(id)
  if (!ncr) return { error: 'NCR not found' }
  if (ncr.status !== 'open') return { error: `Cannot start rectification from "${ncr.status}"` }
  if (!ncr.root_cause?.trim() || !ncr.corrective_action?.trim()) {
    return { error: 'Root cause and corrective action are both required before moving to In Rectification' }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('ncrs')
    .update({ status: 'in_rectification', updated_at: now })
    .eq('id', id)
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Transition failed' }

  await logEvent(admin, { ncr, from: 'open', to: 'in_rectification', transition: 'NCR_START_RECTIFICATION', actorId: actor.userId })
  await notifyChange(admin, ncr, 'moved to In Rectification')
  revalidate(ncr.project_id)
  return { data: mapRow(data) }
}

/** in_rectification → re_inspection. */
export async function sendToReinspection(id: string): Promise<ActionResult<Ncr>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const ncr = await getNcr(id)
  if (!ncr) return { error: 'NCR not found' }
  if (ncr.status !== 'in_rectification') return { error: `Cannot send to re-inspection from "${ncr.status}"` }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('ncrs')
    .update({ status: 're_inspection', updated_at: now })
    .eq('id', id)
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Transition failed' }

  await logEvent(admin, { ncr, from: 'in_rectification', to: 're_inspection', transition: 'NCR_SEND_REINSPECTION', actorId: actor.userId })
  await notifyChange(admin, ncr, 'moved to Re-inspection')
  revalidate(ncr.project_id)
  return { data: mapRow(data) }
}

/**
 * Re-inspection result.
 *  - pass: requires a closure note → status closed, reinspection_passed=true
 *  - fail: back to open, cycle++, logs a new-cycle note
 */
export async function recordReinspection(
  id: string,
  result: 'pass' | 'fail',
  note: string,
): Promise<ActionResult<Ncr>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const ncr = await getNcr(id)
  if (!ncr) return { error: 'NCR not found' }
  if (ncr.status !== 're_inspection') return { error: 'Re-inspection can only be recorded from the Re-inspection state' }

  const now = new Date().toISOString()

  if (result === 'pass') {
    if (!note?.trim()) return { error: 'A closure note is required to close the NCR on a re-inspection pass' }
    const { data, error } = await admin
      .from('ncrs')
      .update({ status: 'closed', reinspection_passed: true, closure_note: note.trim(), closed_at: now, updated_at: now })
      .eq('id', id)
      .select('*, profiles!ncrs_raised_by_fkey (full_name)')
      .single()
    if (error || !data) return { error: error?.message ?? 'Closure failed' }

    await logEvent(admin, { ncr, from: 're_inspection', to: 'closed', transition: 'NCR_REINSPECTION_PASS',
      actorId: actor.userId, comment: note.trim(), metadata: { reinspection_passed: true } })
    await notifyChange(admin, ncr, 'closed (re-inspection passed)')
    revalidate(ncr.project_id)
    return { data: mapRow(data) }
  }

  // fail → back to open with a new cycle
  const newCycle = ncr.cycle + 1
  const failNote = note?.trim() || 'Re-inspection failed'
  const { data, error } = await admin
    .from('ncrs')
    .update({ status: 'open', cycle: newCycle, reinspection_passed: false, updated_at: now })
    .eq('id', id)
    .select('*, profiles!ncrs_raised_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Transition failed' }

  await logEvent(admin,
    { ncr: { ...ncr, cycle: newCycle }, from: 're_inspection', to: 'open', transition: 'NCR_REINSPECTION_FAIL',
      actorId: actor.userId, comment: failNote, metadata: { new_cycle: newCycle } })
  await notifyChange(admin, ncr, `re-inspection failed — reopened for cycle ${newCycle}`)
  revalidate(ncr.project_id)
  return { data: mapRow(data) }
}

async function notifyChange(admin: ReturnType<typeof createAdminClient>, ncr: Ncr, phrase: string) {
  await notifyStakeholders(admin, {
    tenantId: ncr.tenant_id, projectId: ncr.project_id, ncrId: ncr.id, ncrNumber: ncr.ncr_number,
    title: `${ncr.ncr_number} ${phrase}`,
    body: `"${ncr.title}" ${phrase}.`,
    type: 'alert',
    ncrTitle: ncr.title,
    status: phrase,
  })
}

// ─────────────────────────────────────────────────────────────
// Demo seed
// ─────────────────────────────────────────────────────────────

export async function seedNcrDemo(projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  const admin = createAdminClient()

  const { count } = await admin
    .from('ncrs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if ((count ?? 0) > 0) return { error: 'This project already has NCRs' }

  const now = Date.now()
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString()

  const seeds = [
    { title: 'Torque values not recorded on module clamps', description: 'QA inspection found no torque records for PV module clamp bolts in Array 4.', source: 'failed_inspection', root_cause: 'Installation crew skipped the torque log for a full array row.', corrective_action: 'Re-torque all clamps in Array 4 and record on the torque sheet; retrain crew.', status: 'closed', cycle: 1, reinspection_passed: true, closure_note: 'All clamps re-torqued and logged; re-inspection passed on 2026-06-30.', raised_at: iso(45), closed_at: iso(30) },
    { title: 'Cable trench backfill compaction below spec', description: 'Compaction test at trench section T-12 returned 88% vs 95% required.', source: 'failed_inspection', root_cause: 'Backfill placed in single lift without staged compaction.', corrective_action: 'Excavate, re-place in 200mm lifts, re-test compaction.', status: 'in_rectification', cycle: 2, reinspection_passed: false, closure_note: null, raised_at: iso(20), closed_at: null },
    { title: 'Earthing conductor sizing discrepancy', description: 'Site audit noted earthing conductor smaller than IFC drawing spec at IS-02.', source: 'audit', root_cause: 'Wrong reel used from stores.', corrective_action: 'Replace with correct 120mm² conductor; verify against drawing.', status: 're_inspection', cycle: 1, reinspection_passed: false, closure_note: null, raised_at: iso(12), closed_at: null },
    { title: 'Housekeeping - debris around inverter stations', description: 'Site walk observation: construction debris accumulating near IS-05.', source: 'site_observation', root_cause: null, corrective_action: null, status: 'open', cycle: 1, reinspection_passed: false, closure_note: null, raised_at: iso(3), closed_at: null },
  ] as const

  const { error } = await admin.from('ncrs').insert(
    seeds.map(s => ({
      tenant_id: actor.tenantId,
      project_id: projectId,
      title: s.title,
      description: s.description,
      source: s.source,
      root_cause: s.root_cause,
      corrective_action: s.corrective_action,
      status: s.status,
      cycle: s.cycle,
      reinspection_passed: s.reinspection_passed,
      closure_note: s.closure_note,
      raised_at: s.raised_at,
      closed_at: s.closed_at,
      raised_by: actor.userId,
    })),
  )
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}
