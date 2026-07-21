'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface Asset {
  id: string
  tenant_id: string
  project_id: string
  project_name: string
  asset_tag: string
  name: string
  category: 'panel' | 'inverter' | 'transformer' | 'cable' | 'structure' | 'other'
  manufacturer: string
  model: string
  serial_number: string
  installed_date: string | null
  warranty_expiry: string | null
  status: 'operational' | 'degraded' | 'faulty' | 'decommissioned'
  last_maintenance: string | null
  next_maintenance: string | null
  criticality: 'critical' | 'high' | 'medium' | 'low'
  created_at: string
}

export interface MaintenancePlan {
  id: string
  tenant_id: string
  asset_id: string
  asset_name: string
  title: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  last_completed: string | null
  next_due: string | null
  status: 'scheduled' | 'overdue' | 'completed' | 'skipped'
  assigned_to: string | null
  created_at: string
}

export interface OmDashboard {
  assets: Asset[]
  plans: MaintenancePlan[]
  stats: {
    totalAssets: number
    operational: number
    faulty: number
    overdueMaintenance: number
    upcomingMaintenance: number
    warrantyExpiringSoon: number
  }
  byCategory: { category: string; count: number }[]
  byStatus: { status: string; count: number }[]
}

export async function loadOmDashboard(): Promise<OmDashboard> {
  const sb = createAdminClient()
  const [{ data: assets }, { data: plans }, { data: projects }] = await Promise.all([
    sb.from('assets').select('*').eq('tenant_id', DEMO_TENANT).order('created_at', { ascending: false }),
    sb.from('maintenance_plans').select('*').eq('tenant_id', DEMO_TENANT).order('next_due'),
    sb.from('projects').select('id, name').eq('tenant_id', DEMO_TENANT),
  ])

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]))
  const a = (assets ?? []).map(r => ({ ...r, project_name: projectMap[r.project_id] ?? 'Unknown' })) as Asset[]
  const p = (plans ?? []).map(r => {
    const asset = a.find(x => x.id === r.asset_id)
    return { ...r, asset_name: asset?.name ?? 'Unknown' }
  }) as MaintenancePlan[]

  const catMap: Record<string, number> = {}
  const statusMap: Record<string, number> = {}
  for (const r of a) {
    catMap[r.category] = (catMap[r.category] ?? 0) + 1
    statusMap[r.status] = (statusMap[r.status] ?? 0) + 1
  }

  const now = new Date()
  const soon = new Date(now.getTime() + 90 * 86400000)

  return {
    assets: a,
    plans: p,
    stats: {
      totalAssets: a.length,
      operational: a.filter(r => r.status === 'operational').length,
      faulty: a.filter(r => r.status === 'faulty').length,
      overdueMaintenance: p.filter(r => r.status === 'overdue').length,
      upcomingMaintenance: p.filter(r => r.status === 'scheduled' && r.next_due && new Date(r.next_due) <= soon).length,
      warrantyExpiringSoon: a.filter(r => r.warranty_expiry && new Date(r.warranty_expiry) <= soon).length,
    },
    byCategory: Object.entries(catMap).map(([category, count]) => ({ category, count })),
    byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
  }
}

export async function updateAssetStatusAction(id: string, status: Asset['status']) {
  const sb = createAdminClient()
  const { error } = await sb.from('assets').update({ status }).eq('id', id)
  revalidatePath('/om')
  return { error: error?.message ?? null }
}

export async function completeMaintenanceAction(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from('maintenance_plans').update({
    status: 'completed',
    last_completed: new Date().toISOString(),
  }).eq('id', id)
  revalidatePath('/om')
  return { error: error?.message ?? null }
}

export async function seedOmDemoAction() {
  const sb = createAdminClient()
  const { data: existing } = await sb.from('assets').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if (existing && existing.length > 0) return { seeded: false }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  const pid = projects?.[0]?.id ?? 'a1000000-0000-0000-0000-000000000001'

  const assetRows = [
    { asset_tag: 'INV-001', name: 'Inverter Unit A1', category: 'inverter', manufacturer: 'SMA', model: 'SUNNY CENTRAL 2500', serial_number: 'SMA-2025-001', installed_date: '2026-01-15', warranty_expiry: '2036-01-14', status: 'operational', criticality: 'critical', last_maintenance: '2026-06-01', next_maintenance: '2026-09-01' },
    { asset_tag: 'INV-002', name: 'Inverter Unit A2', category: 'inverter', manufacturer: 'SMA', model: 'SUNNY CENTRAL 2500', serial_number: 'SMA-2025-002', installed_date: '2026-01-15', warranty_expiry: '2036-01-14', status: 'degraded', criticality: 'critical', last_maintenance: '2026-05-15', next_maintenance: '2026-08-15' },
    { asset_tag: 'TRF-001', name: 'MV Transformer T1', category: 'transformer', manufacturer: 'ABB', model: 'RESIBLOC 2500kVA', serial_number: 'ABB-2025-TR1', installed_date: '2025-12-01', warranty_expiry: '2035-11-30', status: 'operational', criticality: 'critical', last_maintenance: '2026-06-10', next_maintenance: '2026-12-10' },
    { asset_tag: 'PNL-001', name: 'Solar Module String 1', category: 'panel', manufacturer: 'Longi Solar', model: 'Hi-MO 6', serial_number: 'LG-2025-S001', installed_date: '2026-01-20', warranty_expiry: '2051-01-19', status: 'operational', criticality: 'medium', last_maintenance: '2026-06-20', next_maintenance: '2026-12-20' },
    { asset_tag: 'PNL-002', name: 'Solar Module String 2', category: 'panel', manufacturer: 'Longi Solar', model: 'Hi-MO 6', serial_number: 'LG-2025-S002', installed_date: '2026-01-20', warranty_expiry: '2051-01-19', status: 'faulty', criticality: 'medium', last_maintenance: null, next_maintenance: '2026-07-30' },
    { asset_tag: 'CBL-001', name: 'HV Cable Feeder 1', category: 'cable', manufacturer: 'Prysmian', model: '132kV XLPE', serial_number: 'PRY-2025-C001', installed_date: '2025-11-01', warranty_expiry: '2055-10-31', status: 'operational', criticality: 'high', last_maintenance: '2026-04-01', next_maintenance: '2027-04-01' },
  ]

  const { data: insertedAssets } = await sb.from('assets').insert(
    assetRows.map(a => ({ ...a, project_id: pid, tenant_id: DEMO_TENANT }))
  ).select('id, asset_tag')

  if (insertedAssets && insertedAssets.length > 0) {
    const planRows = insertedAssets.slice(0, 4).map((asset, i) => ({
      asset_id: asset.id,
      tenant_id: DEMO_TENANT,
      title: `${['Quarterly inspection', 'Thermographic scan', 'Annual service', 'Monthly checks'][i]}`,
      frequency: (['quarterly', 'annual', 'annual', 'monthly'] as const)[i],
      last_completed: i < 2 ? '2026-06-01' : null,
      next_due: [`2026-09-01`, `2027-06-01`, `2026-08-01`, `2026-08-01`][i],
      status: (i === 2 ? 'overdue' : 'scheduled') as 'scheduled' | 'overdue',
      assigned_to: 'O&M Team',
    }))
    await sb.from('maintenance_plans').insert(planRows)
  }

  revalidatePath('/om')
  return { seeded: true }
}
