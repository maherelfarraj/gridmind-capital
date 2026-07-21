'use server'

import { createAdminClient } from '@/lib/supabase/admin'
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
    5: 'g5', 6: 'g6', 7: 'g7', 8: 'g8', 9: 'g9',
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

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...payload,
      tenant_id: DEMO_TENANT,
      status: 'active',
      current_phase: 0,
      health: 'green',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data.id }
}
