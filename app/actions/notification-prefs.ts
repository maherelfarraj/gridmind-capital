'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface NotificationPrefs {
  email_on_approval: boolean
  email_on_ncr: boolean
  email_on_vo: boolean
  email_on_escalation: boolean
  email_on_mention: boolean
  email_weekly_digest: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_on_approval: true,
  email_on_ncr: true,
  email_on_vo: true,
  email_on_escalation: true,
  email_on_mention: true,
  email_weekly_digest: true,
}

/** Load the current user's email notification preferences (defaults to all-on). */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULT_PREFS

  const { data } = await supabase
    .from('notification_prefs')
    .select('email_on_approval, email_on_ncr, email_on_vo, email_on_escalation, email_on_mention, email_weekly_digest')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return DEFAULT_PREFS
  return {
    email_on_approval: data.email_on_approval ?? true,
    email_on_ncr: data.email_on_ncr ?? true,
    email_on_vo: data.email_on_vo ?? true,
    email_on_escalation: data.email_on_escalation ?? true,
    email_on_mention: data.email_on_mention ?? true,
    email_weekly_digest: (data as { email_weekly_digest?: boolean }).email_weekly_digest ?? true,
  }
}

/** Persist the current user's email notification preferences (upsert). */
export async function updateNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Upsert with the service-role client so this works regardless of RLS insert policy.
  const admin = createAdminClient()
  const { error } = await admin
    .from('notification_prefs')
    .upsert(
      { user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { error: null }
}

export interface EmailLogRow {
  id: string
  user_id: string | null
  type: string
  subject: string
  status: 'sent' | 'failed'
  error: string | null
  created_at: string
}

/** Recent email_log rows — used by the admin verification / audit view. */
export async function getRecentEmailLog(limit = 50): Promise<EmailLogRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('email_log')
    .select('id, user_id, type, subject, status, error, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as EmailLogRow[]
}
