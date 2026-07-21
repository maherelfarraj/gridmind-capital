// ─── G0: Project Initiation & Charter — Type Definitions ──────────────────────

export type CharterStatus = 'draft' | 'under_review' | 'approved' | 'rejected'
export type StakeholderRole = 'sponsor' | 'owner' | 'pmo' | 'legal' | 'finance' | 'technical' | 'external'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type OpportunityStage = 'identified' | 'screening' | 'approved' | 'declined'
export type DeliverableStatus = 'not_started' | 'in_progress' | 'complete' | 'approved'
export type MilestoneStatus = 'pending' | 'in_progress' | 'complete' | 'at_risk'

export interface ProjectCharter {
  id: string
  project_code: string
  project_name: string
  technology: string
  capacity_mw: number
  location: string
  country: string
  client: string
  sponsor: string
  pmo_lead: string
  status: CharterStatus
  version: string
  created_date: string
  approved_date: string | null
  capex_estimate_usd: number
  target_irr_pct: number
  target_dscr: number
  project_duration_months: number
  fid_target: string
  cod_target: string
  description: string
  strategic_rationale: string
  scope_included: string[]
  scope_excluded: string[]
  assumptions: string[]
  constraints: string[]
}

export interface Stakeholder {
  id: string
  name: string
  role: StakeholderRole
  title: string
  organisation: string
  email: string
  phone: string
  influence: 'high' | 'medium' | 'low'
  interest: 'high' | 'medium' | 'low'
  charter_signatory: boolean
  signed: boolean
  signed_date: string | null
}

export interface InitiationRisk {
  id: string
  category: string
  description: string
  level: RiskLevel
  probability: number
  impact: number
  mitigation: string
  owner: string
}

export interface CharterDeliverable {
  id: string
  name: string
  category: string
  status: DeliverableStatus
  owner: string
  due_date: string
  completed_date: string | null
  notes: string
  mandatory: boolean
}

export interface InitiationMilestone {
  id: string
  name: string
  target_date: string
  actual_date: string | null
  status: MilestoneStatus
  gate: string
  owner: string
}

export interface OpportunityScreen {
  id: string
  criterion: string
  category: string
  result: 'pass' | 'fail' | 'conditional'
  score: number
  max_score: number
  notes: string
}
