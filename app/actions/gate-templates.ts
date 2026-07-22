'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface TemplateDeliverable {
  name: string
  owner_role: string
}

export interface TemplateGate {
  gate: string          // e.g. 'G1'
  title: string         // e.g. 'Proposal & Go/No-Go'
  deliverables: TemplateDeliverable[]
}

export interface GateTemplate {
  id: string
  name: string
  description: string | null
  technology: string | null
  is_active: boolean
  is_default: boolean
  gates: TemplateGate[]
  deliverable_count: number
  created_at: string
  updated_at: string
}

function normalizeGates(raw: unknown): TemplateGate[] {
  if (!Array.isArray(raw)) return []
  return raw.map((g) => {
    const gate = g as { gate?: string; title?: string; deliverables?: unknown }
    const deliverables = Array.isArray(gate.deliverables)
      ? gate.deliverables.map((d) => {
          const item = d as { name?: string; owner_role?: string }
          return { name: item.name ?? '', owner_role: item.owner_role ?? 'Unassigned' }
        })
      : []
    return { gate: gate.gate ?? '', title: gate.title ?? '', deliverables }
  })
}

/**
 * Load gate templates for the current tenant.
 * @param activeOnly  When true (default), only returns active templates — used by the wizard.
 */
export async function getGateTemplates(activeOnly = true): Promise<GateTemplate[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('gate_templates')
    .select('id, name, description, technology, is_active, is_default, gates, created_at, updated_at')
    .eq('tenant_id', DEMO_TENANT)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error || !data) return []

  return data.map((t) => {
    const gates = normalizeGates(t.gates)
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      technology: t.technology,
      is_active: t.is_active,
      is_default: t.is_default,
      gates,
      deliverable_count: gates.reduce((sum, g) => sum + g.deliverables.length, 0),
      created_at: t.created_at,
      updated_at: t.updated_at,
    }
  })
}
