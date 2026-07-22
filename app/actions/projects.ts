'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendProjectCreatedEmail } from '@/lib/email/send'
import type { Project } from '@/components/projects/projects-list-page'
import type { ProjectData } from '@/components/project/project-command-center'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

const PHASE_MAP: Record<number, string> = {
  0: 'intake', 1: 'commercial', 2: 'engineering', 3: 'engineering',
  4: 'procurement', 5: 'construction', 6: 'commissioning', 7: 'om', 8: 'finance',
}

const GATE_NAMES: Record<number, string> = {
  0: 'Investment Intake',
  1: 'Development Approval',
  2: 'Commercial IFC',
  3: 'Engineering IFC',
  4: 'Procurement Ready',
  5: 'Construction Mobilization',
  6: 'Systems Commissioning',
  7: 'COD Declaration',
  8: 'O&M Handover',
}

export interface GetProjectsOptions {
  phase?: string | null
  search?: string | null
  status?: string | null
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface GetProjectsResult {
  projects: Project[]
  totalCount: number
}

export async function getProjects(opts?: GetProjectsOptions): Promise<Project[]>
export async function getProjects(opts: GetProjectsOptions & { paginated: true }): Promise<GetProjectsResult>
export async function getProjects(opts?: GetProjectsOptions & { paginated?: boolean }): Promise<Project[] | GetProjectsResult> {
  const supabase = createAdminClient()

  const phase     = opts?.phase     ?? null
  const search    = opts?.search    ?? null
  const status    = opts?.status    ?? null
  const page      = opts?.page      ?? 1
  const pageSize  = opts?.pageSize  ?? 50
  const sortBy    = opts?.sortBy    ?? 'created_at'
  const sortOrder = opts?.sortOrder ?? 'desc'
  const paginated = opts?.paginated ?? false

  let query = supabase
    .from('projects')
    .select('id, code, name, status, technology, budget_usd, current_phase, target_completion, location, country', { count: 'exact' })
    .eq('tenant_id', DEMO_TENANT)

  if (phase && phase !== 'all') {
    // Map phase key back to current_phase number(s)
    const phaseNums = Object.entries(PHASE_MAP)
      .filter(([, v]) => v === phase)
      .map(([k]) => Number(k))
    if (phaseNums.length > 0) query = query.in('current_phase', phaseNums)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%`)
  }

  const sortCol = sortBy === 'budget_amount' ? 'budget_usd'
    : sortBy === 'target_cod' ? 'target_completion'
    : sortBy === 'name' ? 'name'
    : 'created_at'

  query = query
    .order(sortCol, { ascending: sortOrder === 'asc' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query

  if (error || !data) return paginated ? { projects: [], totalCount: 0 } : []

  const projects = data.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    client_name: (p as any).client_name ?? p.location ?? p.country ?? '—',
    phase: PHASE_MAP[p.current_phase ?? 0] ?? 'intake',
    gate: `G${p.current_phase ?? 0}`,
    budget_amount: p.budget_usd ?? 0,
    status: (p.status as Project['status']) ?? 'active',
    target_cod: p.target_completion ?? '',
  }))

  return paginated ? { projects, totalCount: count ?? projects.length } : projects
}

export async function getProject(id: string): Promise<ProjectData | null> {
  const supabase = createAdminClient()

  // Try by UUID first, then by code
  let query = supabase
    .from('projects')
    .select('id, code, name, description, status, technology, capacity_mw, budget_usd, current_phase, health, location, country, start_date, target_completion, created_at')
    .eq('tenant_id', DEMO_TENANT)

  // Detect if id looks like a UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  if (isUuid) {
    query = query.eq('id', id)
  } else {
    query = query.ilike('code', id)
  }

  const { data, error } = await query.single()

  if (error || !data) return null

  const gate = data.current_phase ?? 0
  const PHASE_KEY_MAP: Record<number, ProjectData['phase']> = {
    0: 'g0', 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4',
    5: 'g5', 6: 'g6', 7: 'g6', 8: 'g6', 9: 'g6',
  }

  return {
    id: data.id,
    name: data.name,
    code: data.code,
    client: data.location ?? data.country ?? '—',
    status: (data.status as ProjectData['status']) ?? 'active',
    phase: PHASE_KEY_MAP[gate] ?? 'g0',
    gate,
    gateName: GATE_NAMES[gate] ?? `Gate ${gate}`,
    budgetUsd: data.budget_usd ?? 0,
    currency: 'USD',
    startDate: data.start_date ?? data.created_at?.split('T')[0] ?? '2024-01-01',
    targetCod: data.target_completion ?? '',
    location: data.location ?? data.country ?? undefined,
    commentCount: 0,
    documentCount: 0,
  }
}

export async function createProject(payload: {
  name: string
  code: string
  technology: string
  capacity_mw: number
  location: string
  country: string
  budget_usd: number
  start_date: string
  target_completion: string
  description?: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient()

  // Guard: Postgres DATE columns reject empty strings — convert to null
  const isValidDate = (d: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d)

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...payload,
      start_date:        isValidDate(payload.start_date)        ? payload.start_date        : null,
      target_completion: isValidDate(payload.target_completion) ? payload.target_completion : null,
      tenant_id: DEMO_TENANT,
      status: 'active',
      current_phase: 0,
      health: 'green',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Fire-and-forget notification email — does not block response
  sendProjectCreatedEmail({
    to: 'admin@gridmind.capital',
    recipientName: 'GridMind Team',
    projectCode: payload.code,
    projectName: payload.name,
    technology: payload.technology,
    budgetUsd: payload.budget_usd ?? 0,
    projectId: data.id,
  }).catch(() => {})

  return { id: data.id }
}

// ─── S09: Commercial Charter ──────────────────────────────────────────────────

export interface CommercialRecord {
  id: string
  project_id: string
  type: 'budget' | 'contract' | 'cashflow'
  category: string
  description: string
  amount: number
  status: string
  period: string | null
  created_at: string
}

export interface CommercialDashboard {
  totalBudget: number
  committed: number
  contracts: number
  byCategory: { name: string; value: number }[]
  byStatus:   { name: string; value: number; color: string }[]
  records: CommercialRecord[]
}

export async function loadCommercialDashboard(projectId: string): Promise<CommercialDashboard> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('finance_records')
    .select('id, project_id, type, category, description, amount, status, period, created_at')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as CommercialRecord[]
  const totalBudget = rows.reduce((s, r) => s + (r.amount ?? 0), 0)
  const committed   = rows.filter((r) => r.status === 'committed').reduce((s, r) => s + (r.amount ?? 0), 0)
  const contracts   = rows.filter((r) => r.type === 'contract').length

  const byCategory = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.category] = (m[r.category] ?? 0) + (r.amount ?? 0) })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const statusColors: Record<string, string> = {
    draft: '#94a3b8', committed: '#3b82f6', approved: '#22c55e',
    paid: '#10b981', cancelled: '#ef4444',
  }
  const byStatus = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: statusColors[name] ?? '#94a3b8' }))
  })()

  return { totalBudget, committed, contracts, byCategory, byStatus, records: rows }
}

export async function createCommercialRecord(data: {
  project_id: string; type: 'budget' | 'contract' | 'cashflow'
  category: string; description: string; amount: number; status?: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('finance_records').insert({
    tenant_id: DEMO_TENANT,
    project_id: data.project_id,
    type:        data.type,
    category:    data.category,
    description: data.description,
    amount:      data.amount,
    status:      data.status ?? 'draft',
    period:      new Date().toISOString().slice(0, 7),
  })
  return { error: error?.message }
}

export async function seedCommercialDemoData(projectId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('finance_records').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}
  const demos = [
    { type: 'budget',   category: 'Civil Works',       description: 'Site preparation and civil scope',   amount: 18_000_000, status: 'approved' },
    { type: 'budget',   category: 'PV Modules',        description: 'Supply of 550Wp bifacial modules',   amount: 62_000_000, status: 'committed' },
    { type: 'budget',   category: 'Inverters',         description: 'Central inverter supply (4 × 3MW)',  amount: 14_500_000, status: 'committed' },
    { type: 'budget',   category: 'Balance of Plant',  description: 'MV cabling, switchgear, substation', amount: 22_000_000, status: 'draft' },
    { type: 'budget',   category: 'EPC Management',    description: 'Project management & supervision',   amount:  9_000_000, status: 'approved' },
    { type: 'contract', category: 'EPC',               description: 'EPC contract — lump sum turnkey',    amount: 95_000_000, status: 'approved' },
    { type: 'contract', category: 'O&M',               description: '5-year O&M service agreement',       amount:  7_500_000, status: 'draft' },
    { type: 'cashflow', category: 'Revenue',           description: 'PPA milestone payment Q2-2026',       amount: 12_000_000, status: 'paid', period: '2026-06' },
  ] as const
  for (const d of demos) {
    await supabase.from('finance_records').insert({
      tenant_id: DEMO_TENANT, project_id: projectId,
      period: '2026-01', ...d,
    })
  }
  return {}
}

// ─── S10: Schedule ────────────────────────────────────────────────────────────

export interface Milestone {
  id: string
  project_id: string
  name: string
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  status: 'not_started' | 'in_progress' | 'complete' | 'delayed'
  is_critical: boolean
  gate: number
  owner: string
  progress_pct: number
}

export interface ScheduleDashboard {
  totalMilestones: number
  complete: number
  inProgress: number
  delayed: number
  milestones: Milestone[]
}

export async function loadScheduleDashboard(projectId: string): Promise<ScheduleDashboard> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('phase_gates')
    .select('id, project_id, name, planned_start, planned_end, actual_start, actual_end, status, is_critical, gate_number, owner, progress_pct')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('planned_start', { ascending: true })

  const rows = (data ?? []).map((r): Milestone => ({
    id:            r.id,
    project_id:    r.project_id,
    name:          r.name ?? 'Milestone',
    planned_start: r.planned_start ?? new Date().toISOString().slice(0, 10),
    planned_end:   r.planned_end   ?? new Date().toISOString().slice(0, 10),
    actual_start:  r.actual_start  ?? null,
    actual_end:    r.actual_end    ?? null,
    status:        (r.status ?? 'not_started') as Milestone['status'],
    is_critical:   r.is_critical   ?? false,
    gate:          r.gate_number   ?? 0,
    owner:         r.owner         ?? 'Unassigned',
    progress_pct:  r.progress_pct  ?? 0,
  }))

  return {
    totalMilestones: rows.length,
    complete:   rows.filter((r) => r.status === 'complete').length,
    inProgress: rows.filter((r) => r.status === 'in_progress').length,
    delayed:    rows.filter((r) => r.status === 'delayed').length,
    milestones: rows,
  }
}

export async function createMilestone(data: {
  project_id: string; name: string; planned_start: string; planned_end: string
  is_critical?: boolean; gate?: number; owner?: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('phase_gates').insert({
    tenant_id:     DEMO_TENANT,
    project_id:    data.project_id,
    name:          data.name,
    planned_start: data.planned_start,
    planned_end:   data.planned_end,
    status:        'not_started',
    is_critical:   data.is_critical ?? false,
    gate_number:   data.gate        ?? 0,
    owner:         data.owner       ?? 'Unassigned',
    progress_pct:  0,
  })
  return { error: error?.message }
}

export async function updateMilestoneProgress(id: string, progress_pct: number, status: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('phase_gates')
    .update({ progress_pct, status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
  return { error: error?.message }
}

export async function seedScheduleDemoData(projectId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('phase_gates').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const base = new Date('2026-01-01')
  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().slice(0, 10)
  }

  const milestones = [
    { name: 'Site Survey & Geotechnical',    start: 0,   dur: 21,  critical: true,  gate: 0, owner: 'M. Al-Farsi',  status: 'complete',    pct: 100 },
    { name: 'Regulatory Permits',             start: 14,  dur: 60,  critical: true,  gate: 1, owner: 'A. Carter',    status: 'in_progress', pct: 60  },
    { name: 'IFC Drawings Package',           start: 30,  dur: 45,  critical: false, gate: 2, owner: 'R. Chen',      status: 'in_progress', pct: 40  },
    { name: 'Procurement RFQ Issuance',       start: 60,  dur: 30,  critical: true,  gate: 3, owner: 'J. Rivera',    status: 'not_started', pct: 0   },
    { name: 'Equipment Delivery — Modules',   start: 90,  dur: 30,  critical: true,  gate: 4, owner: 'L. Schmidt',   status: 'not_started', pct: 0   },
    { name: 'Civil Works Mobilization',       start: 105, dur: 60,  critical: false, gate: 4, owner: 'M. Al-Farsi',  status: 'not_started', pct: 0   },
    { name: 'Module Installation',            start: 150, dur: 60,  critical: true,  gate: 5, owner: 'R. Chen',      status: 'not_started', pct: 0   },
    { name: 'MV Cabling & Substation',        start: 160, dur: 45,  critical: false, gate: 5, owner: 'A. Carter',    status: 'not_started', pct: 0   },
    { name: 'Commissioning & Testing',        start: 210, dur: 30,  critical: true,  gate: 6, owner: 'J. Rivera',    status: 'not_started', pct: 0   },
    { name: 'COD Declaration',                start: 240, dur: 7,   critical: true,  gate: 7, owner: 'M. Al-Farsi',  status: 'not_started', pct: 0   },
  ]

  for (const m of milestones) {
    await supabase.from('phase_gates').insert({
      tenant_id:     DEMO_TENANT,
      project_id:    projectId,
      name:          m.name,
      planned_start: addDays(base, m.start),
      planned_end:   addDays(base, m.start + m.dur),
      actual_start:  m.status !== 'not_started' ? addDays(base, m.start) : null,
      actual_end:    m.status === 'complete'     ? addDays(base, m.start + m.dur) : null,
      status:        m.status,
      is_critical:   m.critical,
      gate_number:   m.gate,
      owner:         m.owner,
      progress_pct:  m.pct,
    })
  }
  return {}
}

// ─── S12: Stakeholders ────────────────────────────────────────────────────────

export interface Stakeholder {
  id: string
  project_id: string
  name: string
  organisation: string
  role: string
  influence: number
  interest: number
  engagement: 'high' | 'medium' | 'low' | 'resistant'
  notes: string | null
  created_at: string
}

export interface StakeholdersDashboard {
  total: number
  highEngagement: number
  byType: { name: string; value: number }[]
  byEngagement: { name: string; value: number; color: string }[]
  matrixData: { influence: number; interest: number; name: string; id: string; engagement: string }[]
  items: Stakeholder[]
}

export async function loadStakeholdersDashboard(projectId: string): Promise<StakeholdersDashboard> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('project_members')
    .select('id, project_id, name, organisation, role, influence, interest, engagement, notes, created_at')
    .eq('tenant_id', DEMO_TENANT)
    .eq('project_id', projectId)
    .order('influence', { ascending: false })

  const rows = (data ?? []).map((r): Stakeholder => ({
    id:           r.id,
    project_id:   r.project_id,
    name:         (r as any).name ?? 'Unknown',
    organisation: (r as any).organisation ?? '—',
    role:         r.role ?? 'Stakeholder',
    influence:    (r as any).influence ?? 3,
    interest:     (r as any).interest  ?? 3,
    engagement:   ((r as any).engagement ?? 'medium') as Stakeholder['engagement'],
    notes:        (r as any).notes ?? null,
    created_at:   r.created_at,
  }))

  const engColors: Record<string, string> = {
    high: '#22c55e', medium: '#3b82f6', low: '#f59e0b', resistant: '#ef4444',
  }

  const byType = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.role] = (m[r.role] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const byEngagement = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.engagement] = (m[r.engagement] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: engColors[name] ?? '#94a3b8' }))
  })()

  return {
    total:          rows.length,
    highEngagement: rows.filter((r) => r.engagement === 'high').length,
    byType,
    byEngagement,
    matrixData: rows.map((r) => ({
      influence: r.influence, interest: r.interest,
      name: r.name, id: r.id, engagement: r.engagement,
    })),
    items: rows,
  }
}

export async function createStakeholder(data: {
  project_id: string; name: string; organisation: string; role: string
  influence: number; interest: number; engagement: string; notes?: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('project_members').insert({
    tenant_id:    DEMO_TENANT,
    project_id:   data.project_id,
    role:         data.role,
    name:         data.name,
    organisation: data.organisation,
    influence:    data.influence,
    interest:     data.interest,
    engagement:   data.engagement,
    notes:        data.notes ?? null,
  })
  return { error: error?.message }
}

export async function seedStakeholdersDemoData(projectId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('project_members').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}
  const demos = [
    { name: 'Ministry of Energy',       organisation: 'Government',        role: 'Regulator',       influence: 5, interest: 4, engagement: 'high',     notes: 'Grid connection approval authority' },
    { name: 'Client — ACWA Power',      organisation: 'Owner',             role: 'Client',          influence: 5, interest: 5, engagement: 'high',     notes: 'Project sponsor, PPA off-taker' },
    { name: 'Local Authority',          organisation: 'Municipality',      role: 'Authority',       influence: 3, interest: 3, engagement: 'medium',   notes: 'Land use permits' },
    { name: 'Community Rep.',           organisation: 'Local Community',   role: 'Community',       influence: 2, interest: 4, engagement: 'medium',   notes: 'Community liaison required' },
    { name: 'Lender — IFC',             organisation: 'Finance',           role: 'Lender',          influence: 4, interest: 5, engagement: 'high',     notes: 'Project finance debt provider' },
    { name: 'EPC Contractor',           organisation: 'Construction',      role: 'Contractor',      influence: 3, interest: 5, engagement: 'high',     notes: 'Main EPC contract holder' },
    { name: 'Grid Operator (SEC)',       organisation: 'Utility',           role: 'Grid Operator',   influence: 5, interest: 3, engagement: 'medium',   notes: 'Evacuation point agreement required' },
    { name: 'Environmental NGO',        organisation: 'NGO',               role: 'Watchdog',        influence: 2, interest: 3, engagement: 'low',      notes: 'Biodiversity and EIA concerns' },
  ]
  for (const d of demos) {
    await supabase.from('project_members').insert({ tenant_id: DEMO_TENANT, project_id: projectId, ...d })
  }
  return {}
}
