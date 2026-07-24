import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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

  // IMPORTANT: do not add code between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect authenticated users away from auth pages → dashboard
  const isAuthPage =
    pathname === '/login' ||
    pathname.startsWith('/auth/')

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Public / self-authenticating paths ───────────────────────────────────
  // These paths bypass the proxy auth gate for one of two reasons:
  //
  //   a) They are genuinely unauthenticated (login, auth callbacks, public APIs,
  //      static assets, PWA shell files).
  //
  //   b) They carry their own layout-level auth guard and should not be
  //      double-intercepted here:
  //        /field   — app/field/layout.tsx  → resolveSession() → redirect
  //        /portal  — NOT bypassed; the portal layout also guards itself but
  //                   middleware provides an extra layer for external partners
  //        /client  — same: kept protected by middleware for defence-in-depth
  //
  // If you add a new route with its own auth guard, add it here with a comment.
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
    // /field has its own layout-level auth (resolveSession + redirect).
    // Bypassing here avoids a redundant Supabase round-trip per request.
    pathname.startsWith('/field')

  // Protect everything else — redirect to login if no session
  if (!isPublic && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
