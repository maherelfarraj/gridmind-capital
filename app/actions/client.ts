'use server'

/**
 * Client portal for GridMind Capital.
 *
 * Strictly READ-ONLY surface for users with the `client_viewer` role, built on
 * the external_access foundation. Every read is scoped in code to the projects
 * the client has an active external_access grant on. The only write a client can
 * perform is an "information request" (a message that notifies the PM).
 *
 * Deliberate omissions (client-safe): no internal comments, no assignee names
 * (department/discipline labels only), no cost figures unless a VO is explicitly
 * flagged client_cost_visible, no escalation levels, no internal notes, and only
 * ISSUED (non-draft) client reports.
 *
 * Audit: client logins and document downloads are written to workflow_events so
 * the internal team knows exactly what the client has seen.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/auth/guard'
const DOC_BUCKET = 'documents'
const REPORT_BUCKET = 'reports'

// Internal roles notified about client actions.
const PM_ROLES = ['project_manager', 'project_director', 'commercial_manager', 'tenant_admin', 'system_admin']

type Admin = ReturnType<typeof createAdminClient>
const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ClientActor {
  userId: string
  tenantId: string
  fullName: string
  email: string
  projectIds: string[]
}

export interface ClientProjectRef {
  id: string
  code: string
  name: string
}

export interface GateStep {
  number: number
  code: string
  name: string
  status: 'approved' | 'in_review' | 'pending'
  current: boolean
}

export interface ClientAnnouncement {
  id: string
  title: string
  body: string
  publishedAt: string
  authorName: string | null
}

export interface ClientHome {
  fullName: string
  project: {
    id: string
    code: string
    name: string
    technology: string | null
    location: string | null
    country: string | null
  }
  allProjects: ClientProjectRef[]
  currentGate: string
  percentComplete: number
  gates: GateStep[]
  nextMilestone: { title: string; plannedDate: string | null } | null
  announcements: ClientAnnouncement[]
}

export interface ClientDeliverable {
  id: string
  title: string
  department: string
  status: string
  progressPct: number
  gateNumber: number
  kind: 'work' | 'engineering'
}

export interface ClientGateGroup {
  gateNumber: number
  label: string
  deliverables: ClientDeliverable[]
}

export interface ClientMilestone {
  id: string
  title: string
  plannedDate: string | null
  status: string
}

export interface ClientVariation {
  id: string
  number: string
  title: string
  status: string
  timeImpactDays: number
  costImpact: number | null // null when not client_cost_visible
}

export interface ClientDocument {
  id: string
  title: string
  code: string | null
  category: string | null
  revision: string | null
  storagePath: string
  createdAt: string
}

export interface ClientReportRef {
  id: string
  version: number
  periodLabel: string
  title: string
  storagePath: string | null
  issuedAt: string | null
}

// ─────────────────────────────────────────────────────────────
// Actor resolution
// ─────────────────────────────────────────────────────────────

/** Resolve the current client-portal actor. Returns null when unauthenticated
 * or not a `client_viewer` — callers redirect. */
export async function getClientActor(): Promise<ClientActor | null> {
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

    if (!profile || profile.role !== 'client_viewer') return null

    const { data: grants } = await admin
      .from('external_access')
      .select('project_id')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    return {
      userId: user.id,
      tenantId: profile.tenant_id ?? tenantId,
      fullName: profile.full_name ?? '',
      email: profile.email ?? user.email ?? '',
      projectIds: (grants ?? []).map((g) => g.project_id),
    }
  } catch {
    return null
  }
}

/** Validate a requested projectId against the actor's grants; fall back to the
 * first granted project. Returns null when the actor has no access. */
function resolveProjectId(actor: ClientActor, requested?: string): string | null {
  if (requested && actor.projectIds.includes(requested)) return requested
  return actor.projectIds[0] ?? null
}

// ─────────────────────────────────────────────────────────────
// Audit + notify helpers
// ─────────────────────────────────────────────────────────────

