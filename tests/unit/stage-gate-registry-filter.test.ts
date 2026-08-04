import { describe, it, expect } from 'vitest'
import {
  activeGatePhaseNumber,
  projectMatchesActiveGate,
} from '@/lib/gates/phase-model'

/**
 * Regression tests for the Stage Gates Project Registry filter.
 *
 * Production evidence (Jordan Solar Farm – Phase 1, PRJ-2026-384):
 *   projects.current_phase = 1, projects.status = active
 *   phase_gates: G1 approved, G2 in_review, G3–G8 pending
 *
 * Bug: the filter treated `?gate=GN` as an exact projects.current_phase match,
 * so /projects?gate=G2 showed nothing (current_phase was 1) and /projects?gate=G1
 * showed the project even though G1 is an approved (historical) gate.
 *
 * Correct semantics: the active gate is the FIRST non-approved phase_gate.
 */

// The exact production gate rows for the evidence project.
const JORDAN_GATES = [
  { phase_number: 1, phase_name: 'Origination & Feasibility', status: 'approved' },
  { phase_number: 2, phase_name: 'Permitting & Grid Application', status: 'in_review' },
  { phase_number: 3, phase_name: 'Commercial & Financial Close (RTB)', status: 'pending' },
  { phase_number: 4, phase_name: 'Detailed Design (IFC)', status: 'pending' },
  { phase_number: 5, phase_name: 'Procurement & Manufacturing', status: 'pending' },
  { phase_number: 6, phase_name: 'Construction & Installation', status: 'pending' },
  { phase_number: 7, phase_name: 'Commissioning & Grid Tests', status: 'pending' },
  { phase_number: 8, phase_name: 'Handover & O&M', status: 'pending' },
]

describe('activeGatePhaseNumber', () => {
  it('returns the first non-approved gate (production evidence → G2)', () => {
    expect(activeGatePhaseNumber(JORDAN_GATES)).toBe(2)
  })

  it('returns null when every gate is approved (no active gate)', () => {
    const allApproved = JORDAN_GATES.map((g) => ({ ...g, status: 'approved' }))
    expect(activeGatePhaseNumber(allApproved)).toBeNull()
  })

  it('returns null for missing/empty gate rows', () => {
    expect(activeGatePhaseNumber(null)).toBeNull()
    expect(activeGatePhaseNumber(undefined)).toBeNull()
    expect(activeGatePhaseNumber([])).toBeNull()
  })

  it('treats conditional/rejected/pending all as non-approved (active)', () => {
    expect(
      activeGatePhaseNumber([
        { phase_number: 1, status: 'approved' },
        { phase_number: 2, status: 'conditional' },
      ]),
    ).toBe(2)
    expect(
      activeGatePhaseNumber([
        { phase_number: 1, status: 'approved' },
        { phase_number: 2, status: 'rejected' },
      ]),
    ).toBe(2)
    expect(
      activeGatePhaseNumber([
        { phase_number: 1, status: 'approved' },
        { phase_number: 2, status: 'pending' },
      ]),
    ).toBe(2)
  })

  it('is order-independent (unsorted rows still yield first non-approved)', () => {
    const shuffled = [...JORDAN_GATES].reverse()
    expect(activeGatePhaseNumber(shuffled)).toBe(2)
  })
})

describe('projectMatchesActiveGate — registry filter semantics', () => {
  it('project (G1 approved, G2 in_review) APPEARS under G2', () => {
    expect(projectMatchesActiveGate(JORDAN_GATES, 2)).toBe(true)
  })

  it('does NOT appear under G1 — G1 is an approved historical gate', () => {
    expect(projectMatchesActiveGate(JORDAN_GATES, 1)).toBe(false)
  })

  it('does NOT appear under pending future gate G3', () => {
    expect(projectMatchesActiveGate(JORDAN_GATES, 3)).toBe(false)
  })

  it('does not match any future pending gate G3–G8', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      expect(projectMatchesActiveGate(JORDAN_GATES, n)).toBe(false)
    }
  })

  it('a fully-approved project matches no gate at all', () => {
    const allApproved = JORDAN_GATES.map((g) => ({ ...g, status: 'approved' }))
    for (let n = 1; n <= 8; n++) {
      expect(projectMatchesActiveGate(allApproved, n)).toBe(false)
    }
  })

  it('a brand-new project (all pending) is active at G1', () => {
    const allPending = JORDAN_GATES.map((g) => ({ ...g, status: 'pending' }))
    expect(projectMatchesActiveGate(allPending, 1)).toBe(true)
    expect(projectMatchesActiveGate(allPending, 2)).toBe(false)
  })
})

/**
 * Behavioural expectations enforced in getProjects (documented here so the
 * intent is covered even though the DB query itself is integration-level):
 *
 * - Tenant isolation: getProjects resolves candidate project IDs under the
 *   `tenant_id = <current tenant>` filter BEFORE querying phase_gates, and
 *   constrains the final query with `.in('id', matchingIds)`. A cross-tenant
 *   project can never enter matchingIds because it is never in tenantProjectIds.
 * - Unfiltered registry (gate = null) skips this branch entirely and returns
 *   every tenant project, so the evidence project still appears with no filter.
 * - Zero matches return an empty array / { projects: [], totalCount: 0 } — there
 *   is NO mock/fallback data path.
 * - G0 (0) and out-of-range gates short-circuit to empty (no phase_gates row has
 *   an active gate of 0).
 */
describe('getProjects gate-branch invariants (guards)', () => {
  it('G0 and out-of-range gate numbers have no active-gate match', () => {
    // activeGatePhaseNumber only ever returns 1..8 or null, so 0 / 9 never match.
    expect(projectMatchesActiveGate(JORDAN_GATES, 0)).toBe(false)
    expect(projectMatchesActiveGate(JORDAN_GATES, 9)).toBe(false)
  })
})
