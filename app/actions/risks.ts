'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { getPeople } from '@/lib/db/queries'
import type { RiskRecord, RisksDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

function calcRag(score: number): 'green' | 'amber' | 'red' {
  if (score <= 4)  return 'green'
  if (score <= 9)  return 'amber'
  return 'red'
}

export async function loadRisksDashboard(projectId?: string): Promise<RisksDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  // Column notes (verified against the live schema):
  //  - There is NO `code` column. `risk_number` is the canonical human id and is
  //    auto-filled by the `set_risk_number` trigger (RSK-####).
  //  - There is NO `owner` text column. Ownership is `owner_id uuid` -> profiles,
  //    so the display name comes from an embedded join.
  // Selecting the old `code, owner` names made this query fail outright, which is
  // why the register was always empty.
  let query = supabase
    .from('risks')
    .select('id, risk_number, title, category, probability, impact, status, owner_id, mitigation, project_id, created_at, owner:profiles!risks_owner_id_fkey(full_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) console.log('[v0] loadRisksDashboard failed:', error.message)
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>

  const items: RiskRecord[] = rows.map((r) => {
    // probability/impact are integer 1-5 since the numeric-score migration.
    const prob  = Number(r.probability) || 3
    const imp   = Number(r.impact)      || 3
    const score = prob * imp
    const ownerJoin = r.owner as { full_name?: string | null } | null
    return {
      id:         String(r.id),
      code:       (r.risk_number as string | null) ?? '—',
      title:      (r.title as string | null) ?? 'Unnamed risk',
      category:   (r.category as string | null) ?? 'Technical',
      probability:prob,
      impact:     imp,
      score,
      rag:        calcRag(score),
      status:     (r.status as string | null) ?? 'open',
      ownerId:    (r.owner_id as string | null) ?? null,
      owner:      ownerJoin?.full_name ?? 'Unassigned',
      mitigation: (r.mitigation as string | null) ?? '',
      project_id: (r.project_id as string | null) ?? null,
      created_at: String(r.created_at),
    }
  })

  const byCategory = (() => {
    const m: Record<string, number> = {}
    items.forEach((r) => { m[r.category] = (m[r.category] ?? 0) + 1 })
    return Object.entries(m).map(([name, value]) => ({ name, value }))
  })()

  const bands = { green: 0, amber: 0, red: 0 }
  items.forEach((r) => { bands[r.rag]++ })

  return {
    total:          items.length,
    open:           items.filter((r) => r.status === 'open').length,
    highOrCritical: items.filter((r) => r.score >= 12).length,
    byCategory,
    byBand: [
      { name: 'Low',      value: bands.green, color: '#22c55e' },
      { name: 'Medium',   value: bands.amber, color: '#f59e0b' },
      { name: 'High',     value: bands.red,   color: '#ef4444' },
    ],
    matrixData: items.map((r) => ({
      probability: r.probability,
      impact:      r.impact,
      title:       r.title,
      id:          r.id,
      score:       r.score,
    })),
    items,
  }
}

export async function createRisk(data: {
  title: string; category: string; probability: number; impact: number
  /** profiles.id of the risk owner, chosen from the people picker. */
  ownerId: string; mitigation: string; project_id?: string
}): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  if (!data.title?.trim()) return { error: 'Title is required' }
  if (!data.ownerId)       return { error: 'Owner is required' }

  const supabase = createAdminClient()
  // No `code` is generated: `risk_number` (RSK-####) is assigned by the
  // set_risk_number trigger, so the user never types an identifier.
  const { error } = await supabase.from('risks').insert({
    tenant_id:   tenantId,
    title:       data.title.trim(),
    category:    data.category,
    // Clamp to the 1-5 matrix range enforced by the CHECK constraints.
    probability: Math.min(5, Math.max(1, Math.round(data.probability))),
    impact:      Math.min(5, Math.max(1, Math.round(data.impact))),
    status:      'open',
    owner_id:    data.ownerId,
    mitigation:  data.mitigation,
    project_id:  data.project_id ?? null,
  })
  return { error: error?.message }
}

/** People eligible to own a risk: project team first, then the rest of the tenant. */
export async function getRiskOwnerOptions(projectId?: string): Promise<{
  id: string; name: string; role: string | null; onTeam: boolean
}[]> {
  const gate = await requireWriter()
  if ('error' in gate) return []

  // Reuse the same tenant-scoped people query the wizard and staffing views use.
  const people = await getPeople({ internalOnly: true })

  let teamIds = new Set<string>()
  if (projectId) {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('project_team')
      .select('person_id')
      .eq('project_id', projectId)
    teamIds = new Set((data ?? []).map((r) => r.person_id as string).filter(Boolean))
  }

  return people
    .map((p) => ({
      id:     p.id,
      name:   p.full_name ?? 'Unnamed',
      role:   p.role ?? null,
      onTeam: teamIds.has(p.id),
    }))
    // Project team members surface first, then alphabetical.
    .sort((a, b) => (Number(b.onTeam) - Number(a.onTeam)) || a.name.localeCompare(b.name))
}

export async function closeRisk(id: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('risks')
    .update({ status: 'mitigated', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  return { error: error?.message }
}

export async function seedRisksDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('risks').select('id').eq('tenant_id', tenantId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  // SOL-2026-001 "Al Dhafra Solar PV - Phase 1". The previous id
  // (a1000000-...-001) was a duplicate-code row that has been deleted.
  const PROJECT_ID = 'ce14ed42-0ea0-43e6-b718-cc2c2cb5283d'
  // Owners are real profiles.id values now, not free-text names. Spread the demo
  // risks across whoever actually exists in this tenant rather than inventing
  // people, and fall back to the creator if the tenant has no other staff.
  const people = await getPeople({ internalOnly: true })
  const ownerFor = (i: number) =>
    people.length > 0 ? people[i % people.length].id : gate.actor.userId

  const demos = [
    { title: 'Grid connection delay',         category: 'Schedule',    probability: 4, impact: 5, mitigation: 'Early engagement with utility authority' },
    { title: 'Equipment delivery logistics',  category: 'Procurement', probability: 3, impact: 4, mitigation: 'Buffer stock and dual-source procurement' },
    { title: 'Regulatory permitting slippage',category: 'Regulatory',  probability: 3, impact: 5, mitigation: 'Dedicated permit tracking dashboard' },
    { title: 'Subcontractor cash flow issue', category: 'Commercial',  probability: 2, impact: 3, mitigation: 'Monthly financial review with sub-contractors' },
    { title: 'Adverse weather events',        category: 'Technical',   probability: 2, impact: 4, mitigation: 'Weather contingency in schedule baseline' },
    { title: 'MV cable procurement lead time',category: 'Procurement', probability: 4, impact: 3, mitigation: 'Early LOI issued to cable manufacturer' },
    { title: 'Panel performance below spec',  category: 'Technical',   probability: 2, impact: 5, mitigation: 'FAT + ITP at module factory' },
    { title: 'Force majeure — geopolitical',  category: 'External',    probability: 1, impact: 5, mitigation: 'Political risk insurance cover' },
  ]

  // No `code` — the set_risk_number trigger assigns RSK-####.
  const { error } = await supabase.from('risks').insert(
    demos.map((d, i) => ({
      tenant_id: tenantId, project_id: PROJECT_ID,
      status: 'open', owner_id: ownerFor(i), ...d,
    })),
  )
  return { error: error?.message }
}
