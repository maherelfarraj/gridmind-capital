'use server'

import { createClient } from '@/lib/supabase/server'

export interface SignupPayload {
  email: string
  password: string
  fullName: string
}

export interface SignupResult {
  success: boolean
  error?: string
  userId?: string
}

/**
 * Fail-closed self-signup flow for P0 Test 16.
 *
 * Security requirements:
 * - Accept ONLY full_name in metadata (no role, tenant_id, is_active, user_type, etc)
 * - Database trigger creates fail-closed profile with:
 *   - role = 'viewer'
 *   - tenant_id = NULL
 *   - is_active = false
 *   - user_type = 'internal'
 * - User cannot access dashboard until is_active=true and tenant_id is assigned
 */
export async function signupAction(payload: SignupPayload): Promise<SignupResult> {
  try {
    const supabase = await createClient()

    // Validate inputs on server-side
    if (!payload.email || !payload.email.includes('@')) {
      return { success: false, error: 'Invalid email address' }
    }
    if (!payload.password || payload.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' }
    }
    if (!payload.fullName || payload.fullName.trim().length === 0) {
      return { success: false, error: 'Full name is required' }
    }

    // Sign up with Supabase Auth
    // Only full_name is included in metadata — no role, tenant_id, is_active, user_type, etc
    const { data, error: authError } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
        },
      },
    })

    if (authError) {
      // Supabase specific errors
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'Email already registered' }
      }
      return { success: false, error: authError.message || 'Signup failed' }
    }

    if (!data.user) {
      return { success: false, error: 'Signup failed - no user created' }
    }

    // The database trigger on auth.users (handle_new_user) will create the
    // fail-closed profile with role='viewer', tenant_id=NULL, is_active=false,
    // user_type='internal' automatically.

    return {
      success: true,
      userId: data.user.id,
    }
  } catch (err) {
    console.error('[signup] Error:', err)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}
