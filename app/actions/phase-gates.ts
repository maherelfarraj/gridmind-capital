'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowLogEntry } from '@/components/workflow/workflow-timeline'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

const GATE_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const
type GateCode = typeof GATE_ORDER[number]

export interface ProjectGateState {
  currentGate: GateCode
  completedGates: GateCode[]
  approvedThrough: number   // gate index (0-6) — -1 = none approved
}

/**
 * Derive live gate state from the project's current_phase column.
 * current_phase is a 0-based integer (0=G0, 1=G1, … 6=G6).
 */
export async function getProjectGateState(projectId: string): Promise<ProjectGateState> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('projects')
    .select('current_phase, status')
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  const phase = typeof data?.current_phase === 'number' ? data.current_phase : 0
  const gateIdx = Math.min(Math.max(phase, 0), 6)

  const currentGate = GATE_ORDER[gateIdx]
  const completedGates = GATE_ORDER.slice(0, gateIdx) as GateCode[]

  return { currentGate, completedGates, approvedThrough: gateIdx - 1 }
}

/**
 * Advance a project to the next gate.
 * Increments current_phase by 1 (capped at 6).
 */
export async function advanceProjectGate(
  projectId: string,
): Promise<{ error?: string; newGate?: GateCode }> {
  const supabase = createAdminClient()

  const { data: proj } = await supabase
    .from('projects')
    .select('current_phase')
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  if (!proj) return { error: 'Project not found' }
  const current = typeof proj.current_phase === 'number' ? proj.current_phase : 0
  if (current >= 6) return { error: 'Project is already at the final gate (G6)' }
  const next = current + 1

  // Gate G5 (phase 5, PAC) cannot be approved while any NCR on the project is not Closed.
  if (current === 5) {
    const { data: openNcrs } = await supabase
      .from('ncrs')
      .select('ncr_number')
      .eq('project_id', projectId)
      .neq('status', 'closed')
      .order('ncr_number', { ascending: true })
    if (openNcrs && openNcrs.length > 0) {
      const list = openNcrs.map((n: { ncr_number: string }) => n.ncr_number).join(', ')
      return { error: `Gate G5 cannot be approved: ${openNcrs.length} NCR(s) are not Closed (${list}). Close all NCRs before submitting for gate approval.` }
    }
  }

  const { error } = await supabase
    .from('projects')
    .update({ current_phase: next })
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)

  if (error) return { error: error.message }

  // Resolve the acting reviewer (best-effort; column is nullable)
  let reviewerId: string | null = null
  try {
    const authed = await createClient()
    const { data: userData } = await authed.auth.getUser()
    reviewerId = userData.user?.id ?? null
  } catch {
    reviewerId = null
  }

  const nowIso = new Date().toISOString()

  // Mark the just-completed gate approved, and the newly-active gate in_review.
  // This drives the WorkflowTimeline (derived in getProjectTimeline).
  await supabase
    .from('phase_gates')
    .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: nowIso, updated_at: nowIso })
    .eq('project_id', projectId)
    .eq('phase_number', current)

  await supabase
    .from('phase_gates')
    .update({ status: 'in_review', updated_at: nowIso })
    .eq('project_id', projectId)
    .eq('phase_number', next)

  return { newGate: GATE_ORDER[next] }
}

/**
 * Derive a project's workflow timeline from its phase_gates rows.
 * Each approved/in_review gate transition becomes a WorkflowTimeline entry.
 * No separate events table needed — phase_gates is the single source of truth.
 */
