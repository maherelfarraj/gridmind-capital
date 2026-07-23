'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [profileRes, tenantRes] = await Promise.all([
    user
      ? admin.from('profiles').select('full_name, role').eq('id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
    admin.from('tenants').select('settings').eq('id', DEMO_TENANT).single(),
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

  // Read current tenant settings to perform a safe merge
  const { data: tenantRow } = await admin
    .from('tenants')
    .select('settings')
    .eq('id', DEMO_TENANT)
    .single()

  const currentSettings = (tenantRow?.settings as Record<string, unknown> | null) ?? {}
  const currentExtra    = (currentSettings.profile_extra as Record<string, unknown> | null) ?? {}

  // Build updated extra — only include keys that were supplied
  const updatedExtra: Record<string, unknown> = { ...currentExtra }
  if (payload.title    !== undefined) updatedExtra.title    = payload.title
  if (payload.dept     !== undefined) updatedExtra.dept     = payload.dept
  if (payload.phone    !== undefined) updatedExtra.phone    = payload.phone
  if (payload.timezone !== undefined) updatedExtra.timezone = payload.timezone
  if (payload.bio      !== undefined) updatedExtra.bio      = payload.bio
  if (payload.skills   !== undefined) updatedExtra.skills   = payload.skills
  if (payload.linkedin !== undefined) updatedExtra.linkedin = payload.linkedin
  if (payload.slack    !== undefined) updatedExtra.slack    = payload.slack

  const newSettings = { ...currentSettings, profile_extra: updatedExtra }

  // Run both writes in parallel
  const [profileRes, tenantRes] = await Promise.all([
    payload.fullName !== undefined
      ? admin.from('profiles').update({ full_name: payload.fullName }).eq('id', user.id)
      : Promise.resolve({ error: null }),
    admin.from('tenants').update({ settings: newSettings }).eq('id', DEMO_TENANT),
  ])

  if (profileRes.error) return { error: (profileRes.error as { message: string }).message }
  if (tenantRes.error)  return { error: (tenantRes.error  as { message: string }).message }

  revalidatePath('/settings')
  return {}
}
