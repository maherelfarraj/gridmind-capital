'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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
