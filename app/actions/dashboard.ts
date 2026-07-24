'use server'

import { createClient } from '@supabase/supabase-js'
import type { DashboardStats, DashboardProject } from '@/components/dashboard/dashboard-page'
import type { ApprovalItem } from '@/components/dashboard/dashboard-data'

// Service role client — bypasses RLS for authenticated server actions
// Safe because the layout already validates the user session before rendering
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

import { getCurrentTenantId } from '@/lib/tenant'

// ─────────────────────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()

  const [projectsRes, approvalsRes] = await Promise.all([
    supabase.from('projects').select('id, status').eq('tenant_id', tenantId),
    supabase.from('approvals').select('id, status, created_at').eq('tenant_id', tenantId),
  ])

  const projects  = projectsRes.data ?? []
  const approvals = approvalsRes.data ?? []

  const totalProjects    = projects.length
  const activeProjects   = projects.filter((p) => p.status === 'active').length
  const pendingApprovals = approvals.filter((a) => a.status === 'pending' || a.status === 'under_review').length
  const sevenDaysAgo     = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const overdueApprovals = approvals.filter(
    (a) => (a.status === 'pending' || a.status === 'under_review') && a.created_at < sevenDaysAgo,
  ).length

  return {
    totalProjects,
    activeProjects,
    pendingApprovals,
    overdueApprovals,
    totalProjectsTrend:    `${totalProjects} total`,
    activeProjectsTrend:   `${totalProjects - activeProjects} inactive`,
    pendingApprovalsTrend: `${pendingApprovals} pending`,
    overdueApprovalsTrend: overdueApprovals > 0 ? `${overdueApprovals} overdue` : 'None overdue',
  }
}

// ─────────────────────────────────────────────────────────────
// Recent projects
// ─────────────────────────────────────────────────────────────

export async function getDashboardProjects(): Promise<DashboardProject[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name, status, technology, capacity_mw, budget_usd, current_phase, health, country, location, target_completion')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  const PHASE_GATE_MAP: Record<number, string> = {
    0: 'g0', 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4',
    5: 'g5', 6: 'g6', 7: 'g6', 8: 'g6',
  }

  return data.map((p) => {
    const gate    = p.current_phase ?? 0
    const budgetM = p.budget_usd ? Math.round(p.budget_usd / 1_000_000) : 0
    const targetCod = p.target_completion
      ? new Date(p.target_completion).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : undefined

    return {
      id:            p.id,
      code:          p.code,
      name:          p.name,
      phase:         PHASE_GATE_MAP[gate] ?? 'g0',
      gate,
      gateName:      `G${gate}`,
      budgetM,
      budget_amount: p.budget_usd ?? 0,
      currency:      'USD',
      status:        (p.status as DashboardProject['status']) ?? 'active',
      client:        p.location ?? p.country ?? '—',
      targetCod,
      target_cod:    p.target_completion ?? undefined,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Approval inbox
// ─────────────────────────────────────────────────────────────

export async function getDashboardApprovals(): Promise<ApprovalItem[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at, description, amount')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'under_review'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  const PRIORITY_MAP: Record<string, ApprovalItem['priority']> = {
    critical: 'critical', high: 'high', normal: 'medium', low: 'low',
  }

  return data.map((a) => {
    const daysOpen = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86_400_000)
    return {
      id:          a.id,
      type:        (a.object_type?.toLowerCase().replace(/\s+/g, '-') ?? 'change-order') as ApprovalItem['type'],
      title:       a.title ?? 'Approval Request',
      projectCode: '—',
      projectName: '—',
      requestedBy: 'Team Member',
      daysOpen,
      isOverdue:   daysOpen > 7,
      priority:    PRIORITY_MAP[a.priority ?? 'normal'] ?? 'medium',
    }
  })
}

// ═════════════════════════════════════════════════════════════
// Customizable dashboard widget data
// ═════════════════════════════════════════════════════════════

// Relative "time ago" helper (non-exported so it stays out of the server-action surface)
function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return day === 1 ? '1d ago' : `${day}d ago`
}

function dayStatus(dateIso: string, now: Date): 'today' | 'upcoming' | 'overdue' {
  const day = dateIso.slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  return day < today ? 'overdue' : day === today ? 'today' : 'upcoming'
}

// ─── KPI stats ────────────────────────────────────────────────
export interface WidgetStats {
  activeProjects: number
  totalBudget: number
  openApprovals: number
  openRisks: number
  avgHealth: number
}

