import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActorState, actorFailureMessage } from '@/lib/auth/actor'
import type { DbUserRole } from '@/lib/auth/roles'
import type {
  Department,
  Role,
  Gate,
  RaciDeliverable,
  RaciAssignment,
  VRoleWorkload,
  VProjectStaffing,
  VGateProgress,
  VPersonWorkload,
  VPersonTaskLoad,
  VInbox,
} from '@/lib/db/types'

/**
 * Resolve the acting user + tenant from Supabase auth → profiles.
 *
 * Delegates to the canonical resolver in lib/auth/actor.ts so this data layer
 * and the server-action guards share ONE authorization algorithm. Previously
 * this function ran a weaker second algorithm that accepted inactive profiles,
 * a null tenant_id, and an unvalidated (or null) role.
 *
 * FAIL-CLOSED: throws on lookup error, missing profile, inactive profile,
 * missing tenant, or invalid role. Callers already treat it as throwing.
 */
export const getActor = cache(async (): Promise<{
  userId: string
  tenantId: string
  role: DbUserRole
}> => {
  const state = await resolveActorState()

  if (state.kind === 'invalid') {
    throw new Error(actorFailureMessage(state.reason))
  }

  return {
    userId: state.actor.userId,
    tenantId: state.actor.tenantId,
    role: state.actor.role,
  }
})

// ── Org & Roles (Phase 1) ────────────────────────────────────

export async function getDepartments(): Promise<Department[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('departments')
    .select('*')
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function getRoles(): Promise<(Role & { department_name: string; department_code: string })[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('roles')
    .select('*, departments!inner(code, name)')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((r) => {
    const dept = (r as unknown as { departments: { code: string; name: string } | null }).departments
    return {
      ...(r as Role),
      department_code: dept?.code ?? '',
      department_name: dept?.name ?? '',
    }
  })
}

export interface RoleWorkloadRow extends VRoleWorkload {
  is_bess_critical: boolean
  counts_toward_staffing: boolean
}

export async function getRoleWorkload(): Promise<RoleWorkloadRow[]> {
  const admin = createAdminClient()
  const [{ data, error }, { data: roles, error: rErr }] = await Promise.all([
    admin.from('v_role_workload').select('*').order('a_count', { ascending: false }),
    admin.from('roles').select('id, is_bess_critical, counts_toward_staffing'),
  ])
  if (error) throw error
  if (rErr) throw rErr
  const flags = new Map((roles ?? []).map((r) => [r.id as string, r]))
  return (data ?? []).map((r) => ({
    ...r,
    is_bess_critical: Boolean(flags.get(r.role_id)?.is_bess_critical),
    counts_toward_staffing: Boolean(flags.get(r.role_id)?.counts_toward_staffing),
  }))
}

export interface RoleWithCounts extends Role {
  department_code: string
  department_name: string
  a_count: number
  r_count: number
  c_count: number
  i_count: number
}

/**
 * All roles with their department and RACI accountability counts.
 * A = letters 'A' or 'A/R'; R = letters 'R' or 'A/R' (A/R counts as both).
 */
export async function getRolesWithRaciCounts(): Promise<RoleWithCounts[]> {
  const admin = createAdminClient()
  const [rolesRes, assignRes] = await Promise.all([
    admin.from('roles').select('*, departments!inner(code, name)').order('sort_order'),
    admin.from('raci_assignments').select('role_id, letter'),
  ])
  if (rolesRes.error) throw rolesRes.error
  if (assignRes.error) throw assignRes.error

  const counts = new Map<string, { a: number; r: number; c: number; i: number }>()
  for (const a of assignRes.data ?? []) {
    const key = a.role_id as string
    const c = counts.get(key) ?? { a: 0, r: 0, c: 0, i: 0 }
    const letter = a.letter as string
    if (letter === 'A' || letter === 'A/R') c.a += 1
    if (letter === 'R' || letter === 'A/R') c.r += 1
    if (letter === 'C') c.c += 1
    if (letter === 'I') c.i += 1
    counts.set(key, c)
  }

  return (rolesRes.data ?? []).map((r) => {
    const dept = (r as unknown as { departments: { code: string; name: string } | null }).departments
    const c = counts.get((r as Role).id) ?? { a: 0, r: 0, c: 0, i: 0 }
    return {
      ...(r as Role),
      department_code: dept?.code ?? '',
      department_name: dept?.name ?? '',
      a_count: c.a,
      r_count: c.r,
      c_count: c.c,
      i_count: c.i,
    }
  })
}

export async function getRoleByCode(
  code: string,
): Promise<(Role & { department_code: string; department_name: string }) | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('roles')
    .select('*, departments!inner(code, name)')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const dept = (data as unknown as { departments: { code: string; name: string } | null }).departments
  return {
    ...(data as Role),
    department_code: dept?.code ?? '',
    department_name: dept?.name ?? '',
  }
}

