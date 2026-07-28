'use server'

import { createClient } from '@supabase/supabase-js'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/guards'

export interface PortfolioProject {
  id: string
  code: string
  name: string
  status: string
  technology: string | null
  capacity_mw: number | null
  budget_usd: number | null
  spent_usd: number | null
  current_phase: number | null
  health: string | null
  location: string | null
  country: string | null
  target_completion: string | null
  project_manager: string | null
}

export interface PortfolioStats {
  totalActive: number
  atRisk: number
  pendingApprovals: number
  byGate: Record<string, number>
  projects: PortfolioProject[]
}

export async function getPortfolioStats(): Promise<PortfolioStats> {
  try {
    await requireUser()
  } catch (e: any) {
    return { totalActive: 0, atRisk: 0, pendingApprovals: 0, byGate: {}, projects: [] }
  }

  const tenantId = await getCurrentTenantId()
  const supabase = svc()

  const [projectsRes, approvalsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id,code,name,status,technology,capacity_mw,budget_usd,spent_usd,current_phase,health,location,country,target_completion,project_manager')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('approvals')
      .select('id,status')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ])

  const projects: PortfolioProject[] = (projectsRes.data ?? []) as PortfolioProject[]
  const pendingApprovals = approvalsRes.data?.length ?? 0

  const totalActive = projects.filter((p) => p.status === 'active').length
  const atRisk = projects.filter(
    (p) => p.status === 'on_hold' || p.health === 'red' || p.health === 'amber',
  ).length

  const byGate: Record<string, number> = {}
  for (const p of projects) {
    const g = `G${p.current_phase ?? 0}`
    byGate[g] = (byGate[g] ?? 0) + 1
  }

  return { totalActive, atRisk, pendingApprovals, byGate, projects }
}
