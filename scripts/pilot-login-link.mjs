/**
 * Generate a fresh single-use login link for a pilot user.
 *
 * Builds the URL from `hashed_token` and points it at our own /auth/callback
 * (which calls verifyOtp). Supabase's `action_link` cannot be used here because
 * it returns the session in the URL fragment, which a server route can't read.
 *
 * Run: node --env-file-if-exists=/vercel/share/.env.project \
 *        scripts/pilot-login-link.mjs <email> [port]
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE

if (!url || !key) {
  console.error('[v0] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const email = process.argv[2]
const port = process.argv[3] ?? '3000'

if (!email) {
  console.error('[v0] Usage: pilot-login-link.mjs <email> [port]')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })

if (error || !data?.properties?.hashed_token) {
  console.error('[v0] Failed:', error?.message ?? 'no hashed_token returned')
  process.exit(1)
}

console.log(
  `http://localhost:${port}/auth/callback` +
    `?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=/`,
)
