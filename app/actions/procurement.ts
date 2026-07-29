'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { requireUser } from '@/lib/auth/guard'
import type { RFQRecord, PORecord, ProcurementDashboard } from '@/lib/types/action-types'

import { getCurrentTenantId } from '@/lib/tenant'
// SOL-2026-001 "Al Dhafra Solar PV - Phase 1". The previous id
// (a1000000-...-001) was a duplicate-code row that has been deleted.
const DEMO_PROJECT = 'ce14ed42-0ea0-43e6-b718-cc2c2cb5283d'

const RFQ_STATUS_COLORS: Record<string, string> = {
  draft:       '#94a3b8',
  issued:      '#3b82f6',
  closed:      '#f59e0b',
  evaluated:   '#a855f7',
  awarded:     '#22c55e',
  cancelled:   '#64748b',
}
const PO_STATUS_COLORS: Record<string, string> = {
  draft:       '#94a3b8',
  issued:      '#3b82f6',
  acknowledged:'#a855f7',
  delivered:   '#22c55e',
  closed:      '#10b981',
  disputed:    '#ef4444',
}

// ─── G3 gate detail page data ─────────────────────────────────────────────────

/** Minimal shapes the G3 tab components expect (mirroring the inline types). */
export interface G3RFQ {
  id: string; code: string; title: string; description: string
  category: string; status: string; value_min: number; value_max: number
  currency: string; bid_deadline: string; evaluation_period_days: number
  publish_date: string | null; invited_vendors: string[]; responded_vendors: string[]
  specifications: { section: string; requirement: string; mandatory: boolean }[]
  evaluation_criteria: { criterion: string; weight: number; max_score: number }[]
  bids: G3Bid[]; created_at: string
}

export interface G3Bid {
  id: string; rfq_id: string; vendor_id: string; vendor_name: string
  total_price: number; currency: string; technical_score: number
  commercial_score: number; delivery_score: number; past_performance_score: number
  total_score: number; rank: number; status: string; submission_date: string
  validity_days: number
  line_items: { code: string; description: string; qty: number; unit: string; unit_price: number; total: number }[]
  clarifications: { date: string; question: string; response: string | null }[]
}

export interface G3PO {
  id: string; code: string; vendor_id: string; vendor_name: string
  description: string; total_amount: number; currency: string; status: string
  delivery_date: string; incoterms: string
  payment_terms: { milestone: string; percentage: number; due_days: number }[]
  line_items: { code: string; description: string; qty: number; unit: string; unit_price: number; total: number }[]
  milestones: { name: string; due_date: string; completed: boolean }[]
  changes: { co_number: string; description: string; value: number; status: string }[]
  created_at: string
}

export interface G3Vendor {
  id: string; code: string; name: string; country: string
  categories: string[]; status: string; qualification_score: number
  projects_completed: number; rating: number
  contacts: { name: string; title: string; email: string; phone: string }[]
  qualifications: { area: string; status: string; expiry: string | null; notes: string }[]
  performance_history: { project: string; year: number; on_time: boolean; quality_score: number; safety_score: number }[]
  documents: { type: string; name: string; expiry: string | null; status: string }[]
}

export interface G3Contract {
  id: string; code: string; vendor_id: string; vendor_name: string
  title: string; type: string; value: number; currency: string
  status: string; start_date: string; end_date: string
  retention_pct: number; created_at: string
  variations: { vo_number: string; description: string; value: number; status: string; submitted_date: string }[]
}

export interface G3DataResult {
  rfqs:      G3RFQ[]
  bids:      G3Bid[]
  pos:       G3PO[]
  vendors:   G3Vendor[]
  contracts: G3Contract[]
}

const RFQ_STATUS_REMAP: Record<string, string> = {
  issued:     'published',
  closed:     'closed',
  evaluated:  'evaluated',
  awarded:    'awarded',
  cancelled:  'cancelled',
  draft:      'draft',
}

