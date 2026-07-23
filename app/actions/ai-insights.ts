'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import type { AiInsight, MarketplaceProvider, AiMarketplaceDashboard } from '@/lib/types/action-types'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export async function loadAiMarketplaceDashboard(): Promise<AiMarketplaceDashboard> {
  const sb = createAdminClient()
  const [{ data: insights }, { data: providers }, { data: projects }] = await Promise.all([
    sb.from('ai_insights').select('*').eq('tenant_id', DEMO_TENANT).order('created_at', { ascending: false }),
    sb.from('marketplace_providers').select('*').eq('tenant_id', DEMO_TENANT).order('name'),
    sb.from('projects').select('id, name').eq('tenant_id', DEMO_TENANT),
  ])

  const pm = Object.fromEntries((projects ?? []).map(p => [p.id, p.name]))
  const ins = (insights ?? []).map(r => ({ ...r, project_name: pm[r.project_id] ?? 'Unknown' })) as AiInsight[]
  const prov = (providers ?? []) as MarketplaceProvider[]

  const modMap: Record<string, number> = {}
  const sevMap: Record<string, number> = {}
  for (const r of ins) {
    modMap[r.module] = (modMap[r.module] ?? 0) + 1
    sevMap[r.severity] = (sevMap[r.severity] ?? 0) + 1
  }

  return {
    insights: ins,
    providers: prov,
    insightStats: {
      open:         ins.filter(r => r.status === 'open').length,
      critical:     ins.filter(r => r.severity === 'critical' && r.status === 'open').length,
      acknowledged: ins.filter(r => r.status === 'acknowledged').length,
      resolved:     ins.filter(r => r.status === 'resolved').length,
    },
    byModule:   Object.entries(modMap).map(([module, count]) => ({ module, count })),
    bySeverity: Object.entries(sevMap).map(([severity, count]) => ({ severity, count })),
  }
}

export async function acknowledgeInsightAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('ai_insights').update({ status: 'acknowledged' }).eq('id', id)
  revalidatePath('/ai-insights')
  return { error: error?.message ?? null }
}

export async function dismissInsightAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('ai_insights').update({ status: 'dismissed' }).eq('id', id)
  revalidatePath('/ai-insights')
  return { error: error?.message ?? null }
}

export async function connectProviderAction(id: string) {
  const gate = await requireWriter()
  if ('error' in gate) return { error: gate.error }

  const sb = createAdminClient()
  const { error } = await sb.from('marketplace_providers').update({ status: 'connected' }).eq('id', id)
  revalidatePath('/marketplace')
  return { error: error?.message ?? null }
}

export async function seedAiMarketplaceDemoAction() {
  const gate = await requireWriter()
  if ('error' in gate) return { seeded: false }

  const sb = createAdminClient()
  const { data: existing } = await sb.from('ai_insights').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if (existing && existing.length > 0) return { seeded: false }

  const { data: projects } = await sb.from('projects').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  const pid = projects?.[0]?.id ?? 'a1000000-0000-0000-0000-000000000001'

  const insightRows = [
    { module: 'predictive_maintenance', title: 'Inverter A2 showing early degradation', description: 'SCADA data indicates 12% efficiency loss vs baseline. Probability of failure in 60 days: 73%.', confidence: 87, severity: 'critical', status: 'open', recommended_action: 'Schedule inspection within 2 weeks. Pre-order replacement IGBT module.' },
    { module: 'anomaly_detection', title: 'String 7 IV curve deviation detected', description: 'DC string output deviating >8% from expected model. Possible shading event or cell degradation.', confidence: 92, severity: 'high', status: 'open', recommended_action: 'Dispatch field technician for visual inspection and thermal imaging.' },
    { module: 'schedule_risk', title: 'G2 Engineering milestone at risk', description: 'IFC drawing submission rate 18% behind plan. Extrapolated to 3-week delay to G3 gate.', confidence: 78, severity: 'high', status: 'acknowledged', recommended_action: 'Review drawing register with EPC PM. Consider additional draughtsman resource.' },
    { module: 'cost_overrun', title: 'Procurement costs trending 4.2% above budget', description: 'MV cable pricing has increased 9% since budget set. EAC impact: +$1.3M.', confidence: 85, severity: 'medium', status: 'open', recommended_action: 'Lock in pricing with alternative suppliers. Review value engineering options.' },
    { module: 'safety', title: 'HSE leading indicator — near-miss frequency trending up', description: '3 near-miss reports in 5 days. Statistically significant increase. Historical pattern precedes LTI.', confidence: 81, severity: 'high', status: 'open', recommended_action: 'Convene toolbox talk. Review permits to work for high-risk activities this week.' },
    { module: 'predictive_maintenance', title: 'Transformer T1 oil temperature elevated', description: 'Operating at 78°C vs 65°C design point. Load-side investigation recommended.', confidence: 76, severity: 'medium', status: 'resolved', recommended_action: 'Reduce load during peak hours. Sample oil for DGA analysis.' },
  ]

  await sb.from('ai_insights').insert(
    insightRows.map(r => ({ ...r, project_id: pid, tenant_id: DEMO_TENANT }))
  )

  const providerRows = [
    { name: 'SolarEdge Monitoring API', category: 'data_feed', description: 'Real-time inverter telemetry, string-level data and alerts.', logo_url: null, integration_type: 'api', status: 'connected', rating: 4.7, review_count: 312 },
    { name: 'Meteomatics Weather', category: 'data_feed', description: 'High-resolution solar irradiance and weather forecasts.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.5, review_count: 189 },
    { name: 'DNV GL Energy Analytics', category: 'analytics', description: 'P50/P90 energy yield assessment and performance benchmarking.', logo_url: null, integration_type: 'oauth', status: 'available', rating: 4.8, review_count: 94 },
    { name: 'Procore Construction PM', category: 'epc_tool', description: 'Construction management, RFIs, submittals, and punch lists.', logo_url: null, integration_type: 'api', status: 'pending', rating: 4.3, review_count: 1420 },
    { name: 'Enertiv Building Analytics', category: 'analytics', description: 'Energy consumption benchmarking and anomaly detection.', logo_url: null, integration_type: 'webhook', status: 'available', rating: 4.1, review_count: 67 },
    { name: 'SAP ERP Finance Bridge', category: 'finance', description: 'Bi-directional sync of POs, invoices, and commitment data.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.0, review_count: 203 },
    { name: 'Fieldwire Site Inspection', category: 'field_service', description: 'Mobile punch list and inspection management for field teams.', logo_url: null, integration_type: 'api', status: 'available', rating: 4.6, review_count: 578 },
    { name: 'ISO 14001 Compliance Hub', category: 'compliance', description: 'Environmental management system compliance tracking and reporting.', logo_url: null, integration_type: 'file_import', status: 'available', rating: 3.9, review_count: 42 },
  ]

  await sb.from('marketplace_providers').insert(
    providerRows.map(r => ({ ...r, tenant_id: DEMO_TENANT }))
  )

  revalidatePath('/ai-insights')
  return { seeded: true }
}
