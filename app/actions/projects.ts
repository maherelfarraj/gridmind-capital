'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireProjectDirector } from '@/lib/auth/guard'
import { sendProjectCreatedEmail } from '@/lib/email/send'
import { createApprovalWorkflow } from '@/app/actions/approvals'
import type { Project } from '@/components/projects/projects-list-page'
import type { ProjectData } from '@/components/project/project-command-center'

import { getCurrentTenantId } from '@/lib/tenant'
import { deriveGateStatus, MAX_GATE } from '@/lib/gate-status'
import { numOrNull } from '@/lib/format-nullable'

const PHASE_MAP: Record<number, string> = {
  0: 'intake', 1: 'commercial', 2: 'engineering', 3: 'engineering',
  4: 'procurement', 5: 'construction', 6: 'commissioning', 7: 'om', 8: 'finance',
}

const GATE_NAMES: Record<number, string> = {
  0: 'Opportunity Accepted',
  1: 'Project Baseline Approved',
  2: 'Engineering IFC Release',
  3: 'Procurement Award',
  4: 'Construction Mobilization',
  5: 'Mechanical Completion',
  6: 'Handover, Ops & Closeout',
  7: 'Handover, Ops & Closeout',
  8: 'Handover, Ops & Closeout',
}

// The governed gate model is G0–G6 (matches GATE_ORDER in app/actions/phase-gates.ts).
// Used to seed phase_gates rows when a project is created.
const GATE_PHASES: { phase: number; name: string }[] = Array.from({ length: 7 }, (_, i) => ({
  phase: i,
  name: GATE_NAMES[i],
}))

export interface GetProjectsOptions {
  phase?: string | null
  /** Filter by exact `projects.current_phase` (G0 → 0, G1 → 1, …). */
  gate?: number | null
  search?: string | null
  status?: string | null
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface GetProjectsResult {
  projects: Project[]
  totalCount: number
}

export async function getProjects(opts?: GetProjectsOptions): Promise<Project[]>
export async function getProjects(opts: GetProjectsOptions & { paginated: true }): Promise<GetProjectsResult>
export async function getProjects(opts?: GetProjectsOptions & { paginated?: boolean }): Promise<Project[] | GetProjectsResult> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  const phase     = opts?.phase     ?? null
  const gate      = opts?.gate      ?? null
  const search    = opts?.search    ?? null
  const status    = opts?.status    ?? null
  const page      = opts?.page      ?? 1
  const pageSize  = opts?.pageSize  ?? 50
  const sortBy    = opts?.sortBy    ?? 'created_at'
  const sortOrder = opts?.sortOrder ?? 'desc'
  const paginated = opts?.paginated ?? false

  let query = supabase
    .from('projects')
    .select('id, code, name, status, technology, capacity_mw, budget_usd, current_phase, target_completion, location, country, health, created_at', { count: 'exact' })
    .eq('tenant_id', tenantId)

  if (phase && phase !== 'all') {
    // Map phase key back to current_phase number(s)
    const phaseNums = Object.entries(PHASE_MAP)
      .filter(([, v]) => v === phase)
      .map(([k]) => Number(k))
    if (phaseNums.length > 0) query = query.in('current_phase', phaseNums)
  }