async function logClientEvent(admin: Admin, args: {
  actorId: string
  transition: string
  projectId: string | null
  objectType: string
  objectId: string
  metadata?: Record<string, unknown>
}) {
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: null,
    to_state: null,
    transition_code: args.transition,
    actor_id: args.actorId,
    comment: null,
    metadata: {
      module: 'client_portal',
      object_type: args.objectType,
      object_id: args.objectId,
      project_id: args.projectId,
      ...args.metadata,
    },
  }).then(() => {}, () => {})
}

async function notifyPm(admin: Admin, args: {
  tenantId: string
  title: string
  body: string
  link: string
}) {
  const tenantId = await getCurrentTenantId()
  const { data: recipients } = await admin
    .from('profiles').select('id')
    .eq('tenant_id', args.tenantId).eq('is_active', true)
    .in('role', PM_ROLES)
  if (!recipients?.length) return
  await admin.from('notifications').insert(
    recipients.map((r) => ({
      user_id: r.id,
      tenant_id: args.tenantId,
      title: args.title,
      body: args.body,
      type: 'approval',
      channel: 'in_app',
      link: args.link,
    })),
  ).then(() => {}, () => {})
}

// ─────────────────────────────────────────────────────────────
// Home (logs client login)
// ─────────────────────────────────────────────────────────────

export async function getClientHome(projectId?: string): Promise<ClientHome | null> {
  const actor = await getClientActor()
  if (!actor) return null
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return null

  const admin = createAdminClient()

  // Audit the login/view for this project.
  await logClientEvent(admin, {
    actorId: actor.userId,
    transition: 'CLIENT_LOGIN',
    projectId: activeId,
    objectType: 'project',
    objectId: activeId,
  })

  const [projRes, allProjRes, gatesRes, msRes, annRes] = await Promise.all([
    admin.from('projects')
      .select('id, code, name, technology, location, country, current_phase')
      .eq('id', activeId).maybeSingle(),
    admin.from('projects').select('id, code, name').in('id', actor.projectIds).order('code'),
    admin.from('phase_gates').select('phase_number, phase_name, status')
      .eq('project_id', activeId).order('phase_number'),
    admin.from('payment_milestones')
      .select('title, planned_date, status').eq('project_id', activeId)
      .eq('client_visible', true).order('planned_date'),
    admin.from('client_announcements')
      .select('id, title, body, published_at, author_id')
      .eq('project_id', activeId).order('published_at', { ascending: false }).limit(10),
  ])

  const p = projRes.data
  if (!p) return null

  // Build an 8-gate stepper (G1–G8).
  const gateRows = gatesRes.data ?? []
  const currentPhase = num(p.current_phase)
  const gates: GateStep[] = []
  for (let n = 1; n <= 8; n++) {
    const row = gateRows.find((g) => num(g.phase_number) === n)
    const rawStatus = (row?.status as string) ?? 'pending'
    const status: GateStep['status'] =
      rawStatus === 'approved' ? 'approved' : rawStatus === 'in_review' ? 'in_review' : 'pending'
    gates.push({
      number: n,
      code: `G${n}`,
      name: (row?.phase_name as string) ?? `Gate ${n}`,
      status,
      current: n === currentPhase + 1,
    })
  }
  const approved = gates.filter((g) => g.status === 'approved').length
  const percentComplete = Math.round((approved / 8) * 100)

  // Next upcoming milestone (first non-paid with a future/earliest planned date).
  const ms = msRes.data ?? []
  const upcoming = ms.find((m) => m.status !== 'paid') ?? ms[0] ?? null

  // Resolve announcement author names.
  const authorIds = [...new Set((annRes.data ?? []).map((a) => a.author_id).filter(Boolean))] as string[]
  const authorMap = new Map<string, string>()
  if (authorIds.length) {
    const { data: authors } = await admin.from('profiles').select('id, full_name').in('id', authorIds)
    for (const a of authors ?? []) authorMap.set(a.id, a.full_name ?? '')
  }

  return {
    fullName: actor.fullName,
    project: {
      id: p.id, code: p.code, name: p.name,
      technology: (p.technology as string) ?? null,
      location: (p.location as string) ?? null,
      country: (p.country as string) ?? null,
    },
    allProjects: (allProjRes.data ?? []).map((x) => ({ id: x.id, code: x.code, name: x.name })),
    currentGate: `G${currentPhase + 1}`,
    percentComplete,
    gates,
    nextMilestone: upcoming
      ? { title: upcoming.title as string, plannedDate: (upcoming.planned_date as string) ?? null }
      : null,
    announcements: (annRes.data ?? []).map((a) => ({
      id: a.id as string,
      title: a.title as string,
      body: (a.body as string) ?? '',
      publishedAt: a.published_at as string,
      authorName: a.author_id ? (authorMap.get(a.author_id as string) ?? null) : null,
    })),
  }
}

