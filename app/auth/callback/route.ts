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

  // Handle email links: both token_hash (old format) and token (new Supabase format)
  const tokenValue = tokenHash || token
  if (tokenValue && type) {
    const { error } = await supabase.auth.verifyOtp({ 
      type, 
      token_hash: tokenValue
    })
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