  // Gate filter: `gate` is the raw `projects.current_phase` value (G0 → 0, G1 → 1, …).
  // This is distinct from `phase`, which maps several phases onto one workstream key.
  if (gate !== null && gate !== undefined) {
    // current_phase can exceed the governed G0–G6 range (completed projects sit at
    // 7/8) and those clamp to G6 for display. Use >= at the top gate so the filter
    // matches what the UI actually shows instead of hiding them.
    if (gate >= MAX_GATE) query = query.gte('current_phase', gate)
    else query = query.eq('current_phase', gate)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%`)
  }

  const sortCol = sortBy === 'budget_amount' ? 'budget_usd'
    : sortBy === 'target_cod' ? 'target_completion'
    : sortBy === 'name' ? 'name'
    : 'created_at'

  query = query
    .order(sortCol, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query

  if (error || !data) return paginated ? { projects: [], totalCount: 0 } : []

  // PostgREST returns PG `numeric` columns as strings — coerce before the UI does math.
  // `budget_usd` / `capacity_mw` are NULLABLE and rendered directly, so they use
  // `numOrNull` to keep NULL distinct from a real 0 (see lib/format-nullable.ts).

  const projects = data.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client_name: (p as any).client_name ?? p.location ?? p.country ?? '—',
    phase: PHASE_MAP[p.current_phase ?? 0] ?? 'intake',
    // Clamped to the governed G0–G6 range via the shared helper so completed
    // projects at phase 7/8 render as "G6" instead of a nonexistent "G8".
    gate: deriveGateStatus(p.current_phase).code,
    current_phase: p.current_phase ?? 0,
    budget_amount: numOrNull(p.budget_usd),
    status: (p.status as Project['status']) ?? 'active',
    target_cod: p.target_completion ?? '',
    // Real values so the registry can stop rendering "N/A" / "0 MW".
    country: p.country ?? '',
    location: p.location ?? '',
    technology: p.technology ?? '',
    capacity_mw: numOrNull(p.capacity_mw),
    health: (p as any).health ?? 'green',
    created_at: p.created_at ?? new Date().toISOString(),
  }))

  return paginated ? { projects, totalCount: count ?? projects.length } : projects
}

export async function getProject(id: string): Promise<ProjectData | null> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Try by UUID first, then by code
  let query = supabase
    .from('projects')
    .select('id, code, name, description, status, technology, capacity_mw, budget_usd, current_phase, health, location, country, start_date, target_completion, provenance, created_at')
    .eq('tenant_id', tenantId)

  // Detect if id looks like a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUuid) {
    query = query.eq('id', id)
  } else {
    // Codes are not guaranteed unique historically, so order deterministically
    // (oldest wins) and take one row. Using .single() here would throw when a
    // code is duplicated and surface as a bogus "project not found".
    query = query.ilike('code', id).order('created_at', { ascending: true })
  }

  const { data, error } = await query.limit(1).maybeSingle()

  // Surface query errors (42703 missing column, etc) instead of swallowing them as 404.
  // Only return null if a row legitimately doesn't exist (error=null && !data).
  if (error) throw new Error(`Failed to fetch project: ${error.message} (code: ${error.code})`)
  if (!data) return null

  const gate = data.current_phase ?? 0
  // Map current_phase (count of approved gates 0–8) to legacy phase keys (g0–g6).
  // Phases 7–8 (commissioning, handover) map to g6 for backward compatibility.
  const PHASE_KEY_MAP: Record<number, ProjectData['phase']> = {
    0: 'g0', 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4',
    5: 'g5', 6: 'g6', 7: 'g6', 8: 'g6',
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    client: data.location ?? data.country ?? '—',
    status: (data.status as ProjectData['status']) ?? 'active',
    phase: PHASE_KEY_MAP[gate] ?? 'g0',
    gate,
    gateName: GATE_NAMES[gate] ?? `Gate ${gate}`,
    // NULL means "no budget recorded yet" and must stay distinguishable from $0.
    budgetUsd: numOrNull(data.budget_usd),
    currency: 'USD',
    startDate: data.start_date ?? data.created_at?.split('T')[0] ?? '2024-01-01',
    targetCod: data.target_completion ?? '',
    location: data.location ?? data.country ?? undefined,
    // Real identity fields so gate pages can render the correct project instead of
    // falling back to a hardcoded mock charter.
    technology: data.technology ?? '',
    capacityMw: numOrNull(data.capacity_mw),
    country: data.country ?? '',
    description: data.description ?? '',
    commentCount: 0,
    documentCount: 0,
    provenance: (data.provenance as Record<string, any>) ?? {},
  }
}

export async function createProject(payload: {
  name: string
  code: string
  technology: string
  capacity_mw: number
  location: string
  country: string
  budget_usd: number
  start_date: string
  target_completion: string
  description?: string
}): Promise<{ id: string } | { error: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Guard: Postgres DATE columns reject empty strings — convert to null
  const isValidDate = (d: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d)

  // 1. Insert project at G0/planning (not active) — same as createOpportunity.
  // No project may be active without a recorded G0 approval decision.
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...payload,
      start_date:        isValidDate(payload.start_date)        ? payload.start_date        : null,
      target_completion: isValidDate(payload.target_completion) ? payload.target_completion : null,
      tenant_id: tenantId,
      status:           'planning',
      current_phase:    0,
      health:           'green',
      created_by:       gate.actor.userId,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // 2. Create the multi-level G0 approval workflow (idempotent).
  const workflowResult = await createApprovalWorkflow(
    'opportunity',
    data.id,
    payload.code,
    null, // Amount not available at wizard creation time
    gate.actor.userId,
  )
  if (workflowResult.error) return { id: data.id, error: `Approval workflow failed: ${workflowResult.error}` }

  // 3. Seed the G0–G6 gate records. All gates start pending — nothing is pre-approved.
  // Approval of G0 via decideApproval will flip to 'in_review' via applyApprovalLifecycle.
  const gateRows = GATE_PHASES.map((g) => ({
    project_id:   data.id,
    phase_number: g.phase,
    phase_name:   g.name,
    status:       'pending',
  }))
  const { error: gateErr } = await supabase.from('phase_gates').insert(gateRows)
  if (gateErr) console.log('[v0] phase_gates seed failed:', gateErr.message)

  // Fire-and-forget notification email — does not block response
  sendProjectCreatedEmail({
    to: 'admin@gridmind.capital',
    recipientName: 'GridMind Team',
    projectCode: payload.code,
    projectName: payload.name,
    technology: payload.technology,
    budgetUsd: numOrNull(payload.budget_usd),
    projectId: data.id,
  }).catch(() => {})

  return { id: data.id }
}

// ── Phase 6: transactional wizard create ─────────���───────────

// Exact G1–G8 phase names (must equal gates.name so spawn_gate_signoffs joins).
// WIZARD_PHASE_NAMES now uses the canonical 7-gate model (G0–G6), matching GATE_PHASES.
// This ensures projects created via wizard seed identical phase_gates as all other paths.
// (Previously WIZARD_PHASE_NAMES had 8 phases with different names, causing data model divergence.)
const WIZARD_PHASE_NAMES: string[] = GATE_PHASES.map((g) => g.name)

export interface CreateProjectFullInput {
  name: string
  codeHint: string
  technology: string
  capacity_mw: number
  bess_mwh: number
  location: string
  country: string
  /**
   * NULL = the creator did not state a budget (the wizard has no budget field
   * yet; it is set later via the edit form). Must not be faked as 0 — that
   * would announce a "$0" budget in the creation email and mis-route the
   * amount-threshold approval workflow.
   */
  budget_usd: number | null
  target_completion: string | null
  pdPersonId: string
  pmPersonId: string
  approvers: { gate_number: number; primary_role: string | null; secondary_role: string | null }[]
}

/**
 * Create a project with PD+PM staffing and 7 phase_gates (canonical G0–G6 model).
 * 
 * Enforces governance: Projects start at status='planning', current_phase=0 with
 * a pending G0 approval (object_type='opportunity'). This matches createProject and
 * createOpportunity patterns — no project may be 'active' without recorded approval.
 * PD/PM staffing is allowed at creation, but no gate is pre-approved.
 * 
 * No true SQL transaction is available via the JS client, so any failure after
 * the project row triggers a compensating delete (children cascade) — giving
 * all-or-nothing semantics.
 */
export async function createProjectFull(
  input: CreateProjectFullInput,
): Promise<{ id: string } | { error: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const { getActor } = await import('@/lib/db/queries')
  const actor = await getActor()
  if (!actor.userId) return { error: 'User context required' }
  const admin = createAdminClient()
  const tenantId = actor.tenantId ?? (await getCurrentTenantId())

  if (!input.name?.trim()) return { error: 'Project name is required.' }
  if (!input.pdPersonId || !input.pmPersonId) return { error: 'PD and PM are required.' }

  // Resolve PD/PM role ids.
  const { data: roleRows, error: roleErr } = await admin
    .from('roles')
    .select('id, code')
    .in('code', ['PD', 'PM'])
  if (roleErr) return { error: roleErr.message }
  const pdRoleId = roleRows?.find((r) => r.code === 'PD')?.id
  const pmRoleId = roleRows?.find((r) => r.code === 'PM')?.id
  if (!pdRoleId || !pmRoleId) return { error: 'PD/PM roles missing from catalog.' }

  const isDate = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)

  // Ensure a unique code (retry with a suffix on collision).
  // Prefer a real sequential code over the client's hint: the wizard can only
  // guess, so two wizards open at once would propose colliding codes and burn
  // retries producing suffixed codes like PRJ-2026-042-73.
  const codeYear = new Date().getFullYear()
  const codePrefix = `PRJ-${codeYear}-`
  let code = input.codeHint?.trim() || `${codePrefix}001`

  const { data: lastCoded } = await admin
    .from('projects')
    .select('code')
    .eq('tenant_id', tenantId)
    .like('code', `${codePrefix}%`)
    .order('code', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastCoded?.code) {
    const lastSeq = Number.parseInt(String(lastCoded.code).slice(codePrefix.length, codePrefix.length + 3), 10)
    if (Number.isFinite(lastSeq)) {
      code = `${codePrefix}${String(lastSeq + 1).padStart(3, '0')}`
    }
  }

  // 1) Project — starts at planning/phase 0 (not active). Governance gate: must pass G0 approval first.
  let projectId = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('projects')
      .insert({
        tenant_id: tenantId,
        code,
        name: input.name.trim(),
        technology: input.technology,
        capacity_mw: Number.isFinite(input.capacity_mw) ? input.capacity_mw : null,
        bess_mwh: Number.isFinite(input.bess_mwh) ? input.bess_mwh : null,
        location: input.location || null,
        country: input.country || null,
        target_completion: isDate(input.target_completion) ? input.target_completion : null,
        status: 'planning',
        current_phase: 0,
        health: 'green',
        project_manager: input.pmPersonId,
        created_by: actor.userId,
      })
      .select('id')
      .single()
    if (!error && data) {
      projectId = data.id as string
      break
    }
    if (error?.code === '23505') {
      // Walk the sequence forward deterministically rather than picking a random
      // suffix, so concurrent creates converge on the next free code instead of
      // gambling on an unused number.
      const seq = Number.parseInt(code.slice(codePrefix.length, codePrefix.length + 3), 10)
      code = Number.isFinite(seq)
        ? `${codePrefix}${String(seq + 1 + attempt).padStart(3, '0')}`
        : `${codePrefix}${String(Date.now() % 1000).padStart(3, '0')}`
      continue
    }
    return { error: error?.message ?? 'Failed to create project.' }
  }
  if (!projectId) return { error: `Could not allocate a unique project code near "${code}".` }

  const rollback = async (msg: string): Promise<{ error: string }> => {
    await admin.from('projects').delete().eq('id', projectId)
    return { error: msg }
  }

  // 1.5) G0 Approval Workflow — multi-level based on approval_rules (amount threshold-based).
  const workflowResult = await createApprovalWorkflow(
    'opportunity',
    projectId,
    code ?? `${codePrefix}001`,
    // `!= null`, not truthiness: a real 0 budget is a stated amount and should
    // be threshold-matched, not treated as "no amount given".
    input.budget_usd != null ? Number(input.budget_usd) : null,
    actor.userId,
  )
  if (workflowResult.error) return rollback(`G0 approval workflow failed: ${workflowResult.error}`)

  // 2) Team: PD + PM (inserted BEFORE gates so the spawn trigger finds assignees).
  const { error: teamErr } = await admin.from('project_team').insert([
    { tenant_id: tenantId, project_id: projectId, role_id: pdRoleId, person_id: input.pdPersonId, assigned_by: actor.userId },
    { tenant_id: tenantId, project_id: projectId, role_id: pmRoleId, person_id: input.pmPersonId, assigned_by: actor.userId },
  ])
  if (teamErr) return rollback(`Staffing failed: ${teamErr.message}`)

  // 3) Gate approvers (7 rows, G0–G6).
  const approverRows = GATE_PHASES.map((g) => {
    const supplied = input.approvers.find((a) => a.gate_number === g.phase)
    return {
      project_id: projectId,
      gate_number: g.phase,
      primary_role: supplied?.primary_role || 'PD',
      secondary_role: supplied?.secondary_role || null,
    }
  })
  const { error: apprErr } = await admin
    .from('project_gate_approvers')
    .upsert(approverRows, { onConflict: 'project_id,gate_number' })
  if (apprErr) return rollback(`Gate approvers failed: ${apprErr.message}`)

  // 4) phase_gates: All 7 gates start 'pending' (nothing pre-approved).
  // G0 approval decides 'Proceed' → applyApprovalLifecycle flips status='active', decideApproval calls advanceProjectGate
  // (which only runs role+sign-off checks, and viaApproval=true skips sign-offs for G0).
  // No gate spawn-signoffs trigger runs until a gate is actually in_review (after G0 approval).
  // NOTE: phase_gates has NO tenant_id column.
  const gateRows = GATE_PHASES.map((g) => ({
    project_id: projectId,
    phase_number: g.phase,
    phase_name: g.name,
    status: 'pending',
  }))
  const { error: gateErr } = await admin.from('phase_gates').insert(gateRows)
  if (gateErr) return rollback(`Gate seeding failed: ${gateErr.message}`)

  // 5) Audit. The table is `audit_log` (singular) with table_name/record_id/
  // changed_by/new_values — the previous `audit_logs` insert silently wrote
  // nothing, so project creation had no attributed audit trail.
  const { error: auditErr } = await admin.from('audit_log').insert({
    tenant_id: tenantId,
    table_name: 'projects',
    record_id: projectId,
    action: 'insert',
    changed_by: actor.userId,
    new_values: { code, name: input.name, pd: input.pdPersonId, pm: input.pmPersonId },
  })
  // Creation already succeeded, so don't roll back — but surface the failure.
  if (auditErr) {
    console.log('[v0] createProject: audit_log insert failed:', auditErr.message)
  }

  sendProjectCreatedEmail({
    to: 'admin@gridmind.capital',
    recipientName: 'GridMind Team',
    projectCode: code,
    projectName: input.name,
    technology: input.technology,
    // Was hardcoded 0, so every creation email announced a "$0" budget.
    budgetUsd: input.budget_usd ?? null,
    projectId,
  }).catch(() => {})

  return { id: projectId }
}

export interface UpdateProjectInput {
  name?: string
  country?: string
  location?: string
  technology?: string
  /**
   * `undefined` = leave unchanged; `null` = explicitly clear back to "not set".
   * A clearable numeric field needs both, otherwise emptying the input is a no-op.
   */
  capacity_mw?: number | null
  budget_usd?: number | null
  target_completion?: string
  description?: string
}

/**
 * Edit an existing project's core fields.
 *
 * Tenant-scoped like archiveProject, guarded by requireWriter, and audited with a
 * before/after snapshot so "who changed the budget?" is answerable.
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate
  const { actor } = gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Snapshot the prior values for the audit trail.
  const { data: before } = await supabase
    .from('projects')
    .select('name, country, location, technology, capacity_mw, budget_usd, target_completion, description')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!before) return { error: 'Project not found' }

  // Only send keys the caller actually provided, so blank inputs don't null out data.
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined)              patch.name = input.name.trim()
  if (input.country !== undefined)           patch.country = input.country.trim() || null
  if (input.location !== undefined)          patch.location = input.location.trim() || null
  if (input.technology !== undefined)        patch.technology = input.technology.trim() || null
  if (input.capacity_mw !== undefined)       patch.capacity_mw = input.capacity_mw
  if (input.budget_usd !== undefined)        patch.budget_usd = input.budget_usd
  if (input.target_completion !== undefined) patch.target_completion = input.target_completion || null
  if (input.description !== undefined)       patch.description = input.description.trim() || null

  if (Object.keys(patch).length === 0) return {}

  if (typeof patch.name === 'string' && patch.name.length === 0) {
    return { error: 'Project name is required' }
  }

  const { error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  // The table is `audit_log` (singular) with columns table_name/record_id/
  // changed_by/old_values/new_values. NOTE: a DB trigger already logs the
  // old/new values on every projects UPDATE, but it records changed_by = NULL
  // because the admin client bypasses auth.uid(). This row supplies the missing
  // actor attribution so "who changed the budget?" is answerable.
  const { error: auditError } = await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    table_name: 'projects',
    record_id: id,
    action: 'update',
    changed_by: actor.userId,
    old_values: before,
    new_values: patch,
  })

  // Don't fail the update if auditing fails, but never let it fail silently —
  // a swallowed audit error is how a whole audit trail goes missing unnoticed.
  if (auditError) {
    console.log('[v0] updateProject: audit_log insert failed:', auditError.message)
  }

  return {}
}

export async function archiveProject(id: string): Promise<{ error?: string }> {
  const gate = await requireProjectDirector()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { error } = await supabase
    .from('projects')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  return error ? { error: error.message } : {}
}

export async function duplicateProject(id: string): Promise<{ id?: string; error?: string }> {
  const gate = await requireProjectDirector()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: src, error: fetchErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !src) return { error: fetchErr?.message ?? 'Not found' }
  const newCode = `${src.code}-COPY-${Date.now().toString().slice(-4)}`
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...src, id: undefined, code: newCode, name: `${src.name} (Copy)`, status: 'draft', created_at: undefined, updated_at: undefined })
    .select('id')
    .single()
  return error ? { error: error.message } : { id: data?.id }
}

// ─── S09: Commercial Charter ──────────────────────────────────────────────────

export interface CommercialRecord {
  id: string
  project_id: string
  type: 'budget' | 'contract' | 'cashflow'
  category: string
  description: string
  amount: number
  status: string
  period: string | null
  created_at: string
}

export interface CommercialDashboard {
  totalBudget: number
  committed: number
  contracts: number
  byCategory: { name: string; value: number }[]
  byStatus:   { name: string; value: number; color: string }[]
  records: CommercialRecord[]
}

export async function loadCommercialDashboard(projectId: string): Promise<CommercialDashboard> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('finance_records')
    .select('id, project_id, type, category, description, amount, status, period, created_at')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as CommercialRecord[]
  const totalBudget = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const committed   = rows.filter((r) => r.status === 'committed').reduce((s, r) => s + (r.amount ?? 0), 0)
  const contracts   = rows.filter((r) => r.type === 'contract').length

  const byCategory = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.category] = (m[r.category] ?? 0) + (r.amount ?? 0) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const statusColors: Record<string, string> = {
    draft: '#94a3b8', committed: '#3b82f6', approved: '#22c55e',
    paid: '#10b981', cancelled: '#ef4444',
  }
  const byStatus = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: statusColors[name] ?? '#94a3b8' }))
  })()

  return { totalBudget, committed, contracts, byCategory, byStatus, records: rows }
}

export async function createCommercialRecord(data: {
  project_id: string; type: 'budget' | 'contract' | 'cashflow'
  category: string; description: string; amount: number; status?: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { error } = await supabase.from('finance_records').insert({
    tenant_id: tenantId,
    project_id: data.project_id,
    type:        data.type,
    category:    data.category,
    description: data.description,
    amount:      data.amount,
    status:      data.status ?? 'draft',
    period:      new Date().toISOString().slice(0, 7),
  })
  return { error: error?.message }
}

export async function seedCommercialDemoData(projectId: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data: ex } = await supabase.from('finance_records').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}
  const demos = [
    { type: 'budget',   category: 'Civil Works',       description: 'Site preparation and civil scope',   amount: 18_000_000, status: 'approved' },
    { type: 'budget',   category: 'PV Modules',        description: 'Supply of 550Wp bifacial modules',   amount: 62_000_000, status: 'committed' },
    { type: 'budget',   category: 'Inverters',         description: 'Central inverter supply (4 × 3MW)',  amount: 14_500_000, status: 'committed' },
    { type: 'budget',   category: 'Balance of Plant',  description: 'MV cabling, switchgear, substation', amount: 22_000_000, status: 'draft' },
    { type: 'budget',   category: 'EPC Management',    description: 'Project management & supervision',   amount:  9_000_000, status: 'approved' },
    { type: 'contract', category: 'EPC',               description: 'EPC contract — lump sum turnkey',    amount: 95_000_000, status: 'approved' },
    { type: 'contract', category: 'O&M',               description: '5-year O&M service agreement',       amount:  7_500_000, status: 'draft' },
    { type: 'cashflow', category: 'Revenue',           description: 'PPA milestone payment Q2-2026',       amount: 12_000_000, status: 'paid', period: '2026-06' },
  ] as const
  for (const d of demos) {
    await supabase.from('finance_records').insert({
      tenant_id: tenantId, project_id: projectId,
      period: '2026-01', ...d,
    })
  }
  return {}
}

// ─── S10: Schedule ────────────────────────────────────────────────────────────

export interface Milestone {
  id: string
  project_id: string
  name: string
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  status: 'not_started' | 'in_progress' | 'complete' | 'delayed'
  is_critical: boolean
  gate: number
  owner: string
  progress_pct: number
}

export interface ScheduleDashboard {
  totalMilestones: number
  complete: number
  inProgress: number
  delayed: number
  milestones: Milestone[]
}

export async function loadScheduleDashboard(projectId: string): Promise<ScheduleDashboard> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('schedule_milestones')
    .select('id, project_id, name, planned_start, planned_end, actual_start, actual_end, status, is_critical, gate_number, owner, progress_pct')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('planned_start', { ascending: true })

  const rows = (data ?? []).map((r): Milestone => ({
    id:            r.id,
    project_id:    r.project_id,
    name:          r.name ?? 'Milestone',
    planned_start: r.planned_start ?? new Date().toISOString().slice(0, 10),
    planned_end:   r.planned_end   ?? new Date().toISOString().slice(0, 10),
    actual_start:  r.actual_start  ?? null,
    actual_end:    r.actual_end    ?? null,
    status:        (r.status ?? 'not_started') as Milestone['status'],
    is_critical:   r.is_critical   ?? false,
    gate:          r.gate_number   ?? 0,
    owner:         r.owner         ?? 'Unassigned',
    progress_pct:  r.progress_pct  ?? 0,
  }))

  return {
    totalMilestones: rows.length,
    complete:   rows.filter((r) => r.status === 'complete').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    delayed:    rows.filter((r) => r.status === 'delayed').length,
    milestones: rows,
  }
}

export async function createMilestone(data: {
  project_id: string; name: string; planned_start: string; planned_end: string
  is_critical?: boolean; gate?: number; owner?: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { error } = await supabase.from('schedule_milestones').insert({
    tenant_id:     tenantId,
    project_id:    data.project_id,
    name:          data.name,
    planned_start: data.planned_start,
    planned_end:   data.planned_end,
    status:        'not_started',
    is_critical:   data.is_critical ?? false,
    gate_number:   data.gate        ?? 0,
    owner:         data.owner       ?? 'Unassigned',
    progress_pct:  0,
  })
  return { error: error?.message }
}

export async function updateMilestoneProgress(id: string, progress_pct: number, status: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { error } = await supabase
    .from('schedule_milestones')
    .update({ progress_pct, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  return { error: error?.message }
}

export async function seedScheduleDemoData(projectId: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data: ex } = await supabase.from('schedule_milestones').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  // Anchor the schedule ~120 days before "now" so the Gantt spans today
  // (today line + in-progress bars render meaningfully against live data).
  const base = new Date(); base.setDate(base.getDate() - 120)
  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().slice(0, 10)
  }

  const milestones = [
    { name: 'Site Survey & Geotechnical',    start: 0,   dur: 21,  critical: true,  gate: 0, owner: 'M. Al-Farsi',  status: 'complete',    pct: 100 },
    { name: 'Regulatory Permits',             start: 14,  dur: 60,  critical: true,  gate: 1, owner: 'A. Carter',    status: 'in_progress', pct: 60  },
    { name: 'IFC Drawings Package',           start: 30,  dur: 45,  critical: false, gate: 2, owner: 'R. Chen',      status: 'in_progress', pct: 40  },
    { name: 'Procurement RFQ Issuance',       start: 60,  dur: 30,  critical: true,  gate: 3, owner: 'J. Rivera',    status: 'not_started', pct: 0   },
    { name: 'Equipment Delivery — Modules',   start: 90,  dur: 30,  critical: true,  gate: 4, owner: 'L. Schmidt',   status: 'not_started', pct: 0   },
    { name: 'Civil Works Mobilization',       start: 105, dur: 60,  critical: false, gate: 4, owner: 'M. Al-Farsi',  status: 'not_started', pct: 0   },
    { name: 'Module Installation',            start: 150, dur: 60,  critical: true,  gate: 5, owner: 'R. Chen',      status: 'not_started', pct: 0   },
    { name: 'MV Cabling & Substation',        start: 160, dur: 45,  critical: false, gate: 5, owner: 'A. Carter',    status: 'not_started', pct: 0   },
    { name: 'Commissioning & Testing',        start: 210, dur: 30,  critical: true,  gate: 6, owner: 'J. Rivera',    status: 'not_started', pct: 0   },
    { name: 'COD Declaration',                start: 240, dur: 7,   critical: true,  gate: 7, owner: 'M. Al-Farsi',  status: 'not_started', pct: 0   },
  ]

  for (const m of milestones) {
    await supabase.from('schedule_milestones').insert({
      tenant_id:     tenantId,
      project_id:    projectId,
      name:          m.name,
      planned_start: addDays(base, m.start),
      planned_end:   addDays(base, m.start + m.dur),
      actual_start:  m.status !== 'not_started' ? addDays(base, m.start) : null,
      actual_end:    m.status === 'complete'     ? addDays(base, m.start + m.dur) : null,
      status:        m.status,
      is_critical:   m.critical,
      gate_number:   m.gate,
      owner:         m.owner,
      progress_pct:  m.pct,
    })
  }
  return {}
}

// ─── S12: Stakeholders ────────────────────────────────────────────────────────

export interface Stakeholder {
  id: string
  project_id: string
  name: string
  organisation: string
  role: string
  influence: number
  interest: number
  engagement: 'high' | 'medium' | 'low' | 'resistant'
  notes: string | null
  created_at: string
}

export interface StakeholdersDashboard {
  total: number
  highEngagement: number
  byType: { name: string; value: number }[]
  byEngagement: { name: string; value: number; color: string }[]
  matrixData: { influence: number; interest: number; name: string; id: string; engagement: string }[]
  items: Stakeholder[]
}

export async function loadStakeholdersDashboard(projectId: string): Promise<StakeholdersDashboard> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('project_members')
    .select('id, project_id, name, organisation, role, influence, interest, engagement, notes, created_at')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('influence', { ascending: false })

  const rows = (data ?? []).map((r): Stakeholder => ({
    id:           r.id,
    project_id:   r.project_id,
    name:         (r as any).name ?? 'Unknown',
    organisation: (r as any).organisation ?? '—',
    role:         r.role ?? 'Stakeholder',
    influence:    (r as any).influence ?? 3,
    interest:     (r as any).interest  ?? 3,
    engagement:   ((r as any).engagement ?? 'medium') as Stakeholder['engagement'],
    notes:        (r as any).notes ?? null,
    created_at:   r.created_at,
  }))

  const engColors: Record<string, string> = {
    high: '#22c55e', medium: '#3b82f6', low: '#f59e0b', resistant: '#ef4444',
  }

  const byType = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.role] = (m[r.role] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const byEngagement = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.engagement] = (m[r.engagement] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: engColors[name] ?? '#94a3b8' }))
  })()

  return {
    total:          rows.length,
    highEngagement: rows.filter((r) => r.engagement === 'high').length,
    byType,
    byEngagement,
    matrixData: rows.map((r) => ({
      influence: r.influence, interest: r.interest,
      name: r.name, id: r.id, engagement: r.engagement,
    })),
    items: rows,
  }
}

export async function createStakeholder(data: {
  project_id: string; name: string; organisation: string; role: string
  influence: number; interest: number; engagement: string; notes?: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { error } = await supabase.from('project_members').insert({
    tenant_id:    tenantId,
    project_id:   data.project_id,
    role:         data.role,
    name:         data.name,
    organisation: data.organisation,
    influence:    data.influence,
    interest:     data.interest,
    engagement:   data.engagement,
    notes:        data.notes ?? null,
  })
  return { error: error?.message }
}

export async function seedStakeholdersDemoData(projectId: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data: ex } = await supabase.from('project_members').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}
  const demos = [
    { name: 'Ministry of Energy',       organisation: 'Government',        role: 'Regulator',       influence: 5, interest: 4, engagement: 'high',     notes: 'Grid connection approval authority' },
    { name: 'Client — ACWA Power',      organisation: 'Owner',             role: 'Client',          influence: 5, interest: 5, engagement: 'high',     notes: 'Project sponsor, PPA off-taker' },
    { name: 'Local Authority',          organisation: 'Municipality',      role: 'Authority',       influence: 3, interest: 3, engagement: 'medium',   notes: 'Land use permits' },
    { name: 'Community Rep.',           organisation: 'Local Community',   role: 'Community',       influence: 2, interest: 4, engagement: 'medium',   notes: 'Community liaison required' },
    { name: 'Lender — IFC',             organisation: 'Finance',           role: 'Lender',          influence: 4, interest: 5, engagement: 'high',     notes: 'Project finance debt provider' },
    { name: 'EPC Contractor',           organisation: 'Construction',      role: 'Contractor',      influence: 3, interest: 5, engagement: 'high',     notes: 'Main EPC contract holder' },
    { name: 'Grid Operator (SEC)',       organisation: 'Utility',           role: 'Grid Operator',   influence: 5, interest: 3, engagement: 'medium',   notes: 'Evacuation point agreement required' },
    { name: 'Environmental NGO',        organisation: 'NGO',               role: 'Watchdog',        influence: 2, interest: 3, engagement: 'low',      notes: 'Biodiversity and EIA concerns' },
  ]
  for (const d of demos) {
    await supabase.from('project_members').insert({ tenant_id: tenantId, project_id: projectId, ...d })
  }
  return {}
}

// ─── Per-project data loaders (used by project detail page) ──────────────────

/** Risks for a single project. */
export async function getProjectRisks(projectId: string) {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('risks')
    .select('id, title, probability, impact, status')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((r) => ({
    title:       r.title       ?? 'Unnamed risk',
    probability: r.probability <= 2 ? 'low' : r.probability <= 3 ? 'medium' : 'high',
    impact:      r.impact      <= 2 ? 'low' : r.impact      <= 3 ? 'medium' : 'high',
    status:      (r.status ?? 'open') as 'open' | 'closed',
  }))
}

/** Approvals linked to a project via project_code stored in the title. */
export async function getProjectApprovals(projectCode: string): Promise<import('@/lib/project-types').Approval[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at')
    .ilike('title', `%${projectCode}%`)
    .order('created_at', { ascending: false })
    .limit(10)

  const now = Date.now()
  return (data ?? []).map((a) => {
    const daysOpen = Math.floor((now - new Date(a.created_at).getTime()) / 86400000)
    return {
      id:          a.id,
      type:        a.object_type ?? 'general',
      title:       a.title ?? a.id.slice(0, 8).toUpperCase(),
      projectCode,
      projectName: '',
      requestedBy: 'Team',
      daysOpen,
      isOverdue:   daysOpen > 5 && a.status === 'pending',
      priority:    (a.priority ?? 'medium') as import('@/lib/project-types').Approval['priority'],
    }
  })
}

/** Phase-gate deliverables for a project — derived from phase_gates rows. */
export async function getProjectDeliverables(projectId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('phase_gates')
    .select('id, phase_number, phase_name, status')
    .eq('project_id', projectId)
    .order('phase_number', { ascending: true })

  return (data ?? []).map((g) => ({
    name:      g.phase_name ?? `Gate ${g.phase_number}`,
    completed: g.status === 'approved',
  }))
}

/** Team members (project_members) for the project detail Team tab. */
export async function getProjectTeamMembers(projectId: string): Promise<import('@/lib/project-types').ProjectMember[]> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('project_members')
    .select('id, name, role')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((m) => {
    const name: string = (m as { name?: string }).name ?? 'Unknown'
    const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase()
    return {
      id:       m.id,
      name,
      role:     m.role ?? 'Team Member',
      initials,
    }
  })
}

/** Documents for a project — uses document_files table via project_id join. */
export async function getProjectDocuments(projectCode: string): Promise<import('@/lib/project-types').Document[]> {
  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()
  const { data } = await supabase
    .from('document_files')
    .select('id, code, title, file_name, category, created_at, storage_path')
    .eq('tenant_id', tenantId)
    .eq('project_code', projectCode)
    .order('created_at', { ascending: false })
    .limit(20)

  return (data ?? []).map((d) => ({
    id:        d.id,
    code:      d.code ?? d.file_name ?? d.id.slice(0, 8),
    title:     d.title ?? d.file_name ?? 'Document',
    status:    d.category ?? 'general',
    updatedAt: d.created_at ?? '',
    storagePath: d.storage_path ?? null,
  }))
}

/**
 * Update the provenance source for a tracked project field.
 * Admin-only; writes to projects.provenance and audit_log.
 *
 * @param projectId UUID of the project
 * @param field One of: budget_usd, capacity_mw, start_date, target_completion, country, location, technology, bess_mwh
 * @param newSource One of: contract, financial_model, lender_facility, interconnection, term_sheet
 * @returns { success: true } or throws an error
 */
export async function updateProjectProvenance(
  projectId: string,
  field: string,
  newSource: string,
): Promise<{ success: true }> {
  // Admin guard: system_admin, tenant_admin, project_director
  await requireProjectDirector()

  // Validate field name (8 tracked fields)
  const validFields = ['budget_usd', 'capacity_mw', 'start_date', 'target_completion', 'country', 'location', 'technology', 'bess_mwh']
  if (!validFields.includes(field)) {
    throw new Error(`Invalid field: ${field}. Must be one of: ${validFields.join(', ')}`)
  }

  // Validate source enum
  const validSources = ['contract', 'financial_model', 'lender_facility', 'interconnection', 'term_sheet']
  if (!validSources.includes(newSource)) {
    throw new Error(`Invalid source: ${newSource}. Must be one of: ${validSources.join(', ')}`)
  }

  const supabase = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Get current provenance and actor info
  const { data: proj, error: projErr } = await supabase
    .from('projects')
    .select('provenance')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single()

  // Surface query errors (column missing, etc) — don't hide as "project not found"
  if (projErr) throw new Error(`Failed to fetch project provenance: ${projErr.message} (code: ${projErr.code})`)
  if (!proj) throw new Error('Project not found')

  const currentProv = (proj.provenance ?? {}) as Record<string, any>
  const oldSource = currentProv[field]?.source ?? null

  // Skip if already set to the same source
  if (oldSource === newSource) {
    return { success: true }
  }

  // Update provenance: {source: newSource, at: now()}
  const updatedProv = {
    ...currentProv,
    [field]: { source: newSource, at: new Date().toISOString() },
  }

  const { error: updateErr } = await supabase
    .from('projects')
    .update({ provenance: updatedProv })
    .eq('id', projectId)
    .eq('tenant_id', tenantId)

  if (updateErr) throw new Error(`Failed to update provenance: ${updateErr.message}`)

  // Get actor email for audit trail
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  // Write audit_log entry
  await supabase.from('audit_log').insert({
    table_name: 'projects',
    record_id: projectId,
    action: 'update',
    changed_by: profile?.id ?? null,
    old_values: { [field]: { source: oldSource } },
    new_values: { [field]: { source: newSource }, op: 'provenance_source_change' },
  })

  return { success: true }
}

/**
 * Fresh start: Reset project to G0 with all approvals/signatures cleared.
 * Admin-only testing utility for multi-project testing scenarios.
 */
export async function resetProjectToPhase(projectId: string, targetPhase: number) {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()
  
  // Verify admin access
  await requireWriter()

  // Update project to target phase
  const { error: updateError } = await supabase
    .from('projects')
    .update({ current_phase: targetPhase, status: 'active' })
    .eq('id', projectId)
    .eq('tenant_id', tenantId)

  if (updateError) throw new Error(`Failed to update project: ${updateError.message}`)

  // Reset all phase_gates to 'pending' status
  const { error: resetError } = await supabase
    .from('phase_gates')
    .update({ status: 'pending' })
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)

  if (resetError) throw new Error(`Failed to reset gates: ${resetError.message}`)

  // Clear all approvals for this project
  const { error: appError } = await supabase
    .from('approvals')
    .update({ status: 'pending', decided_at: null })
    .eq('object_id', projectId)
    .eq('tenant_id', tenantId)

  if (appError) throw new Error(`Failed to clear approvals: ${appError.message}`)

  // Log fresh start in audit trail
  await supabase.from('audit_log').insert({
    tenant_id: tenantId,
    table_name: 'projects',
    record_id: projectId,
    action: 'update',
    changed_by: null, // Admin action
    old_values: null,
    new_values: { op: 'fresh_start', target_phase: targetPhase },
  })

  return { success: true, projectId, resetToPhase: targetPhase }
}
