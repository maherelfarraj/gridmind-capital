/**
 * One-off pilot provisioning for PRJ-2026-383 "Moz Farm".
 *
 * Mirrors app/actions/admin.ts -> inviteInternalUser exactly (same Supabase
 * admin calls, same profile fields), run as a script so the 6 pilot users can
 * be provisioned in one pass.
 *
 * Idempotent: existing profiles are updated, not duplicated.
 *
 * Run: node --env-file-if-exists=/vercel/share/.env.project scripts/pilot-invite.mjs
 */
import { resolveMx } from 'node:dns/promises'

import { createClient } from '@supabase/supabase-js'

const url =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE

if (!url || !serviceKey) {
  console.error('[v0] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const SITE_URL = process.env.APP_URL ?? 'http://localhost:3000'

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * seat  = code in the 19-role org catalog (roles.code) -> home_role_id
 * role  = value in the Postgres `user_role` enum       -> profiles.role
 *
 * Names marked placeholder are seat titles; `full_name` is a display field and
 * can be corrected later in /admin/users without touching identity.
 */
/**
 * Mail domain for the roster.
 *
 * Supabase Auth validates the domain and returns `email_address_invalid` for
 * one that does not resolve. `gridmind.capital` is NXDOMAIN (no MX, no A), so
 * every invite to it fails; `gsi.jo` has live Outlook MX and invites fine.
 *
 * Override per run:
 *   node scripts/pilot-invite.mjs --domain=gsi.jo
 */
const DOMAIN =
  process.argv.find((a) => a.startsWith('--domain='))?.split('=')[1] ??
  'gridmind.capital'

const at = (local) => `${local}@${DOMAIN}`

const ROSTER = [
  { seat: null,  email: at('maher'), fullName: 'Maher Al Farraj', role: 'tenant_admin',     placeholder: false },
  { seat: 'PD',  email: at('ahmad'), fullName: 'Ahmad Obaisi',    role: 'project_director',  placeholder: false },
  { seat: 'DEV', email: at('pm1'),   fullName: 'Project Developer (pilot)',         role: 'project_manager',  placeholder: true },
  { seat: 'DM',  email: at('eng1'),  fullName: 'Design Manager (pilot)',            role: 'engineer',         placeholder: true },
  { seat: 'FIN', email: at('fin1'),  fullName: 'Finance Manager (pilot)',           role: 'finance_manager',  placeholder: true },
  { seat: 'GCM', email: at('eng2'),  fullName: 'Grid Connection Manager (pilot)',   role: 'engineer',         placeholder: true },
]

// ── preflight: can the domain receive mail at all? ──────────────────────
// Supabase rejects addresses at non-resolving domains with a per-address
// `email_address_invalid`, which reads like a bad address rather than a bad
// domain. Check once up front so the failure is unambiguous.
{
  let mx = []
  try {
    mx = await resolveMx(DOMAIN)
  } catch {
    mx = []
  }
  if (mx.length === 0) {
    console.error(
      `[v0] ABORT — "${DOMAIN}" has no MX records (does not resolve).\n` +
        `[v0] Supabase Auth will reject every address at this domain.\n` +
        `[v0] Re-run against a real mail domain, e.g.:\n` +
        `[v0]   node scripts/pilot-invite.mjs --domain=gsi.jo`,
    )
    process.exit(1)
  }
  console.log(`[v0] Domain "${DOMAIN}" OK — ${mx.length} MX record(s).`)
}

// ── resolve tenant from the pilot project ───────────────────────────────
const { data: project, error: projErr } = await admin
  .from('projects')
  .select('id, code, name, tenant_id')
  .eq('code', 'PRJ-2026-383')
  .single()

if (projErr || !project) {
  console.error('[v0] Could not resolve pilot project:', projErr?.message)
  process.exit(1)
}
console.log(`[v0] Pilot project: ${project.code} "${project.name}"`)
console.log(`[v0] Tenant: ${project.tenant_id}`)

// ── resolve seat role ids ───────────────────────────────────────────────
const seatCodes = ROSTER.map((r) => r.seat).filter(Boolean)
const { data: roleRows, error: roleErr } = await admin
  .from('roles')
  .select('id, code, title')
  .in('code', seatCodes)

if (roleErr) {
  console.error('[v0] Could not load role catalog:', roleErr.message)
  process.exit(1)
}
const seatToRoleId = new Map(roleRows.map((r) => [r.code, r.id]))
for (const code of seatCodes) {
  if (!seatToRoleId.has(code)) {
    console.error(`[v0] Seat "${code}" not found in roles catalog — aborting.`)
    process.exit(1)
  }
}

// ── provision ───────────────────────────────────────────────────────────
const results = []

for (const person of ROSTER) {
  const email = person.email.toLowerCase()
  const homeRoleId = person.seat ? seatToRoleId.get(person.seat) : null

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('tenant_id', project.tenant_id)
    .maybeSingle()

  let userId
  let mode

  if (existing) {
    userId = existing.id
    mode = 'updated'
    const { error } = await admin
      .from('profiles')
      .update({
        role: person.role,
        full_name: person.fullName,
        user_type: 'internal',
        is_active: true,
        ...(homeRoleId ? { home_role_id: homeRoleId } : {}),
      })
      .eq('id', userId)
    if (error) {
      results.push({ email, status: `FAILED (update): ${error.message}` })
      continue
    }
  } else {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role: person.role, tenant_id: project.tenant_id, full_name: person.fullName },
      redirectTo: `${SITE_URL}/auth/callback?next=/`,
    })

    if (inviteErr || !invited?.user) {
      results.push({ email, status: `FAILED (invite): ${inviteErr?.message}` })
      continue
    }
    userId = invited.user.id
    mode = 'invited'

    const { error: upsertErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        tenant_id: project.tenant_id,
        email,
        full_name: person.fullName,
        role: person.role,
        user_type: 'internal',
        is_active: true,
        ...(homeRoleId ? { home_role_id: homeRoleId } : {}),
      },
      { onConflict: 'id' },
    )
    if (upsertErr) {
      results.push({ email, status: `FAILED (profile): ${upsertErr.message}` })
      continue
    }
  }

  // SMTP-independent fallback link (built from hashed_token, not action_link)
  let link = '(none)'
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkData?.properties?.hashed_token) {
    link =
      `${SITE_URL}/auth/callback` +
      `?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}` +
      `&type=magiclink&next=/`
  }

  results.push({
    email,
    seat: person.seat ?? '—',
    role: person.role,
    userId,
    status: mode,
    placeholderName: person.placeholder,
    link,
  })
}

console.log('\n[v0] ── PROVISIONING RESULT ─────────────────────────────')
for (const r of results) {
  console.log(
    `${(r.seat ?? '—').padEnd(4)} ${r.email.padEnd(30)} ${String(r.role ?? '').padEnd(18)} ${r.status}`,
  )
}

console.log('\n[v0] ── INVITE LINKS (single-use, share individually) ───')
for (const r of results) {
  if (r.link && r.link !== '(none)') console.log(`${r.email}\n  ${r.link}\n`)
}

const failed = results.filter((r) => String(r.status).startsWith('FAILED'))
console.log(`[v0] done — ${results.length - failed.length} ok, ${failed.length} failed`)
if (failed.length) process.exit(1)