/** Loads all procurement data for the G3 gate detail page in one call. */
export async function getG3Data(projectId: string): Promise<G3DataResult> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const [rfqRes, poRes] = await Promise.all([
    supabase
      .from('rfqs')
      .select('id, rfq_number, title, category, status, budget_max, currency, bid_deadline, created_at, organization_name')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_orders')
      .select('id, po_number, vendor_name, description, amount_usd, status, expected_delivery, created_at, organization_name')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  ])

  const rfqs: G3RFQ[] = (rfqRes.data ?? []).map((r) => ({
    id:                    r.id,
    code:                  r.rfq_number ?? r.id.slice(0, 12).toUpperCase(),
    title:                 r.title ?? 'RFQ',
    description:           '',
    category:              r.category ?? 'General',
    status:                RFQ_STATUS_REMAP[r.status ?? 'draft'] ?? 'draft',
    value_min:             0,
    value_max:             Number(r.budget_max ?? 0),
    currency:              r.currency ?? 'USD',
    bid_deadline:          r.bid_deadline ?? '',
    evaluation_period_days:14,
    publish_date:          null,
    invited_vendors:       r.organization_name ? [r.organization_name] : [],
    responded_vendors:     [],
    specifications:        [],
    evaluation_criteria:   [],
    bids:                  [],
    created_at:            r.created_at,
  }))

  const pos: G3PO[] = (poRes.data ?? []).map((p) => ({
    id:            p.id,
    code:          p.po_number ?? p.id.slice(0, 12).toUpperCase(),
    vendor_id:     p.organization_name ?? '',
    vendor_name:   p.vendor_name ?? p.organization_name ?? 'Unknown Vendor',
    description:   p.description ?? '',
    total_amount:  Number(p.amount_usd ?? 0),
    currency:      'USD',
    status:        p.status ?? 'draft',
    delivery_date: p.expected_delivery ?? '',
    incoterms:     'DDP',
    payment_terms: [],
    line_items:    [],
    milestones:    [],
    changes:       [],
    created_at:    p.created_at,
  }))

  // Vendors: aggregate unique vendor names from POs; no dedicated vendors table
  const vendorMap = new Map<string, G3Vendor>()
  for (const p of pos) {
    if (!vendorMap.has(p.vendor_name)) {
      vendorMap.set(p.vendor_name, {
        id:                  p.vendor_id || p.vendor_name,
        code:                `VEN-${String(vendorMap.size + 1).padStart(3, '0')}`,
        name:                p.vendor_name,
        country:             '',
        categories:          [],
        status:              'approved',
        qualification_score: 80,
        projects_completed:  0,
        rating:              4.0,
        contacts:            [],
        qualifications:      [],
        performance_history: [],
        documents:           [],
      })
    }
  }

  return {
    rfqs,
    bids:      [],   // bids not stored separately — nested in rfqs in real use
    pos,
    vendors:   Array.from(vendorMap.values()),
    contracts: [],
  }
}

export async function loadProcurementDashboard(): Promise<ProcurementDashboard> {
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()
  const [rfqRes, poRes] = await Promise.all([
    supabase.from('rfqs')
      .select('id, rfq_number, title, vendor, status, issue_date, close_date, amount_usd, score')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabase.from('purchase_orders')
      .select('id, po_number, vendor, description, amount_usd, status, issued_date, expected_delivery')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
  ])

  const rfqs: RFQRecord[] = (rfqRes.data ?? []).map((r) => ({
    id:         r.id,
    rfq_number: r.rfq_number ?? '',
    title:      r.title ?? '',
    vendor:     r.vendor ?? 'TBD',
    status:     r.status ?? 'draft',
    issue_date: r.issue_date ?? r.id,
    close_date: r.close_date ?? null,
    amount_usd: r.amount_usd ?? 0,
    score:      r.score ?? null,
  }))

  const pos: PORecord[] = (poRes.data ?? []).map((p) => ({
    id:                p.id,
    po_number:         p.po_number ?? '',
    vendor:            p.vendor ?? 'TBD',
    description:       p.description ?? '',
    amount_usd:        p.amount_usd ?? 0,
    status:            p.status ?? 'draft',
    issued_date:       p.issued_date ?? null,
    expected_delivery: p.expected_delivery ?? null,
  }))

  const rfqStatusMap: Record<string, number> = {}
  rfqs.forEach((r) => { rfqStatusMap[r.status] = (rfqStatusMap[r.status] ?? 0) + 1 })

  const vendorMap: Record<string, number> = {}
  pos.forEach((p) => {
    const v = p.vendor.slice(0, 20)
    vendorMap[v] = (vendorMap[v] ?? 0) + p.amount_usd
  })

  return {
    totalRFQs: rfqs.length,
    openRFQs:  rfqs.filter((r) => r.status === 'issued' || r.status === 'draft').length,
    totalPOs:  pos.length,
    poValue:   pos.reduce((s, p) => s + p.amount_usd, 0),
    rfqStatus: Object.entries(rfqStatusMap).map(([name, value]) => ({
      name, value, color: RFQ_STATUS_COLORS[name] ?? '#94a3b8',
    })),
    poByVendor: Object.entries(vendorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value: Math.round(value / 1_000_000) })),
    rfqs, pos,
  }
}

