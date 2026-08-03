'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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

  if (!user) {
    return {
      fullName:  'GridMind User',
      role:      'viewer',
      email:     '',
      title:     '',
      dept:      'PMO',
      phone:     '',
      timezone:  'UTC',
      bio:       '',
      skills:    [],
      linkedin:  '',
      slack:     '',
    }
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return {
    fullName:  (profile?.full_name as string | null) ?? 'GridMind User',
    role:      (profile?.role      as string | null) ?? 'viewer',
    email:     user.email ?? '',
    title:     '',
    dept:      'PMO',
    phone:     '',
    timezone:  'UTC',
    bio:       '',
    skills:    [],
    linkedin:  '',
    slack:     '',
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function updateProfileSettings(
  payload: UpdateProfilePayload,
): Promise<{ error?: string }> {
  // Authentication required (no governance write authority needed for self-service profile editing)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Only allow editing own profile
  const admin = createAdminClient()

  // Build profile updates — only update full_name (the only safe field in profiles table)
  const profileUpdate: Record<string, unknown> = {}
  if (payload.fullName !== undefined) profileUpdate.full_name = payload.fullName

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
