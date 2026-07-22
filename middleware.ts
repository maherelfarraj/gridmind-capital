import createMiddleware from 'next-intl/middleware'
import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'
import { LOCALES, DEFAULT_LOCALE } from '@/i18n/request'

/**
 * Locale middleware: reads the NEXT_LOCALE cookie and sets the `locale`
 * request header that next-intl/server (i18n/request.ts) consumes.
 * We do NOT rewrite URLs (no /en/ or /ar/ prefix) — the cookie is the
 * single source of truth.  next-intl routing is therefore "disabled" at
 * the middleware level; we only use it for its cookie-reader helper.
 */
const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'never',         // never rewrite URLs
  localeDetection: false,        // we control detection ourselves via cookie
})

export async function middleware(request: NextRequest) {
  // 1. Let Supabase handle auth (session refresh + redirect to /auth/login).
  const supabaseResponse = await updateSession(request)

  // If Supabase redirected (to /auth/login), pass that through directly —
  // no need to run locale detection on redirects.
  if (supabaseResponse.status !== 200 && supabaseResponse.headers.get('location')) {
    return supabaseResponse
  }

  // 2. Run next-intl to set the x-next-intl-locale header (used by request.ts).
  const intlResponse = intlMiddleware(request)

  // 3. Merge the Supabase cookies (session tokens) onto the intl response so
  //    both sets of cookies propagate to the browser.
  supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
    intlResponse.cookies.set(name, value)
  })

  return intlResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|offline\\.html|fonts/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}