// ─────────────────────────────────────────────────────────────
// Progress: deliverables grouped by gate (department labels only)
// ─────────────────────────────────────────────────────────────

export async function getClientProgress(projectId?: string): Promise<ClientGateGroup[]> {
  const actor = await getClientActor()
  if (!actor) return []
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return []

  const admin = createAdminClient()
  const [wpRes, epRes] = await Promise.all([
    admin.from('work_packages')
      .select('id, wp_code, title, discipline, status, progress_pct, gate_number')
      .eq('project_id', activeId).eq('visible_to_client', true),
    admin.from('engineering_packages')
      .select('id, package_code, title, discipline, status, progress_pct, gate_number')
      .eq('project_id', activeId).eq('visible_to_client', true),
  ])

  const deliverables: ClientDeliverable[] = [
    ...(wpRes.data ?? []).map((w) => ({
      id: w.id as string,
      title: (w.title as string) ?? (w.wp_code as string),
      department: (w.discipline as string) ?? 'General',
      status: (w.status as string) ?? 'pending',
      progressPct: num(w.progress_pct),
      gateNumber: num(w.gate_number),
      kind: 'work' as const,
    })),
    ...(epRes.data ?? []).map((e) => ({
      id: e.id as string,
      title: (e.title as string) ?? (e.package_code as string),
      department: (e.discipline as string) ?? 'Engineering',
      status: (e.status as string) ?? 'pending',
      progressPct: num(e.progress_pct),
      gateNumber: num(e.gate_number),
      kind: 'engineering' as const,
    })),
  ]

  // Group by gate.
  const byGate = new Map<number, ClientDeliverable[]>()
  for (const d of deliverables) {
    if (!byGate.has(d.gateNumber)) byGate.set(d.gateNumber, [])
    byGate.get(d.gateNumber)!.push(d)
  }

  return [...byGate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gateNumber, items]) => ({
      gateNumber,
      label: gateNumber === 0 ? 'General / Cross-gate' : `Gate G${gateNumber}`,
      deliverables: items.sort((a, b) => a.title.localeCompare(b.title)),
    }))
}

// ─────────────────────────────────────────────────────────────
// Milestones (client_visible only)
// ─────────────────────────────────────────────────────────────

export async function getClientMilestones(projectId?: string): Promise<ClientMilestone[]> {
  const actor = await getClientActor()
  if (!actor) return []
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return []

  const admin = createAdminClient()
  const { data } = await admin.from('payment_milestones')
    .select('id, title, planned_date, status')
    .eq('project_id', activeId).eq('client_visible', true)
    .order('planned_date', { ascending: true })

  return (data ?? []).map((m) => ({
    id: m.id as string,
    title: m.title as string,
    plannedDate: (m.planned_date as string) ?? null,
    status: (m.status as string) ?? 'planned',
  }))
}

// ─────────────────────────────────────────────────────────────
// Variations (client_visible; cost only when client_cost_visible)
// ─────────────────────────────────────────────────────────────

export async function getClientVariations(projectId?: string): Promise<ClientVariation[]> {
  const actor = await getClientActor()
  if (!actor) return []
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return []

  const admin = createAdminClient()
  const { data } = await admin.from('variation_orders')
    .select('id, vo_number, title, status, time_impact_days, cost_impact, client_cost_visible')
    .eq('project_id', activeId).eq('client_visible', true)
    .order('vo_number', { ascending: true })

  return (data ?? []).map((v) => ({
    id: v.id as string,
    number: v.vo_number as string,
    title: v.title as string,
    status: (v.status as string) ?? 'submitted',
    timeImpactDays: num(v.time_impact_days),
    costImpact: v.client_cost_visible ? num(v.cost_impact) : null,
  }))
}

