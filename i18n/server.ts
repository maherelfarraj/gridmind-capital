// Server-only: uses next/headers and must never be imported by client modules.
// Pure locale constants live in ./config — safe for both server and client.
import { cache } from 'react'
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOCALE, isValidLocale, type Locale } from './config'

/**
 * Resolve the active locale for this request.
 *
 * Source of truth precedence:
 *   1. NEXT_LOCALE cookie — set instantly by the in-app language switcher so
 *      the choice takes effect without waiting on a DB round-trip.
 *   2. profiles.locale — the user's persisted preference. This is what makes
 *      RTL "driven by the session profile": a user whose profile is Arabic
 *      renders RTL on a fresh session even before any cookie exists.
 *   3. DEFAULT_LOCALE ('en').
 *
 * The DB lookup only runs when there is no valid cookie, so the common path
 * stays cookie-only and cheap. It is fully guarded — any auth/query failure
 * (e.g. unauthenticated or static requests) falls back to the default.
 *
 * Wrapped in React cache() to dedupe per HTTP request.
 */
const resolveLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value
  if (isValidLocale(cookieLocale)) return cookieLocale

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('locale')
        .eq('id', user.id)
        .single()
      const profileLocale = (profile as { locale?: string | null } | null)?.locale
      if (isValidLocale(profileLocale)) return profileLocale
    }
  } catch {
    // Unauthenticated / static / transient failure — fall through to default.
  }

  return DEFAULT_LOCALE
})

export default getRequestConfig(async () => {
  const locale = await resolveLocale()

  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
    timeZone: 'Asia/Riyadh',
  }
})
