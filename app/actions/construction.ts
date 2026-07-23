'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import type { WorkPackage, InspectionRecord, PunchItem, ConstructionDashboard } from '@/lib/types/action-types'

const DEMO_TENANT  = '00000000-0000-0000-0000-000000000001'
const DEMO_USER    = '20000000-0000-0000-0000-000000000001'
const DEMO_PROJECT = 'a1000000-0000-0000-0000-000000000001'

export async function loadConstructionDashboard(): Promise<ConstructionDashboard> {
  const supabase = createAdminClient()

  const [wpRes, inspRes, punchRes] = await Promise.all([
    supabase.from('work_packages')
      .select('id, wp_code, title, discipline, contractor, planned_pct, actual_pct, status, health')
      .eq('tenant_id', DEMO_TENANT)
      .order('created_at', { ascending: false }),
    supabase.from('inspections')
      .select('id, title, type, result, date, inspector, location, metadata')
      .eq('tenant_id', DEMO_TENANT)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tickets')
      .select('id, title, category, status, priority, assigned_to, created_at, metadata')
      .eq('tenant_id', DEMO_TENANT)
      .eq('category', 'punch_item')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const wps = wpRes.data ?? []
  const insps = inspRes.data ?? []
  const punches = punchRes.data ?? []

  const workPackages: WorkPackage[] = wps.map((w) => ({
    id:          w.id,
    wp_code:     w.wp_code ?? '',
    title:       w.title ?? '',
    discipline:  w.discipline ?? 'General',
    contractor:  w.contractor ?? 'TBD',
    planned_pct: w.planned_pct ?? 0,
    actual_pct:  w.actual_pct  ?? 0,
    status:      w.status ?? 'active',
    health:      w.health ?? 'green',
  }))

  const inspections: InspectionRecord[] = insps.map((i) => ({
    id:        i.id,
    ref:       `INS-${i.id.slice(0, 5).toUpperCase()}`,
    title:     i.title ?? 'Inspection',
    type:      i.type ?? 'safety',
    result:    i.result ?? null,
    date:      i.date ?? i.id,
    inspector: i.inspector ?? 'Inspector',
    location:  i.location ?? '—',
  }))

  const punchItems: PunchItem[] = punches.map((p) => ({
    id:           p.id,
    ref:          `PL-${p.id.slice(0, 5).toUpperCase()}`,
    title:        p.title ?? 'Punch item',
    category:     ((p.metadata as { punch_cat?: string } | null)?.punch_cat === 'B') ? 'B' : 'A',
    discipline:   (p.metadata as { discipline?: string } | null)?.discipline ?? 'General',
    status:       p.status ?? 'open',
    assigned_to:  p.assigned_to ?? 'Unassigned',
    raised_date:  p.created_at,
  }))

  const discMap: Record<string, { planned: number; actual: number; count: number }> = {}
  workPackages.forEach((w) => {
    if (!discMap[w.discipline]) discMap[w.discipline] = { planned: 0, actual: 0, count: 0 }
    discMap[w.discipline].planned += w.planned_pct
    discMap[w.discipline].actual  += w.actual_pct
    discMap[w.discipline].count++
  })

  const resultMap: Record<string, number> = {}
  inspections.forEach((i) => {
    const r = i.result ?? 'pending'
    resultMap[r] = (resultMap[r] ?? 0) + 1
  })

  const catA = punchItems.filter((p) => p.category === 'A' && p.status !== 'closed').length
  const catB = punchItems.filter((p) => p.category === 'B' && p.status !== 'closed').length

  return {
    totalWPs:      workPackages.length,
    completedWPs:  workPackages.filter((w) => w.actual_pct >= 100).length,
    openPunches:   punchItems.filter((p) => p.status !== 'closed').length,
    catAPunches:   catA,
    wpByDiscipline: Object.entries(discMap).map(([name, v]) => ({
      name,
      planned: Math.round(v.planned / v.count),
      actual:  Math.round(v.actual  / v.count),
    })),
    punchByCategory: [
      { name: 'Cat A (Mandatory)', value: catA, color: '#ef4444' },
      { name: 'Cat B (Preferred)', value: catB, color: '#f59e0b' },
      { name: 'Closed',           value: punchItems.filter((p) => p.status === 'closed').length, color: '#22c55e' },
    ],
    inspectionResult: Object.entries(resultMap).map(([name, value]) => ({
      name, value,
      color: name === 'pass' ? '#22c55e' : name === 'fail' ? '#ef4444' : name === 'hold' ? '#f59e0b' : '#94a3b8',
    })),
    workPackages, inspections, punchItems,
  }
}

export async function closePunchItem(id: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', DEMO_TENANT)
  return { error: error?.message }
}

export async function recordInspection(data: {
  title: string; type: string; result: string; location: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('inspections').insert({
    tenant_id:  DEMO_TENANT,
    project_id: DEMO_PROJECT,
    title:      data.title,
    type:       data.type,
    result:     data.result,
    location:   data.location,
    date:       new Date().toISOString().slice(0, 10),
    inspector:  'Site Inspector',
  })
  return { error: error?.message }
}

export async function seedConstructionDemoData(): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('work_packages').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const wpData = [
    { wp_code: 'WP-CIV-001', title: 'Pile foundation — Zone A',    discipline: 'Civil',    contractor: 'Al Futtaim Carillion', planned_pct: 80, actual_pct: 75, status: 'active',    health: 'amber' },
    { wp_code: 'WP-CIV-002', title: 'Module mounting structures',  discipline: 'Civil',    contractor: 'Al Futtaim Carillion', planned_pct: 60, actual_pct: 55, status: 'active',    health: 'green' },
    { wp_code: 'WP-ELE-001', title: 'DC cabling — Zone A',        discipline: 'Electrical',contractor: 'Dubai Cables Co.',     planned_pct: 40, actual_pct: 38, status: 'active',    health: 'green' },
    { wp_code: 'WP-ELE-002', title: 'MV switchgear installation',  discipline: 'Electrical',contractor: 'ABB Services',         planned_pct: 20, actual_pct: 15, status: 'active',    health: 'amber' },
    { wp_code: 'WP-MEC-001', title: 'Inverter station assembly',   discipline: 'Mechanical',contractor: 'Huawei FusionSolar',   planned_pct: 30, actual_pct: 30, status: 'active',    health: 'green' },
    { wp_code: 'WP-CIV-003', title: 'Site grading & drainage',    discipline: 'Civil',    contractor: 'Al Futtaim Carillion', planned_pct:100, actual_pct:100, status: 'complete',  health: 'green' },
  ]
  for (const d of wpData) {
    await supabase.from('work_packages').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT, ...d,
    })
  }

  // Punch items
  const punchData = [
    { title: 'Pile cap reinforcement cover insufficient',  cat: 'A', disc: 'Civil' },
    { title: 'Cable tray grounding missing — Row E',        cat: 'A', disc: 'Electrical' },
    { title: 'Inverter cooling duct label incorrect',       cat: 'B', disc: 'Mechanical' },
    { title: 'Access road surface not to specification',    cat: 'B', disc: 'Civil' },
    { title: 'MV busbar torque records missing',            cat: 'A', disc: 'Electrical' },
  ]
  for (const p of punchData) {
    await supabase.from('tickets').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT,
      title: p.title, category: 'punch_item', status: 'open', priority: 'normal',
      description: `Category ${p.cat} punch item raised during inspection.`,
      created_by: DEMO_USER,
      metadata: { punch_cat: p.cat, discipline: p.disc },
    })
  }

  // Inspections
  const insps = [
    { title: 'Foundation ITP inspection — Zone A',  type: 'quality', result: 'pass', location: 'Zone A' },
    { title: 'Hot work permit verification',         type: 'safety',  result: 'pass', location: 'Inverter Station B' },
    { title: 'Cable tray QA check — Row D',         type: 'quality', result: 'hold', location: 'DC Array Zone D' },
    { title: 'Fire extinguisher check — main site', type: 'safety',  result: 'pass', location: 'Site Office' },
    { title: 'Grounding resistance test — zone B',  type: 'quality', result: 'fail', location: 'Zone B' },
  ]
  for (const i of insps) {
    await supabase.from('inspections').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT,
      date: new Date().toISOString().slice(0, 10),
      inspector: 'Site QA Engineer',
      ...i,
    })
  }
  return {}
}
