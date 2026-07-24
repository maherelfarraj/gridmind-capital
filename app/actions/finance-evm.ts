'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import type { FinanceRecord, CashFlowRecord, FinanceEvmDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

export async function loadFinanceEvmDashboard(): Promise<FinanceEvmDashboard> {
  const tenantId = await getCurrentTenantId()
  const sb = createAdminClient()
  const [{ data: records }, { data: cashflow }, { data: projects }, { data: certs }, { data: vos }] = await Promise.all([
    sb.from('finance_records').select('*').eq('tenant_id', tenantId).order('period'),
    sb.from('cash_flow_records').select('*').eq('tenant_id', tenantId).order('period'),
    sb.from('projects').select('id, name, budget_usd').eq('tenant_id', tenantId),
    sb.from('payment_certificates').select('this_period, status').eq('tenant_id', tenantId),
    sb.from('variation_orders').select('cost_impact, status').eq('tenant_id', tenantId),
  ])

  const pm = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]))
  const r = (records ?? []).map(x => ({ ...x, project_name: pm[x.project_id] ?? 'Unknown' })) as FinanceRecord[]
  const c = (cashflow ?? []).map(x => ({ ...x, project_name: pm[x.project_id] ?? 'Unknown' })) as CashFlowRecord[]

  const totalEV  = r.reduce((s, x) => s + (x.ev  ?? 0), 0)
  const avgSPI   = r.length ? r.reduce((s, x) => s + (x.spi ?? 1), 0) / r.length : 1

  // ── Actual Cost: prefer cumulative certified from payment certificates ──────
  // When certificates exist, the certified (certified/invoiced/paid) amount is a
  // firmer actual than the finance_records estimate; otherwise fall back.
  const certifiedStatuses = ['certified', 'invoiced', 'paid']
  const certifiedAC = (certs ?? [])
    .filter(x => certifiedStatuses.includes(x.status as string))
    .reduce((s, x) => s + Number(x.this_period ?? 0), 0)
  const recordsAC = r.reduce((s, x) => s + (x.ac ?? 0), 0)
  const acSource: 'certificates' | 'finance_records' = certifiedAC > 0 ? 'certificates' : 'finance_records'
  const totalAC = acSource === 'certificates' ? certifiedAC : recordsAC

  // ── Budget at Completion: baseline budget + approved VO cost impacts ─────────
  const approvedVos = (vos ?? []).filter(x => x.status === 'approved')
  const approvedVoCount = approvedVos.length
  const approvedVoImpact = approvedVos.reduce((s, x) => s + Number(x.cost_impact ?? 0), 0)
  const baselineBudget = (projects ?? []).reduce((s, p) => s + Number((p as { budget_usd?: number }).budget_usd ?? 0), 0)
  const recordsBAC = r.reduce((s, x) => s + (x.bac ?? 0), 0)
  // Use the project baseline + approved VOs when project budgets are available,
  // otherwise fall back to the finance_records BAC sum.
  const totalBAC = (baselineBudget > 0 ? baselineBudget : recordsBAC) + approvedVoImpact

  // CPI recomputed against the (possibly certificate-sourced) actual cost.
  const avgCPI = totalAC > 0 ? totalEV / totalAC : (r.length ? r.reduce((s, x) => s + (x.cpi ?? 1), 0) / r.length : 1)

  // Aggregate by period for trend charts
  const periodEvm: Record<string, { pv: number; ev: number; ac: number }> = {}
  for (const x of r) {
    if (!periodEvm[x.period]) periodEvm[x.period] = { pv: 0, ev: 0, ac: 0 }
    periodEvm[x.period].pv += x.pv ?? 0
    periodEvm[x.period].ev += x.ev ?? 0
    periodEvm[x.period].ac += x.ac ?? 0
  }

  const periodCash: Record<string, { inflow: number; outflow: number; net: number }> = {}
  for (const x of c) {
    if (!periodCash[x.period]) periodCash[x.period] = { inflow: 0, outflow: 0, net: 0 }
    periodCash[x.period].inflow  += x.actual_inflow ?? 0
    periodCash[x.period].outflow += x.actual_outflow ?? 0
    periodCash[x.period].net     += (x.actual_inflow ?? 0) - (x.actual_outflow ?? 0)
  }

  return {
    records: r,
    cashflow: c,
    summary: {
      totalBAC,
      totalEV,
      totalAC,
      avgCPI: Math.round(avgCPI * 100) / 100,
      avgSPI: Math.round(avgSPI * 100) / 100,
      totalEAC: r.reduce((s, x) => s + (x.eac ?? 0), 0),
      variance: totalEV - totalAC,
      acSource,
      approvedVoCount,
    },
    evmTrend: Object.entries(periodEvm).map(([period, v]) => ({ period, ...v })),
    cashTrend: Object.entries(periodCash).map(([period, v]) => ({ period, ...v })),
  }
}

export async function seedFinanceEvmDemoAction() {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const sb = createAdminClient()
  const { data: existing } = await sb.from('finance_records').select('id').eq('tenant_id', tenantId).limit(1)
  if (existing && existing.length > 0) return { seeded: false }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', tenantId).limit(1)
  const pid = projects?.[0]?.id ?? 'a1000000-0000-0000-0000-000000000001'

  const BAC = 320_000_000
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  const pvBase  = [0.05, 0.10, 0.15, 0.22, 0.30, 0.40]
  const evBase  = [0.04, 0.09, 0.14, 0.21, 0.28, 0.37]
  const acBase  = [0.042, 0.095, 0.145, 0.215, 0.285, 0.378]

  const finRows = months.map((period, i) => {
    const pv = pvBase[i] * BAC
    const ev = evBase[i] * BAC
    const ac = acBase[i] * BAC
    const cpi = Math.round((ev / ac) * 100) / 100
    const spi = Math.round((ev / pv) * 100) / 100
    const eac = Math.round(BAC / cpi)
    return {
      project_id: pid, tenant_id: tenantId, period,
      bac: BAC, pv: Math.round(pv), ev: Math.round(ev), ac: Math.round(ac),
      cpi, spi, eac, etc: eac - Math.round(ac), cv: Math.round(ev - ac), sv: Math.round(ev - pv),
    }
  })
  await sb.from('finance_records').insert(finRows)

  const cfRows = months.map((period, i) => {
    const planned_outflow = pvBase[i] * BAC * 0.9
    const actual_outflow  = acBase[i] * BAC * 0.9
    const planned_inflow  = pvBase[i] * BAC * 0.1
    const actual_inflow   = evBase[i] * BAC * 0.08
    return {
      project_id: pid, tenant_id: tenantId, period,
      planned_inflow: Math.round(planned_inflow),
      actual_inflow:  Math.round(actual_inflow),
      planned_outflow: Math.round(planned_outflow),
      actual_outflow:  Math.round(actual_outflow),
      cumulative_net: Math.round(actual_inflow - actual_outflow),
    }
  })
  await sb.from('cash_flow_records').insert(cfRows)

  revalidatePath('/finance')
  return { seeded: true }
}