export async function getWidgetStats(): Promise<WidgetStats> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const [projRes, apprRes, riskRes] = await Promise.all([
    supabase.from('projects').select('status, budget_usd, health').eq('tenant_id', tenantId),
    supabase.from('approvals').select('status').eq('tenant_id', tenantId),
    supabase.from('risks').select('status').eq('tenant_id', tenantId),
  ])
  const projects  = projRes.data ?? []
  const approvals = apprRes.data ?? []
  const risks     = riskRes.data ?? []

  const activeProjects = projects.filter((p) => p.status === 'active').length
  const totalBudget    = projects.reduce((s, p) => s + (Number(p.budget_usd) || 0), 0)
  const openApprovals  = approvals.filter((a) => a.status === 'pending' || a.status === 'delegated').length
  const openRisks      = risks.filter((r) => {
    const st = (r.status ?? '').toLowerCase()
    return st !== 'closed' && st !== 'mitigated'
  }).length

  const HEALTH: Record<string, number> = { green: 100, amber: 60, red: 25 }
  const avgHealth = projects.length
    ? Math.round(projects.reduce((s, p) => s + (HEALTH[p.health ?? 'green'] ?? 60), 0) / projects.length)
    : 0

  return { activeProjects, totalBudget, openApprovals, openRisks, avgHealth }
}

// ─── My tasks (open approvals) ────────────────────────────────
export interface WidgetTask {
  id: string
  title: string
  project: string
  priority: 'high' | 'medium' | 'low'
  due: string | null
}

export async function getMyTasks(): Promise<WidgetTask[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('approvals')
    .select('id, title, object_type, priority, due_date, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'delegated'])
    .limit(50)

  if (error || !data) return []

  const RANK: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }
  const MAP:  Record<string, WidgetTask['priority']> = { critical: 'high', high: 'high', normal: 'medium', low: 'low' }

  return data
    .sort((a, b) => (RANK[a.priority ?? 'normal'] ?? 2) - (RANK[b.priority ?? 'normal'] ?? 2))
    .slice(0, 10)
    .map((a) => ({
      id:       a.id,
      title:    a.title ?? 'Approval Request',
      project:  (a.object_type ?? '').replace(/_/g, ' ') || '—',
      priority: MAP[a.priority ?? 'normal'] ?? 'medium',
      due:      a.due_date ?? a.created_at ?? null,
    }))
}

// ─── Active gates ─────────────────────────────────────────────
export interface WidgetGate {
  id: string
  project: string
  gate: string
  label: string
  pct: number
  color: string
}

export async function getActiveGates(): Promise<WidgetGate[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('phase_gates')
    .select('id, project_id, phase_number, phase_name, status, projects!inner(name, current_phase, tenant_id)')
    .eq('projects.tenant_id', tenantId)

  if (error || !data) return []

  type Row = {
    id: string; project_id: string; phase_number: number; phase_name: string | null; status: string
    projects: { name: string; current_phase: number | null; tenant_id: string } | null
  }

  return (data as unknown as Row[])
    .filter((g) => {
      const st = (g.status ?? '').toLowerCase()
      if (st === 'approved' || st === 'completed') return false
      // Focus on each project's live gate
      return g.phase_number === (g.projects?.current_phase ?? 0)
    })
    .slice(0, 8)
    .map((g) => {
      const cp  = g.projects?.current_phase ?? 0
      const pct = Math.min(100, Math.round((cp / 6) * 100))
      const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#6b7280'
      return {
        id:      g.project_id,
        project: g.projects?.name ?? '—',
        gate:    `G${g.phase_number}`,
        label:   g.phase_name ?? `Phase ${g.phase_number}`,
        pct,
        color,
      }
    })
}

// ─── Budget overview ──────────────────────────────────────────
export interface BudgetGroup { category: string; planned: number; actual: number }
export interface BudgetOverview { groups: BudgetGroup[]; totalPlanned: number; totalActual: number }

export async function getBudgetOverview(): Promise<BudgetOverview> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('finance_records')
    .select('record_type, status, amount')
    .eq('tenant_id', tenantId)

  if (error || !data || data.length === 0) return { groups: [], totalPlanned: 0, totalActual: 0 }

  const TYPES = ['budget', 'contract', 'cashflow']
  const ACTUAL_STATES = ['actual', 'paid', 'committed', 'invoiced']

  const groups = TYPES.map((t) => {
    const rows   = data.filter((r) => (r.record_type ?? '').toLowerCase() === t)
    const total  = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const actual = rows
      .filter((r) => ACTUAL_STATES.includes((r.status ?? '').toLowerCase()))
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
    return { category: t.charAt(0).toUpperCase() + t.slice(1), planned: total - actual, actual }
  }).filter((g) => g.planned !== 0 || g.actual !== 0)

  return {
    groups,
    totalPlanned: groups.reduce((s, g) => s + g.planned, 0),
    totalActual:  groups.reduce((s, g) => s + g.actual, 0),
  }
}

