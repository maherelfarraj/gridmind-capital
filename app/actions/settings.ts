'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'

import { getCurrentTenantId } from '@/lib/tenant'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileSettings {
  fullName:  string
  role:      string
  email:     string
  /** Extras stored in tenants.settings.profile_extra */
  title:     string
  dept:      string
  phone:     string
  timezone:  string
  bio:       string
  skills:    string[]
  linkedin:  string
  slack:     string
}

export interface UpdateProfilePayload {
  fullName?:  string
  title?:     string
  dept?:      string
  phone?:     string
  timezone?:  string
  bio?:       string
  skills?:    string[]
  linkedin?:  string
  slack?:     string
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProfileSettings(): Promise<ProfileSettings> {
  const tenantId = await getCurrentTenantId()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [profileRes, tenantRes] = await Promise.all([
    user
      ? admin.from('profiles').select('full_name, role').eq('id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
    admin.from('tenants').select('settings').eq('id', tenantId).single(),
  ])

  const profile = profileRes.data
  const tenantSettings = (tenantRes.data?.settings as Record<string, unknown> | null) ?? {}
  const extra = (tenantSettings.profile_extra as Record<string, unknown> | undefined) ?? {}

  return {
    fullName:  (profile?.full_name as string | null) ?? 'GridMind User',
    role:      (profile?.role      as string | null) ?? 'viewer',
    email:     user?.email ?? '',
    title:     (extra.title    as string | undefined) ?? '',
    dept:      (extra.dept     as string | undefined) ?? 'PMO',
    phone:     (extra.phone    as string | undefined) ?? '',
    timezone:  (extra.timezone as string | undefined) ?? 'UTC',
    bio:       (extra.bio      as string | undefined) ?? '',
    skills:    (extra.skills   as string[] | undefined) ?? [],
    linkedin:  (extra.linkedin as string | undefined) ?? '',
    slack:     (extra.slack    as string | undefined) ?? '',
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function updateProfileSettings(
  payload: UpdateProfilePayload,
): Promise<{ error?: string }> {
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Build updates for profiles table - only update full_name, phone, timezone
  // (these are the only fields editable from the profile modal)
  const profileUpdate: Record<string, unknown> = {}
  if (payload.fullName !== undefined) profileUpdate.full_name = payload.fullName
  if (payload.phone    !== undefined) profileUpdate.phone     = payload.phone
  if (payload.timezone !== undefined) profileUpdate.timezone  = payload.timezone

  // Only attempt update if there are fields to update
  if (Object.keys(profileUpdate).length === 0) {
    return {}
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileError) {
    return { error: (profileError as { message: string }).message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/settings')
  return {}
}
