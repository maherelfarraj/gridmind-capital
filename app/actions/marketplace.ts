'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { MarketplaceProvider } from '@/lib/types/action-types'
export type { MarketplaceProvider }

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

// ── Integration hub static config ────────────────────────────────────────────

export interface IntegrationSystem {
  id: string
  name: string
  type: 'erp' | 'scada' | 'gis' | 'weather' | 'finance' | 'document' | 'identity'
  vendor: string
  status: 'online' | 'degraded' | 'offline' | 'not_configured'
  last_ping: string | null
  latency_ms: number | null
  events_today: number
}

export interface DataExchangeEvent {
  id: string
  system: string
  direction: 'inbound' | 'outbound'
  event_type: string
  payload_size_kb: number
  status: 'success' | 'failed' | 'pending'
  timestamp: string
}

export interface MarketplaceDashboard {
  providers: MarketplaceProvider[]
  integrations: IntegrationSystem[]
  recentEvents: DataExchangeEvent[]
  stats: {
    totalProviders: number
    connected: number
    available: number
    pending: number
    onlineSystems: number
    eventsToday: number
  }
  byCategory: { name: string; value: number }[]
  byStatus: { name: string; value: number; color: string }[]
}

// Static integration systems — represent real middleware connections
const INTEGRATION_SYSTEMS: IntegrationSystem[] = [
  { id: 'sys-erp',      name: 'SAP S/4HANA',           type: 'erp',      vendor: 'SAP',            status: 'online',          last_ping: new Date(Date.now() - 45_000).toISOString(),          latency_ms: 142,  events_today: 284 },
  { id: 'sys-scada',    name: 'SCADA / iFIX',           type: 'scada',    vendor: 'GE Digital',     status: 'online',          last_ping: new Date(Date.now() - 12_000).toISOString(),          latency_ms: 28,   events_today: 1847 },
  { id: 'sys-gis',      name: 'ArcGIS Enterprise',      type: 'gis',      vendor: 'Esri',           status: 'online',          last_ping: new Date(Date.now() - 120_000).toISOString(),         latency_ms: 310,  events_today: 37 },
  { id: 'sys-weather',  name: 'Meteomatics API',        type: 'weather',  vendor: 'Meteomatics',    status: 'degraded',        last_ping: new Date(Date.now() - 900_000).toISOString(),         latency_ms: 1840, events_today: 48 },
  { id: 'sys-finance',  name: 'Oracle Financials',      type: 'finance',  vendor: 'Oracle',         status: 'online',          last_ping: new Date(Date.now() - 300_000).toISOString(),         latency_ms: 198,  events_today: 92 },
  { id: 'sys-dms',      name: 'Aconex DMS',             type: 'document', vendor: 'Oracle Aconex',  status: 'online',          last_ping: new Date(Date.now() - 60_000).toISOString(),          latency_ms: 445,  events_today: 123 },
  { id: 'sys-idp',      name: 'Azure AD / Entra',       type: 'identity', vendor: 'Microsoft',      status: 'online',          last_ping: new Date(Date.now() - 5_000).toISOString(),           latency_ms: 18,   events_today: 412 },
  { id: 'sys-epc',      name: 'Procore Construction',   type: 'erp',      vendor: 'Procore',        status: 'not_configured',  last_ping: null,                                                 latency_ms: null, events_today: 0 },
]

// Static data-exchange events (last 24 h)
const RECENT_EVENTS: DataExchangeEvent[] = [
  { id: 'ev-001', system: 'SAP S/4HANA',         direction: 'inbound',  event_type: 'purchase_order_sync',    payload_size_kb: 12.4, status: 'success', timestamp: new Date(Date.now() -   3 * 60_000).toISOString() },
  { id: 'ev-002', system: 'SCADA / iFIX',         direction: 'inbound',  event_type: 'telemetry_batch',        payload_size_kb: 284,  status: 'success', timestamp: new Date(Date.now() -   8 * 60_000).toISOString() },
  { id: 'ev-003', system: 'Meteomatics API',       direction: 'inbound',  event_type: 'irradiance_forecast',    payload_size_kb: 4.1,  status: 'failed',  timestamp: new Date(Date.now() -  15 * 60_000).toISOString() },
  { id: 'ev-004', system: 'Aconex DMS',            direction: 'outbound', event_type: 'document_transmittal',  payload_size_kb: 1820, status: 'success', timestamp: new Date(Date.now() -  22 * 60_000).toISOString() },
  { id: 'ev-005', system: 'Oracle Financials',     direction: 'inbound',  event_type: 'invoice_reconcile',     payload_size_kb: 8.7,  status: 'success', timestamp: new Date(Date.now() -  41 * 60_000).toISOString() },
  { id: 'ev-006', system: 'Azure AD / Entra',      direction: 'inbound',  event_type: 'user_provisioning',     payload_size_kb: 2.1,  status: 'success', timestamp: new Date(Date.now() -  67 * 60_000).toISOString() },
  { id: 'ev-007', system: 'ArcGIS Enterprise',     direction: 'outbound', event_type: 'asset_location_export', payload_size_kb: 45.6, status: 'success', timestamp: new Date(Date.now() - 120 * 60_000).toISOString() },
  { id: 'ev-008', system: 'Meteomatics API',        direction: 'inbound',  event_type: 'irradiance_forecast',   payload_size_kb: 4.1,  status: 'pending', timestamp: new Date(Date.now() - 180 * 60_000).toISOString() },
  { id: 'ev-009', system: 'SAP S/4HANA',            direction: 'outbound', event_type: 'commitment_push',       payload_size_kb: 6.3,  status: 'success', timestamp: new Date(Date.now() - 210 * 60_000).toISOString() },
  { id: 'ev-010', system: 'SCADA / iFIX',           direction: 'inbound',  event_type: 'alarm_event',           payload_size_kb: 0.8,  status: 'success', timestamp: new Date(Date.now() - 250 * 60_000).toISOString() },
]

