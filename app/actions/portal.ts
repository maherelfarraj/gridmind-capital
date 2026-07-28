'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
const PORTAL_BUCKET = 'portal-uploads'

// Internal roles notified about partner actions.
const SUPPLY_CHAIN_ROLES = ['commercial_manager', 'project_manager', 'project_director', 'tenant_admin', 'system_admin']
const FINANCE_ROLES = ['finance_manager', 'commercial_manager', 'project_director', 'tenant_admin', 'system_admin']

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PortalActor {
  userId: string
  tenantId: string
  organizationName: string
  fullName: string
  email: string
  role: string
  projectIds: string[]
}

export interface PortalProject {
  id: string
  code: string
  name: string
  technology: string | null
  location: string | null
}

export interface PortalKpis {
  openPos: number
  invoicesSubmitted: number
  invoicesPaid: number
  pendingRfqs: number
}

export interface PortalHome {
  organizationName: string
  fullName: string
  projects: PortalProject[]
  kpis: PortalKpis
}

export type PoStatus = 'issued' | 'acknowledged' | 'delivered' | 'closed'

export interface PortalPO {
  id: string
  po_number: string
  project_id: string
  project_code: string
  project_name: string
  description: string | null
  amount: number
  currency: string
  issue_date: string | null
  delivery_date: string | null
  status: PoStatus
  delivery_address: string | null
  acknowledged_at: string | null
}

export interface PortalPOLine {
  id: string
  line_no: number
  description: string
  quantity: number
  unit: string
  unit_price: number
  amount: number
}

export type InvoiceStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid'

export interface PortalInvoice {
  id: string
  invoice_ref: string
  po_id: string | null
  po_number: string | null
  project_id: string
  amount: number
  currency: string
  invoice_date: string | null
  status: InvoiceStatus
  notes: string | null
  pdf_path: string | null
  created_at: string
}

export interface PortalDeliveryDoc {
  id: string
  po_id: string
  po_number: string | null
  doc_type: string
  file_name: string
  storage_path: string
  notes: string | null
  created_at: string
}

export type RfqStatus = 'open' | 'closed' | 'awarded'

export interface PortalRfq {
  id: string
  rfq_number: string
  title: string
  scope_summary: string | null
  project_id: string
  project_code: string
  close_date: string | null
  status: RfqStatus
  responded: boolean
  response: PortalRfqResponse | null
}

export interface PortalRfqResponse {
  id: string
  rfq_id: string
  price: number
  currency: string
  validity_days: number
  notes: string | null
  attachment_path: string | null
  status: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Actor resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the current partner-portal actor. Returns null when the user is not
 * authenticated or is not an external (subcontractor) role — callers redirect.
 */
export async function getPortalActor(): Promise<PortalActor | null> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id, role, full_name, email')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'subcontractor') {
      console.log('[v0] Portal access denied:', {
        hasProfile: !!profile,
        role: profile?.role,
        userId: user.id,
      })
      return null
    }

    const { data: grants } = await admin
      .from('external_access')
      .select('project_id, organization_name')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    const projectIds = (grants ?? []).map((g) => g.project_id)
    const organizationName = grants?.[0]?.organization_name ?? ''

    return {
      userId: user.id,
      tenantId: profile.tenant_id ?? tenantId,
      organizationName,
      fullName: profile.full_name ?? '',
      email: profile.email ?? user.email ?? '',
      role: profile.role,
      projectIds,
    }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// Internal helpers (audit + notify)
// ─────────────────────────────────────────────────────────────

async function logPortalEvent(admin: ReturnType<typeof createAdminClient>, args: {
  actorId: string
  transition: string
  from?: string | null
  to?: string | null
  projectId: string | null
  objectType: string
  objectId: string
  metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: args.from ?? null,
    to_state: args.to ?? null,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: null,
    metadata: {
      module: 'portal',
      object_type: args.objectType,
      object_id: args.objectId,
      project_id: args.projectId,
      ...args.metadata,
    },
  })
}

