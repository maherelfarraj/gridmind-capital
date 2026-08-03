import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * SECURITY DEFINER Execute Privilege Lockdown — structural tests.
 *
 * These tests assert against the ACTUAL migration SQL text (not prose), and in
 * particular guard the RLS-helper carve-out that a naive "revoke from everyone"
 * lockdown gets wrong.
 *
 * Proven empirically (validation branch, self-rolling-back probe): a function
 * invoked inside an RLS policy USING/CHECK clause is executed AS THE QUERYING
 * ROLE, so `authenticated` MUST retain EXECUTE on current_user_role() and
 * current_user_org() or every SELECT/UPDATE on the 7 dependent policies fails
 * with "permission denied for function".
 *
 * Dependent policies (all TO authenticated):
 *   current_user_role -> cr_external_read (client_reports),
 *                        pm_external_read (payment_milestones),
 *                        vo_external_read (variation_orders)
 *   current_user_org  -> pol_read (purchase_order_lines),
 *                        po_external_read + po_external_ack (purchase_orders),
 *                        rfq_external_read (rfqs)
 */

const MIGRATION = join(
  process.cwd(),
  'supabase/migrations/20260801100000_security_definer_execute_lockdown.sql',
)

const sql = readFileSync(MIGRATION, 'utf8')

// Strip SQL line comments so assertions match executable statements, not prose.
const executable = sql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n')

const hasStatement = (re: RegExp) => re.test(executable)

// RLS helpers that MUST retain authenticated EXECUTE.
const RLS_HELPERS = ['current_user_role', 'current_user_org'] as const

// Functions that are safe to fully lock down (no RLS policy, no app RPC).
const LOCKED_DOWN = [
  'audit_trigger_fn',
  'consume_rate_limit',
  ...Array.from({ length: 10 }, (_, i) => `gm_rule_b${i + 1}`),
] as const

describe('SECURITY DEFINER lockdown — RLS helper carve-out', () => {
  for (const fn of RLS_HELPERS) {
    describe(`${fn}()`, () => {
      it('revokes EXECUTE from PUBLIC', () => {
        expect(
          hasStatement(
            new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\(\\)\\s+FROM\\s+PUBLIC`, 'i'),
          ),
        ).toBe(true)
      })

      it('revokes EXECUTE from anon', () => {
        expect(
          hasStatement(
            new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\(\\)\\s+FROM\\s+anon`, 'i'),
          ),
        ).toBe(true)
      })

      it('GRANTS EXECUTE to authenticated (required by dependent RLS policies)', () => {
        expect(
          hasStatement(
            new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\(\\)\\s+TO\\s+authenticated`, 'i'),
          ),
        ).toBe(true)
      })

      it('REGRESSION GUARD: never revokes EXECUTE from authenticated', () => {
        // This exact line caused a production read outage in the first revision.
        expect(
          hasStatement(
            new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\(\\)\\s+FROM\\s+authenticated`, 'i'),
          ),
        ).toBe(false)
      })
    })
  }
})

describe('SECURITY DEFINER lockdown — fully locked-down functions', () => {
  for (const fn of LOCKED_DOWN) {
    // consume_rate_limit has a typed signature; match its identifier with optional args.
    const sig = fn === 'consume_rate_limit' ? `${fn}\\([^)]*\\)` : `${fn}\\(\\)`

    it(`${fn}: revokes EXECUTE from authenticated`, () => {
      expect(
        hasStatement(
          new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+FROM\\s+authenticated`, 'i'),
        ),
      ).toBe(true)
    })

    it(`${fn}: revokes EXECUTE from anon`, () => {
      expect(
        hasStatement(
          new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+FROM\\s+anon`, 'i'),
        ),
      ).toBe(true)
    })

    it(`${fn}: revokes EXECUTE from PUBLIC`, () => {
      expect(
        hasStatement(
          new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+FROM\\s+PUBLIC`, 'i'),
        ),
      ).toBe(true)
    })

    it(`${fn}: must NOT be granted to authenticated`, () => {
      expect(
        hasStatement(
          new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+TO\\s+authenticated`, 'i'),
        ),
      ).toBe(false)
    })
  }
})

describe('SECURITY DEFINER lockdown — migration integrity', () => {
  it('is wrapped in a transaction', () => {
    expect(/^\s*BEGIN\s*;/im.test(executable)).toBe(true)
    expect(/COMMIT\s*;/i.test(executable)).toBe(true)
  })

  it('does not alter any function body (no CREATE/ALTER FUNCTION)', () => {
    expect(/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i.test(executable)).toBe(false)
    expect(/ALTER\s+FUNCTION/i.test(executable)).toBe(false)
  })

  it('is ordered after P0 (filename timestamp strictly greater than 20260801095527)', () => {
    const ts = Number(MIGRATION.match(/(\d{14})_/)?.[1])
    expect(ts).toBeGreaterThan(20260801095527)
  })
})
