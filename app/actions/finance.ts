'use server'

import { createAdminClient } from '@/lib/supabase/admin'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/auth/guard'
const M = 1_000_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WbsData {
  id: string
  code: string
  description: string
  bac: number      // Budget At Completion ($M)
  ev: number       // Earned Value ($M)
  ac: number       // Actual Cost ($M)
  pv: number       // Planned Value ($M)
  eac?: number     // Estimate At Completion ($M)
  level: number    // 0 = portfolio root, 1 = project line
}

export interface CommitmentData {
  id: string
  ref: string
  vendor: string
  description: string
  value: number    // $M
  status: 'committed' | 'invoiced' | 'paid' | 'disputed'
  date: string
}

export interface FinanceDashboard {
  wbs: WbsData[]
  commitments: CommitmentData[]
  seeded: boolean
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const PO_STATUS_MAP: Record<string, CommitmentData['status']> = {
  draft:        'committed',
  issued:       'committed',
  acknowledged: 'committed',
  active:       'committed',
  delivered:    'paid',
  invoiced:     'invoiced',
  paid:         'paid',
  disputed:     'disputed',
}

function fmtDate(isoStr: string | null): string {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ─── Main loader ──────────────────────────────────────────────────────────────

export async function getFinanceDashboard(projectId?: string): Promise<FinanceDashboard> {
  try {
    await requireUser()
  } catch (e: any) {
    return { wbs: [], commitments: [], seeded: false }
  }

  const tenantId = await getCurrentTenantId()
  const sb = createAdminClient()

  let frQuery = sb
    .from('finance_records')
    .select('id, project_id, period, bac, ev, ac, pv, cpi, spi, eac')
    .eq('tenant_id', tenantId)
    .order('period', { ascending: false })

  if (projectId) {
    frQuery = frQuery.eq('project_id', projectId)
  }

  const [{ data: frData }, { data: projectsData }, { data: poData }] = await Promise.all([
    frQuery,
    sb
      .from('projects')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at'),
    sb
      .from('purchase_orders')
      .select('id, po_number, vendor_name, description, amount_usd, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const rows = frData ?? []
  const seeded = rows.length > 0

  // Pick the latest period record per project
  const latestByProject: Record<string, typeof rows[0]> = {}
  for (const r of rows) {
    const prev = latestByProject[r.project_id]
    if (!prev || (r.period ?? '') > (prev.period ?? '')) {
      latestByProject[r.project_id] = r
    }
  }

  const pm = Object.fromEntries(
    (projectsData ?? []).map((p) => [p.id, { name: p.name as string, code: p.code as string }])
  )
  const subRows = Object.values(latestByProject)

  // Portfolio totals
  const totBac = subRows.reduce((s, r) => s + (Number(r.bac) || 0), 0)
  const totEv  = subRows.reduce((s, r) => s + (Number(r.ev)  || 0), 0)
  const totAc  = subRows.reduce((s, r) => s + (Number(r.ac)  || 0), 0)
  const totPv  = subRows.reduce((s, r) => s + (Number(r.pv)  || 0), 0)
  const totEac = subRows.reduce((s, r) => s + (Number(r.eac) || 0), 0)

  const wbs: WbsData[] = []

  // Root row only when there are multiple projects
  if (subRows.length > 1) {
    wbs.push({
      id:          'portfolio-root',
      code:        '1.0',
      description: 'Portfolio Total — All Active Projects',
      bac:  totBac / M,
      ev:   totEv  / M,
      ac:   totAc  / M,
      pv:   totPv  / M,
      eac:  totEac > 0 ? totEac / M : undefined,
      level: 0,
    })
  }

  subRows.forEach((r, i) => {
    const proj = pm[r.project_id]
    const code = subRows.length > 1 ? `1.${i + 1}` : '1.0'
    wbs.push({
      id:          r.id,
      code,
      description: proj ? `${proj.name} (${proj.code})` : `Project ${i + 1}`,
      bac:  (Number(r.bac)  || 0) / M,
      ev:   (Number(r.ev)   || 0) / M,
      ac:   (Number(r.ac)   || 0) / M,
      pv:   (Number(r.pv)   || 0) / M,
      eac:  r.eac ? (Number(r.eac) / M) : undefined,
      level: subRows.length > 1 ? 1 : 0,
    })
  })

  // Commitments from purchase_orders
  const commitments: CommitmentData[] = (poData ?? []).map((p) => ({
    id:          p.id,
    ref:         (p.po_number as string | null) ?? p.id.slice(0, 8).toUpperCase(),
    vendor:      (p.vendor_name as string | null) ?? 'Unknown Vendor',
    description: (p.description as string | null) ?? '',
    value:       ((Number(p.amount_usd) || 0)) / M,
    status:      PO_STATUS_MAP[(p.status as string | null) ?? 'draft'] ?? 'committed',
    date:        fmtDate(p.created_at as string | null),
  }))

  return { wbs, commitments, seeded }
}