// ─────────────────────────────────────────────────────────────
// Documents (visible_to_client) + audited signed-URL download
// ─────────────────────────────────────────────────────────────

export async function getClientDocuments(projectId?: string): Promise<ClientDocument[]> {
  const actor = await getClientActor()
  if (!actor) return []
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return []

  const admin = createAdminClient()
  const { data } = await admin.from('document_files')
    .select('id, title, code, category, revision, storage_path, created_at')
    .eq('project_id', activeId).eq('visible_to_client', true)
    .order('created_at', { ascending: false })

  return (data ?? []).map((d) => ({
    id: d.id as string,
    title: (d.title as string) ?? (d.code as string) ?? 'Document',
    code: (d.code as string) ?? null,
    category: (d.category as string) ?? null,
    revision: (d.revision as string) ?? null,
    storagePath: d.storage_path as string,
    createdAt: d.created_at as string,
  }))
}

/** Signed download URL for a client document. Verifies the document is flagged
 * visible_to_client and on a granted project, then AUDITS the download. */
export async function getClientDocumentUrl(documentId: string): Promise<{ url: string } | { error: string }> {
  const actor = await getClientActor()
  if (!actor) return { error: 'Not authorized' }
  const admin = createAdminClient()

  const { data: doc } = await admin.from('document_files')
    .select('id, title, project_id, storage_path, visible_to_client')
    .eq('id', documentId).maybeSingle()

  if (!doc || !doc.visible_to_client || !actor.projectIds.includes(doc.project_id as string)) {
    return { error: 'Document not available' }
  }

  const { data: signed, error } = await admin.storage
    .from(DOC_BUCKET).createSignedUrl(doc.storage_path as string, 300)
  if (error || !signed) return { error: error?.message ?? 'Could not create download link' }

  await logClientEvent(admin, {
    actorId: actor.userId,
    transition: 'CLIENT_DOCUMENT_VIEWED',
    projectId: doc.project_id as string,
    objectType: 'document',
    objectId: doc.id as string,
    metadata: { title: doc.title },
  })

  return { url: signed.signedUrl }
}

// ─────────────────────────────────────────────────────────────
// Reports (issued only) + audited signed-URL download
// ─────────────────────────────────────────────────────────────

export async function getClientReports(projectId?: string): Promise<ClientReportRef[]> {
  const actor = await getClientActor()
  if (!actor) return []
  const activeId = resolveProjectId(actor, projectId)
  if (!activeId) return []

  const admin = createAdminClient()
  const { data } = await admin.from('client_reports')
    .select('id, version, period_label, title, storage_path, issued_at, status')
    .eq('project_id', activeId).eq('status', 'issued')
    .order('version', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id as string,
    version: num(r.version),
    periodLabel: r.period_label as string,
    title: r.title as string,
    storagePath: (r.storage_path as string) ?? null,
    issuedAt: (r.issued_at as string) ?? null,
  }))
}

export async function getClientReportDownloadUrl(reportId: string): Promise<{ url: string } | { error: string }> {
  const actor = await getClientActor()
  if (!actor) return { error: 'Not authorized' }
  const admin = createAdminClient()

  const { data: rpt } = await admin.from('client_reports')
    .select('id, title, project_id, storage_path, status')
    .eq('id', reportId).maybeSingle()

  if (!rpt || rpt.status !== 'issued' || !rpt.storage_path || !actor.projectIds.includes(rpt.project_id as string)) {
    return { error: 'Report not available' }
  }

  const { data: signed, error } = await admin.storage
    .from(REPORT_BUCKET).createSignedUrl(rpt.storage_path as string, 300)
  if (error || !signed) return { error: error?.message ?? 'Could not create download link' }

  await logClientEvent(admin, {
    actorId: actor.userId,
    transition: 'CLIENT_REPORT_VIEWED',
    projectId: rpt.project_id as string,
    objectType: 'client_report',
    objectId: rpt.id as string,
    metadata: { title: rpt.title },
  })

  return { url: signed.signedUrl }
}

// ─────────────────────────────────────────────────────────────
// Information request (the only client write) → notifies PM
// ─────────────────────────────────────────────────────────────

