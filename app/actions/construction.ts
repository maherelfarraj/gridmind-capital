'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { requireUser } from '@/lib/auth/guard'
import type { WorkPackage, InspectionRecord, PunchItem, ConstructionDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

// SOL-2026-001 "Al Dhafra Solar PV - Phase 1". The previous id
// (a1000000-...-001) was a duplicate-code row that has been deleted.
const DEMO_PROJECT = 'ce14ed42-0ea0-43e6-b718-cc2c2cb5283d'

export async function loadConstructionDashboard(): Promise<ConstructionDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [wpRes, inspRes, punchRes] = await Promise.all([
    supabase.from('work_packages')
      .select('id, wp_code, title, discipline, contractor, planned_pct, actual_pct, status, health')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('inspections')
      .select('id, title, type, result, date, inspector, location, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tickets')
      .select('id, title, category, status, priority, assigned_to, created_at, metadata')
      .eq('tenant_id', tenantId)
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
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId)
  return { error: error?.message }
}

export async function recordInspection(data: {
  title: string; type: string; result: string; location: string; projectId: string
}): Promise<{ error?: string }> {
  try {
    await requireUser()
  } catch (e: any) {
    return { error: 'Unauthorized' }
  }

  const gate = await requireWriter()
  if ('error' in gate) return gate
  const tenantId = await getCurrentTenantId()

  // Verify projectId exists and belongs to caller's tenant
  const supabase = createAdminClient()
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', data.projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (projectErr || !project) return { error: 'Project not found or access denied' }

  const { error } = await supabase.from('inspections').insert({
    tenant_id:  tenantId,
    project_id: data.projectId,
    title:      data.title,
    type:       data.type,
    result:     data.result,
    location:   data.location,
    date:       new Date().toISOString().slice(0, 10),
    inspector:  'Site Inspector',
  })
  return { error: error?.message }
}

// ─── G4 gate detail page ──────────────────────────────────────────────────────

export interface G4WorkPackage {
  id: string; code: string; wbs_code: string; title: string; description: string
  discipline: string; status: string; priority: string; progress_percent: number
  planned_hours: number; actual_hours: number; budget_amount: number; actual_cost: number
  start_date: string; end_date: string; team_size: number
  milestones: never[]; issues: never[]; documents: never[]
}

export interface G4Incident {
  id: string; date: string; type: string; severity: string
  description: string; person: string; status: string
}

export interface G4Permit {
  id: string; code: string; type: string; authority: string; status: string
  application_date: string; issue_date: string | null; expiry_date: string | null
  renewal_required: boolean; documents: string
}

export interface G4WorkPermit {
  id: string; permit_no: string; type: string; title: string
  location: string | null; status: string
  valid_from: string | null; valid_to: string | null; issuer: string | null
  active: boolean
}

export interface G4DataResult {
  workPackages: G4WorkPackage[]
  incidents:    G4Incident[]
  permits:      G4Permit[]
  workPermits:  G4WorkPermit[]
  dailyReportCount: number
  latestReportDate: string | null
  gateFormData: Record<string, unknown> | null
}

const WP_STATUS_REMAP: Record<string, string> = {
  complete:    'Complete',
  in_progress: 'In Progress',
  not_started: 'Not Started',
  on_hold:     'On Hold',
  blocked:     'Blocked',
}

const INCIDENT_SEV_REMAP: Record<string, string> = {
  fatal:       'Fatal',
  major:       'Major',
  serious:     'Serious',
  minor:       'Minor',
  near_miss:   'Near Miss',
  observation: 'Near Miss',
}

const INCIDENT_STATUS_REMAP: Record<string, string> = {
  open:                'Open',
  under_investigation: 'Under Investigation',
  closed:              'Closed',
  referred:            'Referred',
}

export async function getG4Data(projectId: string): Promise<G4DataResult> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [wpRes, incRes, permRes, workPermitRes, dailyRes, gateRes] = await Promise.all([
    supabase.from('work_packages')
      .select('id, wp_code, title, discipline, planned_pct, actual_pct, status')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase.from('hse_incidents')
      .select('id, ref, title, severity, status, incident_date, reported_by, description')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('hse_permits')
      .select('id, ref, type, scope, issued_to, issued_date, expiry_date, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('work_permits')
      .select('id, permit_no, type, title, location, status, valid_from, valid_to, issuer')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase.from('daily_reports')
      .select('report_date', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('report_date', { ascending: false }),
    supabase.from('gate_submissions')
      .select('form_data')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('gate_number', 4)
      .maybeSingle(),
  ])

  const workPackages: G4WorkPackage[] = (wpRes.data ?? []).map((r) => ({
    id:               r.id,
    code:             r.wp_code ?? r.id.slice(0, 8).toUpperCase(),
    wbs_code:         '',
    title:            r.title ?? 'Work Package',
    description:      '',
    discipline:       r.discipline ?? 'General',
    status:           WP_STATUS_REMAP[r.status ?? 'not_started'] ?? 'Not Started',
    priority:         'Medium',
    progress_percent: Number(r.actual_pct ?? 0),
    planned_hours:    0,
    actual_hours:     0,
    budget_amount:    0,
    actual_cost:      0,
    start_date:       '',
    end_date:         '',
    team_size:        0,
    milestones:       [],
    issues:           [],
    documents:        [],
  }))

  const incidents: G4Incident[] = (incRes.data ?? []).map((r) => ({
    id:          r.id,
    date:        r.incident_date ?? '',
    type:        'Incident',
    severity:    INCIDENT_SEV_REMAP[r.severity ?? 'observation'] ?? 'Minor',
    description: r.title ?? r.description ?? 'Incident',
    person:      r.reported_by ?? 'Unknown',
    status:      INCIDENT_STATUS_REMAP[r.status ?? 'open'] ?? 'Open',
  }))

  const permits: G4Permit[] = (permRes.data ?? []).map((r) => ({
    id:               r.id,
    code:             r.ref ?? `PTW-${r.id.slice(0, 4).toUpperCase()}`,
    type:             r.type ?? 'General',
    authority:        r.issued_to ?? 'Authority',
    status:           r.status
                        ? r.status.charAt(0).toUpperCase() + r.status.slice(1).replace(/_/g, ' ')
                        : 'Pending',
    application_date: '',
    issue_date:       r.issued_date ?? null,
    expiry_date:      r.expiry_date ?? null,
    renewal_required: false,
    documents:        r.scope ?? '',
  }))

  const nowMs = Date.now()
  const workPermits: G4WorkPermit[] = (workPermitRes.data ?? []).map((r) => ({
    id:         r.id as string,
    permit_no:  (r.permit_no as string) ?? `PTW-${(r.id as string).slice(0, 4).toUpperCase()}`,
    type:       (r.type as string) ?? 'general',
    title:      (r.title as string) ?? 'Work permit',
    location:   (r.location as string) ?? null,
    status:     (r.status as string) ?? 'requested',
    valid_from: (r.valid_from as string) ?? null,
    valid_to:   (r.valid_to as string) ?? null,
    issuer:     (r.issuer as string) ?? null,
    active:     r.status === 'issued' && !!r.valid_to && new Date(r.valid_to as string).getTime() > nowMs,
  }))

  return {
    workPackages,
    incidents,
    permits,
    workPermits,
    dailyReportCount: dailyRes.count ?? (dailyRes.data?.length ?? 0),
    latestReportDate: (dailyRes.data?.[0]?.report_date as string) ?? null,
    gateFormData: (gateRes.data?.form_data as Record<string, unknown>) ?? null,
  }
}

// ─── G5 gate detail page ──────────────────────────────────────────────────────

export interface G5Inspection {
  id: string; code: string; title: string; discipline: string
  type: string; system: string; planned_date: string; actual_date: string | null
  status: 'passed' | 'failed' | 'in_progress' | 'scheduled' | 'hold'
  inspector: string; contractor: string
  hold_points: string[]; witness_points: string[]
  result_notes: string; deficiencies: number
}

export interface G5PunchItem {
  id: string; code: string; description: string
  category: 'A' | 'B' | 'C'
  status: 'open' | 'closed' | 'in_progress' | 'disputed'
  discipline: string; system: string; location: string
  raised_by: string; assigned_to: string; raised_date: string
  due_date: string; closed_date: string | null
  priority: 'high' | 'medium' | 'low'; drawing_ref: string
}

export interface G5DataResult {
  inspections:  G5Inspection[]
  punchItems:   G5PunchItem[]
  gateFormData: Record<string, unknown> | null
}

const INSP_RESULT_TO_STATUS: Record<string, G5Inspection['status']> = {
  pass:        'passed',
  passed:      'passed',
  fail:        'failed',
  failed:      'failed',
  hold:        'hold',
  in_progress: 'in_progress',
}

const PUNCH_STATUS_REMAP: Record<string, G5PunchItem['status']> = {
  open:        'open',
  closed:      'closed',
  in_progress: 'in_progress',
  disputed:    'disputed',
  'in-progress': 'in_progress',
}

export async function getG5Data(projectId: string): Promise<G5DataResult> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [inspRes, punchRes, gateRes] = await Promise.all([
    supabase.from('inspections')
      .select('id, title, type, result, date, inspector, location, metadata')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('tickets')
      .select('id, title, status, priority, assigned_to, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .not('metadata->punch_cat', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('gate_submissions')
      .select('form_data')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('gate_number', 5)
      .maybeSingle(),
  ])

  const inspections: G5Inspection[] = (inspRes.data ?? []).map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {}
    return {
      id:            r.id,
      code:          `INS-${r.id.slice(0, 6).toUpperCase()}`,
      title:         r.title ?? 'Inspection',
      discipline:    (meta.discipline as string) ?? 'General',
      type:          r.type ?? 'Inspection',
      system:        (meta.system as string) ?? '',
      planned_date:  r.date ?? '',
      actual_date:   r.date ?? null,
      status:        INSP_RESULT_TO_STATUS[r.result ?? ''] ?? 'scheduled',
      inspector:     r.inspector ?? 'Inspector',
      contractor:    (meta.contractor as string) ?? '',
      hold_points:   [],
      witness_points:[],
      result_notes:  '',
      deficiencies:  0,
    }
  })

  const punchItems: G5PunchItem[] = (punchRes.data ?? []).map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {}
    const rawCat = (meta.punch_cat as string | undefined) ?? 'B'
    const category: 'A' | 'B' | 'C' = (['A', 'B', 'C'].includes(rawCat) ? rawCat : 'B') as 'A' | 'B' | 'C'
    const rawPrio = (r.priority as string | undefined) ?? 'medium'
    const priority: 'high' | 'medium' | 'low' = (['high', 'medium', 'low'].includes(rawPrio)
      ? rawPrio : 'medium') as 'high' | 'medium' | 'low'
    return {
      id:          r.id,
      code:        `PL-${r.id.slice(0, 6).toUpperCase()}`,
      description: r.title ?? 'Punch item',
      category,
      status:      PUNCH_STATUS_REMAP[r.status ?? 'open'] ?? 'open',
      discipline:  (meta.discipline as string) ?? 'General',
      system:      (meta.system as string) ?? '',
      location:    (meta.location as string) ?? '',
      raised_by:   'QC Team',
      assigned_to: r.assigned_to ?? '',
      raised_date: (r.created_at as string).slice(0, 10),
      due_date:    (meta.due_date as string) ?? '',
      closed_date: null,
      priority,
      drawing_ref: '',
    }
  })

  return {
    inspections,
    punchItems,
    gateFormData: (gateRes.data?.form_data as Record<string, unknown>) ?? null,
  }
}

export async function seedConstructionDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('work_packages').select('id').eq('tenant_id', tenantId).limit(1)
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
      tenant_id: tenantId, project_id: DEMO_PROJECT, ...d,
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
      tenant_id: tenantId, project_id: DEMO_PROJECT,
      title: p.title, category: 'punch_item', status: 'open', priority: 'normal',
      description: `Category ${p.cat} punch item raised during inspection.`,
      // Real authenticated user from the guard above, not a hardcoded uuid.
      created_by: gate.actor.userId,
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
      tenant_id: tenantId, project_id: DEMO_PROJECT,
      date: new Date().toISOString().slice(0, 10),
      inspector: 'Site QA Engineer',
      ...i,
    })
  }
  return {}
}
