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

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ─────────────────────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getServiceClient()

  const [projectsRes, approvalsRes] = await Promise.all([
    supabase.from('projects').select('id, status').eq('tenant_id', DEMO_TENANT),
    supabase.from('approvals').select('id, status, created_at').eq('tenant_id', DEMO_TENANT),
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
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id, code, name, status, technology, capacity_mw, budget_usd, current_phase, health, country, location, target_completion')
    .eq('tenant_id', DEMO_TENANT)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return []

  const PHASE_GATE_MAP: Record<number, string> = {
    0: 'g0', 1: 'g1', 2: 'g2', 3: 'g3', 4: 'g4',
    5: 'g5', 6: 'g6', 7: 'g7', 8: 'g8',
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
  const supabase = getServiceClient()

  const { data, error } = await supabase
    .from('approvals')
    .select('id, object_type, title, status, priority, created_at, description, amount')
    .eq('tenant_id', DEMO_TENANT)
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
