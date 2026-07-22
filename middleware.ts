import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Middleware: Supabase session refresh + auth-gate only.
 *
 * Locale handling is intentionally NOT done here. This app uses next-intl in
 * cookie-only mode with NO URL prefix (no `app/[locale]` segment), so
 * next-intl's `createMiddleware` must NOT run — it would internally rewrite
 * every request to `/{locale}/...` and 404 against the prefix-less route tree.
 *
 * Instead, `i18n/request.ts` reads the `NEXT_LOCALE` cookie directly via
 * `next/headers`, and `setLocaleAction` writes that cookie. The cookie is the
 * single source of truth; no middleware locale work is required.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|offline\\.html|fonts/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}
