'use server'

import { createAdminClient } from '@/lib/supabase/admin'
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
