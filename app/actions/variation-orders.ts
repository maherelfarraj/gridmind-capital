'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendVoEmail } from '@/lib/email/send'
import { maybeCreateCostOverrunInsight } from '@/app/actions/ai-insights'
import { createApproval } from '@/app/actions/approvals'
import { requireRole } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type VoOrigin = 'ifc_discrepancy' | 'client_request' | 'site_condition'
export type VoStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn'

export interface VariationOrder {
  id: string
  tenant_id: string
  project_id: string
  vo_number: string
  title: string
  description: string | null
  origin: VoOrigin
  cost_impact: number | null
  time_impact_days: number | null
  status: VoStatus
  submitted_at: string | null
  decided_at: string | null
  baseline_updated: boolean
  executed: boolean
  executed_at: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  client_visible: boolean
  client_cost_visible: boolean
}

export interface VoKpis {
  approvedValue: number
  pendingValue: number
  totalCount: number
  byStatus: { name: VoStatus; value: number }[]
  /** Sum of time_impact_days across approved VOs. */
  approvedTimeImpactDays: number
  /** Baseline project budget + approved VO cost impact. */
  currentContractValue: number
  /** Baseline project budget (budget_usd) before VO adjustments. */
  baselineBudget: number
}

export interface VoRegister {
  rows: VariationOrder[]
  kpis: VoKpis
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
    if (!user) return { userId: null, tenantId, role: null, fullName: null }
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, full_name')
      .eq('id', user.id)
      .single()
    return {
      userId: user.id,
      tenantId,
      role: profile?.role ?? null,
      fullName: profile?.full_name ?? null,
    }
  } catch {
    return { userId: null, tenantId, role: null, fullName: null }
  }
}

const PM_ROLES = ['project_manager', 'project_director', 'pmo_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager', 'finance_controller']

function canEditAll(role: string | null): boolean {
  return role == null || PM_ROLES.includes(role) // null (dev/unauthed) treated as PM for demo
}
function canEditCost(role: string | null): boolean {
  return canEditAll(role) || (role != null && FINANCE_ROLES.includes(role))
}

/** Append an immutable entry to the shared workflow_events audit spine. */
async function logEvent(admin: ReturnType<typeof createAdminClient>, args: {
  vo: VariationOrder | { id: string; project_id: string; vo_number: string }
  from: VoStatus | null
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
      module: 'variation_order',
      vo_id: args.vo.id,
      vo_number: args.vo.vo_number,
      project_id: args.vo.project_id,
      ...args.metadata,
    },
  })
}

/** Notify all PM + Financial users in the tenant of a VO status change. */
async function notifyStakeholders(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string; projectId: string; voId: string; voNumber: string
  title: string; body: string; type?: string
  voTitle?: string; status?: string; costImpact?: number
}) {
  const { data: recipients } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('tenant_id', args.tenantId)
    .eq('is_active', true)
    .in('role', [...new Set([...PM_ROLES, ...FINANCE_ROLES])])

  if (!recipients?.length) return
  await admin.from('notifications').insert(
    recipients.map((r) => ({
      user_id: r.id,
      tenant_id: args.tenantId,
      title: args.title,
      body: args.body,
      type: args.type ?? 'approval',
      channel: 'in_app',
      link: `/projects/${args.projectId}/variations/${args.voId}`,
    })),
  )

  // Email each recipient (prefs-aware, logged) — fire-and-forget.
  const { data: proj } = await admin.from('projects').select('code').eq('id', args.projectId).maybeSingle()
  const projectCode = proj?.code ?? 'PROJECT'
  void Promise.all(
    recipients
      .filter((r) => r.email)
      .map((r) =>
        sendVoEmail({
          to: r.email as string,
          userId: r.id,
          voNumber: args.voNumber,
          title: args.voTitle ?? args.body,
          status: args.status ?? args.title,
          costImpact: args.costImpact ?? 0,
          projectCode,
          projectId: args.projectId,
        }),
      ),
  ).catch((e) => console.error('[vo] email failed:', e))
}