export async function submitInformationRequest(args: {
  projectId?: string
  message: string
}): Promise<{ error?: string; ok?: boolean }> {
  const actor = await getClientActor()
  if (!actor) return { error: 'Not authorized' }
  const activeId = resolveProjectId(actor, args.projectId)
  if (!activeId) return { error: 'No project access' }

  const message = args.message.trim()
  if (!message) return { error: 'Please enter a message.' }
  if (message.length > 2000) return { error: 'Message is too long (2000 character limit).' }

  const admin = createAdminClient()
  const { data: req, error } = await admin.from('client_information_requests').insert({
    tenant_id: actor.tenantId,
    project_id: activeId,
    requested_by: actor.userId,
    message,
    status: 'open',
  }).select('id').single()

  if (error || !req) return { error: error?.message ?? 'Could not submit your request.' }

  const { data: proj } = await admin.from('projects').select('code').eq('id', activeId).maybeSingle()

  await logClientEvent(admin, {
    actorId: actor.userId,
    transition: 'CLIENT_INFO_REQUEST',
    projectId: activeId,
    objectType: 'information_request',
    objectId: req.id,
  })
  await notifyPm(admin, {
    tenantId: actor.tenantId,
    title: `Client information request — ${proj?.code ?? 'Project'}`,
    body: `${actor.fullName || 'A client'} requested information: "${message.slice(0, 140)}${message.length > 140 ? '…' : ''}"`,
    link: `/projects/${activeId}`,
  })

  revalidatePath('/client')
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────
// INTERNAL side: announcements management (used by the internal app)
// ─────────────────────────────────────────────────────────────

interface InternalActor { userId: string | null; role: string | null; tenantId: string }
async function getInternalActor(): Promise<InternalActor> {
  const tenantId = await getCurrentTenantId()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, role: null, tenantId: tenantId }
    const admin = createAdminClient()
    const { data: p } = await admin.from('profiles').select('role, tenant_id').eq('id', user.id).maybeSingle()
    return { userId: user.id, role: p?.role ?? null, tenantId: p?.tenant_id ?? tenantId }
  } catch {
    return { userId: null, role: null, tenantId: tenantId }
  }
}
const WRITE_ROLES = ['system_admin', 'tenant_admin', 'project_director', 'project_manager', 'commercial_manager']
const canManageAnnouncements = (role: string | null) => role !== null && WRITE_ROLES.includes(role)

export async function listProjectAnnouncements(projectId: string): Promise<ClientAnnouncement[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('client_announcements')
    .select('id, title, body, published_at, author_id')
    .eq('project_id', projectId).order('published_at', { ascending: false })

  const authorIds = [...new Set((data ?? []).map((a) => a.author_id).filter(Boolean))] as string[]
  const authorMap = new Map<string, string>()
  if (authorIds.length) {
    const { data: authors } = await admin.from('profiles').select('id, full_name').in('id', authorIds)
    for (const a of authors ?? []) authorMap.set(a.id, a.full_name ?? '')
  }
  return (data ?? []).map((a) => ({
    id: a.id as string,
    title: a.title as string,
    body: (a.body as string) ?? '',
    publishedAt: a.published_at as string,
    authorName: a.author_id ? (authorMap.get(a.author_id as string) ?? null) : null,
  }))
}

export async function postClientAnnouncement(args: {
  projectId: string
  title: string
  body: string
}): Promise<{ error?: string; ok?: boolean }> {
  const actor = await getInternalActor()
  if (!canManageAnnouncements(actor.role)) return { error: 'You do not have permission to post announcements.' }
  const title = args.title.trim()
  if (!title) return { error: 'Title is required.' }

  const admin = createAdminClient()
  const { error } = await admin.from('client_announcements').insert({
    tenant_id: actor.tenantId,
    project_id: args.projectId,
    title,
    body: args.body.trim(),
    author_id: actor.userId,
  })
  if (error) return { error: error.message }

  revalidatePath(`/projects/${args.projectId}`)
  revalidatePath('/client')
  return { ok: true }
}

export async function deleteClientAnnouncement(id: string, projectId: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await getInternalActor()
  if (!canManageAnnouncements(actor.role)) return { error: 'Not authorized' }
  const admin = createAdminClient()
  const { error } = await admin.from('client_announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}
