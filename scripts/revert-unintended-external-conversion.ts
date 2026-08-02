/**
 * One-off repair runner for accounts that the external invite flow converted
 * into external identities by mistake.
 *
 * This calls the SAME service the admin server action calls
 * (`revertExternalConversion`). It is not an alternative write path: the
 * validation, the audit row and the post-write verification are identical. The
 * script exists only so the repair can be applied and reviewed without needing
 * an interactive admin session.
 *
 *   Dry run (default, writes nothing):
 *     node --env-file-if-exists=/vercel/share/.env.project \
 *       node_modules/.bin/tsx scripts/revert-unintended-external-conversion.ts \
 *       --actor <admin-email> <target-email>
 *
 *   Apply:
 *     ... --apply --actor <admin-email> <target-email>
 */

import { createClient } from '@supabase/supabase-js'

import { revertExternalConversion } from '../lib/admin/revert-conversion-service'

async function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const actorIdx = argv.indexOf('--actor')
  const actorEmail = actorIdx >= 0 ? argv[actorIdx + 1] : undefined
  const targets = argv.filter((a, i) => !a.startsWith('--') && i !== actorIdx + 1)

  if (!actorEmail || targets.length === 0) {
    console.error('Usage: --actor <admin-email> <target-email> [--apply]')
    process.exit(2)
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(2)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  // The reversal is attributed to a real administrator, never to an anonymous
  // or synthetic actor, so the audit trail names a person.
  const { data: actor } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('email', actorEmail)
    .maybeSingle()

  if (!actor) {
    console.error(`Actor ${actorEmail} not found.`)
    process.exit(2)
  }
  if (!['tenant_admin', 'system_admin'].includes(actor.role ?? '')) {
    console.error(`Actor ${actorEmail} is ${actor.role}, not an administrator.`)
    process.exit(2)
  }

  console.log(`mode   : ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`)
  console.log(`actor  : ${actor.email} (${actor.role})`)

  for (const email of targets) {
    console.log(`\ntarget : ${email}`)
    const res = await revertExternalConversion(admin as never, {
      email,
      actorId: actor.id,
      dryRun: !apply,
    })

    if ('error' in res) {
      console.log(`  REFUSED: ${res.error}`)
      continue
    }

    console.log(`  from   : ${res.plan.before.role} / ${res.plan.before.user_type} / ${res.plan.before.external_org}`)
    console.log(`  to     : ${res.plan.patch.role} / ${res.plan.patch.user_type} / ${res.plan.patch.external_org}`)
    console.log(`  tenant : unchanged (${res.plan.after.tenant_id})`)
    console.log(`  active : unchanged (${res.plan.after.is_active})`)
    console.log(`  grants : ${res.revokedGrants} external access row(s) ${apply ? 'revoked' : 'would be revoked'}`)
    console.log(`  ${apply ? 'APPLIED and verified.' : 'Not applied.'}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
