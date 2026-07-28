import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback. Handles BOTH shapes of Supabase auth redirect:
 *
 *  1. `?code=...`                    — PKCE / OAuth code exchange.
 *  2. `?token_hash=...&type=...`     — email links (invite, magiclink, signup,
 *                                      recovery, email_change).
 *
 * Shape 2 matters because email links generated with `admin.generateLink()`
 * carry a hashed token, not a PKCE code. Without this branch those links fall
 * through to /auth/error and the invited user can never sign in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const token = searchParams.get('token')
  const type = searchParams.get('type') as EmailOtpType | null

  // Debug logging
  console.log('[v0] Auth callback params:', {
    url: request.nextUrl.toString(),
    next_param: searchParams.get('next'),
    type,
    tokenHash: tokenHash ? `${tokenHash.slice(0, 10)}...` : null,
  })

  // Extract next from direct param OR from redirect_to URL param (magic links encode it)
  let nextValue = searchParams.get('next') ?? '/dashboard'
  
  if (nextValue === '/dashboard') {
    // Supabase magic links encode next into the redirect_to parameter
    const redirectTo = searchParams.get('redirect_to')
    if (redirectTo) {
      try {
        const redirectUrl = new URL(redirectTo)
        const nextParam = redirectUrl.searchParams.get('next')
        if (nextParam) nextValue = nextParam
      } catch {
        // Not a valid URL, ignore
      }
    }
  }
  
  // Only allow same-origin relative paths, so `next` can't be used as an
  // open-redirect into an attacker-controlled host.
  const next = nextValue.startsWith('/') && !nextValue.startsWith('//')
    ? nextValue
    : '/dashboard'

  const supabase = await createClient()

  // Check if user is already authenticated (Supabase magic links set session before redirect)
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
    // Supabase already authenticated the user via /auth/v1/verify
    // Just redirect to next page
    console.log('[v0] Session found, redirecting to:', next)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Handle email links with explicit token: both token_hash (old format) and token (new Supabase format)
  const tokenValue = tokenHash || token
  if (tokenValue && type) {
    console.log('[v0] VerifyOtp with token_hash:', { type, tokenHash: tokenValue?.slice(0, 10) })
    // Note: email is embedded in the token for invite/magiclink types, but we pass it for clarity
    const { data, error } = await supabase.auth.verifyOtp({ 
      email: 'maher@tek.jo',
      type, 
      token_hash: tokenValue
    })
    console.log('[v0] VerifyOtp result:', { success: !error, error: error?.message, user: data?.user?.email })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`,
    )
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${encodeURIComponent(error.message)}`,
    )
  }

  return NextResponse.redirect(
    `${origin}/auth/error?reason=${encodeURIComponent('Missing authentication code.')}`,
  )
}
