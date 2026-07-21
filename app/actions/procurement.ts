'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_TENANT  = '00000000-0000-0000-0000-000000000001'
const DEMO_USER    = '20000000-0000-0000-0000-000000000001'
const DEMO_PROJECT = 'a1000000-0000-0000-0000-000000000001'

export interface RFQRecord {
  id: string
  rfq_number: string
  title: string
  vendor: string
  status: string
  issue_date: string
  close_date: string | null
  amount_usd: number
  score: number | null
}

export interface PORecord {
  id: string
  po_number: string
  vendor: string
  description: string
  amount_usd: number
  status: string
  issued_date: string | null
  expected_delivery: string | null
}

export interface ProcurementDashboard {
  totalRFQs: number
  openRFQs: number
  totalPOs: number
  poValue: number
  rfqStatus: { name: string; value: number; color: string }[]
  poByVendor: { name: string; value: number }[]
  rfqs: RFQRecord[]
  pos: PORecord[]
}

const RFQ_STATUS_COLORS: Record<string, string> = {
  draft:       '#94a3b8',
  issued:      '#3b82f6',
  closed:      '#f59e0b',
  evaluated:   '#a855f7',
  awarded:     '#22c55e',
  cancelled:   '#64748b',
}
const PO_STATUS_COLORS: Record<string, string> = {
  draft:       '#94a3b8',
  issued:      '#3b82f6',
  acknowledged:'#a855f7',
  delivered:   '#22c55e',
  closed:      '#10b981',
  disputed:    '#ef4444',
}

export async function loadProcurementDashboard(): Promise<ProcurementDashboard> {
  const supabase = createAdminClient()
  const [rfqRes, poRes] = await Promise.all([
    supabase.from('rfqs')
      .select('id, rfq_number, title, vendor, status, issue_date, close_date, amount_usd, score')
      .eq('tenant_id', DEMO_TENANT)
      .order('created_at', { ascending: false }),
    supabase.from('purchase_orders')
      .select('id, po_number, vendor, description, amount_usd, status, issued_date, expected_delivery')
      .eq('tenant_id', DEMO_TENANT)
      .order('created_at', { ascending: false }),
  ])

  const rfqs: RFQRecord[] = (rfqRes.data ?? []).map((r) => ({
    id:         r.id,
    rfq_number: r.rfq_number ?? '',
    title:      r.title ?? '',
    vendor:     r.vendor ?? 'TBD',
    status:     r.status ?? 'draft',
    issue_date: r.issue_date ?? r.id,
    close_date: r.close_date ?? null,
    amount_usd: r.amount_usd ?? 0,
    score:      r.score ?? null,
  }))

  const pos: PORecord[] = (poRes.data ?? []).map((p) => ({
    id:                p.id,
    po_number:         p.po_number ?? '',
    vendor:            p.vendor ?? 'TBD',
    description:       p.description ?? '',
    amount_usd:        p.amount_usd ?? 0,
    status:            p.status ?? 'draft',
    issued_date:       p.issued_date ?? null,
    expected_delivery: p.expected_delivery ?? null,
  }))

  const rfqStatusMap: Record<string, number> = {}
  rfqs.forEach((r) => { rfqStatusMap[r.status] = (rfqStatusMap[r.status] ?? 0) + 1 })

  const vendorMap: Record<string, number> = {}
  pos.forEach((p) => {
    const v = p.vendor.slice(0, 20)
    vendorMap[v] = (vendorMap[v] ?? 0) + p.amount_usd
  })

  return {
    totalRFQs: rfqs.length,
    openRFQs:  rfqs.filter((r) => r.status === 'issued' || r.status === 'draft').length,
    totalPOs:  pos.length,
    poValue:   pos.reduce((s, p) => s + p.amount_usd, 0),
    rfqStatus: Object.entries(rfqStatusMap).map(([name, value]) => ({
      name, value, color: RFQ_STATUS_COLORS[name] ?? '#94a3b8',
    })),
    poByVendor: Object.entries(vendorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value: Math.round(value / 1_000_000) })),
    rfqs, pos,
  }
}

export async function issueRFQ(data: {
  title: string; vendor: string; amount_usd: number; close_date: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const rfq_number = `RFQ-${Date.now().toString(36).toUpperCase().slice(-6)}`
  const { error } = await supabase.from('rfqs').insert({
    tenant_id:  DEMO_TENANT,
    project_id: DEMO_PROJECT,
    rfq_number,
    title:      data.title,
    vendor:     data.vendor,
    amount_usd: data.amount_usd,
    close_date: data.close_date || null,
    issue_date: new Date().toISOString().slice(0, 10),
    status:     'issued',
  })
  return { error: error?.message }
}

export async function advancePOStatus(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single()
  const lifecycle = ['draft', 'issued', 'acknowledged', 'delivered', 'closed']
  const current   = lifecycle.indexOf(po?.status ?? 'draft')
  const next      = lifecycle[current + 1]
  if (!next) return {}
  const { error } = await supabase.from('purchase_orders')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', DEMO_TENANT)
  return { error: error?.message }
}

export async function seedProcurementDemoData(): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('rfqs').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const rfqData = [
    { rfq_number: 'RFQ-2026-001', title: 'Solar PV Modules Supply', vendor: 'Jinko Solar', amount_usd: 45_000_000, status: 'awarded', score: 88 },
    { rfq_number: 'RFQ-2026-002', title: 'String Inverters Supply', vendor: 'Huawei FusionSolar', amount_usd: 12_000_000, status: 'evaluated', score: 91 },
    { rfq_number: 'RFQ-2026-003', title: 'MV Switchgear', vendor: 'ABB', amount_usd: 8_500_000, status: 'issued', score: null },
    { rfq_number: 'RFQ-2026-004', title: 'DC Cable Supply', vendor: 'Prysmian Group', amount_usd: 6_200_000, status: 'closed', score: 85 },
    { rfq_number: 'RFQ-2026-005', title: 'Civil Works Subcontract', vendor: 'Al Futtaim Carillion', amount_usd: 38_000_000, status: 'draft', score: null },
  ]
  for (const d of rfqData) {
    await supabase.from('rfqs').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT,
      issue_date: '2026-03-01', close_date: '2026-04-15', ...d,
    })
  }

  const poData = [
    { po_number: 'PO-2026-001', vendor: 'Jinko Solar',           description: 'Solar PV modules — 400MW',        amount_usd: 45_000_000, status: 'acknowledged', issued_date: '2026-05-01', expected_delivery: '2026-09-30' },
    { po_number: 'PO-2026-002', vendor: 'Huawei FusionSolar',    description: '1500V string inverters',           amount_usd: 12_000_000, status: 'issued',       issued_date: '2026-05-15', expected_delivery: '2026-08-31' },
    { po_number: 'PO-2026-003', vendor: 'Prysmian Group',        description: '1500V DC cables, 120mm²',         amount_usd: 6_200_000,  status: 'delivered',    issued_date: '2026-04-20', expected_delivery: '2026-07-15' },
    { po_number: 'PO-2026-004', vendor: 'Al Futtaim Carillion',  description: 'Foundation civil works Zone A–C',  amount_usd: 15_000_000, status: 'draft',        issued_date: null,         expected_delivery: null         },
  ]
  for (const d of poData) {
    await supabase.from('purchase_orders').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT, ...d,
    })
  }
  return {}
}
