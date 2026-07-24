'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface LiveNotification {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

export interface NotificationsResult {
  items: LiveNotification[]
  unreadCount: number
}

/** Fetch notifications for the current authenticated user */
export async function getNotificationsAction(): Promise<NotificationsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { items: [], unreadCount: 0 }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, is_read, link, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const stored = (error || !data) ? [] : (data as LiveNotification[])

  // Merge in derived operational alerts (permits expiring, overdue transmittal responses).
  const derived = await getDerivedNotifications()

  const items = [...derived, ...stored].sort(
    (a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0),
  )
  const unreadCount = items.filter(n => !n.is_read).length

  return { items, unreadCount }
}

/**
 * Synthetic, always-unread feed items derived from live operational data:
 * – work permits expiring within 48h  → link to the permits board
 * – transmittals with an overdue response (issued/acknowledged, response_due passed)
 * These are computed on read (not persisted) so they never need a marked-read row.
 */
async function getDerivedNotifications(): Promise<LiveNotification[]> {
  const admin = createAdminClient()
  const now   = new Date()
  const nowIso = now.toISOString()
  const in48   = new Date(now.getTime() + 48 * 3_600_000).toISOString()
  const today  = nowIso.slice(0, 10)
  const last24 = new Date(now.getTime() - 24 * 3_600_000).toISOString()

  const ago3d   = new Date(now.getTime() - 3  * 86_400_000).toISOString()
  const ago7d   = new Date(now.getTime() - 7  * 86_400_000).toISOString()
  const in30d   = new Date(now.getTime() + 30 * 86_400_000).toISOString()
  const in7d    = new Date(now.getTime() +  7 * 86_400_000).toISOString()

  const [permitRes, transRes, dailyRes, photoRes, holdRes, critNcrRes, secExpiryRes, msDueRes, complianceFailRes] = await Promise.all([
    admin
      .from('work_permits')
      .select('id, permit_no, title, project_id, valid_to')
      .eq('tenant_id', DEMO_TENANT)
      .eq('status', 'issued')
      .gte('valid_to', nowIso)
      .lte('valid_to', in48)
      .order('valid_to', { ascending: true }),
    admin
      .from('transmittals')
      .select('id, transmittal_no, subject, project_id, response_due')
      .eq('tenant_id', DEMO_TENANT)
      .in('status', ['issued', 'acknowledged'])
      .lt('response_due', nowIso)
      .order('response_due', { ascending: true }),
    admin
      .from('daily_reports')
      .select('id, project_id, report_date, workforce_count, updated_at')
      .eq('tenant_id', DEMO_TENANT)
      .eq('status', 'submitted')
      .gte('report_date', today)
      .order('updated_at', { ascending: false }),
    admin
      .from('field_photos')
      .select('id, ticket_id, project_id, created_at')
      .eq('tenant_id', DEMO_TENANT)
      .not('ticket_id', 'is', null)
      .gte('created_at', last24)
      .order('created_at', { ascending: false }),
    // ITP hold points pending for more than 3 days
    admin
      .from('itp_activities')
      .select('id, plan_id, description, created_at, itp_plans(project_id, itp_no, tenant_id)')
      .eq('inspection_type', 'HOLD')
      .eq('status', 'pending')
      .lt('created_at', ago3d)
      .order('created_at', { ascending: true })
      .limit(20),
    // Critical NCRs (source = 'failed_inspection') open > 7 days
    admin
      .from('ncrs')
      .select('id, ncr_number, title, project_id, raised_at')
      .eq('tenant_id', DEMO_TENANT)
      .eq('source', 'failed_inspection')
      .neq('status', 'closed')
      .lt('raised_at', ago7d)
      .order('raised_at', { ascending: true })
      .limit(20),
    // Securities expiring within 30 days (active only)
    admin
      .from('securities')
      .select('id, type, issuer, reference, expiry_date, project_id')
      .eq('tenant_id', DEMO_TENANT)
      .eq('status', 'active')
      .gte('expiry_date', nowIso)
      .lte('expiry_date', in30d)
      .order('expiry_date', { ascending: true })
      .limit(20),
    // Contract milestones due within 7 days and still pending
    admin
      .from('contract_milestones')
      .select('id, title, due_date, amount, contract_id, contracts(project_id, contract_no)')
      .eq('tenant_id', DEMO_TENANT)
      .eq('status', 'pending')
      .gte('due_date', today)
      .lte('due_date', in7d)
      .order('due_date', { ascending: true })
      .limit(20),
    // Grid compliance tests that failed (result = 'fail', no completed_date read-back needed)
    admin
      .from('grid_compliance_tests')
      .select('id, test_name, category, completed_date, project_id')
      .eq('tenant_id', DEMO_TENANT)
      .eq('result', 'fail')
      .order('completed_date', { ascending: false })
      .limit(20),
  ])

  // Resolve project names + punch-item titles for the field-derived alerts.
  const punchTicketIds = Array.from(
    new Set((photoRes.data ?? []).map((p) => p.ticket_id as string).filter(Boolean)),
  )
  const projectIds = Array.from(new Set([
    ...(dailyRes.data ?? []).map((r) => r.project_id as string),
    ...(photoRes.data ?? []).map((p) => p.project_id as string),
  ].filter(Boolean)))

  const [ticketRes, projRes] = await Promise.all([
    punchTicketIds.length
      ? admin.from('tickets').select('id, title, project_id, created_at, metadata')
          .eq('tenant_id', DEMO_TENANT).eq('category', 'punch_item').in('id', punchTicketIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    projectIds.length
      ? admin.from('projects').select('id, name').eq('tenant_id', DEMO_TENANT).in('id', projectIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])
  const projName = Object.fromEntries((projRes.data ?? []).map((p) => [p.id as string, p.name as string]))

  const out: LiveNotification[] = []

  for (const p of permitRes.data ?? []) {
    const validTo = p.valid_to as string
    out.push({
      id:        `permit-expiry-${p.id}`,
      title:     `Permit expiring soon — ${(p.permit_no as string) ?? 'PTW'}`,
      body:      `${(p.title as string) ?? 'Work permit'} expires ${new Date(validTo).toLocaleString()}. Renew or close before expiry.`,
      type:      'alert',
      is_read:   false,
      link:      `/projects/${p.project_id}/permits`,
      created_at: validTo,
    })
  }

  for (const t of transRes.data ?? []) {
    const due = t.response_due as string
    out.push({
      id:        `transmittal-overdue-${t.id}`,
      title:     `Overdue transmittal response — ${(t.transmittal_no as string) ?? 'Transmittal'}`,
      body:      `A response for "${(t.subject as string) ?? 'transmittal'}" was due ${new Date(due).toLocaleDateString()}.`,
      type:      'urgent',
      is_read:   false,
      link:      `/projects/${t.project_id}/transmittals`,
      created_at: due,
    })
  }

  // ITP hold points pending >3 days.
  for (const h of holdRes.data ?? []) {
    const plan = (h.itp_plans as unknown as Record<string, unknown> | null)
    const projectId = (plan?.project_id as string | null) ?? ''
    const itpNo     = (plan?.itp_no     as string | null) ?? 'ITP'
    const daysWaiting = Math.max(0, Math.floor((Date.now() - new Date(h.created_at as string).getTime()) / 86_400_000))
    out.push({
      id:        `hold-point-${h.id}`,
      title:     `Hold point pending — ${itpNo}`,
      body:      `"${(h.description as string) ?? 'Hold point'}" has been pending for ${daysWaiting} day${daysWaiting === 1 ? '' : 's'}. Inspector sign-off required before work continues.`,
      type:      'alert',
      is_read:   false,
      link:      projectId ? `/projects/${projectId}/quality` : '/quality',
      created_at: (h.created_at as string) ?? nowIso,
    })
  }

  // Critical NCRs (failed_inspection source) open >7 days.
  for (const n of critNcrRes.data ?? []) {
    const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(n.raised_at as string).getTime()) / 86_400_000))
    out.push({
      id:        `critical-ncr-${n.id}`,
      title:     `Critical NCR open ${daysOpen}d — ${(n.ncr_number as string) ?? 'NCR'}`,
      body:      `"${(n.title as string) ?? 'Non-conformance'}" (Critical) has been open for ${daysOpen} days without closure. Root cause and disposition required.`,
      type:      'urgent',
      is_read:   false,
      link:      `/projects/${n.project_id}/quality`,
      created_at: (n.raised_at as string) ?? nowIso,
    })
  }

  // Securities expiring within 30 days.
  for (const s of secExpiryRes.data ?? []) {
    const expiry   = s.expiry_date as string
    const daysLeft = Math.max(0, Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000))
    const typeLabel = String(s.type ?? 'security').replace(/_/g, ' ')
    const ref      = s.reference ? ` (${s.reference})` : ''
    out.push({
      id:        `security-expiry-${s.id}`,
      title:     `Security expiring in ${daysLeft}d — ${typeLabel}${ref}`,
      body:      `${s.issuer ? `${s.issuer} ` : ''}${typeLabel}${ref} expires on ${new Date(expiry).toLocaleDateString()}. Arrange renewal or submit release documentation before expiry.`,
      type:      daysLeft <= 7 ? 'urgent' : 'alert',
      is_read:   false,
      link:      `/projects/${s.project_id}/contracts`,
      created_at: expiry,
    })
  }

  // Contract milestones due this week (pending).
  for (const m of msDueRes.data ?? []) {
    const contract = (m.contracts as unknown as Record<string, unknown> | null)
    const projectId   = (contract?.project_id  as string | null) ?? ''
    const contractNo  = (contract?.contract_no as string | null) ?? 'Contract'
    const due = m.due_date as string
    const daysLeft = Math.max(0, Math.floor((new Date(due).getTime() - Date.now()) / 86_400_000))
    out.push({
      id:        `milestone-due-${m.id}`,
      title:     `Milestone due in ${daysLeft}d — ${contractNo}`,
      body:      `"${(m.title as string) ?? 'Milestone'}" (${contractNo}) is due ${new Date(due).toLocaleDateString()}. Mark as achieved to prevent LD accrual.`,
      type:      daysLeft === 0 ? 'urgent' : 'alert',
      is_read:   false,
      link:      projectId ? `/projects/${projectId}/contracts` : '/projects',
      created_at: due,
    })
  }

  // Grid compliance test failures.
  for (const t of complianceFailRes.data ?? []) {
    const categoryLabel = String(t.category ?? 'grid compliance').replace(/_/g, ' ')
    const completedDate = t.completed_date as string | null
    out.push({
      id:        `compliance-fail-${t.id}`,
      title:     `Compliance test failed — ${(t.test_name as string) ?? categoryLabel}`,
      body:      `"${(t.test_name as string) ?? 'Grid compliance test'}" (${categoryLabel}) failed${completedDate ? ` on ${new Date(completedDate).toLocaleDateString()}` : ''}. A re-test must be scheduled and the certificate reference updated before grid connection sign-off.`,
      type:      'urgent',
      is_read:   false,
      link:      `/projects/${t.project_id}/energy`,
      created_at: (completedDate ?? nowIso),
    })
  }

  // Daily reports submitted today (field mode → construction).
  for (const r of dailyRes.data ?? []) {
    const proj = projName[r.project_id as string] ?? 'a project'
    const crew = r.workforce_count != null ? ` — ${r.workforce_count} on site` : ''
    out.push({
      id:        `daily-report-${r.id}`,
      title:     `Daily report submitted — ${proj}`,
      body:      `Today's site report was filed from the field${crew}.`,
      type:      'document',
      is_read:   false,
      link:      '/construction',
      created_at: (r.updated_at as string) ?? nowIso,
    })
  }

  // New punch items raised from field mode that include photos.
  for (const t of ticketRes.data ?? []) {
    const proj = projName[t.project_id as string] ?? 'a project'
    const meta = (t.metadata as { punch_cat?: string } | null) ?? null
    const cat  = meta?.punch_cat ? `Cat ${meta.punch_cat} ` : ''
    out.push({
      id:        `field-punch-${t.id}`,
      title:     `New ${cat}punch item with photo — ${proj}`,
      body:      `"${(t.title as string) ?? 'Punch item'}" was raised from the field with a photo attached.`,
      type:      'alert',
      is_read:   false,
      link:      '/construction',
      created_at: (t.created_at as string) ?? nowIso,
    })
  }

  return out
}

