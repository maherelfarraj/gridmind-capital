'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

import { getCurrentTenantId } from '@/lib/tenant'

// Roles allowed to see the company-level cash view.
// (DB user_role enum has no literal sponsor/financial — mapped to the closest real roles.)
// admin → system_admin/tenant_admin · sponsor → project_director · financial → finance_manager/commercial_manager
const ALLOWED_ROLES = [
  'system_admin', 'tenant_admin', 'project_director', 'finance_manager', 'commercial_manager',
]

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PortfolioCashKpis {
  totalContractValue: number
  invoicedToDate: number
  receivedToDate: number
  overdueAmount: number
  overdueCount: number
  retentionHeld: number
  forecast90: number
}

export interface CompanyCashPoint {
  period: string        // YYYY-MM
  planned: number       // cumulative planned (extends into 12-month forecast)
  invoiced: number      // cumulative invoiced (actuals only)
  received: number      // cumulative received (actuals only)
  forecast: boolean     // true for months beyond the current month
}

export interface ProjectCashRow {
  projectId: string
  code: string
  name: string
  status: string
  contractValue: number
  invoiced: number
  received: number
  overdueAmount: number
  oldestOverdueDays: number
  retentionHeld: number
}

export interface WatchlistRow {
  id: string
  projectId: string
  code: string
  projectName: string
  milestone: string
  amount: number          // outstanding (invoice - paid)
  daysOverdue: number
  escalationLevel: number
  dueDate: string | null
}

export interface PortfolioCashFlowData {
  authorized: boolean
  role: string | null
  kpis: PortfolioCashKpis
  chart: CompanyCashPoint[]
  breakdown: ProjectCashRow[]
  watchlist: WatchlistRow[]
  statuses: string[]      // distinct project statuses present (for the status filter)
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function isOverdue(m: { invoiced_at: string | null; paid_at: string | null; due_date: string | null }): boolean {
  if (m.paid_at) return false
  if (!m.invoiced_at) return false
  return !!m.due_date && daysSince(m.due_date) > 0
}

function monthKey(d: string | null): string | null {
  return d ? d.slice(0, 7) : null
}

/** Add `n` months to a YYYY-MM key. */
function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

async function getActor(): Promise<{ role: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { role: null }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    return { role: profile?.role ?? null }
  } catch {
    return { role: null }
  }
}

