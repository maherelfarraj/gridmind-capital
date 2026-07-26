/**
 * Canonical domain types for the Project Detail page.
 * These match the spec-defined ProjectDetailProps interface exactly.
 */

export interface Project {
  id: string
  code: string
  name: string
  client: string
  status: 'active' | 'on-hold' | 'completed' | 'cancelled' | 'draft' | 'planning'
  phase: string
  gate: number
  gateName: string
  /** NULL = no budget recorded yet — renders "Not set", never "$0". */
  budgetUsd: number | null
  currency: string
  startDate: string
  targetCod: string
  location?: string
  commentCount?: number
  documentCount?: number
  technology?: string
  /** Display-formatted capacity string, e.g. "400 MW". */
  capacity?: string
  /**
   * Numeric capacity in MW from `projects.capacity_mw` (source of truth for editing).
   * NULL = not recorded. A real 0 is valid (substation / grid-upgrade projects).
   */
  capacityMw?: number | null
  country?: string
  description?: string
  epcContractor?: string
  ownerEngineer?: string
  projectManager?: string
  pmInitials?: string
}

export interface AuditLog {
  id: string
  action: string
  object_type: string
  object_id: string
  object_code: string | null
  actor_name: string | null
  actor_role: string | null
  before_state: string | null
  after_state: string | null
  decision_reason: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Approval {
  id: string
  type: string
  title: string
  projectCode: string
  projectName: string
  requestedBy: string
  daysOpen: number
  isOverdue: boolean
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export interface ProjectMember {
  id: string
  name: string
  role: string
  initials: string
  avatarUrl?: string
}

export interface Document {
  id: string
  code: string
  title: string
  status: string
  updatedAt: string
}

export interface Comment {
  id: string
  author: string
  authorInitials: string
  content: string
  createdAt: string
}
