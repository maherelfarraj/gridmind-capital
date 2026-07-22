// ─────────────────────────────────────────────────────────────
// GridMind — Team & Roles / RACI / Gate sign-off schema types
// Generated to match the live Supabase schema (Phase 0).
// Do NOT hand-edit column shapes without re-verifying against the DB.
// ─────────────────────────────────────────────────────────────

export type RaciLetter = 'R' | 'A' | 'A/R' | 'C' | 'I'

export type UserType = 'internal' | 'external'

export type SignoffStatus = 'pending' | 'signed' | 'rejected' | 'na'

export type ApprovalItemStatus = 'pending' | 'approved' | 'rejected'

export type ApprovalItemType = 'gate_signoff' | 'task' | 'variation' | 'other'

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

// ── Base tables ──────────────────────────────────────────────

export interface Department {
  id: string
  code: string
  name: string
}

export interface Role {
  id: string
  code: string
  title: string
  department_id: string
  mission: string | null
  is_bess_critical: boolean
  counts_toward_staffing: boolean
  sort_order: number
}

export interface Gate {
  id: string
  code: string
  name: string
  milestone: string
  sort_order: number
}

export interface RaciDeliverable {
  id: string
  gate_id: string
  name: string
  sort_order: number
}

export interface RaciAssignment {
  id: string
  deliverable_id: string
  role_id: string
  letter: RaciLetter
}

export interface GateSignoffTemplate {
  id: string
  gate_id: string
  role_id: string
  is_approver: boolean
  letter: RaciLetter
}

export interface GateApproverDefault {
  gate_number: number
  primary_role: string
  secondary_role: string | null
  updated_at: string
  updated_by: string | null
}

export interface GateRoleRequirement {
  gate_number: number
  role_code: string
}

export interface ProjectTeam {
  id: string
  tenant_id: string
  project_id: string
  role_id: string
  person_id: string
  assigned_at: string
  assigned_by: string | null
}

export interface GateSignoff {
  id: string
  tenant_id: string
  phase_gate_id: string
  role_id: string
  person_id: string | null
  status: SignoffStatus
  signed_at: string | null
}

export interface ApprovalItem {
  id: string
  tenant_id: string
  project_id: string
  phase_gate_id: string | null
  role_id: string | null
  person_id: string | null
  title: string
  type: ApprovalItemType
  status: ApprovalItemStatus
  created_at: string
  resolved_at: string | null
}

export interface Task {
  id: string
  tenant_id: string
  project_id: string
  deliverable_id: string | null
  title: string
  description: string | null
  assignee_role_id: string | null
  assignee_person_id: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string | null
  body: string
  created_at: string
}

export interface ProjectGateApprover {
  project_id: string
  gate_number: number
  primary_role: string
  secondary_role: string | null
}

// ── Views ────────────────────────────────────────────────────

export interface VRoleWorkload {
  role_id: string
  code: string
  title: string
  department: string
  a_count: number
  r_count: number
  c_count: number
  i_count: number
}

export interface VPersonWorkload {
  project_id: string
  person_id: string
  full_name: string
  a_count: number
  r_count: number
  c_count: number
  i_count: number
}

export interface VGateProgress {
  phase_gate_id: string
  project_id: string
  phase_number: number
  phase_name: string
  status: string
  total_signoffs: number
  signed_count: number
  ready_to_approve: boolean
}

export interface VProjectStaffing {
  project_id: string
  name: string
  assigned_roles: number
  total_roles: number
  staffing_pct: number
}

export interface VPersonTaskLoad {
  person_id: string
  full_name: string
  project_id: string
  todo: number
  in_progress: number
  blocked: number
  overdue: number
}

export interface VInbox {
  id: string
  tenant_id: string
  title: string
  status: string
  due_date: string | null
  created_at: string
  source: string
  object_type: string
}

// ── Enriched shapes (joined) used by the UI ─────────────────

export interface RoleWithDepartment extends Role {
  department: Department
}

export interface DeliverableWithAssignments extends RaciDeliverable {
  assignments: (RaciAssignment & { role: Pick<Role, 'id' | 'code' | 'title'> })[]
}
