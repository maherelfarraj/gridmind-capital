/**
 * G2: Permitting & Grid Application
 *
 * Defines the gate-level checklist, requirements, and status derivation for
 * the Permitting & Grid Application gate. This is the pure logic — independent
 * of the DB, server actions, or React. All assertions about what makes a G2
 * submission "ready" are centralized here so they can be tested and reused
 * across the UI, server actions, and tests.
 */

/**
 * Permitting milestones — the key phases of the permitting lifecycle.
 */
export interface PermittingMilestone {
  id: string
  name: string
  description: string
  completed: boolean
  targetDate?: string | null
}

/**
 * Grid connection milestones — utility interconnection phases.
 */
export interface GridMilestone {
  id: string
  name: string
  description: string
  completed: boolean
  targetDate?: string | null
}

/**
 * Staffing role assignment — who is responsible for permitting and grid work.
 */
export interface StaffingRole {
  roleId: string
  roleName: string
  description: string
  assignedTo?: { id: string; name: string } | null
}

/**
 * Deliverables — key documents and reports required for G2.
 */
export interface Deliverable {
  id: string
  name: string
  description: string
  category: 'permitting' | 'grid' | 'authority' | 'deliverable'
  uploaded: boolean
  uploadedAt?: string | null
  fileName?: string | null
}

/**
 * G2 Form data — the complete submission payload.
 */
export interface G2FormData {
  permittingMilestones: PermittingMilestone[]
  gridMilestones: GridMilestone[]
  staffingRoles: StaffingRole[]
  deliverables: Deliverable[]
  summary?: string | null
}

/**
 * G2 readiness result — whether a submission is complete and ready to submit.
 */
export interface G2ReadinessResult {
  ready: boolean
  blockers: string[]
  completionPercentage: number
  missingDeliverables: Deliverable[]
  unassignedRoles: StaffingRole[]
}

/**
 * Required permitting milestones (exact list every G2 must address).
 */
export const REQUIRED_PERMITTING_MILESTONES: Array<Omit<PermittingMilestone, 'completed'>> = [
  {
    id: 'water-permits',
    name: 'Water Use Permits',
    description: 'Water allocation and discharge permits from relevant authorities',
  },
  {
    id: 'land-permits',
    name: 'Land Use Permits',
    description: 'Local zoning and land use approvals',
  },
  {
    id: 'env-approvals',
    name: 'Environmental Approvals',
    description: 'Environmental impact assessment and compliance approvals',
  },
]

/**
 * Required grid connection milestones (exact list every G2 must address).
 */
export const REQUIRED_GRID_MILESTONES: Array<Omit<GridMilestone, 'completed'>> = [
  {
    id: 'utility-application',
    name: 'Utility Application Submitted',
    description: 'Interconnection request formally submitted to utility',
  },
  {
    id: 'grid-study',
    name: 'Grid Study Complete',
    description: 'Utility completed technical feasibility study',
  },
  {
    id: 'interconnection-agreement',
    name: 'Interconnection Agreement',
    description: 'Final agreement signed with utility',
  },
]

/**
 * Required staffing roles (exact roles that must be assigned).
 */
export const REQUIRED_STAFFING_ROLES: Array<{ roleId: string; roleName: string; description: string }> = [
  {
    roleId: 'grid-engineer',
    roleName: 'Grid Engineer',
    description: 'Lead for grid interconnection technical work',
  },
  {
    roleId: 'permitting-specialist',
    roleName: 'Permitting Specialist',
    description: 'Lead for permitting and regulatory approvals',
  },
  {
    roleId: 'env-consultant',
    roleName: 'Environmental Consultant',
    description: 'Environmental impact assessment and compliance',
  },
  {
    roleId: 'utility-liaison',
    roleName: 'Utility Liaison',
    description: 'Primary contact with utility and grid authority',
  },
]

/**
 * Required deliverables (key documents/reports needed for G2).
 */
export const REQUIRED_DELIVERABLES: Array<{ id: string; name: string; description: string; category: 'permitting' | 'grid' | 'authority' | 'deliverable' }> = [
  {
    id: 'permitting-strategy',
    name: 'Permitting Strategy',
    description: 'Roadmap for all permitting and regulatory approvals',
    category: 'permitting',
  },
  {
    id: 'environmental-report',
    name: 'Environmental Report',
    description: 'Environmental impact assessment and mitigation plan',
    category: 'authority',
  },
  {
    id: 'grid-application',
    name: 'Grid Interconnection Application',
    description: 'Technical application for utility interconnection',
    category: 'grid',
  },
  {
    id: 'utility-correspondence',
    name: 'Utility Correspondence',
    description: 'Correspondence and confirmations from utility',
    category: 'grid',
  },
]

