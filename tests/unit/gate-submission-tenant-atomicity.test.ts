import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server-action tests for `submitG4FormAction`..`submitG8FormAction`
 * (the shared `submitGateForm` helper in app/actions/gate-submissions.ts).
 *
 * These actions used to run 5 separate, unlocked round-trips: a project
 * lookup with NO tenant_id filter, an existing-submission check, an upsert
 * that never wrote tenant_id, an existing-approval check, and an approval
 * insert. That let a writer submit against another tenant's project and
 * left a TOCTOU window where two concurrent submissions could both pass the
 * existing-approval check and create duplicate pending approvals.
 *
 * The fix routes the whole operation through one `submit_gate_form_tx`
 * RPC call. These tests prove the action:
 *   - calls the RPC exactly once, with the actor's own tenantId/userId
 *     (never a separately-derived tenant lookup)
 *   - never touches `gate_submissions`/`approvals` directly from the app
 *   - surfaces the RPC's error message when the RPC rejects (which is
 *     where the tenant-mismatch and phase-lock guards actually live —
 *     proven against the live schema in a rolled-back SQL transaction,
 *     not re-derived here)
 *
 * Everything below the action is mocked at the module boundary; no
 * Supabase connection is opened.
 */

const state = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: any }>,
  rpcResult: { data: 'submitted' as unknown, error: null as { message: string } | null },
  fromCalls: [] as string[],
  actor: { userId: 'actor-1', tenantId: 'tenant-a', role: 'project_manager' as string },
}))

function makeBuilder(table: string) {
  state.fromCalls.push(table)
  const b: Record<string, any> = {
    select: () => b,
    eq: () => b,
    in: () => b,
    upsert: () => b,
    insert: () => b,
    update: () => b,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeBuilder(table),
    rpc: async (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args })
      return state.rpcResult
    },
  }),
}))

vi.mock('@/lib/auth/guard', () => ({
  requireWriter: async () => ({ actor: state.actor }),
}))

vi.mock('@/lib/email/send', () => ({
  sendApprovalRequestEmail: async () => ({}),
}))

import {
  submitG4FormAction,
  submitG5FormAction,
  submitG6FormAction,
  submitG7FormAction,
  submitG8FormAction,
} from '@/app/actions/gate-submissions'

beforeEach(() => {
  state.rpcCalls = []
  state.rpcResult = { data: 'submitted', error: null }
  state.fromCalls = []
  state.actor = { userId: 'actor-1', tenantId: 'tenant-a', role: 'project_manager' as string }
})

describe('submitGateForm (G4-G8) — tenant-scoped, atomic RPC', () => {
  it('calls submit_gate_form_tx exactly once with the actor own tenantId and userId, and no p_title', async () => {
    const result = await submitG4FormAction({ foo: 'bar' } as any, 'project-1', 'Project One')

    expect(result.error).toBeNull()
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0].fn).toBe('submit_gate_form_tx')
    // Exact key set (not toMatchObject) so a reintroduced p_title, or any
    // other stray argument, fails this assertion instead of passing silently.
    expect(Object.keys(state.rpcCalls[0].args).sort()).toEqual(
      ['p_actor', 'p_form_data', 'p_gate_number', 'p_project_id', 'p_tenant_id'].sort(),
    )
    expect(state.rpcCalls[0].args).toEqual({
      p_tenant_id: 'tenant-a',
      p_project_id: 'project-1',
      p_gate_number: 4,
      p_actor: 'actor-1',
      p_form_data: { foo: 'bar' },
    })
  })

  it('never sends a title/name derived from client input — the RPC derives it server-side', async () => {
    // A caller-supplied projectName must never leak into the RPC call, even
    // if it is spoofed/mismatched relative to the real project.
    await submitG4FormAction({ foo: 'bar' } as any, 'project-1', 'Spoofed Project Name — Not The Real One')

    expect(state.rpcCalls[0].args).not.toHaveProperty('p_title')
    expect(JSON.stringify(state.rpcCalls[0].args)).not.toContain('Spoofed Project Name')
  })

  it('never reads or writes gate_submissions/approvals directly from the app', async () => {
    await submitG4FormAction({ foo: 'bar' } as any, 'project-1', 'Project One')

    expect(state.fromCalls).not.toContain('gate_submissions')
    expect(state.fromCalls).not.toContain('approvals')
    expect(state.fromCalls).not.toContain('projects')
  })

  it('uses a different actor tenantId per call — never a hardcoded/shared tenant', async () => {
    state.actor = { userId: 'actor-2', tenantId: 'tenant-b', role: 'project_director' as string }

    await submitG6FormAction({ x: 1 } as any, 'project-9', 'Project Nine')

    expect(state.rpcCalls[0].args.p_tenant_id).toBe('tenant-b')
    expect(state.rpcCalls[0].args.p_actor).toBe('actor-2')
    expect(state.rpcCalls[0].args.p_gate_number).toBe(6)
  })

  it('passes through each gate number correctly for G5, G7, G8', async () => {
    await submitG5FormAction({} as any, 'p', 'P')
    await submitG7FormAction({} as any, 'p', 'P')
    await submitG8FormAction({} as any, 'p', 'P')

    expect(state.rpcCalls.map((c) => c.args.p_gate_number)).toEqual([5, 7, 8])
  })

  it('surfaces the RPC error message (e.g. tenant-mismatch or phase-lock guard) without throwing', async () => {
    state.rpcResult = {
      data: null,
      error: { message: 'submit_gate_form_tx: project project-1 not found for tenant tenant-a' },
    }

    const result = await submitG4FormAction({} as any, 'project-1', 'Project One')

    expect(result.error).toBe('submit_gate_form_tx: project project-1 not found for tenant tenant-a')
  })

  it('rejects before calling the RPC when the caller is not an authorized writer', async () => {
    vi.doMock('@/lib/auth/guard', () => ({
      requireWriter: async () => ({ error: 'Not authorized: this role cannot write' }),
    }))
    vi.resetModules()
    const { submitG4FormAction: freshAction } = await import('@/app/actions/gate-submissions')

    const result = await freshAction({} as any, 'project-1', 'Project One')

    expect(result.error).toBe('Not authorized: this role cannot write')
    expect(state.rpcCalls).toHaveLength(0)
  })
})
