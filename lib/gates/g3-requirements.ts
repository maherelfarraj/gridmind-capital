import { TOTAL_PHASES } from './phase-model'

/**
 * G3 Commercial & Financial Close form structure and validation.
 * 
 * G3 is the Commercial & Financial Close gate where projects finalize:
 * - 5 Commercial Milestones (Land Secured → Owner Engineer ready)
 * - 5 Financial Checkpoints (Debt Mandate → Financial Close achieved)
 * - 6 Required Deliverables (PPA, EPC Contract, Financial Model, Insurance, Lender Term Sheet, Legal Opinion)
 * - 4 Key Staffing Roles (Commercial Manager, Finance Lead, Legal Counsel, Transaction Advisor)
 * 
 * All data is real — no placeholders or fabricated values. Missing items show explicit
 * "Not completed", "Not signed", "Not uploaded", "Unassigned" states.
 */

// ============================================================================
// COMMERCIAL MILESTONES (5 exact items)
// ============================================================================

export type CommercialMilestone = {
  id: string
  name: string
  description: string
  completed: boolean
}

export const REQUIRED_COMMERCIAL_MILESTONES: Array<Omit<CommercialMilestone, 'completed'>> = [
  {
    id: 'land-secured',
    name: 'Land Secured',
    description: 'Site control established through lease or purchase agreement',
  },
  {
    id: 'ppa-negotiation',
    name: 'PPA Negotiation',
    description: 'Power Purchase Agreement terms negotiated with offtaker',
  },
  {
    id: 'ppa-executed',
    name: 'PPA Executed',
    description: 'Power Purchase Agreement fully executed and binding',
  },
  {
    id: 'epc-contract',
    name: 'EPC Contract',
    description: 'Engineering, Procurement & Construction contract finalized',
  },
  {
    id: 'owner-engineer',
    name: 'Owner Engineer Ready',
    description: 'Owner Engineer appointed and mobilization commenced',
  },
]

// ============================================================================
// FINANCIAL CHECKPOINTS (5 exact items)
// ============================================================================

export type FinancialCheckpoint = {
  id: string
  name: string
  description: string
  completed: boolean
}

export const REQUIRED_FINANCIAL_CHECKPOINTS: Array<Omit<FinancialCheckpoint, 'completed'>> = [
  {
    id: 'debt-mandate',
    name: 'Debt Mandate',
    description: 'Bank debt mandate issued and terms LOI signed',
  },
  {
    id: 'technical-dd',
    name: 'Technical Due Diligence',
    description: 'Lender technical due diligence completed and approved',
  },
  {
    id: 'legal-dd',
    name: 'Legal Due Diligence',
    description: 'Lender legal due diligence completed and signed off',
  },
  {
    id: 'environmental-dd',
    name: 'Environmental Due Diligence',
    description: 'Environmental assessment completed and acceptable to lender',
  },
  {
    id: 'financial-close',
    name: 'Financial Close Achieved',
    description: 'All loan agreements executed and funds disbursed',
  },
]

// ============================================================================
// REQUIRED DELIVERABLES (6 exact items)
// ============================================================================

export type Deliverable = {
  id: string
  name: string
  description: string
  category: 'contracts' | 'financial' | 'approvals'
  uploaded: boolean
  uploadedAt: string | null
  fileName: string | null
}

export const REQUIRED_DELIVERABLES: Array<Omit<Deliverable, 'uploaded' | 'uploadedAt' | 'fileName'>> = [
  {
    id: 'signed-ppa',
    name: 'Signed PPA',
    description: 'Executed Power Purchase Agreement',
    category: 'contracts',
  },
  {
    id: 'epc-contract',
    name: 'EPC Contract',
    description: 'Executed Engineering, Procurement & Construction Contract',
    category: 'contracts',
  },
  {
    id: 'financial-model',
    name: 'Financial Model',
    description: 'Audited financial model used for debt sizing',
    category: 'financial',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    description: 'Proof of insurance quotes for construction and O&M',
    category: 'approvals',
  },
  {
    id: 'lender-term-sheet',
    name: 'Lender Term Sheet',
    description: 'Executed Lender Term Sheet and Mandate',
    category: 'approvals',
  },
  {
    id: 'legal-opinion',
    name: 'Legal Opinion',
    description: 'Legal opinion letter from project counsel',
    category: 'approvals',
  },
]

// ============================================================================
// STAFFING ROLES (4 exact items)
// ============================================================================

export type StaffingRole = {
  roleId: string
  roleName: string
  description: string
  assignedTo: { id: string; name: string } | null
}

