import { describe, it, expect } from 'vitest'
import {
  isGateNumberMissing,
  duplicateWorkflowMessage,
  shouldRouteGateDecisionToRpc,
  isAdminOverride,
} from '@/lib/approvals/gate-routing'

describe('isGateNumberMissing', () => {
  it('is true for a gate workflow with null or undefined gate number', () => {
    expect(isGateNumberMissing('gate', null)).toBe(true)
    expect(isGateNumberMissing('gate', undefined)).toBe(true)
  })

  it('treats gate number 0 as PRESENT (explicit check, not truthiness)', () => {
    // This is the critical regression: a truthiness check (`!gateNumber`) would
    // wrongly reject gate 0. Gate 0 is a valid gate number and must be accepted.
    expect(isGateNumberMissing('gate', 0)).toBe(false)
  })

  it('is false for any positive gate number', () => {
    expect(isGateNumberMissing('gate', 1)).toBe(false)
    expect(isGateNumberMissing('gate', 3)).toBe(false)
  })

  it('never requires a gate number for non-gate objects', () => {
    expect(isGateNumberMissing('opportunity', null)).toBe(false)
    expect(isGateNumberMissing('opportunity', undefined)).toBe(false)
    expect(isGateNumberMissing('variation_order', null)).toBe(false)
  })
})

describe('duplicateWorkflowMessage', () => {
  it('names the specific gate for gate workflows', () => {
    expect(duplicateWorkflowMessage('gate', 3)).toBe(
      'Workflow already pending or delegated for gate 3',
    )
    expect(duplicateWorkflowMessage('gate', 2)).toBe(
      'Workflow already pending or delegated for gate 2',
    )
  })

  it('includes gate 0 in the gate-specific message', () => {
    expect(duplicateWorkflowMessage('gate', 0)).toBe(
      'Workflow already pending or delegated for gate 0',
    )
  })

  it('uses a generic, object-type-named message for non-gate objects', () => {
    expect(duplicateWorkflowMessage('opportunity', null)).toBe(
      'Workflow already pending or delegated for this opportunity',
    )
    expect(duplicateWorkflowMessage('variation_order', undefined)).toBe(
      'Workflow already pending or delegated for this variation_order',
    )
  })

  it('does not leak a "gate N" phrasing onto non-gate objects', () => {
    // Note: the word "delegated" contains the substring "gate", so assert on the
    // specific "for gate <n>" phrasing rather than the bare substring "gate".
    expect(duplicateWorkflowMessage('opportunity', 3)).not.toMatch(/for gate \d/)
  })
})

describe('shouldRouteGateDecisionToRpc', () => {
  it('routes only gate objects through the atomic RPC', () => {
    expect(shouldRouteGateDecisionToRpc('gate')).toBe(true)
    expect(shouldRouteGateDecisionToRpc('opportunity')).toBe(false)
    expect(shouldRouteGateDecisionToRpc(null)).toBe(false)
    expect(shouldRouteGateDecisionToRpc(undefined)).toBe(false)
  })
})

describe('isAdminOverride', () => {
  const ADMIN = ['system_admin', 'tenant_admin', 'project_director'] as const

  it('is true only when an admin decides an approval they are NOT assigned to', () => {
    expect(isAdminOverride('tenant_admin', 'u1', 'u2', ADMIN)).toBe(true)
  })

  it('is false when the admin IS the assignee (normal path, not an override)', () => {
    expect(isAdminOverride('tenant_admin', 'u1', 'u1', ADMIN)).toBe(false)
  })

  it('is false for a non-admin acting on someone else\u2019s approval', () => {
    expect(isAdminOverride('project_manager', 'u1', 'u2', ADMIN)).toBe(false)
  })

  it('is false when the actor role is missing', () => {
    expect(isAdminOverride(null, 'u1', 'u2', ADMIN)).toBe(false)
    expect(isAdminOverride(undefined, 'u1', 'u2', ADMIN)).toBe(false)
  })

  it('requires BOTH admin role AND non-assignee: neither alone suffices', () => {
    // admin but assignee -> false
    expect(isAdminOverride('system_admin', 'u1', 'u1', ADMIN)).toBe(false)
    // non-admin but non-assignee -> false
    expect(isAdminOverride('viewer', 'u1', 'u2', ADMIN)).toBe(false)
  })
})
