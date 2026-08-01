import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Structural guards: the canonical provisioning service is only authoritative
 * if nothing else writes the protected profile authority fields.
 *
 * These read real source files rather than mocking, so they fail when a new
 * overlapping writer is introduced anywhere in the app.
 */

const ROOT = join(__dirname, '../..')

function readCode(rel: string): string {
  // Strip comments so prose describing a banned pattern does not trip a scan.
  return readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** The protected profile authority fields. */
const PROTECTED_FIELDS = [
  'tenant_id',
  'role',
  'is_active',
  'user_type',
  'external_org',
  'home_role_id',
  'department',
] as const

/**
 * Every file that performs a profiles write, and whether it is allowed to
 * touch protected fields. Only the canonical service may.
 */
const PROFILE_WRITERS: { file: string; protectedAllowed: boolean }[] = [
  { file: 'lib/auth/provisioning.ts', protectedAllowed: true },
  { file: 'app/actions/admin.ts', protectedAllowed: false },
  { file: 'app/actions/external-access.ts', protectedAllowed: false },
  { file: 'app/actions/procurement.ts', protectedAllowed: false },
  { file: 'app/actions/team.ts', protectedAllowed: false },
  { file: 'app/actions/settings.ts', protectedAllowed: false },
  { file: 'app/actions/locale.ts', protectedAllowed: false },
  { file: 'app/auth/login/page.tsx', protectedAllowed: false },
]

/**
 * Extract the object literal passed to each profiles insert/update/upsert.
 * Deliberately conservative: it only needs to see the keys being written.
 */
function profileWritePayloads(code: string): string[] {
  const payloads: string[] = []
  const pattern = /from\(\s*['"]profiles['"]\s*\)\s*(?:\r?\n\s*)?\.\s*(insert|update|upsert)\s*\(/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    const start = pattern.lastIndex
    let depth = 1
    let i = start
    while (i < code.length && depth > 0) {
      if (code[i] === '(' || code[i] === '{') depth += 1
      else if (code[i] === ')' || code[i] === '}') depth -= 1
      i += 1
    }
    payloads.push(code.slice(start, i))
  }
  return payloads
}

describe('19. no overlapping protected-profile writer', () => {
  for (const { file, protectedAllowed } of PROFILE_WRITERS) {
    if (protectedAllowed) continue

    it(`${file} writes no protected authority field`, () => {
      const payloads = profileWritePayloads(readCode(file))

      for (const payload of payloads) {
        for (const field of PROTECTED_FIELDS) {
          expect(
            new RegExp(`\\b${field}\\s*:`).test(payload),
            `${file} writes protected field "${field}" directly:\n${payload.trim()}`,
          ).toBe(false)
        }
      }
    })
  }

  it('the canonical service is the only file writing protected fields', () => {
    const canonical = profileWritePayloads(readCode('lib/auth/provisioning.ts'))
    // Sanity: the guard above is meaningless if the service writes nothing.
    expect(canonical.length).toBeGreaterThan(0)
  })
})

describe('18. legacy provisioning actions delegate to the canonical service', () => {
  const DELEGATIONS: { file: string; symbols: string[] }[] = [
    {
      file: 'app/actions/admin.ts',
      symbols: [
        'changeUserRole',
        'provisionInternalUser',
        'deactivateUser as deactivateUserAuthority',
        'activateUser as activateUserAuthority',
      ],
    },
    {
      file: 'app/actions/external-access.ts',
      symbols: ['provisionExternalUser', 'deactivateUser'],
    },
    {
      file: 'app/actions/procurement.ts',
      symbols: ['authorizeVendorProvisioning', 'provisionExternalUser'],
    },
    { file: 'app/actions/team.ts', symbols: ['assignHomeRole'] },
  ]

  for (const { file, symbols } of DELEGATIONS) {
    it(`${file} imports from lib/auth/provisioning`, () => {
      const code = readCode(file)
      expect(code).toMatch(/from '@\/lib\/auth\/provisioning'/)
      for (const symbol of symbols) {
        expect(code).toContain(symbol)
      }
    })
  }

  it('deactivation is never simulated by demoting the role', () => {
    for (const { file } of PROFILE_WRITERS) {
      const code = readCode(file)
      expect(code).not.toMatch(/department:\s*'Deactivated'/)
      expect(code).not.toMatch(/role:\s*'viewer',\s*is_active:\s*false/)
    }
  })
})

/**
 * Operational scripts in scripts/ run from a terminal with a service-role key
 * and NO request context, so there is no actor to authorize against and they
 * cannot call the canonical service. They are therefore out-of-band writers by
 * construction.
 *
 * They are not migrated in this batch, but the set is pinned: adding a new
 * script that writes protected profile fields fails this test, so the exception
 * cannot quietly grow into a second provisioning path.
 */
describe('out-of-band script writers are pinned', () => {
  const KNOWN_SCRIPT_WRITERS = [
    'scripts/exec-reinvite.mjs',
    'scripts/pilot-invite.mjs',
    'scripts/reinvite-vendor.ts',
  ].sort()

  it('no unpinned script writes protected profile fields', () => {
    const { globSync } = require('node:fs') as typeof import('node:fs')
    const files = globSync('scripts/**/*.{ts,mjs,js}', { cwd: ROOT }) as string[]

    const writers = files
      .filter((f) => {
        const code = readCode(f)
        return profileWritePayloads(code).some((payload) =>
          PROTECTED_FIELDS.some((field) => new RegExp(`\\b${field}\\s*:`).test(payload)),
        )
      })
      .map((f) => f.replace(/\\/g, '/'))
      .sort()

    expect(writers).toEqual(KNOWN_SCRIPT_WRITERS)
  })
})

describe('audit contract', () => {
  it('uses the real audit_log columns, never the rejected shape', () => {
    const code = readCode('lib/auth/provisioning.ts')

    expect(code).toMatch(/table_name:/)
    expect(code).toMatch(/record_id:/)
    expect(code).toMatch(/changed_by:/)
    // These columns do not exist on audit_log; inserts using them are rejected.
    expect(code).not.toMatch(/resource_type:/)
    expect(code).not.toMatch(/resource_id:/)
    expect(code).not.toMatch(/\bdetails:/)
  })

  it('never treats a discarded audit error as success', () => {
    const code = readCode('lib/auth/provisioning.ts')
    // The audit insert result must be captured, not awaited bare.
    expect(code).toMatch(/const \{ error \} = await admin\.from\('audit_log'\)\.insert/)
  })

  it('is server-only', () => {
    expect(readCode('lib/auth/provisioning.ts')).toMatch(/import 'server-only'/)
  })
})
