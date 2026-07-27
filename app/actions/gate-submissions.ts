'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { sendApprovalRequestEmail } from '@/lib/email/send'
import { getCurrentTenantId } from '@/lib/tenant'

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
  /** Senior debt interest rate, percent (e.g. "6.25"). */
  interestRatePct:       string
  /** Debt share of total funding, percent (e.g. "70"). */
  debtRatioPct:          string
  projectFinanceReady:   boolean
  offtakeType:           'ppa' | 'fita' | 'merchant' | 'hybrid' | 'tbd'
  offtakeCounterparty:   string
  offtakeTerm:           string
  /** Agreed tariff in US cents per kWh (¢/kWh), e.g. "1.65". */
  tariffUsCentsKwh:      string
  contractorShortlist:   string
  projectDirector:       string
  oeConsultant:          string
  fidTargetDate:         string
  codTargetDate:         string
  totalCapexFinalUsd:    string
  contingencyPct:        string
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
  const tenantId = await getCurrentTenantId()

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
    tenant_id:   tenantId,
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

// ─── Reads ────────────────────────────────────────────────────

// ─── G0 data shape (returned to the gate detail page) ────────────────────────

export interface G0LiveStakeholder {
  id: string; name: string; role: string; title: string; organisation: string
  email: string; phone: string; influence: 'high' | 'medium' | 'low'
  interest: 'high' | 'medium' | 'low'; charter_signatory: boolean
  signed: boolean; signed_date: string | null
}

export interface G0LiveRisk {
  id: string; category: string; description: string
  level: 'low' | 'medium' | 'high' | 'critical'
  probability: number; impact: number; mitigation: string; owner: string
}

export interface G0LiveMilestone {
  id: string; name: string; target_date: string; actual_date: string | null
  status: 'pending' | 'in_progress' | 'complete' | 'at_risk'
  gate: string; owner: string
}

export interface G0DataResult {
  hasSubmission: boolean
  formData: G0FormData | null
  stakeholders: G0LiveStakeholder[]
  risks: G0LiveRisk[]
  milestones: G0LiveMilestone[]
}

/** Loads all live data for the G0 gate detail page in a single round-trip. */
export async function getG0Data(projectId: string): Promise<G0DataResult> {
  const supabase = createAdminClient()

  const [subRes, membersRes, risksRes, gatesRes] = await Promise.all([
    supabase
      .from('gate_submissions')
      .select('form_data')
      .eq('project_id', projectId)
      .eq('gate_number', 0)
      .maybeSingle(),
    supabase
      .from('project_members')
      .select('id, name, role')
      .eq('project_id', projectId),
    supabase
      .from('risks')
      .select('id, title, description, probability, impact, status, category')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('phase_gates')
      .select('id, phase_number, phase_name, status, updated_at')
      .eq('project_id', projectId)
      .order('phase_number', { ascending: true }),
  ])

  const formData = subRes.data?.form_data as G0FormData | null ?? null

  const stakeholders: G0LiveStakeholder[] = (membersRes.data ?? []).map((m) => {
    const n = (m as { name?: string }).name ?? 'Unknown'
    return {
      id: m.id, name: n, role: m.role ?? 'team',
      title: '', organisation: '', email: '', phone: '',
      influence: 'medium', interest: 'medium',
      charter_signatory: false, signed: false, signed_date: null,
    }
  })

  const riskScoreToLevel = (p: number, imp: number): 'low' | 'medium' | 'high' | 'critical' => {
    const score = p * imp
    if (score >= 16) return 'critical'
    if (score >= 9)  return 'high'
    if (score >= 4)  return 'medium'
    return 'low'
  }

  const risks: G0LiveRisk[] = (risksRes.data ?? []).map((r) => {
    const p   = Math.min(5, Math.max(1, Number(r.probability) || 3))
    const imp = Math.min(5, Math.max(1, Number(r.impact)      || 3))
    return {
      id:          r.id,
      category:    (r as { category?: string }).category ?? 'General',
      description: (r as { description?: string }).description ?? r.title ?? 'Risk',
      level:       riskScoreToLevel(p, imp),
      probability: Math.round((p / 5) * 100),
      impact:      Math.round((imp / 5) * 100),
      mitigation:  '',
      owner:       '',
    }
  })

  const GATE_STATUS_MAP: Record<string, G0LiveMilestone['status']> = {
    approved:  'complete',
    in_review: 'in_progress',
    pending:   'pending',
  }

  const milestones: G0LiveMilestone[] = (gatesRes.data ?? []).map((g) => ({
    id:          g.id,
    name:        (g as { phase_name?: string }).phase_name ?? `Gate ${g.phase_number}`,
    target_date: (g as { updated_at?: string }).updated_at?.slice(0, 10) ?? '',
    actual_date: (g as { status?: string }).status === 'approved'
      ? (g as { updated_at?: string }).updated_at?.slice(0, 10) ?? null
      : null,
    status:      GATE_STATUS_MAP[(g as { status?: string }).status ?? 'pending'] ?? 'pending',
    gate:        `G${(g as { phase_number?: number }).phase_number ?? 0}`,
    owner:       '',
  }))

  return { hasSubmission: !!subRes.data, formData, stakeholders, risks, milestones }
}

/**
 * Returns the gate numbers that already have a saved submission for a project.
 * Used to label entry points as "Edit submission" vs "Start submission".
 */
export async function getSubmittedGateNumbers(projectId: string): Promise<number[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('gate_submissions')
    .select('gate_number')
    .eq('project_id', projectId)

  if (error || !data) return []
  return data.map((r) => r.gate_number as number)
}