async function notifyInternal(admin: ReturnType<typeof createAdminClient>, args: {
  tenantId: string
  roles: string[]
  title: string
  body: string
  link: string
  type?: string
}) {
  const tenantId = await getCurrentTenantId()
  const { data: recipients } = await admin
    .from('profiles')
    .select('id')
    .eq('tenant_id', args.tenantId)
    .eq('is_active', true)
    .in('role', [...new Set(args.roles)])

  if (!recipients?.length) return
  await admin.from('notifications').insert(
    recipients.map((r) => ({
      user_id: r.id,
      tenant_id: args.tenantId,
      title: args.title,
      body: args.body,
      type: args.type ?? 'approval',
      channel: 'in_app',
      link: args.link,
    })),
  )
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v)
}

// ─────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────

export async function getPortalHome(): Promise<PortalHome | null> {
  const actor = await getPortalActor()
  if (!actor) return null
  const admin = createAdminClient()

  const projectIds = actor.projectIds
  const projects: PortalProject[] = []
  if (projectIds.length) {
    const { data } = await admin
      .from('projects')
      .select('id, code, name, technology, location')
      .in('id', projectIds)
      .order('code', { ascending: true })
    for (const p of data ?? []) {
      projects.push({
        id: p.id, code: p.code, name: p.name,
        technology: p.technology ?? null, location: p.location ?? null,
      })
    }
  }

  // KPI counts scoped to this organization.
  const org = actor.organizationName
  const [posRes, invRes, paidRes, rfqRes] = await Promise.all([
    admin.from('purchase_orders').select('id', { count: 'exact', head: true })
      .eq('organization_name', org).in('status', ['issued', 'acknowledged']),
    admin.from('portal_invoices').select('id', { count: 'exact', head: true })
      .eq('submitted_by', actor.userId),
    admin.from('portal_invoices').select('id', { count: 'exact', head: true })
      .eq('submitted_by', actor.userId).eq('status', 'paid'),
    admin.from('rfqs').select('id', { count: 'exact', head: true })
      .eq('organization_name', org).eq('status', 'open'),
  ])

  return {
    organizationName: org,
    fullName: actor.fullName,
    projects,
    kpis: {
      openPos: posRes.count ?? 0,
      invoicesSubmitted: invRes.count ?? 0,
      invoicesPaid: paidRes.count ?? 0,
      pendingRfqs: rfqRes.count ?? 0,
    },
  }
}

// ─────────────────────────────────────────────────────────────
// Purchase Orders
// ─────────────────────────────────────────────────────────────

export async function getPortalPurchaseOrders(): Promise<PortalPO[]> {
  const actor = await getPortalActor()
  if (!actor) return []
  const admin = createAdminClient()

  const { data } = await admin
    .from('purchase_orders')
    .select('*, projects(code, name)')
    .eq('organization_name', actor.organizationName)
    .in('project_id', actor.projectIds.length ? actor.projectIds : ['00000000-0000-0000-0000-000000000000'])
    .order('issue_date', { ascending: false })

  return (data ?? []).map((r) => {
    const proj = r.projects as unknown as { code: string; name: string } | null
    return {
      id: r.id,
      po_number: r.po_number,
      project_id: r.project_id,
      project_code: proj?.code ?? '',
      project_name: proj?.name ?? '',
      description: r.description ?? null,
      amount: num(r.amount),
      currency: r.currency ?? 'USD',
      issue_date: r.issue_date ?? null,
      delivery_date: r.delivery_date ?? null,
      status: (r.status ?? 'issued') as PoStatus,
      delivery_address: r.delivery_address ?? null,
      acknowledged_at: r.acknowledged_at ?? null,
    }
  })
}

export async function getPortalPurchaseOrder(id: string): Promise<{ po: PortalPO; lines: PortalPOLine[] } | null> {
  const actor = await getPortalActor()
  if (!actor) return null
  const admin = createAdminClient()

  const { data: r } = await admin
    .from('purchase_orders')
    .select('*, projects(code, name)')
    .eq('id', id)
    .eq('organization_name', actor.organizationName)
    .maybeSingle()
  if (!r) return null

  const proj = r.projects as unknown as { code: string; name: string } | null
  const po: PortalPO = {
    id: r.id,
    po_number: r.po_number,
    project_id: r.project_id,
    project_code: proj?.code ?? '',
    project_name: proj?.name ?? '',
    description: r.description ?? null,
    amount: num(r.amount),
    currency: r.currency ?? 'USD',
    issue_date: r.issue_date ?? null,
    delivery_date: r.delivery_date ?? null,
    status: (r.status ?? 'issued') as PoStatus,
    delivery_address: r.delivery_address ?? null,
    acknowledged_at: r.acknowledged_at ?? null,
  }

  const { data: lineRows } = await admin
    .from('purchase_order_lines')
    .select('*')
    .eq('po_id', id)
    .order('line_no', { ascending: true })

  const lines: PortalPOLine[] = (lineRows ?? []).map((l) => ({
    id: l.id,
    line_no: l.line_no,
    description: l.description,
    quantity: num(l.quantity),
    unit: l.unit,
    unit_price: num(l.unit_price),
    amount: num(l.amount),
  }))

  return { po, lines }
}

