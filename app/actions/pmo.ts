'use server'

import { createAdminClient } from '@/lib/supabase/admin'

import { getCurrentTenantId } from '@/lib/tenant'
const DEMO_USER    = '20000000-0000-0000-0000-000000000001'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PmoRisk {
  id: string; projectId: string; projectName: string
  title: string; category: string; status: string
  probability: string; impact: string; priority: string; owner: string
}
export interface PmoTicketItem {
  id: string; projectId: string; projectName: string
  title: string; status: string; priority: string; owner: string; createdAt: string
}
export interface PmoDecision {
  id: string; projectId: string; projectName: string
  title: string; rationale: string; status: string; date: string
}
export interface PmoLesson {
  id: string; projectId: string; projectName: string
  title: string; phase: string; category: string
}
export interface PmoDashboard {
  totalProjects: number
  onTrack: number
  atRisk: number
  offTrack: number
  criticalIssues: number
  openActions: number
  lessonsCount: number
  riskByCategory: { name: string; value: number }[]
  portfolioHealth: { name: string; value: number; color: string }[]
  risks: PmoRisk[]
  issues: PmoTicketItem[]
  actions: PmoTicketItem[]
  decisions: PmoDecision[]
  lessons: PmoLesson[]
}

// Derive a priority bucket from risk probability + impact text values.
function riskPriority(prob: string, impact: string): string {
  const rank = (v: string) => ({ high: 3, medium: 2, low: 1 } as Record<string, number>)[v?.toLowerCase()] ?? 1
  const score = rank(prob) * rank(impact)
  if (score >= 9) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

export async function loadPmoDashboard(): Promise<PmoDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [projRes, riskRes, ticketRes, profRes] = await Promise.all([
    supabase.from('projects').select('id, name, health').eq('tenant_id', tenantId),
    supabase.from('risks')
      .select('id, project_id, title, category, status, probability, impact, owner_id, created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('tickets')
      .select('id, project_id, title, type, status, priority, assigned_to, description, resolved_at, created_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('tenant_id', tenantId),
  ])

  const projects = projRes.data ?? []
  const projName = new Map(projects.map((p) => [p.id, p.name as string]))
  const people   = new Map((profRes.data ?? []).map((p) => [p.id, p.full_name as string]))
  const ownerOf  = (id: string | null) => (id ? people.get(id) ?? 'Unassigned' : 'Unassigned')

  const risks: PmoRisk[] = (riskRes.data ?? []).map((r) => ({
    id:          r.id,
    projectId:   r.project_id,
    projectName: projName.get(r.project_id) ?? '—',
    title:       r.title ?? '',
    category:    r.category ?? 'General',
    status:      r.status ?? 'open',
    probability: r.probability ?? 'medium',
    impact:      r.impact ?? 'medium',
    priority:    riskPriority(r.probability ?? 'medium', r.impact ?? 'medium'),
    owner:       ownerOf(r.owner_id),
  }))

  const tickets = ticketRes.data ?? []
  const toItem = (t: (typeof tickets)[number]): PmoTicketItem => ({
    id:          t.id,
    projectId:   t.project_id,
    projectName: projName.get(t.project_id) ?? '—',
    title:       t.title ?? '',
    status:      t.status ?? 'open',
    priority:    t.priority ?? 'medium',
    owner:       ownerOf(t.assigned_to),
    createdAt:   t.created_at,
  })

  const issues  = tickets.filter((t) => t.type === 'issue').map(toItem)
  const actions = tickets.filter((t) => t.type === 'action').map(toItem)
  const decisions: PmoDecision[] = tickets.filter((t) => t.type === 'decision').map((t) => ({
    id:          t.id,
    projectId:   t.project_id,
    projectName: projName.get(t.project_id) ?? '—',
    title:       t.title ?? '',
    rationale:   t.description ?? '',
    status:      t.status ?? 'pending',
    date:        t.resolved_at ? new Date(t.resolved_at).toLocaleDateString() : '',
  }))
  const lessons: PmoLesson[] = tickets.filter((t) => t.type === 'lesson').map((t) => ({
    id:          t.id,
    projectId:   t.project_id,
    projectName: projName.get(t.project_id) ?? '—',
    title:       t.title ?? '',
    phase:       t.priority ?? 'General',   // phase stored in priority slot for lessons
    category:    t.description ?? 'General',
  }))

  const riskCatMap: Record<string, number> = {}
  risks.forEach((r) => { riskCatMap[r.category] = (riskCatMap[r.category] ?? 0) + 1 })

  const health = (h: string) => projects.filter((p) => (p.health ?? 'green') === h).length

  return {
    totalProjects:  projects.length,
    onTrack:        health('green'),
    atRisk:         health('amber'),
    offTrack:       health('red'),
    criticalIssues: issues.filter((i) => i.priority === 'critical').length,
    openActions:    actions.filter((a) => a.status !== 'closed' && a.status !== 'done').length,
    lessonsCount:   lessons.length,
    riskByCategory: Object.entries(riskCatMap).map(([name, value]) => ({ name, value })),
    portfolioHealth: [
      { name: 'On Track',  value: health('green'), color: '#22c55e' },
      { name: 'At Risk',   value: health('amber'), color: '#f59e0b' },
      { name: 'Off Track', value: health('red'),   color: '#ef4444' },
    ],
    risks, issues, actions, decisions, lessons,
  }
}

// ── Create (governed via workflow_events audit) ──────────────────────────────

export async function createPmoItem(input: {
  type: 'risk' | 'issue' | 'action' | 'decision' | 'lesson'
  projectId: string; title: string; owner?: string; priority?: string
  category?: string; rationale?: string; phase?: string
}): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()
  const { type, projectId, title } = input
  if (!projectId || !title) return { error: 'Project and title are required' }

  if (type === 'risk') {
    const { error } = await supabase.from('risks').insert({
      tenant_id: tenantId, project_id: projectId, title,
      category: input.category || 'General',
      probability: input.priority === 'critical' || input.priority === 'high' ? 'high' : 'medium',
      impact: input.priority === 'critical' ? 'high' : input.priority === 'low' ? 'low' : 'medium',
      status: 'open', created_by: DEMO_USER,
    })
    return { error: error?.message }
  }

  // issue / action / decision / lesson all live in tickets, keyed by `type`
  const { error } = await supabase.from('tickets').insert({
    tenant_id: tenantId, project_id: projectId, title, type,
    description: type === 'decision' ? (input.rationale || '') : type === 'lesson' ? (input.category || 'General') : '',
    status: type === 'decision' ? 'pending' : 'open',
    priority: type === 'lesson' ? (input.phase || 'General') : (input.priority || 'medium'),
    created_by: DEMO_USER,
  })
  return { error: error?.message }
}

export async function seedPmoDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const { data: projects } = await supabase.from('projects').select('id').eq('tenant_id', tenantId).limit(3)
  if (!projects || projects.length === 0) return { error: 'No projects found to attach PMO items to.' }
  const pid = (i: number) => projects[i % projects.length].id

  const { data: exRisk } = await supabase.from('risks').select('id').eq('tenant_id', tenantId).limit(1)
  if ((exRisk?.length ?? 0) === 0) {
    const riskSeed = [
      { title: 'Grid connection permit delayed', category: 'Regulatory',  probability: 'high', impact: 'high' },
      { title: 'Turbine long-lead delivery risk', category: 'Supply Chain', probability: 'medium', impact: 'high' },
      { title: 'Solar tracker design change',      category: 'Technical',   probability: 'low', impact: 'medium' },
      { title: 'FX rate exposure SAR/USD',         category: 'Financial',   probability: 'medium', impact: 'medium' },
    ]
    for (let i = 0; i < riskSeed.length; i++) {
      await supabase.from('risks').insert({
        tenant_id: tenantId, project_id: pid(i),
        status: i === 3 ? 'escalated' : 'open', created_by: DEMO_USER, ...riskSeed[i],
      })
    }
  }

  const { data: exTicket } = await supabase.from('tickets').select('id').eq('tenant_id', tenantId).eq('type', 'issue').limit(1)
  if ((exTicket?.length ?? 0) === 0) {
    const ticketSeed: { title: string; type: string; status: string; priority: string; description?: string }[] = [
      { title: 'Connection agreement not signed', type: 'issue', status: 'escalated', priority: 'critical' },
      { title: 'Access road delayed 3 months',    type: 'issue', status: 'in_progress', priority: 'high' },
      { title: 'Submit interconnection package v3', type: 'action', status: 'in_progress', priority: 'high' },
      { title: 'Negotiate WTG delivery window',    type: 'action', status: 'open', priority: 'medium' },
      { title: 'Approve bifacial mono-PERC modules', type: 'decision', status: 'approved', priority: 'medium', description: 'Energy yield +3% with 1.2% cost uplift — NPV positive' },
      { title: 'Alternative cable route via west corridor', type: 'decision', status: 'pending', priority: 'medium', description: 'Awaiting environmental impact assessment' },
      { title: 'Early DEWA engagement prevents delays', type: 'lesson', status: 'closed', priority: 'Engineering', description: 'Regulatory' },
      { title: 'Dual-source WTG qualification reduces risk', type: 'lesson', status: 'closed', priority: 'Procurement', description: 'Supply Chain' },
    ]
    for (let i = 0; i < ticketSeed.length; i++) {
      await supabase.from('tickets').insert({
        tenant_id: tenantId, project_id: pid(i), created_by: DEMO_USER, ...ticketSeed[i],
      })
    }
  }
  return {}
}
