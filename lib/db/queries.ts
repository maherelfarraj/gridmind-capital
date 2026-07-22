import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
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

export const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

/**
 * Resolve the acting user + tenant. Mirrors the project-wide getActor()
 * convention: Supabase auth → profiles; falls back to DEMO_TENANT for dev.
 */
export async function getActor(): Promise<{
  userId: string | null
  tenantId: string
  role: string | null
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { userId: null, tenantId: DEMO_TENANT, role: null }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    return {
      userId: user.id,
      tenantId: profile?.tenant_id ?? DEMO_TENANT,
      role: profile?.role ?? null,
    }
  } catch {
    return { userId: null, tenantId: DEMO_TENANT, role: null }
  }
}

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

export async function getRoleWorkload(): Promise<VRoleWorkload[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('v_role_workload').select('*').order('a_count', { ascending: false })
  if (error) throw error
  return data ?? []
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

// ── Project staffing (Phase 2) ───────────────────────────────

export async function getProjectStaffing(): Promise<VProjectStaffing[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('v_project_staffing').select('*').order('staffing_pct')
  if (error) throw error
  return data ?? []
}

export async function getProjectsLite(): Promise<{ id: string; code: string; name: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('projects').select('id, code, name').order('code')
  if (error) throw error
  return data ?? []
}

export async function getPeople(): Promise<{ id: string; full_name: string; role: string | null }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name')
  if (error) throw error
  return (data ?? []) as { id: string; full_name: string; role: string | null }[]
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
        'raci_deliverables!tasks_deliverable_id_fkey(title), roles!tasks_assignee_role_id_fkey(code), profiles!tasks_assignee_person_id_fkey(full_name), task_comments(count)',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error

  // Supabase can't infer a row type across four embedded relations, so treat
  // the rows as loosely-typed records and map into our explicit TaskRow shape.
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  return rows.map((r) => {
    const deliverable = r.raci_deliverables as { title: string } | null
    const role = r.roles as { code: string } | null
    const person = r.profiles as { full_name: string } | null
    const commentAgg = r.task_comments as { count: number }[] | null
    return {
      id: r.id as string,
      project_id: r.project_id as string,
      deliverable_id: (r.deliverable_id as string) ?? null,
      deliverable_title: deliverable?.title ?? null,
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
