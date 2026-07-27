import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Public / self-authenticating paths ───────────────────────────────────
  // Skip auth checks for paths that don't need them. Check these BEFORE calling
  // getUser() to avoid unnecessary Supabase network round-trips.
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.startsWith('/workbox-') ||
    // /field has its own layout-level auth (resolveSession + redirect).
    // Bypassing here avoids a redundant Supabase round-trip per request.
    pathname.startsWith('/field')

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Only call getUser() for protected paths that need auth decisions
  const {
    data: { user },
    error: userError,
  } = isPublic ? { data: { user: null }, error: null } : await supabase.auth.getUser()

  // A stale/rotated refresh token makes getUser() fail on *every* request while
  // the dead cookie survives, costing a wasted auth round-trip each time. Treat
  // it as signed out and clear the cookies so the retry loop stops.
  const staleSession =
    userError != null &&
    (userError.code === 'refresh_token_not_found' ||
      userError.message.includes('Refresh Token'))

  // Applied to whichever response we ultimately return — a redirect is a fresh
  // NextResponse, so clearing cookies on `supabaseResponse` alone would be lost.
  const clearStaleAuthCookies = <T extends NextResponse>(response: T): T => {
    if (!staleSession) return response
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.delete(cookie.name)
      }
    }
    return response
  }

  // Redirect authenticated users away from auth pages → dashboard
  const isAuthPage = pathname === '/login' || pathname.startsWith('/auth/')

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return clearStaleAuthCookies(NextResponse.redirect(url))
  }

  // Protect everything else — redirect to login if no session
  if (!isPublic && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return clearStaleAuthCookies(NextResponse.redirect(url))
  }

  return clearStaleAuthCookies(supabaseResponse)
}
