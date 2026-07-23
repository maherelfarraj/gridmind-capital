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

  if (error || !data) return { items: [], unreadCount: 0 }

  const items = data as LiveNotification[]
  const unreadCount = items.filter(n => !n.is_read).length

  return { items, unreadCount }
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