export interface RoleSignoffDuty {
  gate_code: string
  gate_name: string
  sort_order: number
  is_approver: boolean
  letter: string
}

/** The gate sign-off duties a role holds, ordered by gate. */
export async function getRoleSignoffDuties(roleId: string): Promise<RoleSignoffDuty[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gate_signoff_templates')
    .select('is_approver, letter, gates!inner(code, name, sort_order)')
    .eq('role_id', roleId)
  if (error) throw error
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows
    .map((r) => {
      const gate = r.gates as { code: string; name: string; sort_order: number } | null
      return {
        gate_code: gate?.code ?? '',
        gate_name: gate?.name ?? '',
        sort_order: gate?.sort_order ?? 0,
        is_approver: Boolean(r.is_approver),
        letter: (r.letter as string) ?? 'C',
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** RACI duties a role holds, grouped for the role detail page. */
export async function getRoleRaciDuties(
  roleId: string,
): Promise<{ gate_code: string; deliverable_title: string; letter: string; sort_order: number }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('raci_assignments')
    .select('letter, raci_deliverables!inner(title, sort_order, gates!inner(code, sort_order))')
    .eq('role_id', roleId)
  if (error) throw error
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows
    .map((r) => {
      const d = r.raci_deliverables as {
        title: string
        sort_order: number
        gates: { code: string; sort_order: number } | null
      } | null
      return {
        gate_code: d?.gates?.code ?? '',
        deliverable_title: d?.title ?? '',
        letter: (r.letter as string) ?? 'I',
        sort_order: (d?.gates?.sort_order ?? 0) * 100 + (d?.sort_order ?? 0),
      }
    })
    .sort((a, b) => a.sort_order - b.sort_order)
}

// ── Gates & RACI (Phase 3) ───────────────────────────────────

export async function getGates(): Promise<Gate[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('gates').select('*').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function getRaciMatrixForGate(gateId: string): Promise<{
  deliverables: RaciDeliverable[]
  assignments: RaciAssignment[]
}> {
  const admin = createAdminClient()
  const { data: deliverables, error: dErr } = await admin
    .from('raci_deliverables')
    .select('*')
    .eq('gate_id', gateId)
    .order('sort_order')
  if (dErr) throw dErr

  const ids = (deliverables ?? []).map((d) => d.id)
  if (ids.length === 0) return { deliverables: deliverables ?? [], assignments: [] }

  const { data: assignments, error: aErr } = await admin
    .from('raci_assignments')
    .select('*')
    .in('deliverable_id', ids)
  if (aErr) throw aErr

  return { deliverables: deliverables ?? [], assignments: assignments ?? [] }
}

/** Full RACI matrix: every gate, every deliverable, every assignment. */
export async function getRaciMatrix(): Promise<{
  gates: Gate[]
  deliverables: RaciDeliverable[]
  assignments: RaciAssignment[]
}> {
  const admin = createAdminClient()
  const [{ data: gates, error: gErr }, { data: deliverables, error: dErr }, { data: assignments, error: aErr }] =
    await Promise.all([
      admin.from('gates').select('*').order('sort_order'),
      admin.from('raci_deliverables').select('*').order('sort_order'),
      admin.from('raci_assignments').select('*'),
    ])
  if (gErr) throw gErr
  if (dErr) throw dErr
  if (aErr) throw aErr
  return {
    gates: gates ?? [],
    deliverables: deliverables ?? [],
    assignments: assignments ?? [],
  }
}

// ── Project staffing (Phase 2) ───────────────────────────────

export async function getProjectStaffing(): Promise<VProjectStaffing[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('v_project_staffing').select('*').order('staffing_pct')
  if (error) throw error
  return data ?? []
}

/** Role ids that have a person seated on a given project (from project_team). */
export async function getProjectStaffedRoleIds(projectId: string): Promise<string[]> {
  if (!projectId) return []
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_team')
    .select('role_id')
    .eq('project_id', projectId)
    .not('person_id', 'is', null)
  if (error) throw error
  return (data ?? []).map((r) => r.role_id as string)
}

export interface StaffingRadar {
  currentPhase: number
  targetGate: number
  targetGateCode: string
  missingRoles: { code: string; title: string; is_bess_critical: boolean }[]
  staffingPct: number
}

/**
 * Staffing readiness for the NEXT gate. Reads gate_role_requirements for
 * current_phase + 1 and flags required roles that have no project_team row.
 */
export async function getStaffingRadar(projectId: string): Promise<StaffingRadar | null> {
  const admin = createAdminClient()
  const { data: proj } = await admin
    .from('projects')
    .select('current_phase')
    .eq('id', projectId)
    .maybeSingle()
  if (!proj) return null

  const currentPhase = typeof proj.current_phase === 'number' ? proj.current_phase : 0
  const targetGate = Math.min(currentPhase + 1, 8)

  const [{ data: reqs }, { data: team }, { data: allRoles }, { data: staffing }] = await Promise.all([
    admin.from('gate_role_requirements').select('role_code').eq('gate_number', targetGate),
    admin.from('project_team').select('role_id').eq('project_id', projectId),
    admin.from('roles').select('id, code, title, is_bess_critical'),
    admin.from('v_project_staffing').select('staffing_pct').eq('project_id', projectId).maybeSingle(),
  ])

  const roleById = new Map((allRoles ?? []).map((r) => [r.id as string, r]))
  const assignedCodes = new Set(
    (team ?? []).map((t) => roleById.get(t.role_id as string)?.code).filter(Boolean) as string[],
  )
  const missingRoles = (reqs ?? [])
    .map((r) => r.role_code as string)
    .filter((code) => !assignedCodes.has(code))
    .map((code) => {
      const role = (allRoles ?? []).find((r) => r.code === code)
      return {
        code,
        title: role?.title ?? code,
        is_bess_critical: Boolean(role?.is_bess_critical),
      }
    })

  return {
    currentPhase,
    targetGate,
    targetGateCode: `G${targetGate}`,
    missingRoles,
    staffingPct: Number(staffing?.staffing_pct ?? 0),
  }
}

export async function getProjectsLite(): Promise<{ id: string; code: string; name: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').select('id, code, name').order('code')
  if (error) throw error
  return data ?? []
}

export interface PersonLite {
  id: string
  full_name: string
  role: string | null
}

/** Active people. Pass `internalOnly` to restrict to internal staff. */
export async function getPeople(opts?: { internalOnly?: boolean }): Promise<PersonLite[]> {
  const admin = createAdminClient()
  // Scope to the caller's tenant. This previously selected EVERY profile row with
  // no tenant filter, so a second tenant would have leaked its staff into every
  // people-picker. Only one tenant exists today, so this was latent, not live.
  const { tenantId } = await getActor()
  // profiles table has: id, full_name, role, tenant_id, email, department, locale, digit_style
  // is_active and user_type columns do not exist on this schema — omit them.
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .eq('tenant_id', tenantId)
    .order('full_name')
  if (error) throw error
  // internalOnly: exclude external roles (subcontractor / client_viewer) from the picker
  const external = new Set(['subcontractor', 'client_viewer'])
  const filtered = opts?.internalOnly
    ? (data ?? []).filter((p) => !external.has(p.role ?? ''))
    : (data ?? [])
  return filtered as PersonLite[]
}

/** Current role→person assignments for a project. */
export async function getProjectTeam(
  projectId: string,
): Promise<{ role_id: string; person_id: string; full_name: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_team')
    .select('role_id, person_id, profiles!project_team_person_id_fkey(full_name)')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).map((row) => ({
    role_id: row.role_id as string,
    person_id: row.person_id as string,
    full_name:
      (row as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ?? '',
  }))
}

// ── Gate progress (Phase 4) ──────────────────────────────────

export async function getGateProgress(projectId: string): Promise<VGateProgress[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('v_gate_progress')
    .select('*')
    .eq('project_id', projectId)
    .order('phase_number')
  if (error) throw error
  return data ?? []
}

export interface SignoffRow {
  id: string
  role_id: string
  role_code: string
  role_title: string
  person_id: string | null
  person_name: string | null
  is_approver: boolean
  letter: string
  status: string
  signed_at: string | null
}

/** All sign-off rows for one phase_gate, enriched with role + template flags. */
export async function getGateSignoffs(phaseGateId: string): Promise<SignoffRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('gate_signoffs')
    .select(
      'id, role_id, person_id, status, signed_at, roles(code, title), profiles!gate_signoffs_person_id_fkey(full_name)',
    )
    .eq('phase_gate_id', phaseGateId)
  if (error) throw error

  // Fetch template flags (is_approver, letter) for this gate's roles.
  const rows = data ?? []
  const roleIds = rows.map((r) => r.role_id as string)
  const tmplByRole = new Map<string, { is_approver: boolean; letter: string }>()
  if (roleIds.length) {
    // phase_gate -> gate catalog id, to scope templates
    const { data: pg } = await admin
      .from('phase_gates')
      .select('phase_number, phase_name')
      .eq('id', phaseGateId)
      .single()
    if (pg) {
      const { data: gate } = await admin
        .from('gates')
        .select('id')
        .eq('sort_order', pg.phase_number)
        .eq('name', pg.phase_name)
        .single()
      if (gate) {
        const { data: tmpls } = await admin
          .from('gate_signoff_templates')
          .select('role_id, is_approver, letter')
          .eq('gate_id', gate.id)
        for (const t of tmpls ?? [])
          tmplByRole.set(t.role_id as string, {
            is_approver: t.is_approver as boolean,
            letter: t.letter as string,
          })
      }
    }
  }

  return rows.map((r) => {
    const role = r.roles as unknown as { code: string; title: string } | null
    const person = r.profiles as unknown as { full_name: string } | null
    const tmpl = tmplByRole.get(r.role_id as string)
    return {
      id: r.id as string,
      role_id: r.role_id as string,
      role_code: role?.code ?? '',
      role_title: role?.title ?? '',
      person_id: (r.person_id as string) ?? null,
      person_name: person?.full_name ?? null,
      is_approver: tmpl?.is_approver ?? false,
      letter: tmpl?.letter ?? 'C',
      status: r.status as string,
      signed_at: (r.signed_at as string) ?? null,
    }
  })
}

// ── Tasks (Phase 5) ──────────────────────────────────────────

export interface TaskRow {
  id: string
  project_id: string
  deliverable_id: string | null
  deliverable_title: string | null
  title: string
  description: string | null
  assignee_role_id: string | null
  assignee_role_code: string | null
  assignee_person_id: string | null
  assignee_person_name: string | null
  status: string
  priority: string
  due_date: string | null
  comment_count: number
  created_at: string
}

export async function getTasksForProject(projectId: string): Promise<TaskRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select(
      'id, project_id, deliverable_id, title, description, assignee_role_id, assignee_person_id, status, priority, due_date, created_at, ' +
        'raci_deliverables!tasks_deliverable_id_fkey(name), roles!tasks_assignee_role_id_fkey(code), profiles!tasks_assignee_person_id_fkey(full_name), task_comments(count)',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error

  // Supabase can't infer a row type across four embedded relations, so treat
  // the rows as loosely-typed records and map into our explicit TaskRow shape.
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows.map((r) => {
    const deliverable = r.raci_deliverables as { name: string } | null
    const role = r.roles as { code: string } | null
    const person = r.profiles as { full_name: string } | null
    const commentAgg = r.task_comments as { count: number }[] | null
    return {
      id: r.id as string,
      project_id: r.project_id as string,
      deliverable_id: (r.deliverable_id as string) ?? null,
      deliverable_title: deliverable?.name ?? null,
      title: r.title as string,
      description: (r.description as string) ?? null,
      assignee_role_id: (r.assignee_role_id as string) ?? null,
      assignee_role_code: role?.code ?? null,
      assignee_person_id: (r.assignee_person_id as string) ?? null,
      assignee_person_name: person?.full_name ?? null,
      status: r.status as string,
      priority: r.priority as string,
      due_date: (r.due_date as string) ?? null,
      comment_count: commentAgg?.[0]?.count ?? 0,
      created_at: r.created_at as string,
    }
  })
}

export interface MyTaskRow extends TaskRow {
  project_code: string | null
  project_name: string | null
  deliverable_gate: number | null
}

/**
 * The current actor's open (not done) tasks across all projects, enriched with
 * project + deliverable-gate context for the MY TASKS grouped view.
 */
export async function getMyTasks(): Promise<MyTaskRow[]> {
  const actor = await getActor()
  if (!actor.userId) return []
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select(
      'id, project_id, deliverable_id, title, description, assignee_role_id, assignee_person_id, status, priority, due_date, created_at, ' +
        'raci_deliverables!tasks_deliverable_id_fkey(name, gate_id, gates(sort_order)), ' +
        'roles!tasks_assignee_role_id_fkey(code), profiles!tasks_assignee_person_id_fkey(full_name), ' +
        'projects!tasks_project_id_fkey(code, name), task_comments(count)',
    )
    .eq('assignee_person_id', actor.userId)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows.map((r) => {
    const deliverable = r.raci_deliverables as { name: string; gates: { sort_order: number } | null } | null
    const role = r.roles as { code: string } | null
    const person = r.profiles as { full_name: string } | null
    const project = r.projects as { code: string; name: string } | null
    const commentAgg = r.task_comments as { count: number }[] | null
    return {
      id: r.id as string,
      project_id: r.project_id as string,
      deliverable_id: (r.deliverable_id as string) ?? null,
      deliverable_title: deliverable?.name ?? null,
      deliverable_gate: deliverable?.gates?.sort_order ?? null,
      title: r.title as string,
      description: (r.description as string) ?? null,
      assignee_role_id: (r.assignee_role_id as string) ?? null,
      assignee_role_code: role?.code ?? null,
      assignee_person_id: (r.assignee_person_id as string) ?? null,
      assignee_person_name: person?.full_name ?? null,
      status: r.status as string,
      priority: r.priority as string,
      due_date: (r.due_date as string) ?? null,
      comment_count: commentAgg?.[0]?.count ?? 0,
      created_at: r.created_at as string,
      project_code: project?.code ?? null,
      project_name: project?.name ?? null,
    }
  })
}

export async function getTaskComments(
  taskId: string,
): Promise<{ id: string; body: string; author_name: string | null; created_at: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('task_comments')
    .select('id, body, created_at, profiles!task_comments_author_id_fkey(full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    author_name:
      (r.profiles as unknown as { full_name: string } | null)?.full_name ?? null,
    created_at: r.created_at as string,
  }))
}

// ── Workload dashboards (Phase 6) ────────────────────────────

export async function getPersonWorkload(projectId?: string): Promise<VPersonWorkload[]> {
  const admin = createAdminClient()
  let q = admin.from('v_person_workload').select('*')
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function getPersonTaskLoad(projectId?: string): Promise<VPersonTaskLoad[]> {
  const admin = createAdminClient()
  let q = admin.from('v_person_task_load').select('*')
  if (projectId) q = q.eq('project_id', projectId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

// ── Unified inbox (Phase 7) ──────────────────────────────────

export async function getInbox(tenantId: string): Promise<VInbox[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('v_inbox')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Gate approver config (Phase 8) ───────────────────────────

export interface GateApproverConfigRow {
  gate_number: number
  gate_code: string
  gate_name: string
  default_primary: string | null
  default_secondary: string | null
  override_primary: string | null
  override_secondary: string | null
  required_roles: string[]
}

/**
 * Merge the tenant-wide gate approver defaults with any per-project
 * overrides, plus the mandatory role requirements, into one row per gate.
 * When projectId is omitted, only defaults are returned.
 */
export async function getGateApproverConfig(
  projectId?: string,
): Promise<GateApproverConfigRow[]> {
  const admin = createAdminClient()

  const [gatesRes, defaultsRes, reqsRes] = await Promise.all([
    admin.from('gates').select('code, name, sort_order').order('sort_order'),
    admin.from('gate_approver_defaults').select('gate_number, primary_role, secondary_role'),
    admin.from('gate_role_requirements').select('gate_number, role_code'),
  ])
  if (gatesRes.error) throw gatesRes.error
  if (defaultsRes.error) throw defaultsRes.error
  if (reqsRes.error) throw reqsRes.error

  let overrides: { gate_number: number; primary_role: string; secondary_role: string | null }[] = []
  if (projectId) {
    const { data, error } = await admin
      .from('project_gate_approvers')
      .select('gate_number, primary_role, secondary_role')
      .eq('project_id', projectId)
    if (error) throw error
    overrides = data ?? []
  }

  const defByGate = new Map(defaultsRes.data?.map((d) => [d.gate_number, d]) ?? [])
  const ovrByGate = new Map(overrides.map((o) => [o.gate_number, o]))
  const reqByGate = new Map<number, string[]>()
  for (const r of reqsRes.data ?? []) {
    const list = reqByGate.get(r.gate_number) ?? []
    list.push(r.role_code)
    reqByGate.set(r.gate_number, list)
  }

  return (gatesRes.data ?? []).map((g) => {
    const def = defByGate.get(g.sort_order)
    const ovr = ovrByGate.get(g.sort_order)
    return {
      gate_number: g.sort_order,
      gate_code: g.code,
      gate_name: g.name,
      default_primary: def?.primary_role ?? null,
      default_secondary: def?.secondary_role ?? null,
      override_primary: ovr?.primary_role ?? null,
      override_secondary: ovr?.secondary_role ?? null,
      required_roles: reqByGate.get(g.sort_order) ?? [],
    }
  })
}

// ── Admin: Roles & Approval Flow (Phase 9) ───────────────────

export interface ApprovalMatrixRow {
  id: string
  action_code: string
  action_name: string
  category: string
  department_code: string
  initiator_role: string
  approver_role: string
  secondary_approver_role: string | null
  threshold_usd: number | null
  requires_segregation: boolean
  notes: string | null
  sort_order: number
}

/** The seeded 25-action approval-authority matrix (read-only, from DB). */
export async function getApprovalMatrix(): Promise<ApprovalMatrixRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('approval_matrix')
    .select(
      'id, action_code, action_name, category, department_code, initiator_role, approver_role, secondary_approver_role, threshold_usd, requires_segregation, notes, sort_order',
    )
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as ApprovalMatrixRow[]
}

export interface DirectoryUser {
  id: string
  full_name: string
  email: string | null
  role: string | null
  home_role_id: string | null
  home_role_code: string | null
  home_role_title: string | null
  last_active: string | null
  external_org: string | null
  user_type: string | null
}

export interface DepartmentDirectory {
  code: string
  name: string
  roles: { id: string; code: string; title: string }[]
  headcount: number
  users: DirectoryUser[]
}

export interface OrgDirectory {
  departments: DepartmentDirectory[]
  governance: DirectoryUser[]
  external: DirectoryUser[]
}

/**
 * Organization directory for the admin roles-flow Tab 1. Groups internal staff
 * under their home-role's department, and separates governance + external users.
 */
export async function getOrgDirectory(): Promise<OrgDirectory> {
  const admin = createAdminClient()
  const [deptRes, rolesRes, usersRes] = await Promise.all([
    admin.from('departments').select('id, code, name').order('code'),
    admin.from('roles').select('id, code, title, department_id, sort_order').order('sort_order'),
    admin
      .from('profiles')
      .select('id, full_name, email, role, home_role_id, last_active, external_org, user_type')
      .order('full_name'),
  ])
  if (deptRes.error) throw deptRes.error
  if (rolesRes.error) throw rolesRes.error
  if (usersRes.error) throw usersRes.error

  const roleById = new Map((rolesRes.data ?? []).map((r) => [r.id as string, r]))
  const deptById = new Map((deptRes.data ?? []).map((d) => [d.id as string, d]))

  const enrich = (u: Record<string, unknown>): DirectoryUser => {
    const role = u.home_role_id ? roleById.get(u.home_role_id as string) : undefined
    return {
      id: u.id as string,
      full_name: (u.full_name as string) ?? 'Unnamed',
      email: (u.email as string) ?? null,
      role: (u.role as string) ?? null,
      home_role_id: (u.home_role_id as string) ?? null,
      home_role_code: role?.code ?? null,
      home_role_title: role?.title ?? null,
      last_active: (u.last_active as string) ?? null,
      external_org: (u.external_org as string) ?? null,
      user_type: (u.user_type as string) ?? null,
    }
  }

  const users = (usersRes.data ?? []).map((u) => enrich(u as Record<string, unknown>))

  // Bucket users by their home-role department.
  const usersByDept = new Map<string, DirectoryUser[]>()
  for (const u of users) {
    if (u.user_type === 'governance' || u.user_type === 'external') continue
    const role = u.home_role_id ? roleById.get(u.home_role_id) : undefined
    const deptId = role?.department_id as string | undefined
    const deptCode = deptId ? deptById.get(deptId)?.code : undefined
    if (!deptCode) continue
    const list = usersByDept.get(deptCode) ?? []
    list.push(u)
    usersByDept.set(deptCode, list)
  }

  const departments: DepartmentDirectory[] = (deptRes.data ?? []).map((d) => {
    const deptRoles = (rolesRes.data ?? [])
      .filter((r) => r.department_id === d.id)
      .map((r) => ({ id: r.id as string, code: r.code as string, title: r.title as string }))
    const deptUsers = usersByDept.get(d.code as string) ?? []
    return {
      code: d.code as string,
      name: d.name as string,
      roles: deptRoles,
      headcount: deptUsers.length,
      users: deptUsers,
    }
  })

  return {
    departments,
    governance: users.filter((u) => u.user_type === 'governance'),
    external: users.filter((u) => u.user_type === 'external'),
  }
}
