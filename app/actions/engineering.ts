'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import type { IFCPackage, DrawingRecord, RFIRecord, EngineeringDashboard } from '@/lib/types/action-types'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'
const DEMO_USER   = '20000000-0000-0000-0000-000000000001'
const DEMO_PROJECT = 'a1000000-0000-0000-0000-000000000001'

const DISC_COLORS: Record<string, string> = {
  Civil:         '#64ffda',
  Structural:    '#3b82f6',
  Mechanical:    '#f97316',
  Electrical:    '#a855f7',
  Instrumentation:'#22c55e',
  Architectural: '#f59e0b',
  Commissioning: '#06b6d4',
}

const IFC_STATUS_COLORS: Record<string, string> = {
  draft:     '#94a3b8',
  in_review: '#f59e0b',
  approved:  '#22c55e',
  rejected:  '#ef4444',
  superseded:'#64748b',
}

export async function loadEngineeringDashboard(): Promise<EngineeringDashboard> {
  const supabase = createAdminClient()

  const [pkgRes, docRes, rfiRes] = await Promise.all([
    supabase.from('engineering_packages')
      .select('id, package_number, discipline, title, revision, status, completion_pct, created_at')
      .eq('tenant_id', DEMO_TENANT)
      .order('created_at', { ascending: false }),
    supabase.from('documents')
      .select('id, title, category, metadata, status, created_at')
      .eq('tenant_id', DEMO_TENANT)
      .eq('category', 'drawing')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('tickets')
      .select('id, title, category, status, created_at, metadata')
      .eq('tenant_id', DEMO_TENANT)
      .eq('category', 'rfi')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const pkgs = pkgRes.data ?? []
  const docs = docRes.data ?? []
  const rfiRows = rfiRes.data ?? []

  const packages: IFCPackage[] = pkgs.map((p) => ({
    id:             p.id,
    package_number: p.package_number ?? '',
    discipline:     p.discipline ?? 'General',
    title:          p.title ?? 'Unnamed Package',
    revision:       p.revision ?? 'A',
    status:         p.status ?? 'draft',
    completion_pct: p.completion_pct ?? 0,
    created_at:     p.created_at,
  }))

  const drawings: DrawingRecord[] = docs.map((d) => ({
    id:             d.id,
    drawing_number: (d.metadata as { drawing_number?: string } | null)?.drawing_number ?? d.id.slice(0, 6).toUpperCase(),
    title:          d.title ?? 'Unnamed Drawing',
    discipline:     (d.metadata as { discipline?: string } | null)?.discipline ?? 'General',
    revision:       (d.metadata as { revision?: string } | null)?.revision ?? 'A',
    status:         d.status ?? 'draft',
    created_at:     d.created_at,
  }))

  const now = Date.now()
  const rfis: RFIRecord[] = rfiRows.map((r) => {
    const daysOpen = Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000)
    return {
      id:         r.id,
      ref:        `RFI-${r.id.slice(0, 5).toUpperCase()}`,
      title:      r.title ?? 'RFI',
      discipline: (r.metadata as { discipline?: string } | null)?.discipline ?? 'General',
      status:     r.status ?? 'open',
      days_open:  daysOpen,
      is_overdue: daysOpen > 14 && r.status !== 'closed',
      created_at: r.created_at,
    }
  })

  const byDisc = packages.reduce<Record<string, number>>((acc, p) => {
    acc[p.discipline] = (acc[p.discipline] ?? 0) + 1
    return acc
  }, {})

  const rfiStatusMap: Record<string, number> = {}
  rfis.forEach((r) => { rfiStatusMap[r.status] = (rfiStatusMap[r.status] ?? 0) + 1 })

  return {
    totalPackages:    packages.length,
    approvedPackages: packages.filter((p) => p.status === 'approved').length,
    openRFIs:         rfis.filter((r) => r.status !== 'closed').length,
    overdueRFIs:      rfis.filter((r) => r.is_overdue).length,
    byDiscipline: Object.entries(byDisc).map(([name, value]) => ({
      name, value, color: DISC_COLORS[name] ?? '#94a3b8',
    })),
    rfiStatus: Object.entries(rfiStatusMap).map(([name, value]) => ({
      name, value, color: name === 'open' ? '#f59e0b' : name === 'closed' ? '#22c55e' : '#3b82f6',
    })),
    packages, drawings, rfis,
  }
}

// ─── G2 gate detail page data ─────────────────────────────────────────────────

/** Shape the G2 EngineeringPackage component expects */
export interface G2Package {
  id: string; code: string; title: string; description: string
  discipline: string; phase: string; status: string; progress_percent: number
  drawing_count: number; rfi_count: number; review_count: number
  lead_engineer: { name: string; initials: string; color: string }
  reviewers: { name: string; initials: string; color: string }[]
  created_at: string; updated_at: string
}

/** Shape the G2 Drawing component expects */
export interface G2Drawing {
  id: string; number: string; title: string; discipline: string
  revision: string; status: string; date: string; package_id: string
  revisions: { revision: string; date: string; author: string; checker: string; approver: string; description: string; status: string }[]
}

/** Shape the G2 RFIRecord component expects */
export interface G2RFI {
  id: string; number: string; date: string; from_party: string; to_party: string
  subject: string; question: string; drawing_reference: string
  status: string; priority: string; due_date: string
  response: string | null; responded_by: string | null; responded_at: string | null
}

export interface G2DataResult {
  packages: G2Package[]
  drawings: G2Drawing[]
  rfis: G2RFI[]
}

const PKG_STATUS_MAP: Record<string, string> = {
  draft:      'Draft',
  in_review:  'Internal Review',
  approved:   'Approved IFC',
  rejected:   'Superseded',
  superseded: 'Superseded',
}

const RFI_STATUS_MAP: Record<string, string> = {
  open:       'Open',
  closed:     'Closed',
  resolved:   'Answered',
  in_review:  'Open',
  escalated:  'Escalated',
}

/** Loads real engineering data for a specific project's G2 gate detail page. */
export async function getG2Data(projectId: string): Promise<G2DataResult> {
  const supabase = createAdminClient()

  const [pkgRes, docRes, rfiRes] = await Promise.all([
    supabase
      .from('engineering_packages')
      .select('id, package_number, discipline, title, revision, status, completion_pct, created_at')
      .eq('tenant_id', DEMO_TENANT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, title, category, metadata, status, created_at')
      .eq('tenant_id', DEMO_TENANT)
      .eq('category', 'drawing')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('tickets')
      .select('id, title, status, created_at, metadata')
      .eq('tenant_id', DEMO_TENANT)
      .eq('category', 'rfi')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const packages: G2Package[] = (pkgRes.data ?? []).map((p) => {
    const disc = p.discipline ?? 'General'
    const initials = disc.slice(0, 2).toUpperCase()
    return {
      id:               p.id,
      code:             p.package_number ?? p.id.slice(0, 8).toUpperCase(),
      title:            p.title ?? 'Unnamed Package',
      description:      '',
      discipline:       disc,
      phase:            'IFC',
      status:           PKG_STATUS_MAP[p.status ?? 'draft'] ?? 'Draft',
      progress_percent: p.completion_pct ?? 0,
      drawing_count:    0,
      rfi_count:        0,
      review_count:     0,
      lead_engineer:    { name: disc, initials, color: DISC_COLORS[disc] ?? '#94a3b8' },
      reviewers:        [],
      created_at:       p.created_at,
      updated_at:       p.created_at,
    }
  })

  const drawings: G2Drawing[] = (docRes.data ?? []).map((d) => {
    const meta = (d.metadata ?? {}) as Record<string, string>
    return {
      id:         d.id,
      number:     meta.drawing_number ?? d.id.slice(0, 8).toUpperCase(),
      title:      d.title ?? 'Unnamed Drawing',
      discipline: meta.discipline ?? 'General',
      revision:   meta.revision ?? 'A',
      status:     d.status === 'approved' ? 'Approved' : d.status === 'draft' ? 'Draft' : 'For Review',
      date:       d.created_at?.slice(0, 10) ?? '',
      package_id: meta.package_id ?? '',
      revisions:  [],
    }
  })

  const rfis: G2RFI[] = (rfiRes.data ?? []).map((r, i) => {
    const meta = (r.metadata ?? {}) as Record<string, string>
    const num  = String(i + 1).padStart(3, '0')
    return {
      id:              r.id,
      number:          `RFI-${num}`,
      date:            r.created_at?.slice(0, 10) ?? '',
      from_party:      meta.discipline ?? 'Engineering',
      to_party:        meta.to_party   ?? 'Client',
      subject:         r.title ?? 'RFI',
      question:        meta.question ?? '',
      drawing_reference: meta.drawing_reference ?? '',
      status:          RFI_STATUS_MAP[r.status ?? 'open'] ?? 'Open',
      priority:        meta.priority ?? 'Medium',
      due_date:        meta.due_date  ?? '',
      response:        meta.response  ?? null,
      responded_by:    meta.responded_by ?? null,
      responded_at:    meta.responded_at ?? null,
    }
  })

  return { packages, drawings, rfis }
}

export async function createRFI(data: {
  title: string; discipline: string; description: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('tickets').insert({
    tenant_id:  DEMO_TENANT,
    project_id: DEMO_PROJECT,
    title:      data.title,
    description:data.description,
    category:   'rfi',
    status:     'open',
    priority:   'normal',
    metadata:   { discipline: data.discipline },
    created_by: DEMO_USER,
  })
  return { error: error?.message }
}

export async function closeRFI(id: string): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', DEMO_TENANT)
  return { error: error?.message }
}

export async function seedEngineeringDemoData(): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('engineering_packages')
    .select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const disciplines = ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation']
  const statuses    = ['draft', 'in_review', 'approved', 'approved', 'draft']

  for (let i = 0; i < disciplines.length; i++) {
    const disc = disciplines[i]
    await supabase.from('engineering_packages').insert({
      tenant_id:      DEMO_TENANT,
      project_id:     DEMO_PROJECT,
      package_number: `IFC-${disc.slice(0, 3).toUpperCase()}-001`,
      discipline:     disc,
      title:          `${disc} IFC Package — Zone A`,
      revision:       i < 2 ? 'B' : 'C',
      status:         statuses[i],
      completion_pct: [40, 65, 95, 100, 30][i],
    })
  }

  // Seed a few RFIs
  const rfis = [
    { title: 'Pile cap depth clarification',     discipline: 'Civil' },
    { title: 'Transformer foundation loading',   discipline: 'Structural' },
    { title: 'Cable tray routing — Row E',       discipline: 'Electrical' },
    { title: 'Inverter cooling spec confirmation',discipline: 'Mechanical' },
  ]
  for (const rfi of rfis) {
    await supabase.from('tickets').insert({
      tenant_id: DEMO_TENANT, project_id: DEMO_PROJECT,
      title: rfi.title, category: 'rfi', status: 'open', priority: 'normal',
      description: `RFI raised by site engineer`, created_by: DEMO_USER,
      metadata: { discipline: rfi.discipline },
    })
  }
  return {}
}
