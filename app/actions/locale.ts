'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { LOCALES, isValidLocale } from '@/i18n/config'

const COOKIE_NAME = 'NEXT_LOCALE'
// 1 year in seconds
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * Persist the user's chosen locale:
 *  1. Write the NEXT_LOCALE cookie (drives SSR direction + next-intl)
 *  2. Upsert profiles.locale for authenticated users (drives email/PDF locale)
 */
export async function setLocaleAction(locale: string): Promise<{ error: string | null }> {
  if (!isValidLocale(locale)) {
    return { error: `Invalid locale "${locale}". Supported: ${LOCALES.join(', ')}` }
  }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false, // must be readable by client JS for instant UI update
  })

  // Best-effort DB persist — fails gracefully if not authenticated.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const admin = createAdminClient()
      await admin
        .from('profiles')
        .update({ locale })
        .eq('id', user.id)
    }
  } catch {
    // Not fatal — cookie is sufficient for immediate effect.
  }

  return { error: null }
}

/**
 * Persist the user's digit-style preference (western | arabic_indic).
 */
export async function setDigitStyleAction(
  digitStyle: 'western' | 'arabic_indic',
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({ digit_style: digitStyle })
      .eq('id', user.id)

    return { error: null }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