export async function getProjectTimeline(projectId: string): Promise<WorkflowLogEntry[]> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('phase_gates')
    .select('id, phase_number, phase_name, status, reviewed_by, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  const rows = data ?? []
  const logs: WorkflowLogEntry[] = []

  for (const g of rows) {
    const gateCode = `G${g.phase_number}`
    if (g.status === 'approved') {
      logs.push({
        id: `${g.id}-approve`,
        action: 'workflow.approve',
        object_type: 'gate',
        object_id: g.id,
        object_code: `${gateCode} · ${g.phase_name}`,
        actor_name: g.reviewed_by ? 'Gate Reviewer' : 'System',
        actor_role: 'Project Manager',
        before_state: 'in_review',
        after_state: 'approved',
        decision_reason: null,
        metadata: null,
        created_at: g.updated_at ?? g.created_at,
      })
    } else if (g.status === 'in_review') {
      logs.push({
        id: `${g.id}-submit`,
        action: 'workflow.submit',
        object_type: 'gate',
        object_id: g.id,
        object_code: `${gateCode} · ${g.phase_name}`,
        actor_name: 'System',
        actor_role: null,
        before_state: 'pending',
        after_state: 'in_review',
        decision_reason: null,
        metadata: null,
        created_at: g.updated_at ?? g.created_at,
      })
    }
  }

  // Merge real module events (VO, NCR, cost control, cash flow, retention, guarantees, …)
  // recorded in workflow_events with metadata.project_id === projectId.
  const moduleLogs = await getModuleEvents(supabase, projectId)
  logs.push(...moduleLogs)

  // Newest first
  return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

// ─────────────────────────────────────────────────────────────
// Module events → timeline entries
// ─────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { objectType: string; label: string }> = {
  cash_flow:  { objectType: 'finance',  label: 'Payment Milestone' },
  retention:  { objectType: 'finance',  label: 'Retention' },
  guarantees: { objectType: 'finance',  label: 'Guarantee' },
  cost_control: { objectType: 'finance', label: 'Cost Entry' },
  variation_order: { objectType: 'approval', label: 'Variation Order' },
  vo: { objectType: 'approval', label: 'Variation Order' },
  ncr: { objectType: 'hse', label: 'NCR' },
}

/** Map a raw transition_code + module to a known WorkflowTimeline action key. */
function actionFor(transition: string | null, moduleKey: string): string {
  const t = (transition ?? '').toUpperCase()
  if (t.includes('APPROV')) return 'workflow.approve'
  if (t.includes('REJECT')) return 'workflow.reject'
  if (t.includes('ESCALAT')) return 'workflow.escalate'
  if (t.includes('RELEAS') || t.includes('DISCHARG') || t.includes('CLOSE')) return 'workflow.approve'
  if (t.includes('SUBMIT') || t.includes('RAISE') || t.includes('REQUEST')) return 'workflow.submit'
  if (moduleKey === 'cash_flow' || moduleKey === 'retention' || moduleKey === 'guarantees' || moduleKey === 'cost_control') {
    return 'finance.budget_update'
  }
  return 'activity'
}

async function getModuleEvents(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
): Promise<WorkflowLogEntry[]> {
  let rows: any[] = []
  // Try with actor profile join; fall back to a plain query if the FK alias differs.
  const joined = await supabase
    .from('workflow_events')
    .select('id, from_state, to_state, transition_code, actor_id, comment, metadata, created_at, profiles!workflow_events_actor_id_fkey (full_name, role)')
    .eq('metadata->>project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (joined.error) {
    const plain = await supabase
      .from('workflow_events')
      .select('id, from_state, to_state, transition_code, actor_id, comment, metadata, created_at')
      .eq('metadata->>project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100)
    rows = plain.data ?? []
  } else {
    rows = joined.data ?? []
  }

  return rows.map((r): WorkflowLogEntry => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    const moduleKey = String(meta.module ?? '')
    const cfg = MODULE_META[moduleKey] ?? { objectType: moduleKey || 'activity', label: moduleKey || 'Activity' }
    const code =
      (meta.vo_number as string) ||
      (meta.ncr_number as string) ||
      (r.comment as string) ||
      cfg.label
    return {
      id: r.id,
      action: actionFor(r.transition_code, moduleKey),
      object_type: cfg.objectType,
      object_id: (meta.milestone_id as string) || (meta.guarantee_id as string) || (meta.retention_id as string) || r.id,
      object_code: `${cfg.label} · ${code}`,
      actor_name: r.profiles?.full_name ?? null,
      actor_role: r.profiles?.role ?? null,
      before_state: r.from_state,
      after_state: r.to_state,
      decision_reason: r.comment ?? null,
      metadata: r.metadata,
      created_at: r.created_at,
    }
  })
}