export async function acknowledgePurchaseOrder(id: string): Promise<{ error?: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  const admin = createAdminClient()

  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, po_number, status, project_id, organization_name')
    .eq('id', id)
    .eq('organization_name', actor.organizationName)
    .maybeSingle()
  if (!po) return { error: 'Purchase order not found' }
  if (po.status !== 'issued') return { error: 'Only issued POs can be acknowledged' }

  const { error } = await admin
    .from('purchase_orders')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: actor.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { error: error.message }

  await logPortalEvent(admin, {
    actorId: actor.userId,
    transition: 'PO_ACKNOWLEDGED',
    from: 'issued', to: 'acknowledged',
    projectId: po.project_id,
    objectType: 'purchase_order',
    objectId: id,
    metadata: { po_number: po.po_number, organization_name: actor.organizationName },
  })
  await notifyInternal(admin, {
    tenantId: actor.tenantId,
    roles: SUPPLY_CHAIN_ROLES,
    title: `PO ${po.po_number} acknowledged`,
    body: `${actor.organizationName} acknowledged purchase order ${po.po_number}.`,
    link: `/procurement/purchase-orders`,
    type: 'approval',
  })

  revalidatePath('/portal/pos')
  revalidatePath('/portal')
  return {}
}

// ─────────────────────────────────────────────────────────────
// Uploads (shared signed-URL flow)
// ─────────────────────────────────────────────────────────────

async function ensurePortalBucket() {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === PORTAL_BUCKET)) {
    await admin.storage.createBucket(PORTAL_BUCKET, {
      public: false,
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      fileSizeLimit: 26214400, // 25 MB
    })
  }
}

export async function createPortalUploadUrl(kind: 'invoices' | 'deliveries' | 'rfqs', fileName: string):
  Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  await ensurePortalBucket()
  const admin = createAdminClient()

  const orgSlug = (actor.organizationName || 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const storagePath = `${kind}/${orgSlug}/${Date.now()}-${fileName}`
  const { data, error } = await admin.storage.from(PORTAL_BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data) return { error: error?.message ?? 'Could not create upload URL' }
  return { uploadUrl: data.signedUrl, storagePath }
}

export async function getPortalFileUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(PORTAL_BUCKET).createSignedUrl(storagePath, 300)
  if (error || !data) return { error: error?.message ?? 'Could not create download URL' }
  return { url: data.signedUrl }
}

// ─────────────────────────────────────────────────────────────
// Invoices
// ─────────────────────────────────�����──────────────────────────��

export async function getPortalInvoices(): Promise<PortalInvoice[]> {
  const actor = await getPortalActor()
  if (!actor) return []
  const admin = createAdminClient()

  const { data } = await admin
    .from('portal_invoices')
    .select('*, purchase_orders(po_number)')
    .eq('submitted_by', actor.userId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    invoice_ref: r.invoice_ref,
    po_id: r.po_id ?? null,
    po_number: (r.purchase_orders as unknown as { po_number: string } | null)?.po_number ?? null,
    project_id: r.project_id,
    amount: num(r.amount),
    currency: r.currency ?? 'USD',
    invoice_date: r.invoice_date ?? null,
    status: (r.status ?? 'submitted') as InvoiceStatus,
    notes: r.notes ?? null,
    pdf_path: r.pdf_path ?? null,
    created_at: r.created_at,
  }))
}