// ─── Risk heatmap ─────────────────────────────────────────────
export interface HeatmapRisk { id: string; label: string; p: number; i: number }

export async function getRiskHeatmap(): Promise<HeatmapRisk[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('risks')
    .select('id, title, probability, impact')
    .eq('tenant_id', tenantId)

  if (error || !data) return []

  const LVL: Record<string, number> = { low: 1, medium: 2, high: 3, very_high: 3, critical: 3 }
  return data.map((r) => ({
    id:    r.id,
    label: r.title ?? 'Risk',
    p:     LVL[(r.probability ?? 'medium').toLowerCase()] ?? 2,
    i:     LVL[(r.impact ?? 'medium').toLowerCase()] ?? 2,
  }))
}

// ─── Document queue ───────────────────────────────────────────
export interface QueueDoc {
  id: string; name: string; project: string
  type: 'approval' | 'review' | 'upload'; status: string; when: string; urgent: boolean
}

export async function getDocumentQueue(): Promise<QueueDoc[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('document_files')
    .select('id, title, file_name, project_code, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error || !data) return []

  const TYPE_MAP: Record<string, QueueDoc['type']> = {
    approved: 'approval', submitted: 'review', under_review: 'review', draft: 'upload',
  }
  return data.map((d) => {
    const st = d.status ?? 'draft'
    return {
      id:      d.id,
      name:    d.title || d.file_name || 'Document',
      project: d.project_code || '—',
      type:    TYPE_MAP[st] ?? 'review',
      status:  st,
      when:    relTime(d.created_at),
      urgent:  st === 'under_review' || st === 'submitted',
    }
  })
}

// ─── Team activity feed ───────────────────────────────────────
export interface ActivityEntry {
  id: string; actor: string; initials: string; color: string
  action: string; target: string; time: string
  type: 'approve' | 'upload' | 'comment' | 'complete' | 'create'
}

export async function getTeamActivity(): Promise<ActivityEntry[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('approvals')
    .select('id, title, object_type, status, updated_at, created_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  const STATUS_ACTION: Record<string, { action: string; type: ActivityEntry['type'] }> = {
    approved:  { action: 'approved',  type: 'approve'  },
    rejected:  { action: 'rejected',  type: 'complete' },
    delegated: { action: 'delegated', type: 'create'   },
    pending:   { action: 'requested', type: 'create'   },
  }
  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#10b981']

  return data.map((a, idx) => {
    const label = (a.object_type ?? 'item').replace(/_/g, ' ')
    const sa = STATUS_ACTION[a.status] ?? { action: 'updated', type: 'comment' as const }
    return {
      id:       a.id,
      actor:    label.replace(/\b\w/g, (c: string) => c.toUpperCase()),
      initials: label.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase(),
      color:    COLORS[idx % COLORS.length],
      action:   sa.action,
      target:   a.title ?? 'Approval',
      time:     relTime(a.updated_at ?? a.created_at),
      type:     sa.type,
    }
  })
}

// ─── Upcoming milestones (timeline + calendar) ────────────────
export interface UpcomingMilestone {
  id: string; project: string; label: string; date: string
  type: 'gate' | 'milestone' | 'deadline'; status: 'today' | 'upcoming' | 'overdue'
}

export async function getUpcomingMilestones(): Promise<UpcomingMilestone[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const now   = new Date()
  const in30  = new Date(now.getTime() + 30 * 86_400_000)
  const today = now.toISOString().slice(0, 10)

  const [schedRes, projRes] = await Promise.all([
    supabase
      .from('schedule_milestones')
      .select('id, name, planned_end, gate_number, projects(name)')
      .eq('tenant_id', tenantId)
      .gte('planned_end', today)
      .lte('planned_end', in30.toISOString().slice(0, 10))
      .order('planned_end', { ascending: true }),
    supabase
      .from('projects')
      .select('id, name, target_completion')
      .eq('tenant_id', tenantId)
      .not('target_completion', 'is', null)
      .order('target_completion', { ascending: true }),
  ])

  const out: UpcomingMilestone[] = []

  type SchedRow = { id: string; name: string | null; planned_end: string; gate_number: number | null; projects: { name: string } | null }
  for (const m of (schedRes.data as unknown as SchedRow[] | null) ?? []) {
    out.push({
      id:      m.id,
      project: m.projects?.name ?? '—',
      label:   m.name ?? 'Milestone',
      date:    m.planned_end.slice(0, 10),
      type:    m.gate_number != null ? 'gate' : 'milestone',
      status:  dayStatus(m.planned_end, now),
    })
  }
  for (const p of projRes.data ?? []) {
    const tc = p.target_completion as string
    out.push({
      id:      `cod-${p.id}`,
      project: p.name,
      label:   'Target Completion (COD)',
      date:    tc.slice(0, 10),
      type:    'deadline',
      status:  dayStatus(tc, now),
    })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)
}

// ─── Calendar events (milestones + permit expiries + transmittal due dates) ───
export interface CalendarEvent {
  id: string
  project: string
  label: string
  date: string
  type: 'gate' | 'milestone' | 'deadline' | 'permit' | 'transmittal'
  status: 'today' | 'upcoming' | 'overdue'
  location: string
  link: string | null
}

/**
 * Merged calendar feed for the dashboard widget:
 * – upcoming schedule milestones & COD deadlines (existing feed)
 * – work-permit expiries (issued, valid_to within 14 days)
 * – transmittal response_due dates within 14 days
 */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const now   = new Date()
  const today = now.toISOString().slice(0, 10)
  const in14  = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10)

  const [milestones, permitRes, transRes, projRes] = await Promise.all([
    getUpcomingMilestones(),
    supabase
      .from('work_permits')
      .select('id, permit_no, project_id, valid_to, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'issued')
      .gte('valid_to', today)
      .lte('valid_to', in14),
    supabase
      .from('transmittals')
      .select('id, transmittal_no, project_id, response_due, status')
      .eq('tenant_id', tenantId)
      .in('status', ['issued', 'acknowledged'])
      .gte('response_due', today)
      .lte('response_due', in14),
    supabase.from('projects').select('id, name').eq('tenant_id', tenantId),
  ])

  const pm = Object.fromEntries((projRes.data ?? []).map((p) => [p.id as string, p.name as string]))

  const out: CalendarEvent[] = milestones.map((m) => ({
    ...m,
    location: m.type === 'gate' ? 'Gate Review' : m.type === 'deadline' ? 'Deadline' : 'Milestone',
    link: null,
  }))

  for (const p of permitRes.data ?? []) {
    const vt = p.valid_to as string
    out.push({
      id:       `permit-${p.id}`,
      project:  pm[p.project_id as string] ?? '—',
      label:    `Permit expiry — ${(p.permit_no as string) ?? 'PTW'}`,
      date:     vt.slice(0, 10),
      type:     'permit',
      status:   dayStatus(vt, now),
      location: 'Permit to Work',
      link:     `/projects/${p.project_id}/permits`,
    })
  }

  for (const t of transRes.data ?? []) {
    const rd = t.response_due as string
    out.push({
      id:       `transmittal-${t.id}`,
      project:  pm[t.project_id as string] ?? '—',
      label:    `Response due — ${(t.transmittal_no as string) ?? 'Transmittal'}`,
      date:     rd.slice(0, 10),
      type:     'transmittal',
      status:   dayStatus(rd, now),
      location: 'Transmittals',
      link:     `/projects/${t.project_id}/transmittals`,
    })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Health score ─────────────────────────────────────────────
export interface HealthScore { score: number; green: number; amber: number; red: number; total: number }

export async function getHealthScore(): Promise<HealthScore> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase.from('projects').select('health').eq('tenant_id', tenantId)

  if (error || !data || data.length === 0) return { score: 0, green: 0, amber: 0, red: 0, total: 0 }

  const green = data.filter((p) => p.health === 'green').length
  const amber = data.filter((p) => p.health === 'amber').length
  const red   = data.filter((p) => p.health === 'red').length
  const total = data.length
  const score = Math.round((green * 100 + amber * 60 + red * 25) / total)

  return { score, green, amber, red, total }
}

// ─── System alerts (announcements from AI insights) ───────────
export interface SystemAlert {
  id: string; title: string; body: string; severity: string; module: string | null; date: string
}

export async function getSystemAlerts(): Promise<SystemAlert[]> {
  const tenantId = await getCurrentTenantId()
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('ai_insights')
    .select('id, title, description, severity, module, created_at')
    .eq('tenant_id', tenantId)
    .in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false })
    .limit(8)

  if (error || !data) return []

  return data.map((a) => ({
    id:       a.id,
    title:    a.title ?? 'System Alert',
    body:     a.description ?? '',
    severity: a.severity ?? 'high',
    module:   a.module ?? null,
    date:     relTime(a.created_at),
  }))
}