function emptyData(authorized: boolean, role: string | null): PortfolioCashFlowData {
  return {
    authorized,
    role,
    kpis: {
      totalContractValue: 0, invoicedToDate: 0, receivedToDate: 0,
      overdueAmount: 0, overdueCount: 0, retentionHeld: 0, forecast90: 0,
    },
    chart: [],
    breakdown: [],
    watchlist: [],
    statuses: [],
  }
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

export async function loadPortfolioCashFlow(): Promise<PortfolioCashFlowData> {
  const { role } = await getActor()
  // Null role = dev/unauthenticated fallback (matches app convention); otherwise enforce allow-list.
  const authorized = role == null || ALLOWED_ROLES.includes(role)
  if (!authorized) return emptyData(false, role)

  const admin = createAdminClient()
  const tenantId = await getCurrentTenantId()

  // Active projects in the tenant (admins/sponsors/financial see all).
  const { data: projectRows } = await admin
    .from('projects')
    .select('id, code, name, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  const projects = projectRows ?? []
  if (projects.length === 0) return emptyData(true, role)

  const projectIds = projects.map((p) => p.id)
  const projectMap = new Map(projects.map((p) => [p.id, p]))

  const [msRes, retRes] = await Promise.all([
    admin.from('payment_milestones').select('*').in('project_id', projectIds),
    admin.from('retention_entries').select('*').in('project_id', projectIds),
  ])

  const milestones = msRes.data ?? []
  const retentions = retRes.data ?? []

  // Per-project retention held
  const retentionHeldByProject = new Map<string, number>()
  let totalRetentionHeld = 0
  for (const r of retentions) {
    if (r.status !== 'held') continue
    const amt = num(r.retention_amount)
    totalRetentionHeld += amt
    retentionHeldByProject.set(r.project_id, (retentionHeldByProject.get(r.project_id) ?? 0) + amt)
  }

  // ── Per-project breakdown + KPI accumulation ──
  const breakdownMap = new Map<string, ProjectCashRow>()
  for (const p of projects) {
    breakdownMap.set(p.id, {
      projectId: p.id, code: p.code, name: p.name, status: p.status,
      contractValue: 0, invoiced: 0, received: 0,
      overdueAmount: 0, oldestOverdueDays: 0,
      retentionHeld: retentionHeldByProject.get(p.id) ?? 0,
    })
  }

  const watchlist: WatchlistRow[] = []
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 86400000)
  let forecast90 = 0

  for (const m of milestones) {
    const row = breakdownMap.get(m.project_id)
    if (!row) continue
    const planned = num(m.planned_amount)
    const invoice = num(m.invoice_amount)
    const paid = num(m.paid_amount)

    row.contractValue += planned
    row.invoiced += invoice
    row.received += paid

    // Forecast next-90-days receipts: unpaid milestones with a planned date in the window.
    if (!m.paid_at && m.planned_date) {
      const pd = new Date(m.planned_date)
      if (pd >= now && pd <= in90) forecast90 += planned || invoice
    }

    if (isOverdue(m)) {
      const outstanding = invoice - paid
      const dOver = daysSince(m.due_date)
      row.overdueAmount += outstanding
      if (dOver > row.oldestOverdueDays) row.oldestOverdueDays = dOver
      const proj = projectMap.get(m.project_id)!
      watchlist.push({
        id: m.id,
        projectId: m.project_id,
        code: proj.code,
        projectName: proj.name,
        milestone: m.title,
        amount: outstanding,
        daysOverdue: dOver,
        escalationLevel: m.escalation_level ?? 0,
        dueDate: m.due_date,
      })
    }
  }

  const breakdown = [...breakdownMap.values()].sort((a, b) => b.contractValue - a.contractValue)
  watchlist.sort((a, b) => b.daysOverdue - a.daysOverdue)

  // ── KPIs ──
  const kpis: PortfolioCashKpis = {
    totalContractValue: breakdown.reduce((s, r) => s + r.contractValue, 0),
    invoicedToDate: breakdown.reduce((s, r) => s + r.invoiced, 0),
    receivedToDate: breakdown.reduce((s, r) => s + r.received, 0),
    overdueAmount: breakdown.reduce((s, r) => s + r.overdueAmount, 0),
    overdueCount: watchlist.length,
    retentionHeld: totalRetentionHeld,
    forecast90,
  }

  // ── Company cash curve (cumulative) with 12-month forecast ──
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthSet = new Set<string>()
  for (const m of milestones) {
    for (const d of [m.planned_date, m.invoiced_at, m.paid_at]) {
      const k = monthKey(d)
      if (k) monthSet.add(k)
    }
  }
  monthSet.add(currentMonth)
  // Ensure the forecast window covers the next 12 months.
  for (let i = 1; i <= 12; i++) monthSet.add(addMonths(currentMonth, i))

  const forecastHorizon = addMonths(currentMonth, 12)
  const months = [...monthSet].filter((mo) => mo <= forecastHorizon).sort()

  // Pre-bucket amounts by month for efficiency.
  const plannedByMonth = new Map<string, number>()
  const invoicedByMonth = new Map<string, number>()
  const receivedByMonth = new Map<string, number>()
  for (const m of milestones) {
    const pk = monthKey(m.planned_date)
    if (pk) plannedByMonth.set(pk, (plannedByMonth.get(pk) ?? 0) + num(m.planned_amount))
    const ik = monthKey(m.invoiced_at)
    if (ik) invoicedByMonth.set(ik, (invoicedByMonth.get(ik) ?? 0) + num(m.invoice_amount))
    const rk = monthKey(m.paid_at)
    if (rk) receivedByMonth.set(rk, (receivedByMonth.get(rk) ?? 0) + num(m.paid_amount))
  }

  const chart: CompanyCashPoint[] = []
  let cp = 0, ci = 0, cr = 0
  for (const mo of months) {
    cp += plannedByMonth.get(mo) ?? 0
    // Invoiced/received are actuals — only accumulate up to the current month.
    if (mo <= currentMonth) {
      ci += invoicedByMonth.get(mo) ?? 0
      cr += receivedByMonth.get(mo) ?? 0
    }
    chart.push({ period: mo, planned: cp, invoiced: ci, received: cr, forecast: mo > currentMonth })
  }

  const statuses = [...new Set(projects.map((p) => p.status))].sort()

  return { authorized: true, role, kpis, chart, breakdown, watchlist, statuses }
}
