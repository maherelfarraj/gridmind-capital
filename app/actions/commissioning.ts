'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { CommissioningTest, HandoverRecord, CommissioningDashboard } from '@/lib/types/action-types'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ─── Load ─────────────────────────────────────────────────────
export async function loadCommissioningDashboard(): Promise<CommissioningDashboard> {
  const sb = createAdminClient()

  const [{ data: tests }, { data: handover }, { data: projects }] = await Promise.all([
    sb.from('commissioning_tests').select('*').eq('tenant_id', DEMO_TENANT).order('created_at', { ascending: false }),
    sb.from('handover_records').select('*').eq('tenant_id', DEMO_TENANT).order('created_at', { ascending: false }),
    sb.from('projects').select('id, name').eq('tenant_id', DEMO_TENANT),
  ])

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]))
  const t = (tests ?? []).map(r => ({ ...r, project_name: projectMap[r.project_id] ?? 'Unknown' })) as CommissioningTest[]
  const h = (handover ?? []).map(r => ({ ...r, project_name: projectMap[r.project_id] ?? 'Unknown' })) as HandoverRecord[]

  const passed = t.filter(r => r.status === 'passed').length
  const failed = t.filter(r => r.status === 'failed').length
  const pending = t.filter(r => r.status === 'pending').length

  const systemMap: Record<string, { total: number; passed: number; failed: number }> = {}
  for (const r of t) {
    if (!systemMap[r.system]) systemMap[r.system] = { total: 0, passed: 0, failed: 0 }
    systemMap[r.system].total++
    if (r.status === 'passed') systemMap[r.system].passed++
    if (r.status === 'failed') systemMap[r.system].failed++
  }

  const typeMap: Record<string, number> = {}
  for (const r of t) { typeMap[r.test_type] = (typeMap[r.test_type] ?? 0) + 1 }

  return {
    tests: t,
    handover: h,
    stats: {
      totalTests: t.length,
      passedTests: passed,
      failedTests: failed,
      pendingTests: pending,
      handoverDocs: h.length,
      approvedDocs: h.filter(r => r.status === 'approved').length,
      passRate: t.length ? Math.round((passed / t.length) * 100) : 0,
    },
    bySystem: Object.entries(systemMap).map(([system, v]) => ({ system, ...v })),
    testsByType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
  }
}

// ─── Mutations ────────────────────────────────────────────────
export async function updateTestStatusAction(id: string, status: CommissioningTest['status']) {
  const sb = createAdminClient()
  const { error } = await sb
    .from('commissioning_tests')
    .update({ status, completed_date: status === 'passed' || status === 'failed' ? new Date().toISOString() : null })
    .eq('id', id)
  revalidatePath('/commissioning')
  return { error: error?.message ?? null }
}

export async function createTestAction(data: {
  project_id: string
  system: string
  subsystem: string
  test_number: string
  description: string
  test_type: CommissioningTest['test_type']
  scheduled_date: string
  witness_required: boolean
}) {
  const sb = createAdminClient()
  const { error } = await sb.from('commissioning_tests').insert({
    ...data,
    tenant_id: DEMO_TENANT,
    status: 'pending',
    defects_raised: 0,
  })
  revalidatePath('/commissioning')
  return { error: error?.message ?? null }
}

export async function approveHandoverDocAction(id: string) {
  const sb = createAdminClient()
  const { error } = await sb
    .from('handover_records')
    .update({ status: 'approved', approved_date: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/commissioning')
  return { error: error?.message ?? null }
}

// ─── Seed ─────────────────────────────────────────────────────
export async function seedCommissioningDemoAction() {
  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('commissioning_tests')
    .select('id')
    .eq('tenant_id', DEMO_TENANT)
    .limit(1)
  if (existing && existing.length > 0) return { seeded: false, message: 'Already seeded' }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', DEMO_TENANT).limit(2)
  const pid = projects?.[0]?.id ?? 'a1000000-0000-0000-0000-000000000001'

  const tests = [
    { system: 'DC Collection', subsystem: 'String Level', test_number: 'FC-001', description: 'String IV curve trace', test_type: 'functional', status: 'passed', witness_required: false, defects_raised: 0, scheduled_date: '2026-09-01', completed_date: '2026-09-02' },
    { system: 'DC Collection', subsystem: 'Combiner Boxes', test_number: 'FC-002', description: 'Combiner box insulation test', test_type: 'functional', status: 'passed', witness_required: false, defects_raised: 1, scheduled_date: '2026-09-03', completed_date: '2026-09-04' },
    { system: 'Inverter Station', subsystem: 'MV Transformer', test_number: 'FC-010', description: 'Transformer ratio test', test_type: 'functional', status: 'passed', witness_required: true, defects_raised: 0, scheduled_date: '2026-09-05', completed_date: '2026-09-06' },
    { system: 'Inverter Station', subsystem: 'Inverter Unit', test_number: 'FC-011', description: 'Inverter grid synchronisation', test_type: 'functional', status: 'failed', witness_required: true, defects_raised: 3, scheduled_date: '2026-09-07', completed_date: '2026-09-08' },
    { system: 'SCADA', subsystem: 'Communications', test_number: 'FC-020', description: 'SCADA comms loop test', test_type: 'functional', status: 'in_progress', witness_required: false, defects_raised: 0, scheduled_date: '2026-09-10', completed_date: null },
    { system: 'SCADA', subsystem: 'Alarms', test_number: 'FC-021', description: 'Alarm annunciation check', test_type: 'functional', status: 'pending', witness_required: false, defects_raised: 0, scheduled_date: '2026-09-11', completed_date: null },
    { system: 'Grid Connection', subsystem: 'HV Switchgear', test_number: 'PT-001', description: 'Grid code compliance performance test', test_type: 'performance', status: 'pending', witness_required: true, defects_raised: 0, scheduled_date: '2026-09-15', completed_date: null },
    { system: 'Grid Connection', subsystem: 'Protection Relays', test_number: 'PT-002', description: 'Protection relay coordination', test_type: 'performance', status: 'pending', witness_required: true, defects_raised: 0, scheduled_date: '2026-09-16', completed_date: null },
  ]

  await sb.from('commissioning_tests').insert(
    tests.map(t => ({ ...t, project_id: pid, tenant_id: DEMO_TENANT }))
  )

  const handoverDocs = [
    { document_type: 'as_built', title: 'As-Built DC Collection Drawings', revision: 'C', status: 'approved', submitted_by: 'EPC Contractor', approved_date: '2026-09-10' },
    { document_type: 'operation_manual', title: 'Inverter Station O&M Manual', revision: 'B', status: 'submitted', submitted_by: 'OEM Vendor', approved_date: null },
    { document_type: 'warranty', title: 'Module Warranty Certificates (Tier 1)', revision: 'A', status: 'approved', submitted_by: 'Procurement', approved_date: '2026-09-05' },
    { document_type: 'training_cert', title: 'O&M Team Training Records', revision: 'A', status: 'pending', submitted_by: null, approved_date: null },
    { document_type: 'spare_parts', title: 'Recommended Spare Parts List', revision: 'B', status: 'submitted', submitted_by: 'OEM Vendor', approved_date: null },
  ]

  await sb.from('handover_records').insert(
    handoverDocs.map(d => ({ ...d, project_id: pid, tenant_id: DEMO_TENANT }))
  )

  revalidatePath('/commissioning')
  return { seeded: true, message: 'Commissioning demo data seeded' }
}