/** Get unread count only — used by layout for the badge */
export async function getUnreadCountAction(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return 0
  return count ?? 0
}

/** Mark a single notification as read */
export async function markNotificationReadAction(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)   // RLS guard — only own notifications

  revalidatePath('/', 'layout')
}

/** Mark all notifications as read */
export async function markAllReadAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/', 'layout')
}

/** Seed demo notifications for the current user (dev helper) */
export async function seedNotificationsAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Get tenant_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const tenantId = profile?.tenant_id
  if (!tenantId) return

  const admin = createAdminClient()

  const seeds = [
    { title: 'Gate G3 approval overdue',   body: 'Contract Award review has exceeded the 48h SLA window.',  type: 'urgent',   is_read: false },
    { title: 'Budget threshold breached',   body: 'Phase 1 civil works reached 92% of approved budget.',     type: 'alert',    is_read: false },
    { title: 'Document uploaded',           body: 'HVAC Specifications v2.1 uploaded to Engineering package.',type: 'document', is_read: false },
    { title: 'You were mentioned',          body: '@you Please review the updated piling report.',            type: 'mention',  is_read: false },
    { title: 'Approval decision recorded',  body: 'Gate G2 approved with conditions by Executive Sponsor.',  type: 'approval', is_read: true  },
    { title: 'Task completed',              body: 'Foundation Pour milestone marked complete by site supervisor.', type: 'task', is_read: true },
  ]

  await admin.from('notifications').insert(
    seeds.map(s => ({ ...s, user_id: user.id, tenant_id: tenantId, channel: 'in_app' }))
  )

  revalidatePath('/', 'layout')
}

