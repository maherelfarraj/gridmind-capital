'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter, requireRole } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import { maybeCreateContractsInsight } from '@/app/actions/ai-insights'

import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function daysLate(completionDate: string): number {
  const due = new Date(completionDate).getTime()
  const now = Date.now()
  return now > due ? Math.floor((now - due) / 86_400_000) : 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContractType   = 'epc' | 'lump_sum' | 'cost_reimbursable' | 'framework' | 'supply' | 'service' | 'other'
export type ContractStatus = 'draft' | 'active' | 'completed' | 'terminated' | 'suspended'

export type MilestoneStatus = 'pending' | 'achieved' | 'missed' | 'paid'

export type SecurityType   = 'performance_bond' | 'advance_payment_bond' | 'retention_bond' | 'bid_bond' | 'warranty_bond' | 'letter_of_credit' | 'other'
export type SecurityStatus = 'active' | 'expired' | 'released' | 'claimed'

export interface ContractMilestone {
  id: string
  contract_id: string
  title: string
  due_date: string
  amount: number
  status: MilestoneStatus
  achieved_date: string | null
  created_at: string
}

export interface LdExposure {
  days_late: number
  ld_amount: number
  capped: boolean
}

export interface Contract {
  id: string
  tenant_id: string
  project_id: string
  contract_no: string
  title: string
  party: string | null
  type: ContractType
  status: ContractStatus
  value: number
  currency: string
  signed_date: string | null
  commencement: string | null
  completion: string | null
  retention_pct: number
  ld_rate_per_day: number
  ld_cap_pct: number
  created_at: string
  milestones: ContractMilestone[]
  ld_exposure: LdExposure
}

export interface ContractsRegisterSummary {
  total_value_by_type: { type: string; value: number }[]
  active_count: number
  milestone_achieved: number
  milestone_missed: number
  milestone_pending: number
  total_ld_exposure: number
}

export interface ContractsRegister {
  contracts: Contract[]
  summary: ContractsRegisterSummary
}

export interface Security {
  id: string
  tenant_id: string
  project_id: string
  contract_id: string | null
  type: SecurityType
  issuer: string | null
  reference: string | null
  amount: number
  currency: string
  issue_date: string | null
  expiry_date: string | null
  status: SecurityStatus
  days_to_expiry: number | null
  created_at: string
}

export interface SecuritiesRegisterSummary {
  total_bonded_value: number
  expiring_within_30_days: number
  expired_not_released: number
}

export interface SecuritiesRegister {
  securities: Security[]
  summary: SecuritiesRegisterSummary
}

// ─────────────────────────────────────────────────────────────────────────────
// Row mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapMilestone(r: Record<string, unknown>): ContractMilestone {
  return {
    id:            r.id as string,
    contract_id:   r.contract_id as string,
    title:         r.title as string,
    due_date:      r.due_date as string,
    amount:        num(r.amount),
    status:        (r.status as MilestoneStatus) ?? 'pending',
    achieved_date: (r.achieved_date as string | null) ?? null,
    created_at:    (r.created_at as string) ?? '',
  }
}

function mapContract(
  r: Record<string, unknown>,
  milestones: ContractMilestone[],
): Contract {
  const status     = (r.status as ContractStatus) ?? 'draft'
  const completion = (r.completion as string | null) ?? null
  const value      = num(r.value)
  const ldRate     = num(r.ld_rate_per_day)
  const ldCapPct   = num(r.ld_cap_pct)

  // Compute LD exposure inline
  let ldExposure: LdExposure = { days_late: 0, ld_amount: 0, capped: false }
  if (status === 'active' && completion) {
    const days = daysLate(completion)
    if (days > 0) {
      const raw     = days * ldRate
      const cap     = value * (ldCapPct / 100)
      const capped  = cap > 0 && raw > cap
      ldExposure = { days_late: days, ld_amount: capped ? cap : raw, capped }
    }
  }

  return {
    id:              r.id as string,
    tenant_id:       r.tenant_id as string,
    project_id:      r.project_id as string,
    contract_no:     r.contract_no as string,
    title:           r.title as string,
    party:           (r.party as string | null) ?? null,
    type:            (r.type as ContractType) ?? 'other',
    status,
    value,
    currency:        (r.currency as string) ?? 'USD',
    signed_date:     (r.signed_date as string | null) ?? null,
    commencement:    (r.commencement as string | null) ?? null,
    completion,
    retention_pct:   num(r.retention_pct),
    ld_rate_per_day: ldRate,
    ld_cap_pct:      ldCapPct,
    created_at:      (r.created_at as string) ?? '',
    milestones,
    ld_exposure:     ldExposure,
  }
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000)
}