function mapRow(r: any): VariationOrder {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    project_id: r.project_id,
    vo_number: r.vo_number,
    title: r.title,
    description: r.description,
    origin: r.origin,
    cost_impact: r.cost_impact == null ? null : Number(r.cost_impact),
    time_impact_days: r.time_impact_days,
    status: r.status,
    submitted_at: r.submitted_at,
    decided_at: r.decided_at,
    baseline_updated: r.baseline_updated,
    executed: r.executed,
    executed_at: r.executed_at,
    created_by: r.created_by,
    created_by_name: r.profiles?.full_name ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    client_visible: r.client_visible ?? false,
    client_cost_visible: r.client_cost_visible ?? false,
  }
}

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/variations`)
  revalidatePath('/', 'layout')
}

// ─────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────

export async function getVariationOrders(projectId: string): Promise<VoRegister> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('variation_orders')
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .eq('project_id', projectId)
    .order('vo_number', { ascending: true })

  const rows = (error || !data ? [] : data).map(mapRow)

  const approvedRows = rows.filter(r => r.status === 'approved')
  const approvedValue = approvedRows.reduce((s, r) => s + (r.cost_impact ?? 0), 0)
  const pendingValue  = rows.filter(r => r.status === 'submitted').reduce((s, r) => s + (r.cost_impact ?? 0), 0)
  const approvedTimeImpactDays = approvedRows.reduce((s, r) => s + (r.time_impact_days ?? 0), 0)
  const statusOrder: VoStatus[] = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn']
  const byStatus = statusOrder.map(s => ({ name: s, value: rows.filter(r => r.status === s).length }))

  // Baseline budget for the current contract value (budget + approved VOs).
  const { data: proj } = await admin.from('projects').select('budget_usd').eq('id', projectId).maybeSingle()
  const baselineBudget = proj?.budget_usd == null ? 0 : Number(proj.budget_usd)
  const currentContractValue = baselineBudget + approvedValue

  // Fire-and-forget: raise a cost_overrun AI insight if pending VO impact > 5% of budget.
  void maybeCreateCostOverrunInsight(projectId)

  return {
    rows,
    kpis: {
      approvedValue, pendingValue, totalCount: rows.length, byStatus,
      approvedTimeImpactDays, currentContractValue, baselineBudget,
    },
  }
}

export async function getVariationOrder(id: string): Promise<VariationOrder | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('variation_orders')
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return mapRow(data)
}

// ─────────────────────────────────────────────────────────────
// Create / Update
// ─────────────────────────────────────────────────────────────

export async function createVariationOrder(input: {
  project_id: string
  title: string
  description?: string
  origin: VoOrigin
  cost_impact?: number | null
  time_impact_days?: number | null
}): Promise<ActionResult<VariationOrder>> {
  if (!input.title?.trim()) return { error: 'Title is required' }
  const actor = await getActor()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('variation_orders')
    .insert({
      tenant_id: actor.tenantId,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      origin: input.origin,
      cost_impact: input.cost_impact ?? null,
      time_impact_days: input.time_impact_days ?? null,
      status: 'draft',
      created_by: actor.userId,
    })
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to create variation order' }
  const vo = mapRow(data)
  await logEvent(admin, { vo, from: null, to: 'draft', transition: 'VO_CREATE', actorId: actor.userId })
  revalidate(input.project_id)
  return { data: vo }
}

export async function updateVariationOrder(id: string, patch: {
  title?: string
  description?: string
  origin?: VoOrigin
  cost_impact?: number | null
  time_impact_days?: number | null
}): Promise<ActionResult<VariationOrder>> {
  const actor = await getActor()
  const admin = createAdminClient()

  const existing = await getVariationOrder(id)
  if (!existing) return { error: 'Variation order not found' }
  if (existing.status !== 'draft') return { error: 'Only draft variation orders can be edited' }

  // Role-based field gating: finance may only touch cost_impact; PM may touch all.
  const updates: Record<string, unknown> = {}
  const keys = Object.keys(patch) as (keyof typeof patch)[]
  const nonCostChange = keys.some(k => k !== 'cost_impact' && patch[k] !== undefined)

  if (nonCostChange && !canEditAll(actor.role)) {
    return { error: 'Your role can only edit the cost impact of a variation order' }
  }
  if (patch.cost_impact !== undefined && !canEditCost(actor.role)) {
    return { error: 'You do not have permission to edit cost impact' }
  }

  if (patch.title !== undefined)            updates.title = patch.title.trim()
  if (patch.description !== undefined)      updates.description = patch.description?.trim() || null
  if (patch.origin !== undefined)           updates.origin = patch.origin
  if (patch.cost_impact !== undefined)      updates.cost_impact = patch.cost_impact
  if (patch.time_impact_days !== undefined) updates.time_impact_days = patch.time_impact_days
  if (Object.keys(updates).length === 0)    return { data: existing }
  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('variation_orders')
    .update(updates)
    .eq('id', id)
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Update failed' }
  revalidate(existing.project_id)
  return { data: mapRow(data) }
}

// ─────────────────────────────────────────────────────────────
// Workflow transitions
// ─────────────────────────────────────────────────────────────

/** Step 1: Draft → Submitted. Requires cost_impact + time_impact_days. */
export async function submitVariationOrder(id: string): Promise<ActionResult<VariationOrder>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const vo = await getVariationOrder(id)
  if (!vo) return { error: 'Variation order not found' }
  if (vo.status !== 'draft') return { error: `Cannot submit a variation order in "${vo.status}" status` }
  if (vo.cost_impact == null || vo.time_impact_days == null) {
    return { error: 'Cost impact and time impact (days) are both required before submission' }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('variation_orders')
    .update({ status: 'submitted', submitted_at: now, updated_at: now })
    .eq('id', id)
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Submission failed' }

  await logEvent(admin, { vo, from: 'draft', to: 'submitted', transition: 'VO_SUBMIT', actorId: actor.userId,
    metadata: { cost_impact: vo.cost_impact, time_impact_days: vo.time_impact_days } })
  await notifyStakeholders(admin, {
    tenantId: vo.tenant_id, projectId: vo.project_id, voId: vo.id, voNumber: vo.vo_number,
    title: `${vo.vo_number} submitted to client`,
    body: `"${vo.title}" was submitted — cost impact ${formatUsd(vo.cost_impact)}, ${vo.time_impact_days} day(s).`,
    type: 'approval',
    voTitle: vo.title, status: 'Submitted', costImpact: vo.cost_impact ?? 0,
  })

  // Route the VO through the shared approval inbox. Best-effort: the VO is
  // already submitted, so a guard rejection here must not roll that back.
  try {
    const { data: proj } = await admin
      .from('projects').select('code, name').eq('id', vo.project_id).maybeSingle()
    const res = await createApproval({
      title:       `${vo.vo_number} — ${vo.title}`,
      description: `Variation order submitted for approval. Cost impact ${formatUsd(vo.cost_impact)}, ${vo.time_impact_days} day(s).`,
      objectType:  'variation',
      priority:    (vo.cost_impact ?? 0) >= 250_000 ? 'high' : 'normal',
      amount:      vo.cost_impact ?? 0,
      requestedBy: actor.userId ?? undefined,
      projectCode: (proj?.code as string) ?? undefined,
      projectName: (proj?.name as string) ?? vo.title,
    })
    if ('error' in res) console.warn('[variation-orders] approval creation skipped:', res.error)
  } catch (e) {
    console.warn('[variation-orders] approval creation failed:', e)
  }

  revalidate(vo.project_id)
  return { data: mapRow(data) }
}

/** Step 2: Client decision — Approved / Rejected / Withdrawn. */
export async function decideVariationOrder(
  id: string,
  decision: 'approved' | 'rejected' | 'withdrawn',
  comment?: string,
): Promise<ActionResult<VariationOrder>> {
  // Only approving roles may decide a submitted VO (segregation of duties).
  const gate = await requireRole(['system_admin', 'tenant_admin', 'project_director', 'finance_manager'])
  if ('error' in gate) return gate

  const actor = await getActor()
  const admin = createAdminClient()
  const vo = await getVariationOrder(id)
  if (!vo) return { error: 'Variation order not found' }
  if (vo.status !== 'submitted') return { error: 'Only submitted variation orders can be decided' }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('variation_orders')
    .update({ status: decision, decided_at: now, updated_at: now })
    .eq('id', id)
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Decision failed' }

  await logEvent(admin, { vo, from: 'submitted', to: decision, transition: `VO_${decision.toUpperCase()}`,
    actorId: actor.userId, comment })
  await notifyStakeholders(admin, {
    tenantId: vo.tenant_id, projectId: vo.project_id, voId: vo.id, voNumber: vo.vo_number,
    title: `${vo.vo_number} ${decision}`,
    body: `"${vo.title}" was ${decision}${comment ? `: ${comment}` : ''}.`,
    type: decision === 'approved' ? 'approval' : 'alert',
    voTitle: vo.title, status: decision.charAt(0).toUpperCase() + decision.slice(1), costImpact: vo.cost_impact ?? 0,
  })
  revalidate(vo.project_id)
  return { data: mapRow(data) }
}

/** Step 3: On approved, confirm baseline update; optionally adjust project budget + target completion. */
export async function updateVariationBaselines(id: string, opts: {
  newBudgetUsd?: number | null
  newTargetCompletion?: string | null
}): Promise<ActionResult<VariationOrder>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const vo = await getVariationOrder(id)
  if (!vo) return { error: 'Variation order not found' }
  if (vo.status !== 'approved') return { error: 'Baselines can only be updated for approved variation orders' }
  if (vo.baseline_updated) return { error: 'Baselines have already been updated for this variation order' }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('variation_orders')
    .update({ baseline_updated: true, updated_at: now })
    .eq('id', id)
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Baseline update failed' }

  // Adjust the project baselines (capex budget + target completion) if provided
  const projPatch: Record<string, unknown> = {}
  if (opts.newBudgetUsd != null)        projPatch.budget_usd = opts.newBudgetUsd
  if (opts.newTargetCompletion)         projPatch.target_completion = opts.newTargetCompletion
  if (Object.keys(projPatch).length) {
    projPatch.updated_at = now
    await admin.from('projects').update(projPatch).eq('id', vo.project_id)
  }

  await logEvent(admin, { vo, from: 'approved', to: 'approved', transition: 'VO_BASELINE_UPDATE',
    actorId: actor.userId,
    metadata: { baseline_updated: true, new_budget_usd: opts.newBudgetUsd ?? null, new_target_completion: opts.newTargetCompletion ?? null } })
  await notifyStakeholders(admin, {
    tenantId: vo.tenant_id, projectId: vo.project_id, voId: vo.id, voNumber: vo.vo_number,
    title: `${vo.vo_number} baselines updated`,
    body: `Project baselines were adjusted for "${vo.title}".`,
    type: 'info',
  })
  revalidate(vo.project_id)
  return { data: mapRow(data) }
}

/** Step 4 / Rule: VO work cannot be executed before approval + baseline update. */
export async function markVariationExecuted(id: string): Promise<ActionResult<VariationOrder>> {
  const actor = await getActor()
  const admin = createAdminClient()
  const vo = await getVariationOrder(id)
  if (!vo) return { error: 'Variation order not found' }
  if (vo.status !== 'approved') return { error: 'VO work cannot be executed before it is approved' }
  if (!vo.baseline_updated) return { error: 'VO work cannot be executed before baselines are updated' }
  if (vo.executed) return { error: 'This variation order is already marked executed' }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('variation_orders')
    .update({ executed: true, executed_at: now, updated_at: now })
    .eq('id', id)
    .select('*, profiles!variation_orders_created_by_fkey (full_name)')
    .single()
  if (error || !data) return { error: error?.message ?? 'Execution update failed' }

  await logEvent(admin, { vo, from: 'approved', to: 'approved', transition: 'VO_EXECUTED', actorId: actor.userId })
  revalidate(vo.project_id)
  return { data: mapRow(data) }
}

// ─────────────────────────────────────────────────────────────
// Demo seed
// ─────────────────────────────────────────────────────────────

export async function seedVariationDemo(projectId: string): Promise<ActionResult> {
  const actor = await getActor()
  const admin = createAdminClient()

  const { count } = await admin
    .from('variation_orders')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if ((count ?? 0) > 0) return { error: 'This project already has variation orders' }

  const now = Date.now()
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString()

  const seeds = [
    { title: 'Revised cable trench routing (IFC clash)', description: 'DC cable trench rerouted to avoid conflict with stormwater culvert identified during IFC review.', origin: 'ifc_discrepancy', cost_impact: 185000, time_impact_days: 12, status: 'approved', baseline_updated: true, executed: true, submitted_at: iso(40), decided_at: iso(33) },
    { title: 'Client-requested additional MV switchgear bay', description: 'Owner requested one extra 33kV switchgear bay for future expansion.', origin: 'client_request', cost_impact: 420000, time_impact_days: 21, status: 'approved', baseline_updated: false, executed: false, submitted_at: iso(20), decided_at: iso(14) },
    { title: 'Rock excavation at inverter station foundations', description: 'Unforeseen hard rock encountered requiring blasting at IS-03/IS-04.', origin: 'site_condition', cost_impact: 96000, time_impact_days: 8, status: 'submitted', baseline_updated: false, executed: false, submitted_at: iso(5), decided_at: null },
    { title: 'Fencing specification upgrade', description: 'Upgrade perimeter fence to anti-climb spec per revised security assessment.', origin: 'client_request', cost_impact: 34000, time_impact_days: 3, status: 'rejected', baseline_updated: false, executed: false, submitted_at: iso(28), decided_at: iso(24) },
    { title: 'Access road widening', description: 'Draft VO for widening the site access road for abnormal load delivery.', origin: 'site_condition', cost_impact: null, time_impact_days: null, status: 'draft', baseline_updated: false, executed: false, submitted_at: null, decided_at: null },
  ] as const

  const { error } = await admin.from('variation_orders').insert(
    seeds.map(s => ({
      tenant_id: actor.tenantId,
      project_id: projectId,
      title: s.title,
      description: s.description,
      origin: s.origin,
      cost_impact: s.cost_impact,
      time_impact_days: s.time_impact_days,
      status: s.status,
      submitted_at: s.submitted_at,
      decided_at: s.decided_at,
      baseline_updated: s.baseline_updated,
      executed: s.executed,
      executed_at: s.executed ? iso(30) : null,
      created_by: actor.userId,
    })),
  )
  if (error) return { error: error.message }
  revalidate(projectId)
  return {}
}

// ─────────────────────────────────────────────────────────────
// util
// ─────────────────────────────────────────────────────────────

function formatUsd(v: number | null): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}
