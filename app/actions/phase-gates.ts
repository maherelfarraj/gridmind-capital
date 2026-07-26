'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowLogEntry } from '@/components/workflow/workflow-timeline'
import { requireRole } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'

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
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('projects')
    .select('current_phase, status')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  const phase = typeof data?.current_phase === 'number' ? data.current_phase : 0
  const gateIdx = Math.min(Math.max(phase, 0), 6)

  const currentGate = GATE_ORDER[gateIdx]
  const completedGates = GATE_ORDER.slice(0, gateIdx) as GateCode[]

  return { currentGate, completedGates, approvedThrough: gateIdx - 1 }
}

/**
 * Advance a project to the next gate (G0→G1, G1→G2, etc).
 * Increments current_phase by 1 (capped at 6).
 *
 * Authorization: Caller must be system_admin, tenant_admin, or project_director.
 *
 * Workflow gate sign-off guard: If the current gate has unsigned sign-offs
 * (gate_signoffs table with status != 'signed'), advancement is blocked UNLESS
 * opts.viaApproval=true, which indicates this call originates from decideApproval
 * after the G0 opportunity was already approved (approval workflow supersedes sign-offs).
 */
export async function advanceProjectGate(
  projectId: string,
  opts?: { viaApproval?: boolean }
): Promise<{ error?: string; newGate?: GateCode }> {
  // 1. Authorization: require project director or admin role.
  const gate = await requireRole(['system_admin', 'tenant_admin', 'project_director'] as const)
  if ('error' in gate) return gate

  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data: proj } = await supabase
    .from('projects')
    .select('current_phase')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (!proj) return { error: 'Project not found' }
  const current = typeof proj.current_phase === 'number' ? proj.current_phase : 0
  if (current >= 6) return { error: 'Project is already at the final gate (G6)' }
  const next = current + 1

  // 2. Workflow gate sign-off guard: unless coming via approval, check for unsigned sign-offs.
  // G0 approval advancement (viaApproval=true) bypasses this check — the approval workflow
  // already verified all required stakeholders. G1–G6 advances always check.
  if (!opts?.viaApproval) {
    // `gate_signoffs` has NO project_id / gate_number columns — it links to a
    // project only through phase_gates(phase_gate_id → project_id, phase_number).
    // The previous version filtered on those nonexistent columns, so PostgREST
    // returned error 42703, `data` came back null, and the discarded error meant
    // the guard silently passed every time. Resolve the phase_gate first.
    const { data: phaseGate, error: pgErr } = await supabase
      .from('phase_gates')
      .select('id')
      .eq('project_id', projectId)
      .eq('phase_number', current)
      .maybeSingle()

    if (pgErr) return { error: `Could not verify gate sign-offs: ${pgErr.message}` }

    if (phaseGate?.id) {
      const { data: unsignedSignoffs, error: soErr } = await supabase
        .from('gate_signoffs')
        .select('id')
        .eq('phase_gate_id', phaseGate.id)
        .neq('status', 'signed')
        .limit(1)

      if (soErr) return { error: `Could not verify gate sign-offs: ${soErr.message}` }

      if (unsignedSignoffs && unsignedSignoffs.length > 0) {
        return { error: `Gate G${current} has unsigned sign-offs. All required sign-offs must be completed before advancing.` }
      }
    }
  }

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
    .eq('tenant_id', tenantId)

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

  // NOTE: This G0-G6 stepper is intentionally decoupled from the phase_gates
  // table, which is now owned exclusively by the /team gate sign-off flow
  // (its triggers spawn sign-offs / enforce approval on any phase_gates write).
  // The stepper's UI derives entirely from projects.current_phase; the gate
  // transition is recorded to workflow_events so it still surfaces on the
  // project timeline (via getModuleEvents) without touching phase_gates.
  await supabase.from('workflow_events').insert({
    instance_id: null,
    from_state: GATE_ORDER[current],
    to_state: GATE_ORDER[next],
    transition_code: 'GATE_ADVANCE',
    actor_id: reviewerId,
    comment: `${GATE_ORDER[current]} approved → ${GATE_ORDER[next]} opened`,
    metadata: { module: 'gate', project_id: projectId, gate_from: GATE_ORDER[current], gate_to: GATE_ORDER[next] },
    created_at: nowIso,
  })

  return { newGate: GATE_ORDER[next] }
}

