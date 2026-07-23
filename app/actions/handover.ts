'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export type HandoverStatus = 'not_started' | 'in_progress' | 'submitted' | 'accepted' | 'rejected'

export interface HandoverItem {
  id: string
  project_id: string
  project_name: string
  project_code: string
  category: 'technical' | 'commercial' | 'safety' | 'documentation' | 'training'
  title: string
  description: string | null
  status: HandoverStatus
  completion_pct: number
  due_date: string | null
  accepted_by: string | null
  created_at: string
}

export interface HandoverDashboard {
  total: number
  complete: number
  inProgress: number
  overdue: number
  byCategory: { name: string; total: number; complete: number }[]
  byStatus: { name: string; value: number; color: string }[]
  items: HandoverItem[]
}

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  submitted:   '#f59e0b',
  accepted:    '#22c55e',
  rejected:    '#ef4444',
}

export async function loadHandoverDashboard(): Promise<HandoverDashboard> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('handover_items')
    .select(`
      id, project_id, category, title, description,
      status, completion_pct, due_date, accepted_by, created_at,
      projects!handover_items_project_id_fkey(name, code)
    `)
    .eq('tenant_id', DEMO_TENANT)
    .order('due_date', { ascending: true })

  const rows = (data ?? []).map((r): HandoverItem => ({
    id:             r.id,
    project_id:     r.project_id,
    project_name:   (r.projects as any)?.name ?? 'Unknown Project',
    project_code:   (r.projects as any)?.code ?? '—',
    category:       r.category as HandoverItem['category'],
    title:          r.title,
    description:    r.description ?? null,
    status:         r.status as HandoverStatus,
    completion_pct: r.completion_pct ?? 0,
    due_date:       r.due_date ?? null,
    accepted_by:    r.accepted_by ?? null,
    created_at:     r.created_at,
  }))

  const now = new Date()
  const overdue = rows.filter(
    (r) => r.due_date && new Date(r.due_date) < now && r.status !== 'accepted',
  ).length

  const byCategory = (['technical', 'commercial', 'safety', 'documentation', 'training'] as const).map((cat) => {
    const sub = rows.filter((r) => r.category === cat)
    return { name: cat, total: sub.length, complete: sub.filter((r) => r.status === 'accepted').length }
  }).filter((c) => c.total > 0)

  const byStatus = (() => {
    const m: Record<string, number> = {}
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] ?? '#94a3b8' }))
  })()

  return {
    total:      rows.length,
    complete:   rows.filter((r) => r.status === 'accepted').length,
    inProgress: rows.filter((r) => r.status === 'in_progress' || r.status === 'submitted').length,
    overdue,
    byCategory,
    byStatus,
    items: rows,
  }
}

export async function updateHandoverStatus(
  id: string,
  status: HandoverStatus,
  completion_pct?: number,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('handover_items')
    .update({
      status,
      completion_pct: completion_pct ?? (status === 'accepted' ? 100 : undefined),
      accepted_by: status === 'accepted' ? 'Current User' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
  return { error: error?.message }
}

export async function createHandoverItem(data: {
  project_id: string
  category: HandoverItem['category']
  title: string
  description?: string
  due_date?: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase.from('handover_items').insert({
    tenant_id:      DEMO_TENANT,
    project_id:     data.project_id,
    category:       data.category,
    title:          data.title,
    description:    data.description ?? null,
    status:         'not_started',
    completion_pct: 0,
    due_date:       data.due_date ?? null,
  })
  return { error: error?.message }
}

export async function seedHandoverDemoData(): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Get first demo project
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, code')
    .eq('tenant_id', DEMO_TENANT)
    .limit(1)

  const projectId = projects?.[0]?.id
  if (!projectId) return { error: 'No demo project found' }

  const { data: ex } = await supabase.from('handover_items').select('id').eq('project_id', projectId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const demos: Array<Omit<HandoverItem, 'id' | 'project_name' | 'project_code' | 'created_at'>> = [
    { project_id: projectId, category: 'technical',       title: 'As-Built Drawing Package',             description: 'IFC drawings revised to as-built standard, QA signed-off',         status: 'accepted',    completion_pct: 100, due_date: null,         accepted_by: 'R. Chen' },
    { project_id: projectId, category: 'technical',       title: 'Commissioning Test Reports',            description: 'All HV/LV protection relay test packs signed and witnessed',       status: 'accepted',    completion_pct: 100, due_date: null,         accepted_by: 'A. Carter' },
    { project_id: projectId, category: 'technical',       title: 'Equipment O&M Manuals',                 description: 'OEM manuals for inverters, transformers, switchgear and SCADA',   status: 'submitted',   completion_pct: 85,  due_date: '2026-08-15', accepted_by: null },
    { project_id: projectId, category: 'safety',          title: 'Safety File (CDM)',                     description: 'Health & Safety file compiled per CDM 2015 requirements',         status: 'in_progress', completion_pct: 60,  due_date: '2026-08-20', accepted_by: null },
    { project_id: projectId, category: 'safety',          title: 'LOTO Procedures Register',              description: 'Lock-out tag-out procedures for all HV isolation points',          status: 'accepted',    completion_pct: 100, due_date: null,         accepted_by: 'J. Rivera' },
    { project_id: projectId, category: 'documentation',   title: 'Land Registry & Title Documents',       description: 'Confirmed land ownership, leases, and easements',                  status: 'accepted',    completion_pct: 100, due_date: null,         accepted_by: 'A. Carter' },
    { project_id: projectId, category: 'documentation',   title: 'Grid Connection Agreement',             description: 'Executed GCA with national utility, including metering schedule',  status: 'submitted',   completion_pct: 90,  due_date: '2026-08-10', accepted_by: null },
    { project_id: projectId, category: 'documentation',   title: 'Insurance Placement Certificates',      description: 'All-risk, third-party liability, and machinery breakdown',         status: 'in_progress', completion_pct: 40,  due_date: '2026-08-25', accepted_by: null },
    { project_id: projectId, category: 'commercial',      title: 'PPA Execution & Countersignature',      description: 'Signed PPA including addenda and agreed dispatch schedule',         status: 'accepted',    completion_pct: 100, due_date: null,         accepted_by: 'T. Müller' },
    { project_id: projectId, category: 'commercial',      title: 'Final Account Settlement',              description: 'EPC final account agreed and surplus/deficit reconciled',           status: 'not_started', completion_pct: 0,   due_date: '2026-09-01', accepted_by: null },
    { project_id: projectId, category: 'training',        title: 'O&M Operator Training Sign-off',        description: 'Site operations team trained on SCADA, inverter fault codes',       status: 'in_progress', completion_pct: 70,  due_date: '2026-08-18', accepted_by: null },
    { project_id: projectId, category: 'training',        title: 'Emergency Response Drill',              description: 'Fire, HV fault, and evacuation drill conducted and recorded',      status: 'not_started', completion_pct: 0,   due_date: '2026-08-30', accepted_by: null },
  ]

  for (const d of demos) {
    await supabase.from('handover_items').insert({ tenant_id: DEMO_TENANT, ...d })
  }

  return {}
}