export async function loadMarketplaceDashboard(): Promise<MarketplaceDashboard> {
  const sb = createAdminClient()

  const { data: providerRows } = await sb
    .from('marketplace_providers')
    .select('*')
    .eq('tenant_id', DEMO_TENANT)
    .order('name')

  const providers = (providerRows ?? []) as MarketplaceProvider[]

  const stats = {
    totalProviders: providers.length,
    connected:      providers.filter((p) => p.status === 'connected').length,
    available:      providers.filter((p) => p.status === 'available').length,
    pending:        providers.filter((p) => p.status === 'pending').length,
    onlineSystems:  INTEGRATION_SYSTEMS.filter((s) => s.status === 'online').length,
    eventsToday:    INTEGRATION_SYSTEMS.reduce((sum, s) => sum + s.events_today, 0),
  }

  const catMap: Record<string, number> = {}
  providers.forEach((p) => { catMap[p.category] = (catMap[p.category] ?? 0) + 1 })
  const byCategory = Object.entries(catMap).map(([name, value]) => ({ name, value }))

  const statusColors: Record<string, string> = {
    available: '#3b82f6', connected: '#22c55e', pending: '#f59e0b', deprecated: '#94a3b8',
  }
  const statusMap: Record<string, number> = {}
  providers.forEach((p) => { statusMap[p.status] = (statusMap[p.status] ?? 0) + 1 })
  const byStatus = Object.entries(statusMap).map(([name, value]) => ({
    name, value, color: statusColors[name] ?? '#94a3b8',
  }))

  return {
    providers,
    integrations: INTEGRATION_SYSTEMS,
    recentEvents: RECENT_EVENTS,
    stats,
    byCategory,
    byStatus,
  }
}

export async function connectProviderAction(id: string): Promise<{ error: string | null }> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('marketplace_providers')
    .update({ status: 'connected' })
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
  revalidatePath('/marketplace')
  return { error: error?.message ?? null }
}

export async function disconnectProviderAction(id: string): Promise<{ error: string | null }> {
  const sb = createAdminClient()
  const { error } = await sb
    .from('marketplace_providers')
    .update({ status: 'available' })
    .eq('id', id)
    .eq('tenant_id', DEMO_TENANT)
  revalidatePath('/marketplace')
  return { error: error?.message ?? null }
}

export async function seedMarketplaceDemoData(): Promise<{ error?: string }> {
  const sb = createAdminClient()
  const { data: ex } = await sb.from('marketplace_providers').select('id').eq('tenant_id', DEMO_TENANT).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const demos = [
    { name: 'TomKimi AI Copilot',         category: 'analytics',    description: 'AI copilot for project risk, schedule and portfolio intelligence.',                           integration_type: 'api',         status: 'connected', rating: 4.9, review_count: 58  },
    { name: 'SolarEdge Monitoring API',  category: 'data_feed',    description: 'Real-time inverter telemetry, string-level data and fault alerts.',                        integration_type: 'api',         status: 'connected', rating: 4.7, review_count: 312 },
    { name: 'Meteomatics Weather',        category: 'data_feed',    description: 'High-resolution solar irradiance, wind and weather forecasts.',                            integration_type: 'api',         status: 'available', rating: 4.5, review_count: 189 },
    { name: 'DNV GL Energy Analytics',    category: 'analytics',    description: 'P50/P90 energy yield assessment, performance benchmarking and degradation analysis.',       integration_type: 'oauth',       status: 'available', rating: 4.8, review_count: 94  },
    { name: 'Procore Construction PM',    category: 'epc_tool',     description: 'Construction management — RFIs, submittals, punch lists and daily reports.',               integration_type: 'api',         status: 'pending',   rating: 4.3, review_count: 1420 },
    { name: 'Enertiv Building Analytics', category: 'analytics',    description: 'Energy consumption benchmarking, anomaly detection and carbon reporting.',                 integration_type: 'webhook',     status: 'available', rating: 4.1, review_count: 67  },
    { name: 'SAP ERP Finance Bridge',     category: 'finance',      description: 'Bi-directional sync of POs, invoices and commitment data with SAP S/4HANA.',              integration_type: 'api',         status: 'connected', rating: 4.0, review_count: 203 },
    { name: 'Fieldwire Site Inspection',  category: 'field_service',description: 'Mobile punch list and inspection management for field teams.',                             integration_type: 'api',         status: 'available', rating: 4.6, review_count: 578 },
    { name: 'ISO 14001 Compliance Hub',   category: 'compliance',   description: 'Environmental management system compliance tracking and regulatory reporting.',             integration_type: 'file_import', status: 'available', rating: 3.9, review_count: 42  },
  ] as const

  for (const d of demos) {
    await sb.from('marketplace_providers').insert({ tenant_id: DEMO_TENANT, logo_url: null, ...d })
  }
  return {}
}
