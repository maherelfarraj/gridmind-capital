import { TOTAL_PHASES } from './phase-model'

/**
 * G3 Commercial & Financial Close form structure and validation.
 * 
 * G3 is the Commercial & Financial Close gate where projects finalize:
 * - Revenue/offtake contracts and agreements
 * - Project financing and debt structures
 * - Budget tracking and cash flow forecast
 * - Executive-level sign-offs and board approvals
 * 
 * All data is real — no placeholders or fabricated values. Missing items
 * show explicit "Not set", "Unsigned", "Not uploaded" states.
 */

export type BudgetItem = {
  id: string
  category: 'Civil Works' | 'Equipment' | 'Development' | 'Contingency' | 'Financing'
  description: string
  budgetedAmount: number | null
  actualAmount: number | null
  variance: number | null
  status: 'pending' | 'committed' | 'spent' | 'complete'
}

export type ContractRecord = {
  id: string
  contractType: 'offtake' | 'supply' | 'epc' | 'financing' | 'insurance' | 'other'
  counterparty: string | null
  status: 'draft' | 'negotiating' | 'executed' | 'archived'
  signedDate: string | null
  fileName: string | null
}

export type FinancingPlan = {
  id: string
  sourceType: 'equity' | 'debt' | 'grant'
  source: string | null
  amount: number | null
  terms: string | null
  status: 'proposed' | 'committed' | 'closed'
}

export type ExecutiveApproval = {
  id: string
  approvalType: 'board_approval' | 'executive_sign_off' | 'sponsor_approval'
  approverName: string | null
  approverTitle: string | null
  signedDate: string | null
  comments: string | null
}

export type CashFlowForecast = {
  monthlyProjection: Array<{
    month: string
    inflow: number
    outflow: number
    netCashFlow: number
  }>
  cumulativeCashFlow: Array<{ month: string; cumulative: number }>
}

export type G3FormData = {
  budget: BudgetItem[]
  contracts: ContractRecord[]
  financing: FinancingPlan[]
  approvals: ExecutiveApproval[]
  cashFlowForecast: CashFlowForecast | null
  commercialSummary: string | null
}

export type G3Readiness = {
  ready: boolean
  blockers: string[]
  completionPercentage: number
  missingContracts: ContractRecord[]
  unfinancedAmount: number
  unsignedApprovals: ExecutiveApproval[]
}

/**
 * Required budget categories that every G3 must address.
 */
export const REQUIRED_BUDGET_CATEGORIES = [
  'Civil Works',
  'Equipment',
  'Development',
  'Contingency',
  'Financing',
] as const

/**
 * Required contract types for a complete commercial close.
 */
export const REQUIRED_CONTRACT_TYPES: Array<ContractRecord['contractType']> = [
  'offtake',
  'epc',
  'financing',
]

/**
 * Required executive approvals for commercial close sign-off.
 */
export const REQUIRED_APPROVALS: Array<ExecutiveApproval['approvalType']> = [
  'board_approval',
  'executive_sign_off',
]

/**
 * Initialize a blank G3 form with all required structures.
 */
export function initializeG3Form(): G3FormData {
  return {
    budget: REQUIRED_BUDGET_CATEGORIES.map((cat) => ({
      id: cat.toLowerCase().replace(/\s+/g, '-'),
      category: cat as BudgetItem['category'],
      description: '',
      budgetedAmount: null,
      actualAmount: null,
      variance: null,
      status: 'pending',
    })),
    contracts: REQUIRED_CONTRACT_TYPES.map((ct) => ({
      id: ct,
      contractType: ct,
      counterparty: null,
      status: 'draft',
      signedDate: null,
      fileName: null,
    })),
    financing: [],
    approvals: REQUIRED_APPROVALS.map((apt) => ({
      id: apt,
      approvalType: apt,
      approverName: null,
      approverTitle: null,
      signedDate: null,
      comments: null,
    })),
    cashFlowForecast: null,
    commercialSummary: null,
  }
}

