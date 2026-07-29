'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { maybeCreatePermitSafetyInsight } from '@/app/actions/ai-insights'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/auth/guard'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PermitStatus = 'requested' | 'issued' | 'suspended' | 'expired' | 'closed' | 'cancelled'
/** Common permit-to-work categories. */
export type PermitType =
  | 'hot_work'
  | 'confined_space'
  | 'working_at_height'
  | 'electrical'
  | 'excavation'
  | 'lifting'
  | 'general'
  | string

export interface WorkPermit {
  id: string
  tenant_id: string
  project_id: string
  permit_no: string
  type: PermitType
  title: string
  location: string | null
  description: string | null
  hazards: string[]
  precautions: string[]
  requested_by: string | null
  issuer: string | null
  valid_from: string | null
  valid_to: string | null
  status: PermitStatus
  suspension_reason: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
  /** Derived: issued and expiring within 48h. */
  expiringSoon: boolean
}

export interface PermitStats {
  activeNow: number
  expiring48h: number
  requested: number
  suspended: number
}

export interface PermitsBoard {
  /** Permits grouped by status for a kanban-style board. */
  byStatus: Record<PermitStatus, WorkPermit[]>
  all: WorkPermit[]
  stats: PermitStats
}

type ActionResult<T = void> = { data?: T; error?: string }

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

interface Actor { userId: string | null; tenantId: string; role: string | null; fullName: string | null }

/** Best-effort resolve the current authenticated actor + their profile role. */
async function getActor(): Promise<Actor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: tenantId, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()
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

/** viewer is read-only; null role (dev/unauthed) is treated as a writer for demo. */
function canWrite(role: string | null): boolean {
  return role !== 'viewer'
}

/** Roles permitted to formally issue a permit to work. */
const ISSUER_ROLES = ['hse_manager', 'system_admin', 'tenant_admin', 'project_manager']
function canIssue(role: string | null): boolean {
  return role !== null && ISSUER_ROLES.includes(role)
}

/** Types that must never be simultaneously active in the same location. */
const CONFLICTING_TYPES: [string, string][] = [
  ['hot_work', 'confined_space'],
]
function typesConflict(a: string, b: string): boolean {
  return CONFLICTING_TYPES.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  )
}

/** Append an immutable entry to the shared workflow_events audit spine. */
async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  p: { id: string; project_id: string; permit_no: string }
  from: PermitStatus | null
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
      module: 'work_permit',
      permit_id: args.p.id,
      permit_no: args.p.permit_no,
      project_id: args.p.project_id,
      ...args.metadata,
    },
  })
}

function mapRow(r: any): WorkPermit {
  const status = (r.status ?? 'requested') as PermitStatus
  const validTo = r.valid_to ? new Date(r.valid_to) : null
  const expiringSoon =
    status === 'issued' &&
    validTo != null &&
    validTo.getTime() > Date.now() &&
    validTo.getTime() - Date.now() <= 48 * 3_600_000
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    project_id: r.project_id,
    permit_no: r.permit_no,
    type: r.type,
    title: r.title,
    location: r.location ?? null,
    description: r.description ?? null,
    hazards: Array.isArray(r.hazards) ? r.hazards : [],
    precautions: Array.isArray(r.precautions) ? r.precautions : [],
    requested_by: r.requested_by ?? null,
    issuer: r.issuer ?? null,
    valid_from: r.valid_from ?? null,
    valid_to: r.valid_to ?? null,
    status,
    suspension_reason: r.suspension_reason ?? null,
    closed_at: r.closed_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    expiringSoon,
  }
}