export async function submitPortalInvoice(args: {
  poId: string
  invoiceRef: string
  amount: number
  invoiceDate: string
  currency?: string
  notes?: string
  pdfPath?: string
}): Promise<{ error?: string; id?: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  if (!args.invoiceRef?.trim()) return { error: 'Invoice number is required' }
  if (!args.amount || args.amount <= 0) return { error: 'A valid amount is required' }
  const admin = createAdminClient()

  // Validate the PO belongs to this org.
  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, po_number, project_id, organization_name')
    .eq('id', args.poId)
    .eq('organization_name', actor.organizationName)
    .maybeSingle()
  if (!po) return { error: 'Select a valid purchase order' }

  const { data, error } = await admin
    .from('portal_invoices')
    .insert({
      tenant_id: actor.tenantId,
      project_id: po.project_id,
      submitted_by: actor.userId,
      po_id: po.id,
      invoice_ref: args.invoiceRef.trim(),
      amount: args.amount,
      currency: args.currency ?? 'USD',
      invoice_date: args.invoiceDate || null,
      period_label: args.invoiceDate ? args.invoiceDate.slice(0, 7) : '',
      status: 'submitted',
      notes: args.notes?.trim() || null,
      pdf_path: args.pdfPath ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to submit invoice' }

  await logPortalEvent(admin, {
    actorId: actor.userId,
    transition: 'INVOICE_SUBMITTED',
    to: 'submitted',
    projectId: po.project_id,
    objectType: 'portal_invoice',
    objectId: data.id,
    metadata: { invoice_ref: args.invoiceRef, po_number: po.po_number, amount: args.amount, organization_name: actor.organizationName },
  })
  await notifyInternal(admin, {
    tenantId: actor.tenantId,
    roles: FINANCE_ROLES,
    title: `Invoice ${args.invoiceRef} submitted`,
    body: `${actor.organizationName} submitted invoice ${args.invoiceRef} against PO ${po.po_number}.`,
    link: `/projects/${po.project_id}/cash-flow`,
    type: 'approval',
  })

  revalidatePath('/portal/invoices')
  revalidatePath('/portal')
  return { id: data.id }
}

// ─────────────────────────────────────────────────────────────
// Delivery documents
// ─────────────────────────────────────────────────────────────

export async function getPortalDeliveryDocs(poId?: string): Promise<PortalDeliveryDoc[]> {
  const actor = await getPortalActor()
  if (!actor) return []
  const admin = createAdminClient()

  let q = admin
    .from('delivery_documents')
    .select('*, purchase_orders(po_number)')
    .eq('submitted_by', actor.userId)
    .order('created_at', { ascending: false })
  if (poId) q = q.eq('po_id', poId)

  const { data } = await q
  return (data ?? []).map((r) => ({
    id: r.id,
    po_id: r.po_id,
    po_number: (r.purchase_orders as unknown as { po_number: string } | null)?.po_number ?? null,
    doc_type: r.doc_type,
    file_name: r.file_name,
    storage_path: r.storage_path,
    notes: r.notes ?? null,
    created_at: r.created_at,
  }))
}

export async function submitDeliveryDocument(args: {
  poId: string
  docType: 'delivery_note' | 'packing_list'
  fileName: string
  storagePath: string
  notes?: string
}): Promise<{ error?: string; id?: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  const admin = createAdminClient()

  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, po_number, project_id, organization_name')
    .eq('id', args.poId)
    .eq('organization_name', actor.organizationName)
    .maybeSingle()
  if (!po) return { error: 'Select a valid purchase order' }

  const { data, error } = await admin
    .from('delivery_documents')
    .insert({
      tenant_id: actor.tenantId,
      po_id: po.id,
      project_id: po.project_id,
      organization_name: actor.organizationName,
      submitted_by: actor.userId,
      doc_type: args.docType,
      file_name: args.fileName,
      storage_path: args.storagePath,
      notes: args.notes?.trim() || null,
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'Failed to upload document' }

  await logPortalEvent(admin, {
    actorId: actor.userId,
    transition: 'DELIVERY_DOC_UPLOADED',
    projectId: po.project_id,
    objectType: 'delivery_document',
    objectId: data.id,
    metadata: { po_number: po.po_number, doc_type: args.docType, file_name: args.fileName, organization_name: actor.organizationName },
  })
  await notifyInternal(admin, {
    tenantId: actor.tenantId,
    roles: SUPPLY_CHAIN_ROLES,
    title: `Delivery document for PO ${po.po_number}`,
    body: `${actor.organizationName} uploaded a ${args.docType.replace('_', ' ')} for PO ${po.po_number}.`,
    link: `/procurement/purchase-orders`,
    type: 'approval',
  })

  revalidatePath('/portal/pos')
  return { id: data.id }
}

// ─────────────────────────────────────────────────────────────
// RFQs
// ─────────────────────────────────────────────────────────────

export async function getPortalRfqs(): Promise<PortalRfq[]> {
  const actor = await getPortalActor()
  if (!actor) return []
  const admin = createAdminClient()

  const { data } = await admin
    .from('rfqs')
    .select('*, projects(code)')
    .eq('organization_name', actor.organizationName)
    .in('project_id', actor.projectIds.length ? actor.projectIds : ['00000000-0000-0000-0000-000000000000'])
    .order('close_date', { ascending: true })

  const rfqs = data ?? []
  if (!rfqs.length) return []

  const { data: responses } = await admin
    .from('rfq_responses')
    .select('*')
    .eq('submitted_by', actor.userId)
    .in('rfq_id', rfqs.map((r) => r.id))

  const respByRfq = new Map<string, PortalRfqResponse>()
  for (const r of responses ?? []) {
    respByRfq.set(r.rfq_id, {
      id: r.id,
      rfq_id: r.rfq_id,
      price: num(r.price),
      currency: r.currency ?? 'USD',
      validity_days: r.validity_days ?? 30,
      notes: r.notes ?? null,
      attachment_path: r.attachment_path ?? null,
      status: r.status ?? 'submitted',
      created_at: r.created_at,
    })
  }

  return rfqs.map((r) => {
    const response = respByRfq.get(r.id) ?? null
    return {
      id: r.id,
      rfq_number: r.rfq_number,
      title: r.title,
      scope_summary: r.scope_summary ?? null,
      project_id: r.project_id,
      project_code: (r.projects as unknown as { code: string } | null)?.code ?? '',
      close_date: r.close_date ?? null,
      status: (r.status ?? 'open') as RfqStatus,
      responded: response !== null,
      response,
    }
  })
}

export async function submitRfqResponse(args: {
  rfqId: string
  price: number
  validityDays: number
  currency?: string
  notes?: string
  attachmentPath?: string
}): Promise<{ error?: string; id?: string }> {
  const actor = await getPortalActor()
  if (!actor) return { error: 'Not authorized' }
  if (!args.price || args.price <= 0) return { error: 'A valid price is required' }
  const admin = createAdminClient()

  const { data: rfq } = await admin
    .from('rfqs')
    .select('id, rfq_number, title, project_id, organization_name, status')
    .eq('id', args.rfqId)
    .eq('organization_name', actor.organizationName)
    .maybeSingle()
  if (!rfq) return { error: 'RFQ not found' }
  if (rfq.status !== 'open') return { error: 'This RFQ is no longer open for responses' }

  // Prevent duplicate response — update if one exists.
  const { data: existing } = await admin
    .from('rfq_responses')
    .select('id')
    .eq('rfq_id', args.rfqId)
    .eq('submitted_by', actor.userId)
    .maybeSingle()

  const payload = {
    tenant_id: actor.tenantId,
    rfq_id: args.rfqId,
    organization_name: actor.organizationName,
    submitted_by: actor.userId,
    price: args.price,
    currency: args.currency ?? 'USD',
    validity_days: args.validityDays || 30,
    notes: args.notes?.trim() || null,
    attachment_path: args.attachmentPath ?? null,
    status: 'submitted',
  }

  let responseId: string
  if (existing) {
    const { data, error } = await admin.from('rfq_responses').update(payload).eq('id', existing.id).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to update response' }
    responseId = data.id
  } else {
    const { data, error } = await admin.from('rfq_responses').insert(payload).select('id').single()
    if (error || !data) return { error: error?.message ?? 'Failed to submit response' }
    responseId = data.id
  }

  await logPortalEvent(admin, {
    actorId: actor.userId,
    transition: existing ? 'RFQ_RESPONSE_UPDATED' : 'RFQ_RESPONSE_SUBMITTED',
    to: 'submitted',
    projectId: rfq.project_id,
    objectType: 'rfq_response',
    objectId: responseId,
    metadata: { rfq_number: rfq.rfq_number, price: args.price, organization_name: actor.organizationName },
  })
  await notifyInternal(admin, {
    tenantId: actor.tenantId,
    roles: SUPPLY_CHAIN_ROLES,
    title: `RFQ response — ${rfq.rfq_number}`,
    body: `${actor.organizationName} submitted a quote for RFQ ${rfq.rfq_number} (${rfq.title}).`,
    link: `/procurement/rfqs`,
    type: 'approval',
  })

  revalidatePath('/portal/rfqs')
  revalidatePath('/portal')
  return { id: responseId }
}

// ─────────────────────────────────────────────────────────────
// PO options (for invoice / delivery dropdowns)
// ─────────────────────────────────────────────────────────────

export async function getPortalPoOptions(): Promise<{ id: string; po_number: string; project_code: string }[]> {
  const pos = await getPortalPurchaseOrders()
  return pos.map((p) => ({ id: p.id, po_number: p.po_number, project_code: p.project_code }))
}

// ─────────────────────────────────────────────────────────────
// Demo seeding (internal admin only) — creates POs + RFQs for an
// organization on a project so an invited partner sees live data.
// ─────────────────────────────────────────────────────────────

export async function seedPortalDemo(args: {
  projectId: string
  organizationName: string
}): Promise<{ error?: string; pos?: number; rfqs?: number }> {
  // Internal-only guard.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('role, tenant_id').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null
  const INTERNAL = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'commercial_manager']
  if (role && !INTERNAL.includes(role)) return { error: 'Only internal managers can seed demo data' }

  const tenantId = profile?.tenant_id ?? await getCurrentTenantId()
  const org = args.organizationName.trim()
  if (!org) return { error: 'Organization name is required' }

  const stamp = Date.now().toString().slice(-4)

  // Purchase orders + line items.
  const poSeeds = [
    { num: `PO-${stamp}-001`, status: 'issued',       amount: 480000, desc: 'MV switchgear supply — 33kV package', addr: 'Site laydown yard, Gate 2, Sirius Solar Park' },
    { num: `PO-${stamp}-002`, status: 'acknowledged', amount: 215000, desc: 'DC combiner boxes and string cabling', addr: 'Warehouse B, Sirius Solar Park' },
  ]
  let poCount = 0
  for (const s of poSeeds) {
    const { data: po } = await admin.from('purchase_orders').insert({
      tenant_id: tenantId,
      project_id: args.projectId,
      po_number: s.num,
      vendor_name: org,
      organization_name: org,
      status: s.status,
      amount: s.amount,
      currency: 'USD',
      issue_date: new Date().toISOString().slice(0, 10),
      delivery_date: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
      description: s.desc,
      delivery_address: s.addr,
      acknowledged_at: s.status === 'acknowledged' ? new Date().toISOString() : null,
    }).select('id').single()
    if (po) {
      poCount++
      await admin.from('purchase_order_lines').insert([
        { po_id: po.id, line_no: 1, description: s.desc, quantity: 1, unit: 'lot', unit_price: s.amount * 0.7, amount: s.amount * 0.7 },
        { po_id: po.id, line_no: 2, description: 'Installation & commissioning support', quantity: 10, unit: 'day', unit_price: (s.amount * 0.3) / 10, amount: s.amount * 0.3 },
      ])
    }
  }

  // RFQs.
  const rfqSeeds = [
    { num: `RFQ-${stamp}-001`, title: 'Balance of plant civil works', scope: 'Access roads, foundations, and drainage for the 400MW array.' },
    { num: `RFQ-${stamp}-002`, title: 'HV cable termination services', scope: 'Termination and testing of 33kV cables at the substation interface.' },
  ]
  let rfqCount = 0
  for (const r of rfqSeeds) {
    const { data: rfq } = await admin.from('rfqs').insert({
      tenant_id: tenantId,
      project_id: args.projectId,
      rfq_number: r.num,
      title: r.title,
      organization_name: org,
      scope_summary: r.scope,
      status: 'open',
      issue_date: new Date().toISOString().slice(0, 10),
      close_date: new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10),
    }).select('id').single()
    if (rfq) rfqCount++
  }

  revalidatePath('/portal')
  return { pos: poCount, rfqs: rfqCount }
}