export const REQUIRED_STAFFING_ROLES: Array<{ roleId: string; roleName: string; description: string }> = [
  {
    roleId: 'commercial-manager',
    roleName: 'Commercial Manager',
    description: 'Lead for PPA negotiations and commercial strategy',
  },
  {
    roleId: 'finance-lead',
    roleName: 'Finance Lead',
    description: 'Lead for financial structuring and banking relationships',
  },
  {
    roleId: 'legal-counsel',
    roleName: 'Legal Counsel',
    description: 'Lead for legal agreements and due diligence',
  },
  {
    roleId: 'transaction-advisor',
    roleName: 'Transaction Advisor',
    description: 'Transaction advisor for commercial close management',
  },
]

// ============================================================================
// FORM DATA STRUCTURE
// ============================================================================

export type G3FormData = {
  commercialMilestones: CommercialMilestone[]
  financialCheckpoints: FinancialCheckpoint[]
  deliverables: Deliverable[]
  staffingRoles: StaffingRole[]
  executiveSummary: string | null
}

// ============================================================================
// READINESS ASSESSMENT
// ============================================================================

export type G3Readiness = {
  ready: boolean
  completionPercentage: number
  blockers: string[]
  missingDeliverables: Deliverable[]
  unassignedRoles: StaffingRole[]
  incompleteMilestones: CommercialMilestone[]
  incompleteCheckpoints: FinancialCheckpoint[]
}

/**
 * Initialize a blank G3 form.
 */
export function initializeG3Form(): G3FormData {
  return {
    commercialMilestones: REQUIRED_COMMERCIAL_MILESTONES.map((m) => ({
      ...m,
      completed: false,
    })),
    financialCheckpoints: REQUIRED_FINANCIAL_CHECKPOINTS.map((c) => ({
      ...c,
      completed: false,
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
    staffingRoles: REQUIRED_STAFFING_ROLES.map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      description: r.description,
      assignedTo: null,
    })),
    executiveSummary: null,
  }
}

/**
 * Assess G3 readiness for approval. A project is G3-ready when:
 * - 4/5 commercial milestones completed
 * - 4/5 financial checkpoints completed
 * - All 6 deliverables uploaded
 * - All 4 staffing roles assigned
 * - Executive summary provided
 */
export function assessG3Readiness(formData: G3FormData | null): G3Readiness {
  if (!formData) {
    return {
      ready: false,
      completionPercentage: 0,
      blockers: ['No submission data provided'],
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
      incompleteMilestones: [],
      incompleteCheckpoints: [],
    }
  }

  const blockers: string[] = []
  const missingDeliverables: Deliverable[] = []
  const unassignedRoles: StaffingRole[] = []
  const incompleteMilestones: CommercialMilestone[] = []
  const incompleteCheckpoints: FinancialCheckpoint[] = []

  // Commercial milestones: need 4/5
  const completedCommercial = formData.commercialMilestones.filter((m) => m.completed).length
  if (completedCommercial < 4) {
    blockers.push(`Only ${completedCommercial}/5 commercial milestones completed (need 4)`)
    incompleteMilestones.push(...formData.commercialMilestones.filter((m) => !m.completed))
  }

  // Financial checkpoints: need 4/5
  const completedFinancial = formData.financialCheckpoints.filter((c) => c.completed).length
  if (completedFinancial < 4) {
    blockers.push(`Only ${completedFinancial}/5 financial checkpoints completed (need 4)`)
    incompleteCheckpoints.push(...formData.financialCheckpoints.filter((c) => !c.completed))
  }

  // Deliverables: all 6 required
  const uploadedCount = formData.deliverables.filter((d) => d.uploaded).length
  if (uploadedCount < 6) {
    blockers.push(`${uploadedCount}/6 required deliverables uploaded`)
    missingDeliverables.push(...formData.deliverables.filter((d) => !d.uploaded))
  }

  // Staffing: all 4 roles must be assigned
  const assignedRoles = formData.staffingRoles.filter((r) => r.assignedTo).length
  if (assignedRoles < 4) {
    blockers.push(`${assignedRoles}/4 staffing roles assigned`)
    unassignedRoles.push(...formData.staffingRoles.filter((r) => !r.assignedTo))
  }

  // Executive summary
  if (!formData.executiveSummary?.trim()) {
    blockers.push('Executive summary is required')
  }

  // Completion percentage: (commercial 4/5 + financial 4/5 + deliverables 6/6 + staffing 4/4 + summary) / 5
  const commercialScore = Math.min(completedCommercial / 4, 1)
  const financialScore = Math.min(completedFinancial / 4, 1)
  const deliverablesScore = uploadedCount / 6
  const staffingScore = assignedRoles / 4
  const summaryScore = formData.executiveSummary?.trim() ? 1 : 0
  const completionPercentage = Math.round(
    ((commercialScore + financialScore + deliverablesScore + staffingScore + summaryScore) / 5) * 100,
  )

  return {
    ready: blockers.length === 0,
    completionPercentage,
    blockers,
    missingDeliverables,
    unassignedRoles,
    incompleteMilestones,
    incompleteCheckpoints,
  }
}