/** Generate the next permit number for a project: PTW-001. */
async function nextPermitNo(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  projectId: string,
): Promise<string> {
  const prefix = 'PTW-'
  const { data } = await admin
    .from('work_permits')
    .select('permit_no')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .like('permit_no', `${prefix}%`)
  let max = 0
  for (const row of data ?? []) {
    const n = parseInt(String(row.permit_no).slice(prefix.length), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

const EMPTY_BOARD: Record<PermitStatus, WorkPermit[]> = {
  requested: [], issued: [], suspended: [], expired: [], closed: [], cancelled: [],
}

// ─────────────────────────────────────────────────────────────
// 1. Board + stats (runs an expiry sweep first)
// ─────────────────────────────────────────────────────────────

export async function getPermitsBoard(projectId: string): Promise<PermitsBoard> {
  const { tenantId } = await getActor() // reads allowed for viewers
  const admin = createAdminClient()

  // 7. Expiry sweep — auto-expire issued permits whose validity has lapsed.
  await expireSweep(projectId, admin, tenantId)

  const { data } = await admin
    .from('work_permits')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const all = (data ?? []).map(mapRow)

  const byStatus: Record<PermitStatus, WorkPermit[]> = {
    requested: [], issued: [], suspended: [], expired: [], closed: [], cancelled: [],
  }
  for (const p of all) (byStatus[p.status] ??= []).push(p)

  const now = Date.now()
  let activeNow = 0
  let expiring48h = 0
  for (const p of all) {
    if (p.status === 'issued' && p.valid_to && new Date(p.valid_to).getTime() > now) {
      activeNow++
      if (p.expiringSoon) expiring48h++
    }
  }

  // Fire-and-forget safety watchdog: suspended permits, or >3 expired-without-closure in 7d.
  const sevenDaysAgo = now - 7 * 86_400_000
  const expiredUnclosedLast7d = byStatus.expired.filter((p) => {
    const t = new Date(p.updated_at).getTime()
    return !isNaN(t) && t >= sevenDaysAgo
  }).length
  void maybeCreatePermitSafetyInsight(projectId, byStatus.suspended.length, expiredUnclosedLast7d)

  return {
    byStatus: { ...EMPTY_BOARD, ...byStatus },
    all,
    stats: {
      activeNow,
      expiring48h,
      requested: byStatus.requested.length,
      suspended: byStatus.suspended.length,
    },
  }
}

// ─────────────────────────────────────────────────────────────
// 7. Expiry sweep (helper)
// ─────────────────────────────────────────────────────────────

/** Mark issued permits whose valid_to has passed as 'expired'. */
export async function expireSweep(
  projectId: string,
  adminClient?: ReturnType<typeof createAdminClient>,
  tenantId?: string,
): Promise<{ expired: number }> {
  const admin = adminClient ?? createAdminClient()
  const tid = tenantId ?? (await getActor()).tenantId
  const nowIso = new Date().toISOString()

  const { data } = await admin
    .from('work_permits')
    .update({ status: 'expired', updated_at: nowIso })
    .eq('tenant_id', tid)
    .eq('project_id', projectId)
    .eq('status', 'issued')
    .lt('valid_to', nowIso)
    .select('id, project_id, permit_no')

  const expired = data ?? []
  for (const p of expired) {
    await logEvent(admin, {
      p, from: 'issued', to: 'expired', transition: 'EXPIRE', actorId: null,
      comment: 'Auto-expired: validity window elapsed.',
    })
  }
  return { expired: expired.length }
}

// ─────────────────────────────────────────────────────────────
// 1b. Status-change timeline (from the workflow_events audit spine)
// ─────────────────────────────────────────────────────────────

export interface PermitTimelineEntry {
  id: string
  from: string | null
  to: string
  transition: string
  comment: string | null
  actorId: string | null
  actorName: string | null
  at: string
}

/** Ordered history of status changes for a permit, newest first. */
export async function getPermitTimeline(permitId: string): Promise<PermitTimelineEntry[]> {
  await getActor() // reads allowed for viewers
  const admin = createAdminClient()
  const { data } = await admin
    .from('workflow_events')
    .select('id, from_state, to_state, transition_code, comment, actor_id, created_at, metadata')
    .eq('metadata->>module', 'work_permit')
    .eq('metadata->>permit_id', permitId)
    .order('created_at', { ascending: false })

  const rows = data ?? []
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])]
  const names: Record<string, string> = {}
  if (actorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', actorIds)
    for (const p of profiles ?? []) names[p.id as string] = (p.full_name as string) ?? ''
  }

  return rows.map((r) => ({
    id: r.id as string,
    from: (r.from_state as string) ?? null,
    to: (r.to_state as string) ?? '',
    transition: (r.transition_code as string) ?? '',
    comment: (r.comment as string) ?? null,
    actorId: (r.actor_id as string) ?? null,
    actorName: r.actor_id ? names[r.actor_id as string] ?? null : null,
    at: r.created_at as string,
  }))
}

// ─────────────────────────────────────────────────────────────
// 2. Request (with conflict check)
// ─────────────────────────────────────────────────────────────

export interface RequestPermitInput {
  type: PermitType
  title: string
  location?: string | null
  description?: string | null
  hazards?: string[]
  precautions?: string[]
  requested_by?: string | null
  valid_from?: string | null
  valid_to?: string | null
}