export async function issueRFQ(data: {
  title: string; vendor: string; amount_usd: number; close_date: string; projectId: string
}): Promise<{ error?: string }> {
  try {
    await requireUser()
  } catch (e: any) {
    return { error: 'Unauthorized' }
  }

  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  // Verify projectId exists and belongs to caller's tenant
  const supabase = createAdminClient()
  const { data: project, error: projectErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', data.projectId)
    .eq('tenant_id', tenantId)
    .single()

  if (projectErr || !project) return { error: 'Project not found or access denied' }

  const rfq_number = `RFQ-${Date.now().toString(36).toUpperCase().slice(-6)}`
  const { error } = await supabase.from('rfqs').insert({
    tenant_id:  tenantId,
    project_id: data.projectId,
    rfq_number,
    title:      data.title,
    vendor:     data.vendor,
    amount_usd: data.amount_usd,
    close_date: data.close_date || null,
    issue_date: new Date().toISOString().slice(0, 10),
    status:     'issued',
  })
  return { error: error?.message }
}

export async function advancePOStatus(id: string): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: po } = await supabase.from('purchase_orders').select('status').eq('id', id).single()
  const lifecycle = ['draft', 'issued', 'acknowledged', 'delivered', 'closed']
  const current   = lifecycle.indexOf(po?.status ?? 'draft')
  const next      = lifecycle[current + 1]
  if (!next) return {}
  const { error } = await supabase.from('purchase_orders')
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tenant_id', tenantId)
  return { error: error?.message }
}

export async function updateVendorContactEmail(args: {
  poNumber: string
  newEmail: string
  oldEmail?: string
}): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  
  // Find the PO and update vendor contact info
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, vendor_name, vendor_contact_email')
    .eq('po_number', args.poNumber)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!po) {
    return { error: `Purchase Order ${args.poNumber} not found` }
  }

  // Update the vendor contact email on the PO record
  const { error } = await supabase
    .from('purchase_orders')
    .update({
      vendor_contact_email: args.newEmail,
      vendor_contact_email_updated_at: new Date().toISOString(),
      vendor_contact_email_updated_by: tenantId, // Track who made the change
    })
    .eq('id', po.id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: `Failed to update vendor contact email: ${error.message}` }
  }

  return {}
}

