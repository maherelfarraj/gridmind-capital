'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import type { RiskRecord, RisksDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'
const DEMO_USER   = '20000000-0000-0000-0000-000000000001'

function calcRag(score: number): 'green' | 'amber' | 'red' {
  if (score <= 4)  return 'green'
  if (score <= 9)  return 'amber'
  return 'red'
}

export async function loadRisksDashboard(projectId?: string): Promise<RisksDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  let query = supabase
    .from('risks')
    .select('id, code, title, category, probability, impact, status, owner, mitigation, project_id, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)

  const { data } = await query
  const rows = data ?? []

  const items: RiskRecord[] = rows.map((r) => {
    const prob  = r.probability ?? 3
    const imp   = r.impact      ?? 3
    const score = prob * imp
    return {
      id:         r.id,
      code:       r.code ?? `R-${r.id.slice(0, 4).toUpperCase()}`,
      title:      r.title ?? 'Unnamed risk',
      category:   r.category ?? 'Technical',
      probability:prob,
      impact:     imp,
      score,
      rag:        calcRag(score),
      status:     r.status  ?? 'open',
      owner:      r.owner   ?? 'Unassigned',
      mitigation: r.mitigation ?? '',
      project_id: r.project_id ?? null,
      created_at: r.created_at,
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
  const tenantId = await getCurrentTenantId()
  title: string; category: string; probability: number; impact: number
  owner: string; mitigation: string; project_id?: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const code = `R-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('risks').insert({
    tenant_id:   tenantId,
    code,
    title:       data.title,
    category:    data.category,
    probability: data.probability,
    impact:      data.impact,
    status:      'open',
    owner:       data.owner,
    mitigation:  data.mitigation,
    project_id:  data.project_id ?? null,
  })
  return { error: error?.message }
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

  const PROJECT_ID = 'a1000000-0000-0000-0000-000000000001'
  const demos = [
    { title: 'Grid connection delay',         category: 'Schedule',    probability: 4, impact: 5, owner: 'M. Al-Farsi', mitigation: 'Early engagement with utility authority' },
    { title: 'Equipment delivery logistics',  category: 'Procurement', probability: 3, impact: 4, owner: 'R. Chen',     mitigation: 'Buffer stock and dual-source procurement' },
    { title: 'Regulatory permitting slippage',category: 'Regulatory',  probability: 3, impact: 5, owner: 'A. Carter',   mitigation: 'Dedicated permit tracking dashboard' },
    { title: 'Subcontractor cash flow issue', category: 'Commercial',  probability: 2, impact: 3, owner: 'J. Rivera',   mitigation: 'Monthly financial review with sub-contractors' },
    { title: 'Adverse weather events',        category: 'Technical',   probability: 2, impact: 4, owner: 'L. Schmidt',  mitigation: 'Weather contingency in schedule baseline' },
    { title: 'MV cable procurement lead time',category: 'Procurement', probability: 4, impact: 3, owner: 'R. Chen',     mitigation: 'Early LOI issued to cable manufacturer' },
    { title: 'Panel performance below spec',  category: 'Technical',   probability: 2, impact: 5, owner: 'M. Al-Farsi', mitigation: 'FAT + ITP at module factory' },
    { title: 'Force majeure — geopolitical',  category: 'External',    probability: 1, impact: 5, owner: 'A. Carter',   mitigation: 'Political risk insurance cover' },
  ]

  for (const d of demos) {
    const code = `R-${Math.floor(Math.random() * 9000) + 1000}`
    await supabase.from('risks').insert({
      tenant_id: tenantId, project_id: PROJECT_ID,
      code, status: 'open', ...d,
    })
  }
  return {}
}