// ─── Activity feed ────────────────────────────────────────────────────────────

export interface ActivityFeedItem {
  id: string
  actorName: string
  actorInitials: string
  actorColor: string
  action: string
  subject: string
  project: string
  projectId: string
  timestamp: string
  type: 'approval' | 'document' | 'task' | 'budget' | 'gate'
}

const FEED_COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6']

function feedColor(id: string): string {
  const n = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return FEED_COLORS[n % FEED_COLORS.length]
}

function feedTime(isoStr: string | null): string {
  if (!isoStr) return '—'
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = diff / 60_000
  if (m < 1)    return 'just now'
  if (m < 60)   return `${Math.round(m)}m ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

/**
 * Merged, time-sorted activity feed from:
 * – recent approvals
 * – recent document uploads
 * – open critical/high AI insights
 */
export async function getActivityFeed(): Promise<ActivityFeedItem[]> {
  const sb = createAdminClient()

  const [{ data: approvals }, { data: docs }, { data: insights }, { data: projects }] =
    await Promise.all([
      sb
        .from('approvals')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('documents')
        .select('id, title, category, created_at, project_id')
        .eq('tenant_id', DEMO_TENANT)
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('ai_insights')
        .select('id, title, severity, module, created_at')
        .eq('tenant_id', DEMO_TENANT)
        .in('severity', ['critical', 'high'])
        .in('status', ['open', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(10),
      sb
        .from('projects')
        .select('id, name')
        .eq('tenant_id', DEMO_TENANT),
    ])

  const pm = Object.fromEntries((projects ?? []).map((p) => [p.id as string, p.name as string]))

  type WithAt = ActivityFeedItem & { _at: string }
  const items: WithAt[] = []

  for (const a of (approvals ?? [])) {
    const status = (a.status as string | null) ?? 'pending'
    items.push({
      id:            `approval-${a.id}`,
      actorName:     'Approvals',
      actorInitials: 'AP',
      actorColor:    feedColor(a.id as string),
      action:        status === 'pending' ? 'submitted approval for' : `${status} approval for`,
      subject:       (a.title as string | null) ?? 'Approval',
      project:       'Portfolio',
      projectId:     '',
      timestamp:     feedTime(a.created_at as string | null),
      type:          'approval',
      _at:           (a.created_at as string | null) ?? '',
    })
  }

  for (const d of (docs ?? [])) {
    const projId   = d.project_id as string | null
    const projName = projId ? (pm[projId] ?? 'Project') : 'GridMind Capital'
    items.push({
      id:            `doc-${d.id}`,
      actorName:     'Document Control',
      actorInitials: 'DC',
      actorColor:    feedColor(d.id as string),
      action:        'uploaded document',
      subject:       (d.title as string | null) ?? (d.category as string | null) ?? 'Document',
      project:       projName,
      projectId:     projId ?? '',
      timestamp:     feedTime(d.created_at as string | null),
      type:          'document',
      _at:           (d.created_at as string | null) ?? '',
    })
  }

  for (const i of (insights ?? [])) {
    const sev = (i.severity as string | null) ?? 'high'
    items.push({
      id:            `insight-${i.id}`,
      actorName:     'AI Monitor',
      actorInitials: 'AI',
      actorColor:    sev === 'critical' ? '#ef4444' : '#f59e0b',
      action:        `flagged ${sev} risk in`,
      subject:       (i.title as string | null) ?? (i.module as string | null) ?? 'system',
      project:       'Portfolio',
      projectId:     '',
      timestamp:     feedTime(i.created_at as string | null),
      type:          'budget',
      _at:           (i.created_at as string | null) ?? '',
    })
  }

  // Sort newest first, cap at 20
  return items
    .sort((a, b) => (b._at > a._at ? 1 : b._at < a._at ? -1 : 0))
    .slice(0, 20)
    .map(({ _at, ...rest }) => rest)
}