function mapSecurity(r: Record<string, unknown>): Security {
  return {
    id:            r.id as string,
    tenant_id:     r.tenant_id as string,
    project_id:    r.project_id as string,
    contract_id:   (r.contract_id as string | null) ?? null,
    type:          (r.type as SecurityType) ?? 'other',
    issuer:        (r.issuer as string | null) ?? null,
    reference:     (r.reference as string | null) ?? null,
    amount:        num(r.amount),
    currency:      (r.currency as string) ?? 'USD',
    issue_date:    (r.issue_date as string | null) ?? null,
    expiry_date:   (r.expiry_date as string | null) ?? null,
    status:        (r.status as SecurityStatus) ?? 'active',
    days_to_expiry: daysUntil(r.expiry_date as string | null),
    created_at:    (r.created_at as string) ?? '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getContractsRegister
// ─────────────────────────────────────────────────────────────────────────────

export async function getContractsRegister(projectId: string): Promise<ContractsRegister> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()

  const [contractsRes, milestonesRes] = await Promise.all([
    admin
      .from('contracts')
      .select('id, tenant_id, project_id, contract_no, title, party, type, status, value, currency, signed_date, commencement, completion, retention_pct, ld_rate_per_day, ld_cap_pct, created_at')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('contract_no', { ascending: true }),
    admin
      .from('contract_milestones')
      .select('id, contract_id, title, due_date, amount, status, achieved_date, created_at')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true }),
  ])

  // Group milestones by contract_id
  const milestonesByContract: Record<string, ContractMilestone[]> = {}
  for (const m of contractsRes.data?.map(c => c.id) ?? []) {
    milestonesByContract[m as string] = []
  }
  for (const m of milestonesRes.data ?? []) {
    const ms = mapMilestone(m as Record<string, unknown>)
    if (!milestonesByContract[ms.contract_id]) milestonesByContract[ms.contract_id] = []
    milestonesByContract[ms.contract_id].push(ms)
  }

  const contracts = (contractsRes.data ?? []).map(r =>
    mapContract(r as Record<string, unknown>, milestonesByContract[r.id as string] ?? []),
  )

  // Summary
  const valueByType: Record<string, number> = {}
  let achieved = 0, missed = 0, pending = 0, totalLd = 0

  for (const c of contracts) {
    valueByType[c.type] = (valueByType[c.type] ?? 0) + c.value
    totalLd += c.ld_exposure.ld_amount
    for (const m of c.milestones) {
      if (m.status === 'achieved' || m.status === 'paid') achieved++
      else if (m.status === 'missed') missed++
      else pending++
    }
  }

  const summary: ContractsRegisterSummary = {
    total_value_by_type: Object.entries(valueByType).map(([type, value]) => ({ type, value })),
    active_count: contracts.filter(c => c.status === 'active').length,
    milestone_achieved: achieved,
    milestone_missed: missed,
    milestone_pending: pending,
    total_ld_exposure: totalLd,
  }

  // Fire-and-forget contracts AI insight check.
  // Need oldest expired-but-active security age — fetch securities for project.
  void (async () => {
    const tenantId = await getCurrentTenantId()
    try {
      const admin2 = createAdminClient()
      const { data: secRows } = await admin2
        .from('securities')
        .select('expiry_date, status')
        .eq('project_id', projectId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
      const oldestExpiredDays = (secRows ?? []).reduce((max: number, s: Record<string, unknown>) => {
        const exp = s.expiry_date as string | null
        if (!exp) return max
        const days = Math.floor((Date.now() - new Date(exp).getTime()) / 86_400_000)
        return days > 0 ? Math.max(max, days) : max
      }, 0)
      await maybeCreateContractsInsight(projectId, summary.total_ld_exposure, oldestExpiredDays)
    } catch { /* best-effort */ }
  })()

  return { contracts, summary }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. createContract
// ─────────────────────────────────────────────────────────────────────────────

export async function createContract(
  projectId: string,
  data: {
    const tenantId = await getCurrentTenantId()
    title: string
    party?: string
    type: ContractType
    value: number
    currency?: string
    signed_date?: string | null
    commencement?: string | null
    completion?: string | null
    retention_pct?: number
    ld_rate_per_day?: number
    ld_cap_pct?: number
  },
  milestones: { title: string; due_date: string; amount: number }[] = [],
): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()

  // Auto-number: CON-NNN (padded to 3 digits, scoped to project)
  const { count } = await admin
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const contract_no = `CON-${seq}`

  const { data: inserted, error } = await admin
    .from('contracts')
    .insert({
      tenant_id:       tenantId,
      project_id:      projectId,
      contract_no,
      title:           data.title.trim(),
      party:           data.party?.trim() ?? null,
      type:            data.type,
      status:          'active',
      value:           num(data.value),
      currency:        data.currency ?? 'USD',
      signed_date:     data.signed_date ?? null,
      commencement:    data.commencement ?? null,
      completion:      data.completion ?? null,
      retention_pct:   num(data.retention_pct ?? 5),
      ld_rate_per_day: num(data.ld_rate_per_day ?? 0),
      ld_cap_pct:      num(data.ld_cap_pct ?? 10),
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Failed to create contract' }

  const contractId = (inserted as Record<string, unknown>).id as string

  // Insert milestones if provided
  if (milestones.length > 0) {
    const rows = milestones.map(m => ({
      tenant_id:   tenantId,
      contract_id: contractId,
      title:       m.title.trim(),
      due_date:    m.due_date,
      amount:      num(m.amount),
      status:      'pending' as MilestoneStatus,
    }))
    const { error: msErr } = await admin.from('contract_milestones').insert(rows)
    if (msErr) console.warn('[contracts] milestone insert partial failure:', msErr.message)
  }

  revalidatePath(`/projects/${projectId}/contracts`)
  return { id: contractId }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. computeLdExposure
// ─────────────────────────────────────────────────────────────────────────────

export async function computeLdExposure(contractId: string): Promise<LdExposure & { error?: string }> {
  const tenantId = await getCurrentTenantId()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contracts')
    .select('status, value, completion, ld_rate_per_day, ld_cap_pct')
    .eq('id', contractId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) return { days_late: 0, ld_amount: 0, capped: false, error: error?.message ?? 'Contract not found' }

  const r        = data as Record<string, unknown>
  const status   = r.status as ContractStatus
  const completion = r.completion as string | null

  if (status !== 'active' || !completion) {
    return { days_late: 0, ld_amount: 0, capped: false }
  }

  const days   = daysLate(completion)
  if (days === 0) return { days_late: 0, ld_amount: 0, capped: false }

  const value  = num(r.value)
  const rate   = num(r.ld_rate_per_day)
  const capPct = num(r.ld_cap_pct)
  const raw    = days * rate
  const cap    = value * (capPct / 100)
  const capped = cap > 0 && raw > cap

  return { days_late: days, ld_amount: capped ? cap : raw, capped }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. updateMilestoneStatus
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMilestoneStatus(
  id: string,
  status: MilestoneStatus,
  achievedDate?: string,
): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()

  // Read current milestone to get contract_id + amount for finance_records
  const { data: milestone, error: fetchErr } = await admin
    .from('contract_milestones')
    .select('id, contract_id, title, amount, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (fetchErr || !milestone) return { error: fetchErr?.message ?? 'Milestone not found' }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (achievedDate) patch.achieved_date = achievedDate
  else if (status === 'achieved' || status === 'paid') patch.achieved_date = new Date().toISOString().slice(0, 10)

  const { error } = await admin
    .from('contract_milestones')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  // On 'paid': record a finance_records row so the payment appears in finance roll-ups.
  if (status === 'paid') {
    const m     = milestone as Record<string, unknown>
    const amount = num(m.amount)
    const today  = new Date().toISOString().slice(0, 7) // YYYY-MM

    // Resolve project_id from the parent contract
    const { data: contract } = await admin
      .from('contracts')
      .select('project_id')
      .eq('id', m.contract_id as string)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const projectId = (contract as Record<string, unknown> | null)?.project_id as string | undefined

    if (projectId) {
      const { error: finErr } = await admin.from('finance_records').insert({
        tenant_id:   tenantId,
        project_id:  projectId,
        type:        'contract',
        category:    'milestone_payment',
        description: `Milestone payment — ${m.title as string}`,
        amount,
        status:      'paid',
        period:      today,
      })
      if (finErr) console.warn('[contracts] finance_records insert skipped:', finErr.message)

      revalidatePath(`/projects/${projectId}/contracts`)
    }
  }

  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getSecuritiesRegister (includes expiry sweep)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSecuritiesRegister(projectId: string): Promise<SecuritiesRegister> {
  const tenantId = await getCurrentTenantId()
  // Run expiry sweep first (best-effort, never blocks the read)
  await expirySweep(projectId)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('securities')
    .select('id, tenant_id, project_id, contract_id, type, issuer, reference, amount, currency, issue_date, expiry_date, status, created_at')
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  const securities = (error || !data ? [] : data).map(r => mapSecurity(r as Record<string, unknown>))

  const summary: SecuritiesRegisterSummary = {
    total_bonded_value:      securities.filter(s => s.status === 'active').reduce((a, s) => a + s.amount, 0),
    expiring_within_30_days: securities.filter(s => s.status === 'active' && s.days_to_expiry !== null && s.days_to_expiry >= 0 && s.days_to_expiry <= 30).length,
    expired_not_released:    securities.filter(s => s.status === 'expired').length,
  }

  return { securities, summary }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. createSecurity / releaseSecurity / claimSecurity
// ─────────────────────────────────────────────────────────────────────────────

export async function createSecurity(
  projectId: string,
  data: {
    const tenantId = await getCurrentTenantId()
    type: SecurityType
    issuer?: string
    reference?: string
    amount: number
    currency?: string
    issue_date?: string | null
    expiry_date?: string | null
    contract_id?: string | null
  },
): Promise<{ error?: string; id?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('securities')
    .insert({
      tenant_id:   tenantId,
      project_id:  projectId,
      contract_id: data.contract_id ?? null,
      type:        data.type,
      issuer:      data.issuer?.trim() ?? null,
      reference:   data.reference?.trim() ?? null,
      amount:      num(data.amount),
      currency:    data.currency ?? 'USD',
      issue_date:  data.issue_date ?? null,
      expiry_date: data.expiry_date ?? null,
      status:      'active',
    })
    .select('id')
    .single()

  if (error || !inserted) return { error: error?.message ?? 'Failed to create security' }
  revalidatePath(`/projects/${projectId}/contracts`)
  return { id: (inserted as Record<string, unknown>).id as string }
}

export async function releaseSecurity(id: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireRole(['system_admin', 'tenant_admin', 'project_director', 'finance_manager'])
  if ('error' in gate) return gate

  const admin = createAdminClient()
  const { data: current, error: fetchErr } = await admin
    .from('securities')
    .select('id, project_id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (fetchErr || !current) return { error: fetchErr?.message ?? 'Security not found' }
  const s = current as Record<string, unknown>
  if (s.status !== 'active' && s.status !== 'expired') {
    return { error: `Cannot release a security with status '${s.status as string}'.` }
  }

  const { error } = await admin
    .from('securities')
    .update({ status: 'released', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${s.project_id as string}/contracts`)
  return {}
}

export async function claimSecurity(id: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireRole(['system_admin', 'tenant_admin', 'project_director', 'finance_manager'])
  if ('error' in gate) return gate

  const admin = createAdminClient()
  const { data: current, error: fetchErr } = await admin
    .from('securities')
    .select('id, project_id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (fetchErr || !current) return { error: fetchErr?.message ?? 'Security not found' }
  const s = current as Record<string, unknown>
  if (s.status !== 'active') {
    return { error: `Only active securities can be claimed. Current status: '${s.status as string}'.` }
  }

  const { error } = await admin
    .from('securities')
    .update({ status: 'claimed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${s.project_id as string}/contracts`)
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. expirySweep
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark securities 'expired' where status='active' and expiry_date < today.
 * Called inside getSecuritiesRegister — best-effort, never throws.
 */
export async function expirySweep(projectId: string): Promise<void> {
  const tenantId = await getCurrentTenantId()
  try {
    const admin = createAdminClient()
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await admin
      .from('securities')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .lt('expiry_date', today)
    if (error) console.warn('[contracts] expirySweep failed:', error.message)
  } catch (e) {
    console.warn('[contracts] expirySweep threw:', e)
  }
}