/**
 * Derive a project's workflow timeline from workflow_events.
 *
 * Gate transitions (from advanceProjectGate), module events (VO/NCR/finance/…),
 * and electronic signatures are all merged here. This function no longer reads
 * phase_gates — that table is owned exclusively by the /team gate sign-off flow.
 */
export async function getProjectTimeline(projectId: string): Promise<WorkflowLogEntry[]> {
  const supabase = createAdminClient()

  const logs: WorkflowLogEntry[] = []

  // Merge real module events (VO, NCR, cost control, cash flow, retention, guarantees,
  // and gate advances) recorded in workflow_events with metadata.project_id === projectId.
  // recorded in workflow_events with metadata.project_id === projectId.
  const moduleLogs = await getModuleEvents(supabase, projectId)
  logs.push(...moduleLogs)

  // Merge electronic signatures captured against this project (gate sign-offs,
  // certificates) so each appears as a timeline entry with its signature image.
  const signatureLogs = await getSignatureEvents(supabase, projectId)
  logs.push(...signatureLogs)

  // Newest first
  return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

// ─────────────────────────────────────────────────────────────
// Module events → timeline entries
// ─────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { objectType: string; label: string }> = {
  gate:       { objectType: 'gate',     label: 'Gate' },
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
  if (t.includes('ADVANCE')) return 'workflow.approve'
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

const SIG_ENTITY_LABEL: Record<string, string> = {
  gate_approval: 'Gate Approval',
  vo_approval: 'Variation Order',
  client_report: 'Client Report',
  certificate: 'Gate Certificate',
}

/** Electronic signatures for a project → timeline entries carrying the signature image. */
async function getSignatureEvents(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
): Promise<WorkflowLogEntry[]> {
  const { data } = await supabase
    .from('signatures')
    .select('id, entity_type, entity_id, signer_name, signer_role, signature_image_path, signed_at, ip_address, statement')
    .eq('project_id', projectId)
    .order('signed_at', { ascending: false })
    .limit(100)

  const rows = data ?? []
  return Promise.all(
    rows.map(async (r: Record<string, any>): Promise<WorkflowLogEntry> => {
      const { data: signed } = await supabase.storage
        .from('documents')
        .createSignedUrl(r.signature_image_path as string, 3600)
      const label = SIG_ENTITY_LABEL[r.entity_type as string] ?? 'Signature'
      return {
        id: `sig-${r.id}`,
        action: 'workflow.approve',
        object_type: 'signature',
        object_id: r.entity_id as string,
        object_code: `${label} · Signed`,
        actor_name: r.signer_name as string,
        actor_role: (r.signer_role as string) ?? null,
        before_state: null,
        after_state: 'signed',
        decision_reason: null,
        metadata: {
          signature: {
            imageUrl: signed?.signedUrl ?? '',
            signerName: r.signer_name,
            signerRole: r.signer_role,
            signedAt: r.signed_at,
            ip: r.ip_address,
          },
        },
        created_at: r.signed_at as string,
      }
    }),
  )
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

// ─── Gate Progress Report ─────────────────────────────────────────────────────

export interface GateProgressRow {
  projectId:   string
  projectCode: string
  projectName: string
  phaseNumber: number
  phaseName:   string
  status:      string
  reviewedAt:  string | null
  notes:       string | null
}

/** Returns all phase_gates rows joined with project name/code for the Reports center. */
export async function getGateProgressReport(): Promise<GateProgressRow[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data: gates } = await supabase
    .from('phase_gates')
    .select('project_id, phase_number, phase_name, status, reviewed_at, notes')
    .eq('tenant_id', tenantId)
    .order('project_id')
    .order('phase_number')

  if (!gates?.length) return []

  const projectIds = Array.from(new Set(gates.map((g) => g.project_id as string)))
  const { data: projects } = await supabase
    .from('projects')
    .select('id, code, name')
    .in('id', projectIds)

  const pm = Object.fromEntries((projects ?? []).map((p) => [p.id as string, { code: p.code as string, name: p.name as string }]))

  return gates.map((g) => ({
    projectId:   g.project_id as string,
    projectCode: pm[g.project_id as string]?.code  ?? '—',
    projectName: pm[g.project_id as string]?.name  ?? 'Project',
    phaseNumber: g.phase_number as number,
    phaseName:   g.phase_name   as string ?? `G${g.phase_number}`,
    status:      g.status       as string ?? 'pending',
    reviewedAt:  g.reviewed_at  as string | null,
    notes:       g.notes        as string | null,
  }))
}
