'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import type {
  HseDashboard, HseIncident, HsePermit,
  HseIncidentSeverity, HseIncidentStatus, HsePermitStatus,
} from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'

export async function getHseDashboard(tenantId: string = tenantId): Promise<HseDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [{ data: incRows }, { data: permRows }] = await Promise.all([
    supabase
      .from('hse_incidents')
      .select('id, ref, title, project_code, severity, status, incident_date, reported_by, location, description, action_count, closed_actions, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase
      .from('hse_permits')
      .select('id, ref, type, scope, project_code, issued_to, issued_date, expiry_date, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ])

  const incidents: HseIncident[] = (incRows ?? []).map((r) => ({
    id:           r.id,
    ref:          r.ref ?? `INC-${r.id.slice(0, 4).toUpperCase()}`,
    title:        r.title ?? 'Unnamed incident',
    projectCode:  r.project_code ?? '—',
    severity:     (r.severity as HseIncidentSeverity) ?? 'observation',
    status:       (r.status as HseIncidentStatus) ?? 'open',
    date:         r.incident_date ?? '',
    reportedBy:   r.reported_by ?? 'Unassigned',
    location:     r.location ?? '—',
    description:  r.description ?? '',
    actionCount:  r.action_count ?? 0,
    closedActions:r.closed_actions ?? 0,
  }))

  const permits: HsePermit[] = (permRows ?? []).map((r) => ({
    id:          r.id,
    ref:         r.ref ?? `PTW-${r.id.slice(0, 4).toUpperCase()}`,
    type:        r.type ?? 'General',
    scope:       r.scope ?? '',
    projectCode: r.project_code ?? '—',
    issuedTo:    r.issued_to ?? 'Unassigned',
    issuedDate:  r.issued_date ?? '',
    expiryDate:  r.expiry_date ?? '',
    status:      (r.status as HsePermitStatus) ?? 'pending',
  }))

  return { incidents, permits }
}

export async function createHseIncident(data: {
  const tenantId = await getCurrentTenantId()
  title: string; projectCode: string; severity: HseIncidentSeverity
  reportedBy: string; location: string; description: string
  actionCount?: number; closedActions?: number
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const ref = `INC-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('hse_incidents').insert({
    tenant_id:     tenantId,
    ref,
    title:         data.title,
    project_code:  data.projectCode,
    severity:      data.severity,
    status:        'open',
    incident_date: new Date().toISOString().slice(0, 10),
    reported_by:   data.reportedBy,
    location:      data.location,
    description:   data.description,
    action_count:  data.actionCount ?? 0,
    closed_actions:data.closedActions ?? 0,
  })
  revalidatePath('/hse')
  return { error: error?.message }
}

export async function updateHseIncidentStatus(id: string, status: HseIncidentStatus): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('hse_incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  revalidatePath('/hse')
  return { error: error?.message }
}

export async function createHsePermit(data: {
  const tenantId = await getCurrentTenantId()
  type: string; scope: string; projectCode: string
  issuedTo: string; issuedDate: string; expiryDate: string
}): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const ref = `PTW-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('hse_permits').insert({
    tenant_id:    tenantId,
    ref,
    type:         data.type,
    scope:        data.scope,
    project_code: data.projectCode,
    issued_to:    data.issuedTo,
    issued_date:  data.issuedDate,
    expiry_date:  data.expiryDate,
    status:       'pending',
  })
  revalidatePath('/hse')
  return { error: error?.message }
}

export async function updateHsePermitStatus(id: string, status: HsePermitStatus): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('hse_permits')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  revalidatePath('/hse')
  return { error: error?.message }
}

export async function seedHseDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('hse_incidents').select('id').eq('tenant_id', tenantId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const incidents = [
    { ref: 'NM-22',  title: 'Scaffolding Collapse — Grid Connection Point', project_code: 'CRS-150', severity: 'near-miss',   status: 'under-investigation', incident_date: '19 Jul 2025', reported_by: 'L. Schmidt',  location: 'Zone 4 — Turbine Row C',     description: 'Scaffolding section collapsed during high-wind event (45km/h). No injuries. Root cause: weather monitoring protocol gap identified.', action_count: 5, closed_actions: 2 },
    { ref: 'OBS-47', title: 'Unsecured Tools on Elevated Platform',         project_code: 'SRS-400', severity: 'observation', status: 'closed',              incident_date: '17 Jul 2025', reported_by: 'M. Al-Farsi', location: 'Inverter Station B',          description: 'Tools not secured to tool lanyards on platform at 4.5m elevation. Corrected on-site immediately.', action_count: 1, closed_actions: 1 },
    { ref: 'MTC-08', title: 'Hand Laceration — Wire Rope Handling',         project_code: 'NOV-600', severity: 'mtc',         status: 'closed',              incident_date: '12 Jul 2025', reported_by: 'T. Müller',   location: 'Offshore Platform Alpha',     description: 'Worker sustained laceration to left hand while handling wire rope without cut-resistant gloves. First aid administered. Returned to duty same day.', action_count: 3, closed_actions: 3 },
    { ref: 'OBS-44', title: 'Missing Barricading Around Excavation',        project_code: 'ATL-300', severity: 'observation', status: 'closed',              incident_date: '08 Jul 2025', reported_by: 'J. Rivera',   location: 'Cable Trench Section 12',     description: 'Open excavation trench lacked adequate barricading at site entrance. Barriers reinstated immediately.', action_count: 2, closed_actions: 2 },
    { ref: 'NM-21',  title: 'Near-Miss — Crane Swing Arc Intrusion',       project_code: 'ORN-180', severity: 'near-miss',   status: 'open',                incident_date: '02 Jul 2025', reported_by: 'A. Patel',    location: 'Assembly Area Row 7',         description: 'Personnel entered crane exclusion zone during tower section lift. No contact made. Exclusion zone protocol under review.', action_count: 4, closed_actions: 1 },
  ]

  const permits = [
    { ref: 'PTW-4801', type: 'Work at Height',       scope: 'Scaffold erection — Zone A',        project_code: 'SRS-400', issued_to: 'M. Al-Farsi', issued_date: '20 Jul 2025', expiry_date: '21 Jul 2025', status: 'active'    },
    { ref: 'PTW-4799', type: 'Confined Space',       scope: 'Inverter pit inspection',           project_code: 'SRS-400', issued_to: 'R. Chen',     issued_date: '19 Jul 2025', expiry_date: '19 Jul 2025', status: 'expired'   },
    { ref: 'PTW-4795', type: 'Hot Work',             scope: 'Welding — substation frame',        project_code: 'ATL-300', issued_to: 'J. Rivera',   issued_date: '18 Jul 2025', expiry_date: '18 Jul 2025', status: 'expired'   },
    { ref: 'PTW-4810', type: 'Electrical Isolation', scope: 'MV switchgear maintenance',         project_code: 'SRS-400', issued_to: 'M. Al-Farsi', issued_date: '20 Jul 2025', expiry_date: '22 Jul 2025', status: 'active'    },
    { ref: 'PTW-4780', type: 'Excavation',           scope: 'Cable trench section 14-18',        project_code: 'CRS-150', issued_to: 'L. Schmidt',  issued_date: '15 Jul 2025', expiry_date: '17 Jul 2025', status: 'cancelled' },
    { ref: 'PTW-4815', type: 'Marine Operations',    scope: 'Foundation installation vessel ops', project_code: 'NOV-600', issued_to: 'T. Müller',   issued_date: '21 Jul 2025', expiry_date: '25 Jul 2025', status: 'pending'   },
  ]

  for (const d of incidents) {
    await supabase.from('hse_incidents').insert({ tenant_id: tenantId, ...d })
  }
  for (const p of permits) {
    await supabase.from('hse_permits').insert({ tenant_id: tenantId, ...p })
  }

  revalidatePath('/hse')
  return {}
}
