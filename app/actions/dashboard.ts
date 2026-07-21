'use server'

import { createClient } from '@/lib/supabase/server'
import type { DashboardStats, DashboardProject } from '@/components/dashboard/dashboard-page'
import type { ApprovalItem } from '@/components/dashboard/dashboard-data'

// ─────────────────────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────────────────────

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const supabase = await createClient()

  const [projectsRes, approvalsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('approvals')
      .select('id, status, created_at')
      .eq('tenant_id', tenantId),
  ])

  const projects = projectsRes.data ?? []
  const approvals = approvalsRes.data ?? []

  const totalProjects = projects.length
  const activeProjects = projects.filter((p) => p.status === 'active').length

  const pendingApprovals = approvals.filter(
    (a) => a.status === 'pending' || a.status === 'under_review',
  ).length

  // Overdue = pending and created more than 7 days ago
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString()
  const overdueApprovals = approvals.filter(
    (a) =>
      (a.status === 'pending' || a.status === 'under_review') &&
      a.created_at < sevenDaysAgo,
  ).length

  return {
    totalProjects,
    activeProjects,
    pendingApprovals,
    overdueApprovals,
    totalProjectsTrend: `${totalProjects} total`,
    activeProjectsTrend: `${totalProjects - activeProjects} inactive`,
    pendingApprovalsTrend: `${pendingApprovals} pending`,
    overdueApprovalsTrend: overdueApprovals > 0 ? `${overdueApprovals} overdue` : 'None overdue',
  }
}

// ─────────────────────────────────────────────────────────────
// Recent projects
// ─────────────────────────────────────────────────────────────

export async function getDashboardProjects(tenantId: string): Promise<DashboardProject[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name, status, technology, capacity_mw, budget_usd, current_phase, health, country, location, target_completion')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  const PHASE_GATE_MAP: Record<number, string> = {
    0: 'g0', 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4',
    5: 'g5', 6: 'g6', 7: 'g7', 8: 'g8',
  }

  return data.map((p) => {
    const gate = p.current_phase ?? 0
    const phase = PHASE_GATE_MAP[gate] ?? 'g0'
    const budgetM = p.budget_usd ? Math.round(p.budget_usd / 1_000_000) : 0
    const targetCod = p.target_completion
      ? new Date(p.target_completion).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : undefined

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      phase,
      gate,
      gateName: `G${gate}`,
      budgetM,
      budget_amount: p.budget_usd ?? 0,
      currency: 'USD',
      status: (p.status as DashboardProject['status']) ?? 'active',
      client: p.location ?? p.country ?? '—',
      targetCod,
      target_cod: p.target_completion ?? undefined,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Approval inbox
// ─────────────────────────────────────────────────────────────

export async function getDashboardApprovals(tenantId: string): Promise<ApprovalItem[]> {
  const supabase = await createClient()

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
    const createdAt = new Date(a.created_at)
    const daysOpen = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000)
    return {
      id: a.id,
      type: (a.object_type?.toLowerCase().replace(/\s+/g, '-') ?? 'change-order') as ApprovalItem['type'],
      title: a.title ?? 'Approval Request',
      projectCode: '—',
      projectName: '—',
      requestedBy: 'Team Member',
      daysOpen,
      isOverdue: daysOpen > 7,
      priority: PRIORITY_MAP[a.priority ?? 'normal'] ?? 'medium',
    }
  })
}