export async function requestPermit(
  projectId: string,
  data: RequestPermitInput,
): Promise<ActionResult<{ id: string; permit_no: string; warning?: string }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to request permits.' }
  if (!data.type?.trim()) return { error: 'Permit type is required.' }
  if (!data.title?.trim()) return { error: 'Permit title is required.' }

  const admin = createAdminClient()

  // 8. Conflict check — warn (do not block) if an already-issued permit exists at the
  // same location with an overlapping validity window and a conflicting type.
  let warning: string | undefined
  if (data.location && data.valid_from && data.valid_to) {
    const { data: existing } = await admin
      .from('work_permits')
      .select('permit_no, type, valid_from, valid_to')
      .eq('tenant_id', actor.tenantId)
      .eq('project_id', projectId)
      .eq('status', 'issued')
      .eq('location', data.location)

    const newFrom = new Date(data.valid_from).getTime()
    const newTo = new Date(data.valid_to).getTime()
    for (const e of existing ?? []) {
      if (!e.valid_from || !e.valid_to) continue
      const eFrom = new Date(e.valid_from).getTime()
      const eTo = new Date(e.valid_to).getTime()
      const overlaps = newFrom <= eTo && eFrom <= newTo
      if (overlaps && typesConflict(String(data.type), String(e.type))) {
        warning = `Conflict: permit ${e.permit_no} (${e.type}) is already issued for "${data.location}" during an overlapping period. Concurrent ${data.type} work here is not permitted without HSE review.`
        break
      }
    }
  }

  const permit_no = await nextPermitNo(admin, actor.tenantId, projectId)

  const { data: inserted, error } = await admin
    .from('work_permits')
    .insert({
      tenant_id: actor.tenantId,
      project_id: projectId,
      permit_no,
      type: data.type.trim(),
      title: data.title.trim(),
      location: data.location ?? null,
      description: data.description ?? null,
      hazards: data.hazards ?? [],
      precautions: data.precautions ?? [],
      requested_by: data.requested_by ?? actor.fullName ?? null,
      valid_from: data.valid_from ?? null,
      valid_to: data.valid_to ?? null,
      status: 'requested',
    })
    .select('id, project_id, permit_no')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Failed to request permit.' }

  await logEvent(admin, {
    p: inserted, from: null, to: 'requested', transition: 'REQUEST', actorId: actor.userId,
    metadata: { type: data.type, location: data.location ?? null, conflict_warning: warning ?? null },
  })

  revalidatePath(`/projects/${projectId}/permits`)
  return { data: { id: inserted.id, permit_no: inserted.permit_no, warning } }
}

// ─────────────────────────────────────────────────────────────
// 3–6. Lifecycle transitions
// ─────────────────────────────────────────────────────────────

/** Shared: fetch permit, guard, update, log, revalidate. */
async function transition(
  id: string,
  expectFrom: PermitStatus[] | null,
  patch: Record<string, unknown>,
  transitionCode: string,
  toState: string,
  extraMeta?: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor()
  if (!canWrite(actor.role)) return { error: 'You do not have permission to update permits.' }

  const admin = createAdminClient()
  const { data: current, error: fetchError } = await admin
    .from('work_permits')
    .select('id, project_id, permit_no, status')
    .eq('id', id)
    .single()

  if (fetchError || !current) return { error: 'Permit not found.' }
  if (expectFrom && !expectFrom.includes(current.status as PermitStatus)) {
    return { error: `Cannot perform this action on a ${current.status} permit.` }
  }

  const { error } = await admin
    .from('work_permits')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  await logEvent(admin, {
    p: current, from: current.status as PermitStatus, to: toState,
    transition: transitionCode, actorId: actor.userId, metadata: extraMeta,
  })

  revalidatePath(`/projects/${current.project_id}/permits`)
  return { data: { id } }
}

/** 3. requested → issued (role-gated: hse_manager/system_admin/tenant_admin/project_manager). */
export async function issuePermit(
  id: string,
  issuerName: string,
): Promise<ActionResult<{ id: string }>> {
  const actor = await getActor()
  if (!canIssue(actor.role)) {
    return { error: 'Only an HSE manager, project manager or administrator can issue a permit.' }
  }
  return transition(
    id, ['requested'],
    { status: 'issued', issuer: issuerName?.trim() || actor.fullName || 'Unknown' },
    'ISSUE', 'issued',
    { issuer: issuerName?.trim() || actor.fullName || null },
  )
}

/** 4. issued → suspended (records reason). */
export async function suspendPermit(
  id: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  if (!reason?.trim()) return { error: 'A suspension reason is required.' }
  return transition(
    id, ['issued'],
    { status: 'suspended', suspension_reason: reason.trim() },
    'SUSPEND', 'suspended',
    { reason: reason.trim() },
  )
}

/** 5. suspended → issued (clears suspension reason). */
export async function reinstatePermit(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, ['suspended'],
    { status: 'issued', suspension_reason: null },
    'REINSTATE', 'issued',
  )
}

/** 6a. any → closed (stamps closed_at). */
export async function closePermit(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, null,
    { status: 'closed', closed_at: new Date().toISOString() },
    'CLOSE', 'closed',
  )
}

/** 6b. any → cancelled. */
export async function cancelPermit(id: string): Promise<ActionResult<{ id: string }>> {
  return transition(
    id, null,
    { status: 'cancelled' },
    'CANCEL', 'cancelled',
  )
}