/**
 * Assess G3 commercial readiness: all contracts signed, financing committed,
 * approvals obtained, and budget tracked.
 */
export function assessG3Readiness(formData: G3FormData | null): G3Readiness {
  if (!formData) {
    return {
      ready: false,
      blockers: ['No submission data provided'],
      completionPercentage: 0,
      missingContracts: REQUIRED_CONTRACT_TYPES.map((ct) => ({
        id: ct,
        contractType: ct,
        counterparty: null,
        status: 'draft',
        signedDate: null,
        fileName: null,
      })),
      unfinancedAmount: 0,
      unsignedApprovals: REQUIRED_APPROVALS.map((apt) => ({
        id: apt,
        approvalType: apt,
        approverName: null,
        approverTitle: null,
        signedDate: null,
        comments: null,
      })),
    }
  }

  const blockers: string[] = []
  let completionPercentage = 0
  const missingContracts: ContractRecord[] = []
  let unfinancedAmount = 0
  const unsignedApprovals: ExecutiveApproval[] = []

  // Check contracts executed.
  const missingExec = REQUIRED_CONTRACT_TYPES.filter((req) => {
    const matching = formData.contracts?.find((c) => c.contractType === req)
    return !matching?.signedDate
  }).map((ct) => ({
    id: ct,
    contractType: ct,
    counterparty: null,
    status: 'draft' as const,
    signedDate: null,
    fileName: null,
  }))
  missingContracts.push(...missingExec)
  if (missingExec.length > 0) {
    blockers.push(`${missingExec.length} contract(s) not yet executed`)
  }

  // Check financing committed.
  const totalFinanced = (formData.financing ?? []).reduce((sum, f) => {
    return sum + (f.status === 'committed' || f.status === 'closed' ? f.amount ?? 0 : 0)
  }, 0)
  const totalBudgeted =
    (formData.budget ?? []).reduce((sum, b) => sum + (b.budgetedAmount ?? 0), 0) ?? 0
  unfinancedAmount = Math.max(0, totalBudgeted - totalFinanced)
  if (unfinancedAmount > 0) {
    blockers.push(`Financing gap: $${unfinancedAmount.toLocaleString()} unfinanced`)
  }

  // Check approvals signed.
  const unsigned = REQUIRED_APPROVALS.filter((req) => {
    const matching = formData.approvals?.find((a) => a.approvalType === req)
    return !matching?.signedDate
  }).map((apt) => ({
    id: apt,
    approvalType: apt,
    approverName: null,
    approverTitle: null,
    signedDate: null,
    comments: null,
  }))
  unsignedApprovals.push(...unsigned)
  if (unsigned.length > 0) {
    blockers.push(`${unsigned.length} executive approval(s) not signed`)
  }

  // Completeness %: budget categories filled + contracts signed + financing committed + approvals signed.
  const budgetFilled = (formData.budget ?? []).filter((b) => b.budgetedAmount !== null).length
  const contractsSigned = (formData.contracts ?? []).filter((c) => c.signedDate !== null).length
  const financed = (formData.financing ?? []).filter((f) => f.status !== 'proposed').length
  const approvalsSigned = (formData.approvals ?? []).filter((a) => a.signedDate !== null).length

  const maxItems = 5 + 3 + Math.max(1, (formData.financing ?? []).length) + 2 // budget cats + contract types + financing lines + approval types
  const completedItems = budgetFilled + contractsSigned + financed + approvalsSigned
  completionPercentage = Math.round((completedItems / maxItems) * 100)

  return {
    ready: blockers.length === 0,
    blockers,
    completionPercentage,
    missingContracts,
    unfinancedAmount,
    unsignedApprovals,
  }
}

/**
 * Check if all critical commercial items are set (not just present, but meaningful).
 * Used to prevent premature submissions.
 */
export function isG3Complete(formData: G3FormData): boolean {
  const readiness = assessG3Readiness(formData)
  return readiness.ready && readiness.completionPercentage >= 90
}
