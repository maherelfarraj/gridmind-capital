// G5 Mechanical Completion — shared types

export type InspectionStatus = 'passed' | 'failed' | 'in_progress' | 'scheduled' | 'hold'
export type PunchCategory    = 'A' | 'B' | 'C'
export type PunchStatus      = 'open' | 'closed' | 'in_progress' | 'disputed'
export type NcrStatus        = 'open' | 'under_review' | 'closed' | 'rejected'
export type NcrSeverity      = 'critical' | 'major' | 'minor'
export type CertStatus       = 'issued' | 'pending' | 'rejected' | 'draft'
export type AsBuiltStatus    = 'pending' | 'redlines_submitted' | 'under_review' | 'approved' | 'superseded'

export interface Inspection {
  id: string; code: string; title: string; discipline: string
  type: string; system: string; planned_date: string; actual_date: string | null
  status: InspectionStatus; inspector: string; contractor: string
  hold_points: string[]; witness_points: string[]
  result_notes: string; deficiencies: number
}

export interface PunchItem {
  id: string; code: string; description: string; category: PunchCategory
  status: PunchStatus; discipline: string; system: string; location: string
  raised_by: string; assigned_to: string; raised_date: string
  due_date: string; closed_date: string | null; priority: 'high' | 'medium' | 'low'
  drawing_ref: string
}

export interface NCR {
  id: string; code: string; title: string; discipline: string; system: string
  severity: NcrSeverity; status: NcrStatus; raised_by: string; assigned_to: string
  raised_date: string; due_date: string; closed_date: string | null
  description: string; root_cause: string; corrective_action: string
  verification_required: boolean; cost_impact: number
}

export interface MCCertificate {
  id: string; cert_number: string; system: string; discipline: string
  status: CertStatus; issued_date: string | null; issued_by: string
  mc_coordinator: string; punch_outstanding: number
  ncr_outstanding: number; comments: string
}

export interface TestPlan {
  id: string; code: string; title: string; system: string; discipline: string
  test_type: string; status: 'not_started' | 'in_progress' | 'passed' | 'failed'
  planned_date: string; actual_date: string | null; responsible: string
  steps_total: number; steps_completed: number; result: string
}

export interface Redline {
  id: string; description: string; markup_by: string; markup_date: string
  area: string; status: 'open' | 'incorporated' | 'rejected'
}

export interface AsBuilt {
  id: string; drawing_number: string; title: string; discipline: string
  revision: string; system: string; status: AsBuiltStatus
  original_ifc_rev: string; as_built_rev: string | null
  prepared_by: string; reviewed_by: string | null; approved_by: string | null
  submitted_date: string | null; approved_date: string | null
  redlines: Redline[]; linked_punch_items: string[]; linked_ncrs: string[]
  file_url: string | null
}
