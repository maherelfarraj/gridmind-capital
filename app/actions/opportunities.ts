'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import type { Opportunity, OpportunitiesDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

const STATUS_COLORS: Record<string, string> = {
  draft:        '#94a3b8',
  planning:     '#3b82f6',
  active:       '#22c55e',
  on_hold:      '#f59e0b',
  cancelled:    '#64748b',
  completed:    '#10b981',
}

export async function loadOpportunitiesDashboard(): Promise<OpportunitiesDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [projRes, approvalRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, code, name, technology, capacity_mw, country, location, status, health, budget_usd, created_at, current_phase')
      .eq('tenant_id', tenantId)
      .in('current_phase', [0, 1])
      .order('created_at', { ascending: false }),
    supabase
      .from('approvals')
      .select('id, title, status, object_type')
      .eq('tenant_id', tenantId)
      .eq('object_type', 'opportunity'),
  ])

  const projects  = projRes.data  ?? []
  const approvals = approvalRes.data ?? []

  const approvalMap = new Map(approvals.map((a) => [a.title, a.status]))

  const items: Opportunity[] = projects.map((p) => ({
    id:             p.id,
    code:           p.code,
    name:           p.name,
    technology:     p.technology ?? 'Solar PV',
    capacity_mw:    p.capacity_mw ?? 0,
    country:        p.country ?? '',
    location:       p.location ?? '',
    status:         p.status ?? 'draft',
    health:         p.health ?? 'green',
    budget_usd:     p.budget_usd ?? 0,
    created_at:     p.created_at,
    approvalStatus: approvalMap.get(p.code) ?? null,
  }))

  const byTech = items.reduce<Record<string, number>>((acc, p) => {
    acc[p.technology] = (acc[p.technology] ?? 0) + 1
    return acc
  }, {})

  const statusCounts = items.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})

  return {
    total:      items.length,
    submitted:  approvals.filter((a) => a.status === 'pending').length,
    // The approval_status enum is pending | approved | rejected | delegated —
    // there is no `under_review` member, so this KPI was hardwired to 0.
    underReview:approvals.filter((a) => a.status === 'delegated').length,
    approved:   approvals.filter((a) => a.status === 'approved').length,
    rejected:   approvals.filter((a) => a.status === 'rejected').length,
    byTechnology: Object.entries(byTech).map(([name, value]) => ({ name, value })),
    byStatus: Object.entries(statusCounts).map(([name, value]) => ({
      name, value, color: STATUS_COLORS[name] ?? '#94a3b8',
    })),
    items,
  }
}

export async function createOpportunity(data: {
  name: string
  code: string
  technology: string
  capacity_mw: number
  country: string
  location: string
  budget_usd: number
  description: string
}): Promise<{ id?: string; error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // 1. Insert project at G0/draft
  const { data: proj, error: pe } = await supabase
    .from('projects')
    .insert({
      tenant_id:        tenantId,
      name:             data.name,
      code:             data.code,
      description:      data.description,
      technology:       data.technology,
      capacity_mw:      data.capacity_mw,
      country:          data.country,
      location:         data.location,
      budget_usd:       data.budget_usd,
      status:           'planning',
      current_phase:    0,
      health:           'green',
      // Stamp the REAL authenticated creator, not a hardcoded uuid.
      // `requireWriter()` already resolved them above; the previous code
      // discarded that and wrote DEMO_USER (= admin@gridmind.capital), so every
      // opportunity looked like it was raised by the generic admin account.
      // There is no FK on these columns, so the bad value failed silently.
      project_manager:  gate.actor.userId,
      created_by:       gate.actor.userId,
    })
    .select('id')
    .single()

  if (pe || !proj) return { error: pe?.message ?? 'Failed to create project' }

  // 2. Create approval record for G0 review.
  // `object_id` + `requester_id` were previously left NULL, which orphaned the
  // approval: it could only be found by string-matching `title` to the project
  // code, and nothing recorded who raised it.
  const { error: ae } = await supabase.from('approvals').insert({
    tenant_id:    tenantId,
    object_type:  'opportunity',
    object_id:    proj.id,
    title:        data.code,
    description:  `G0 Gate review for ${data.name}`,
    status:       'pending',
    priority:     'normal',
    amount:       data.budget_usd,
    requester_id: gate.actor.userId,
  })

  // Surface the failure instead of silently returning a project with no
  // approval attached — the caller shows this in a toast.
  if (ae) return { id: proj.id, error: `Project created, but approval failed: ${ae.message}` }

  return { id: proj.id }
}

export async function submitOpportunityForReview(projectId: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('projects')
    .update({ status: 'active' })
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
  return { error: error?.message }
}

export async function seedOpportunitiesDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Idempotent: check if demo opportunities already exist
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('current_phase', 0)
    .limit(1)

  if ((existing?.length ?? 0) > 0) return {}

  const demos = [
    { name: 'Rub Al Khali Solar 250MW',   code: 'RAK-250', technology: 'Solar PV',  capacity_mw: 250, country: 'Saudi Arabia',  location: 'Rub Al Khali Desert',   budget_usd: 175_000_000, health: 'green' },
    { name: 'Gulf of Suez Wind 150MW',    code: 'GOS-150', technology: 'Wind',       capacity_mw: 150, country: 'Egypt',         location: 'Gulf of Suez',          budget_usd: 210_000_000, health: 'green' },
    { name: 'Jubail BESS 100MWh',         code: 'JBL-100', technology: 'BESS',       capacity_mw: 100, country: 'Saudi Arabia',  location: 'Jubail Industrial City',budget_usd: 90_000_000,  health: 'amber' },
    { name: 'Muscat Green H2 50MW',       code: 'MCT-050', technology: 'Hydrogen',   capacity_mw:  50, country: 'Oman',          location: 'Muscat Industrial Zone',budget_usd: 125_000_000, health: 'green' },
  ] as const

  for (const d of demos) {
    await supabase.from('projects').insert({
      tenant_id: tenantId, created_by: gate.actor.userId,
      project_manager: gate.actor.userId,
      status: 'planning', current_phase: 0,
      description: `G0 opportunity — ${d.technology} project at ${d.location}`,
      ...d,
    })
  }

  return {}
}