/**
 * Assess G2 form readiness — does it have all required items completed?
 *
 * Returns a readiness object with an overall `ready` flag, specific `blockers`,
 * completion percentage, and lists of missing/unassigned items. Multiple blockers
 * can exist; all must be resolved for `ready=true`.
 */
export function assessG2Readiness(formData: G2FormData | null): G2ReadinessResult {
  const blockers: string[] = []
  const missingDeliverables: Deliverable[] = []
  const unassignedRoles: StaffingRole[] = []

  if (!formData) {
    return {
      ready: false,
      blockers: ['No submission data provided'],
      completionPercentage: 0,
      missingDeliverables: REQUIRED_DELIVERABLES.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        category: d.category,
        uploaded: false,
        uploadedAt: null,
        fileName: null,
      })),
      unassignedRoles: REQUIRED_STAFFING_ROLES.map((r) => ({
        roleId: r.roleId,
        roleName: r.roleName,
        description: r.description,
        assignedTo: null,
      })),
    }
  }

  // Check permitting milestones completion.
  const missingPermitting = REQUIRED_PERMITTING_MILESTONES.filter((req) => {
    const matching = formData.permittingMilestones?.find((m) => m.id === req.id)
    return !matching?.completed
  })
  if (missingPermitting.length > 0) {
    blockers.push(`${missingPermitting.length} permitting milestone(s) not completed`)
  }

  // Check grid milestones completion.
  const missingGrid = REQUIRED_GRID_MILESTONES.filter((req) => {
    const matching = formData.gridMilestones?.find((m) => m.id === req.id)
    return !matching?.completed
  })
  if (missingGrid.length > 0) {
    blockers.push(`${missingGrid.length} grid milestone(s) not completed`)
  }

  // Check deliverables.
  const missing = REQUIRED_DELIVERABLES.filter((req) => {
    const matching = formData.deliverables?.find((d) => d.id === req.id)
    return !matching?.uploaded
  }).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    category: m.category,
    uploaded: false,
    uploadedAt: null,
    fileName: null,
  }))
  missingDeliverables.push(...missing)
  if (missing.length > 0) {
    blockers.push(`${missing.length} required deliverable(s) not uploaded`)
  }

  // Check staffing roles assigned.
  const unassigned = REQUIRED_STAFFING_ROLES.filter((req) => {
    const matching = formData.staffingRoles?.find((r) => r.roleId === req.roleId)
    return !matching?.assignedTo
  }).map((r) => ({
    roleId: r.roleId,
    roleName: r.roleName,
    description: r.description,
    assignedTo: null,
  }))
  unassignedRoles.push(...unassigned)
  if (unassigned.length > 0) {
    blockers.push(`${unassigned.length} staffing role(s) not assigned`)
  }

  // Calculate completion percentage (0–100).
  const totalItems =
    REQUIRED_PERMITTING_MILESTONES.length +
    REQUIRED_GRID_MILESTONES.length +
    REQUIRED_DELIVERABLES.length +
    REQUIRED_STAFFING_ROLES.length
  const completedItems =
    (formData.permittingMilestones?.filter((m) => m.completed).length ?? 0) +
    (formData.gridMilestones?.filter((m) => m.completed).length ?? 0) +
    (formData.deliverables?.filter((d) => d.uploaded).length ?? 0) +
    (formData.staffingRoles?.filter((r) => r.assignedTo).length ?? 0)
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return {
    ready: blockers.length === 0,
    blockers,
    completionPercentage,
    missingDeliverables,
    unassignedRoles,
  }
}

/**
 * Initialize a blank G2 form with all required items (incomplete).
 * Used as the starting point for a new submission.
 */
export function initializeG2Form(): G2FormData {
  return {
    permittingMilestones: REQUIRED_PERMITTING_MILESTONES.map((m) => ({
      ...m,
      completed: false,
    })),
    gridMilestones: REQUIRED_GRID_MILESTONES.map((m) => ({
      ...m,
      completed: false,
    })),
    staffingRoles: REQUIRED_STAFFING_ROLES.map((r) => ({
      ...r,
      assignedTo: null,
    })),
    deliverables: REQUIRED_DELIVERABLES.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category,
      uploaded: false,
      uploadedAt: null,
      fileName: null,
    })),
    summary: null,
  }
}
