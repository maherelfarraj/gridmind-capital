'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import type { CommissioningTest, HandoverRecord, CommissioningDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

// ─── Load ─────────────────────────────────────────────────────
export async function loadCommissioningDashboard(): Promise<CommissioningDashboard> {
  const tenantId = await getCurrentTenantId()
  const sb = createAdminClient()

  const [{ data: tests }, { data: handover }, { data: projects }] = await Promise.all([
    sb.from('commissioning_tests').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    sb.from('handover_records').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    sb.from('projects').select('id, name').eq('tenant_id', tenantId),
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
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

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
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('commissioning_tests').insert({
    ...data,
    tenant_id: tenantId,
    status: 'pending',
    defects_raised: 0,
  })
  revalidatePath('/commissioning')
  return { error: error?.message ?? null }
}

export async function approveHandoverDocAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb
    .from('handover_records')
    .update({ status: 'approved', approved_date: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/commissioning')
  return { error: error?.message ?? null }
}

// ─── G6 gate detail page ──────────────────────────────────────────────────────

export interface G6TestPackage {
  id: string; code: string; title: string; description: string
  system: string; priority: string; status: string
  tests_total: number; tests_complete: number; pass: number; fail: number; retest: number
  next_test: string | null; lead: string; updated: string
  procedures: never[]; records: never[]; failures: never[]; sign_offs: never[]
  ref_docs: string[]; planned_start: string; planned_end: string
  actual_start: string | null; actual_end: string | null
}

export interface G6GridComplianceTest {
  id: string; test_name: string; standard: string | null
  test_date: string | null; result: string | null; certificate_ref: string | null
}

export interface G6GridComplianceSummary {
  tests:     G6GridComplianceTest[]
  total:     number
  passed:    number
  failed:    number
  scheduled: number
  pass_rate: number
}

export interface G6DataResult {
  testPackages:   G6TestPackage[]
  gateFormData:   Record<string, unknown> | null
  gridCompliance: G6GridComplianceSummary
}

const COMM_STATUS_REMAP: Record<string, string> = {
  pending:     'not_started',
  in_progress: 'in_progress',
  passed:      'complete',
  failed:      'failed',
  complete:    'complete',
}

export async function getG6Data(projectId: string): Promise<G6DataResult> {
  const tenantId = await getCurrentTenantId()
  const sb = createAdminClient()

  const [testRes, gateRes, complianceRes] = await Promise.all([
    sb.from('commissioning_tests')
      .select('id, test_number, description, system, test_type, status, scheduled_date, completed_date, lead_engineer, reference_doc, defects_raised, witness_required')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    sb.from('gate_submissions')
      .select('form_data')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('gate_number', 6)
      .maybeSingle(),
    // Grid compliance tests surface in the G6 gate data so commissioning
    // readiness reflects grid-code test status. Same shape as getGridCompliance.
    sb.from('grid_compliance_tests')
      .select('id, test_name, standard, test_date, result, certificate_ref')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('test_date', { ascending: true, nullsFirst: false }),
  ])

  const testPackages: G6TestPackage[] = (testRes.data ?? []).map((r) => {
    const mappedStatus = COMM_STATUS_REMAP[r.status ?? 'pending'] ?? 'not_started'
    const isComplete   = mappedStatus === 'complete'
    const isFailed     = mappedStatus === 'failed'
    return {
      id:             r.id,
      code:           r.test_number ?? `TP-${r.id.slice(0, 4).toUpperCase()}`,
      title:          r.description ?? 'Commissioning Test',
      description:    '',
      system:         'control_instrumentation',   // default valid TestSystem key
      priority:       r.witness_required ? 'high' : 'medium',
      status:         mappedStatus,
      tests_total:    1,
      tests_complete: isComplete ? 1 : 0,
      pass:           isComplete && !isFailed ? 1 : 0,
      fail:           isFailed ? 1 : 0,
      retest:         0,
      next_test:      null,
      lead:           (r as Record<string, unknown>).lead_engineer as string ?? '',
      updated:        r.completed_date ? 'completed' : 'scheduled',
      procedures:     [],
      records:        [],
      failures:       [],
      sign_offs:      [],
      ref_docs:       (r as Record<string, unknown>).reference_doc
                        ? [(r as Record<string, unknown>).reference_doc as string]
                        : [],
      planned_start:  r.scheduled_date ?? '',
      planned_end:    r.scheduled_date ?? '',
      actual_start:   r.scheduled_date ?? null,
      actual_end:     r.completed_date ?? null,
    }
  })

  const complianceTests: G6GridComplianceTest[] = (complianceRes.data ?? []).map((r) => ({
    id:              r.id             as string,
    test_name:       r.test_name       as string,
    standard:        r.standard        as string | null,
    test_date:       r.test_date       as string | null,
    result:          r.result          as string | null,
    certificate_ref: r.certificate_ref as string | null,
  }))
  const gcPassed    = complianceTests.filter(t => t.result === 'passed').length
  const gcFailed    = complianceTests.filter(t => t.result === 'failed').length
  const gcScheduled = complianceTests.filter(t => t.result === 'scheduled' || t.result == null).length

  return {
    testPackages,
    gateFormData: (gateRes.data?.form_data as Record<string, unknown>) ?? null,
    gridCompliance: {
      tests:     complianceTests,
      total:     complianceTests.length,
      passed:    gcPassed,
      failed:    gcFailed,
      scheduled: gcScheduled,
      pass_rate: (gcPassed + gcFailed) > 0 ? Math.round((gcPassed / (gcPassed + gcFailed)) * 100) : 0,
    },
  }
}

// ─── Seed ─────────────────────────────────────────────────────
export async function seedCommissioningDemoAction() {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return { seeded: false, message: gate.error }

  const sb = createAdminClient()

  const { data: existing } = await sb
    .from('commissioning_tests')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
  if (existing && existing.length > 0) return { seeded: false, message: 'Already seeded' }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', tenantId).limit(2)
  const pid = projects?.[0]?.id
  // No hardcoded fallback id: project_id is a FK, so seeding against a
  // nonexistent project would fail. Bail out instead.
  if (!pid) return { seeded: false, message: 'No project available to seed against' }

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
    tests.map(t => ({ ...t, project_id: pid, tenant_id: tenantId }))
  )

  const handoverDocs = [
    { document_type: 'as_built', title: 'As-Built DC Collection Drawings', revision: 'C', status: 'approved', submitted_by: 'EPC Contractor', approved_date: '2026-09-10' },
    { document_type: 'operation_manual', title: 'Inverter Station O&M Manual', revision: 'B', status: 'submitted', submitted_by: 'OEM Vendor', approved_date: null },
    { document_type: 'warranty', title: 'Module Warranty Certificates (Tier 1)', revision: 'A', status: 'approved', submitted_by: 'Procurement', approved_date: '2026-09-05' },
    { document_type: 'training_cert', title: 'O&M Team Training Records', revision: 'A', status: 'pending', submitted_by: null, approved_date: null },
    { document_type: 'spare_parts', title: 'Recommended Spare Parts List', revision: 'B', status: 'submitted', submitted_by: 'OEM Vendor', approved_date: null },
  ]

  await sb.from('handover_records').insert(
    handoverDocs.map(d => ({ ...d, project_id: pid, tenant_id: tenantId }))
  )

  revalidatePath('/commissioning')
  return { seeded: true, message: 'Commissioning demo data seeded' }
}
