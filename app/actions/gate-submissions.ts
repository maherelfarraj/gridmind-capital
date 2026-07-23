'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { sendApprovalRequestEmail } from '@/lib/email/send'

// ─── Types ────────────────────────────────────────────────────

export interface G0RiskRow {
  name:        string
  probability: 'Low' | 'Medium' | 'High'
  impact:      'Low' | 'Medium' | 'High'
}

export interface G0StakeholderRow {
  name:         string
  role:         string
  organization: string
  influence:    'High' | 'Medium' | 'Low'
  interest:     'High' | 'Medium' | 'Low'
}

export interface G0FormData {
  // Step 1 — Basic Info
  opportunityName:   string
  opportunityCode:   string
  description:       string
  source:            string
  priority:          'Low' | 'Medium' | 'High' | 'Critical'

  // Step 2 — Technical
  technologyType:       string
  estimatedCapacityMw:  string
  siteLocation:         string
  gridConnection:       string
  landAvailability:     string
  environmentalFlags:   string[]
  technicalNotes:       string

  // Step 3 — Commercial
  clientName:          string
  clientType:          string
  budgetMin:           string
  budgetMax:           string
  currency:            string
  fundingStatus:       string
  ppaStatus:           string
  expectedIrr:         string
  commercialNotes:     string

  // Step 4 — Risk
  overallRisk:        'Low' | 'Medium' | 'High'
  risks:              G0RiskRow[]
  mitigationNotes:    string
  stakeholders:       G0StakeholderRow[]

  // Legacy fields kept for backward compat
  projectSponsor:    string
  hostCountry:       string
  technology:        string
  capacityMwp:       string
  capexEstimateUsd:  string
  targetIrrPct:      string
  requestedDecision: 'proceed-g1' | 'hold' | 'reject'
}

export interface G1FormData {
  feasibilityStatus:     'complete' | 'in-progress' | 'commissioned'
  feasibilityContractor: string
  windSolarResource:     'measured' | 'modelled' | 'satellite' | 'not-started'
  p50YieldGwh:           string
  p90YieldGwh:           string
  gridStudyStatus:       'complete' | 'in-progress' | 'not-started'
  connectionPointKv:     string
  eiaStatus:             'approved' | 'submitted' | 'in-progress' | 'not-started'
  eiaConsultant:         string
  keyPermitsMissing:     string
  landSecured:           boolean
  landNotes:             string
  modelVersion:          string
  baseIrrPct:            string
  baseDscrMin:           string
  lcoeUsdMwh:            string
  debtEquityRatio:       string
  projectFinanceReady:   boolean
  offtakeType:           'ppa' | 'fita' | 'merchant' | 'hybrid' | 'tbd'
  offtakeCounterparty:   string
  offtakeTerm:           string
  tariffUsdMwh:          string
  contractorShortlist:   string
  projectDirector:       string
  oeConsultant:          string
  fidTargetDate:         string
  codTargetDate:         string
  totalCapexFinalUsd:    string
  contingencyPct:        string
  requestedDecision:     'approve-fid' | 'conditional' | 'hold' | 'terminate'
}

// ─── Actions ──────────────────────────────────────────────────

export async function submitG0FormAction(
  formData: G0FormData,
  projectId: string,
): Promise<{ error: string | null }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('gate_submissions').upsert(
    {
      project_id:   projectId,
      gate_number:  0,
      form_data:    formData,
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'project_id,gate_number' },
  )

  if (!error) {
    // Notify Executive Sponsor — fire-and-forget
    sendApprovalRequestEmail({
      to: 'admin@gridmind.capital',
      approverName: 'Executive Sponsor',
      title: 'Gate G0 Investment Intake Package',
      requestedBy: formData.projectSponsor || 'Project Team',
      projectCode: projectId.slice(0, 8).toUpperCase(),
      projectName: `${formData.technology} — ${formData.capacityMwp} MWp`,
      approvalId: projectId,
    }).catch(() => {})
  }

  return { error: error?.message ?? null }
}

