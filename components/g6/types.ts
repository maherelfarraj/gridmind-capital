// ─── G6 Commissioning Completion — Types ────────────────────────────────────

export type TestPackageStatus = 'not_started' | 'in_progress' | 'complete' | 'failed' | 'retest_required'
export type TestPriority = 'critical' | 'high' | 'medium' | 'low'
export type TestSystem =
  | 'turbine_generator' | 'cooling_water' | 'electrical_power'
  | 'control_instrumentation' | 'fuel_supply' | 'hvac'
  | 'fire_protection' | 'water_treatment'

export type PerfTestStatus = 'not_started' | 'pass' | 'failed' | 'within_tolerance' | 'exceeds_guarantee' | 'pending'
export type EnergizationStatus = 'not_started' | 'scheduled' | 'in_progress' | 'complete' | 'hold'
export type FailureStatus = 'open' | 'under_investigation' | 'corrective_action' | 'retest_pending' | 'closed'
export type FailureSeverity = 'critical' | 'major' | 'minor'
export type TrainingStatus = 'not_started' | 'in_progress' | 'complete' | 'expired'
export type DocStatus = 'pending' | 'draft' | 'under_review' | 'approved' | 'superseded'

export interface TestRecord {
  id: string
  test_id: string
  date: string
  technician: string
  result: 'pass' | 'fail' | 'conditional' | 'not_tested'
  value: number | null
  unit: string
  acceptance_min: number | null
  acceptance_max: number | null
  certificate: string | null
}

export interface TestProcedure {
  id: string
  description: string
  method: string
  standard: string
  acceptance_criteria: string
  prerequisites: string[]
  status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'retest'
}

export interface TestFailure {
  id: string
  test_id: string
  description: string
  root_cause: string
  corrective_action: string
  retest_result: string | null
  ncr_ref: string | null
}

export interface SignOff {
  role: string
  name: string
  date: string | null
  status: 'pending' | 'signed'
}

export interface TestPackage {
  id: string
  code: string
  title: string
  description: string
  system: TestSystem
  priority: TestPriority
  status: TestPackageStatus
  tests_total: number
  tests_complete: number
  pass: number
  fail: number
  retest: number
  next_test: string | null
  lead: string
  updated: string
  procedures: TestProcedure[]
  records: TestRecord[]
  failures: TestFailure[]
  sign_offs: SignOff[]
  ref_docs: string[]
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
}

export interface PerformanceTest {
  id: string
  name: string
  description: string
  guarantee: string
  guarantee_unit: string
  tested_value: string | null
  deviation_pct: number | null
  status: PerfTestStatus
  test_date: string | null
  retest_required: boolean
  retest_note: string | null
}

export interface EnergizationStep {
  id: string
  order: number
  description: string
  status: 'pending' | 'complete' | 'hold'
  completed_by: string | null
  completed_date: string | null
}

export interface Energization {
  id: string
  code: string
  title: string
  system: string
  voltage: string
  status: EnergizationStatus
  scheduled_date: string | null
  completed_date: string | null
  permit_ref: string | null
  lead: string
  steps: EnergizationStep[]
}

export interface CommFailure {
  id: string
  code: string
  package_ref: string
  description: string
  severity: FailureSeverity
  status: FailureStatus
  raised_by: string
  raised_date: string
  due_date: string
  closed_date: string | null
  root_cause: string
  corrective_action: string
  ncr_ref: string | null
  retest_date: string | null
}

export interface TrainingRecord {
  id: string
  module: string
  category: string
  trainee: string
  role: string
  trainer: string
  status: TrainingStatus
  planned_date: string
  completed_date: string | null
  score: number | null
  pass_mark: number
  certificate: string | null
  expiry_date: string | null
}

export interface CommDoc {
  id: string
  code: string
  title: string
  type: string
  system: string
  status: DocStatus
  prepared_by: string
  reviewed_by: string | null
  approved_by: string | null
  submitted_date: string | null
  approved_date: string | null
  file_url: string | null
}