export async function reissueVendorInvite(args: {
  poNumber: string
  vendorName: string
  newEmail: string
  oldEmail?: string
  siteUrl: string
}): Promise<{ error?: string; inviteLink?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // First, update the vendor contact email on the PO record
  const updateResult = await updateVendorContactEmail({
    poNumber: args.poNumber,
    newEmail: args.newEmail,
    oldEmail: args.oldEmail,
  })

  if (updateResult.error) {
    return updateResult
  }

  // Then, find or create the external user and send invite
  // Check if a profile exists for the new email
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', args.newEmail)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  let userId: string

  if (existing) {
    // User already exists — update their role to subcontractor if needed
    if (existing.role !== 'subcontractor') {
      await supabase
        .from('profiles')
        .update({ role: 'subcontractor' })
        .eq('id', existing.id)
    }
    userId = existing.id
  } else {
    // Invite via Supabase Auth (sends magic link if SMTP configured)
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      args.newEmail,
      {
        data: {
          role: 'subcontractor',
          tenant_id: tenantId,
          organization_name: args.vendorName,
          full_name: args.vendorName,
        },
        redirectTo: `${args.siteUrl}/auth/callback?next=/portal`,
      },
    )

    if (inviteErr || !inviteData?.user) {
      return { error: inviteErr?.message ?? 'Failed to invite vendor user' }
    }
    userId = inviteData.user.id

    // Ensure the profile row exists
    await supabase.from('profiles').upsert({
      id: userId,
      tenant_id: tenantId,
      email: args.newEmail,
      full_name: args.vendorName,
      role: 'subcontractor',
      is_active: true,
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  // Generate a fallback action link for copy/share if email not sent
  let inviteLink: string | undefined
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: args.newEmail,
    options: { redirectTo: `${args.siteUrl}/auth/callback?next=/portal` },
  })
  if (linkData?.properties?.action_link) {
    inviteLink = linkData.properties.action_link
  }

  // Grant project access (find projects associated with this PO)
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('project_id')
    .eq('po_number', args.poNumber)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (po?.project_id) {
    await supabase.from('external_access').upsert({
      tenant_id: tenantId,
      user_id: userId,
      project_id: po.project_id,
      organization_name: args.vendorName,
      revoked_at: null,
    }, { onConflict: 'user_id,project_id', ignoreDuplicates: false })
  }

  return { inviteLink }
}

export async function seedProcurementDemoData(): Promise<{ error?: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()
  const { data: ex } = await supabase.from('rfqs').select('id').eq('tenant_id', tenantId).limit(1)
  if ((ex?.length ?? 0) > 0) return {}

  const rfqData = [
    { rfq_number: 'RFQ-2026-001', title: 'Solar PV Modules Supply', vendor: 'Jinko Solar', amount_usd: 45_000_000, status: 'awarded', score: 88 },
    { rfq_number: 'RFQ-2026-002', title: 'String Inverters Supply', vendor: 'Huawei FusionSolar', amount_usd: 12_000_000, status: 'evaluated', score: 91 },
    { rfq_number: 'RFQ-2026-003', title: 'MV Switchgear', vendor: 'ABB', amount_usd: 8_500_000, status: 'issued', score: null },
    { rfq_number: 'RFQ-2026-004', title: 'DC Cable Supply', vendor: 'Prysmian Group', amount_usd: 6_200_000, status: 'closed', score: 85 },
    { rfq_number: 'RFQ-2026-005', title: 'Civil Works Subcontract', vendor: 'Al Futtaim Carillion', amount_usd: 38_000_000, status: 'draft', score: null },
  ]
  for (const d of rfqData) {
    await supabase.from('rfqs').insert({
      tenant_id: tenantId, project_id: DEMO_PROJECT,
      issue_date: '2026-03-01', close_date: '2026-04-15', ...d,
    })
  }

  const poData = [
    { po_number: 'PO-2026-001', vendor: 'Jinko Solar',           description: 'Solar PV modules — 400MW',        amount_usd: 45_000_000, status: 'acknowledged', issued_date: '2026-05-01', expected_delivery: '2026-09-30' },
    { po_number: 'PO-2026-002', vendor: 'Huawei FusionSolar',    description: '1500V string inverters',           amount_usd: 12_000_000, status: 'issued',       issued_date: '2026-05-15', expected_delivery: '2026-08-31', vendor_contact_email: 'procurement@petrasolar.jo' },
    { po_number: 'PO-2026-003', vendor: 'Prysmian Group',        description: '1500V DC cables, 120mm²',         amount_usd: 6_200_000,  status: 'delivered',    issued_date: '2026-04-20', expected_delivery: '2026-07-15' },
    { po_number: 'PO-2026-004', vendor: 'Al Futtaim Carillion',  description: 'Foundation civil works Zone A–C',  amount_usd: 15_000_000, status: 'draft',        issued_date: null,         expected_delivery: null         },
  ]
  for (const d of poData) {
    await supabase.from('purchase_orders').insert({
      tenant_id: tenantId, project_id: DEMO_PROJECT, ...d,
    })
  }
  return {}
}