export async function submitG1FormAction(
  formData: G1FormData,
  projectId: string,
): Promise<{ error: string | null }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('gate_submissions').upsert(
    {
      project_id:   projectId,
      gate_number:  1,
      form_data:    formData,
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'project_id,gate_number' },
  )
  return { error: error?.message ?? null }
}

// ─── G2–G7 form data types ────────────────────────────────────

export interface G2FormData {
  engineeringPackagesPlanned: string
  disciplinesInvolved:        string[]
  ifcTargetDate:              string
  keyDeliverables:            { value: string }[]
  designBasisNotes:           string
}

export interface G3FormData {
  contractingStrategy:    'EPC' | 'EPCM' | 'multi-package'
  bidders:                { name: string }[]
  targetAwardDate:        string
  estimatedContractValue: string
  longLeadItemsNotes:     string
}

export interface G4FormData {
  contractorName:       string
  mobilizationDate:     string
  siteReadiness: {
    access:          boolean
    permits:         boolean
    hsePlanApproved: boolean
    insurance:       boolean
  }
  plannedWorkforcePeak: string
}

export interface G5FormData {
  systemsCount:            string
  punchItemsOpenCount:     string
  mcCertificateTargetDate: string
  walkdownDate:            string
  asBuiltStatus:           'not-started' | 'in-progress' | 'complete'
}

export interface G6FormData {
  testPackagesCount:         string
  energizationDate:          string
  performanceTestPlanStatus: 'not-started' | 'draft' | 'approved'
  gridConnectionDate:        string
  trainingPlanStatus:        'not-started' | 'draft' | 'approved'
}

export interface G7FormData {
  omContractor:           string
  handoverCertificateDate: string
  warrantyPeriodMonths:   string
  sparePartsDelivered:    'yes' | 'no'
  omManualsDelivered:     'yes' | 'no'
  finalAcceptanceNotes:   string
}

// ─── Shared submit helper for G2–G7 ───────────────────────────

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

/**
 * Saves a gate submission (upsert on project_id + gate_number) and creates a
 * paired approvals row — mirrors the G0/G1 pattern for gates 2 through 7.
 */
async function submitGateForm(
  gateNumber: number,
  formData: unknown,
  projectId: string,
  projectName: string,
): Promise<{ error: string | null }> {
  const guard = await requireWriter()
  if ('error' in guard) return guard

  const supabase = createAdminClient()

  const { error: subError } = await supabase.from('gate_submissions').upsert(
    {
      project_id:   projectId,
      gate_number:  gateNumber,
      form_data:    formData as Record<string, unknown>,
      status:       'submitted',
      submitted_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    },
    { onConflict: 'project_id,gate_number' },
  )
  if (subError) return { error: subError.message }

  // Create the approval request for this submission
  const { error: apprError } = await supabase.from('approvals').insert({
    tenant_id:   DEMO_TENANT,
    object_type: 'gate_submission',
    object_id:   projectId,
    title:       `G${gateNumber} Submission — ${projectName}`,
    priority:    'normal',
  })

  return { error: apprError?.message ?? null }
}

export async function submitG2FormAction(formData: G2FormData, projectId: string, projectName: string) {
  return submitGateForm(2, formData, projectId, projectName)
}

export async function submitG3FormAction(formData: G3FormData, projectId: string, projectName: string) {
  return submitGateForm(3, formData, projectId, projectName)
}

export async function submitG4FormAction(formData: G4FormData, projectId: string, projectName: string) {
  return submitGateForm(4, formData, projectId, projectName)
}

export async function submitG5FormAction(formData: G5FormData, projectId: string, projectName: string) {
  return submitGateForm(5, formData, projectId, projectName)
}

export async function submitG6FormAction(formData: G6FormData, projectId: string, projectName: string) {
  return submitGateForm(6, formData, projectId, projectName)
}

export async function submitG7FormAction(formData: G7FormData, projectId: string, projectName: string) {
  return submitGateForm(7, formData, projectId, projectName)
}
