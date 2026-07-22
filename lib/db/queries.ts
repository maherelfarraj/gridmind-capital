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
