import { describe, it, expect } from 'vitest'
import {
  mapOpportunityApprovalDetail,
  resolveLinkedProject,
  computeInitials,
  type RawApproval,
  type RawProject,
  type RawRequester,
} from '@/lib/approvals/opportunity-detail'

// ── Production-shaped fixtures (approval e4aa843b…) ─────────────
const TENANT = '00000000-0000-0000-0000-000000000001'
const OTHER_TENANT = '11111111-1111-1111-1111-111111111111'
const PROJECT_ID = 'b9d542bc-530e-4df6-a52a-9f285d89add0'

const approval: RawApproval = {
  id: 'e4aa843b-a5a2-45b1-a22e-1eb3028bc0b0',
  tenant_id: TENANT,
  object_type: 'opportunity',
  object_id: PROJECT_ID,
  title: 'PRJ-2026-384',
  status: 'pending',
  priority: 'normal',
  created_at: '2026-07-28T00:00:00.000Z',
  description: null,
  requester_id: 'fdf38b95-4cbf-4462-af59-10f74fd179ea',
  amount: null,
}

const project: RawProject = {
  id: PROJECT_ID,
  tenant_id: TENANT,
  name: 'Jordan Solar Farm – Phase 1',
  code: 'PRJ-2026-384',
  technology: 'Solar PV',
  capacity_mw: 25,
  location: 'Mafraq',
  country: 'Jordan',
  target_completion: '2027-11-30',
  status: 'planning',
}

const requester: RawRequester = {
  id: 'fdf38b95-4cbf-4462-af59-10f74fd179ea',
  tenant_id: TENANT,
  full_name: 'Maher Mohammad  Al-Farraj',
  email: 'maher@farah.jo',
  role: 'tenant_admin',
}

describe('mapOpportunityApprovalDetail — real project resolution', () => {
  it('resolves the production-shaped approval to the real linked project', () => {
    const view = mapOpportunityApprovalDetail({ approval, project, requester })

    expect(view.projectAvailable).toBe(true)
    expect(view.linkedProject.available).toBe(true)
    expect(view.linkedProject.name).toBe('Jordan Solar Farm – Phase 1')
    expect(view.linkedProject.code).toBe('PRJ-2026-384')
    expect(view.linkedProject.technology).toBe('Solar PV')
    expect(view.linkedProject.capacityMw).toBe('25')
    expect(view.linkedProject.location).toBe('Mafraq')
    expect(view.linkedProject.country).toBe('Jordan')
    expect(view.linkedProject.targetCompletion).toBe('2027-11-30')

    // The G0 surface is fed real project values, not synthesised ones.
    expect(view.opportunity.opportunityName).toBe('Jordan Solar Farm – Phase 1')
    expect(view.opportunity.opportunityCode).toBe('PRJ-2026-384')
    expect(view.opportunity.technologyType).toBe('Solar PV')
    expect(view.opportunity.estimatedCapacityMw).toBe('25')
    expect(view.opportunity.siteLocation).toBe('Mafraq, Jordan')
  })

  it('resolves the REAL requester (never a generic "Project Manager")', () => {
    const view = mapOpportunityApprovalDetail({ approval, project, requester })
    expect(view.requester.available).toBe(true)
    expect(view.requester.name).toBe('Maher Mohammad  Al-Farraj')
    expect(view.requester.email).toBe('maher@farah.jo')
    expect(view.requester.role).toBe('tenant_admin')
    expect(view.requester.name).not.toBe('Project Manager')
  })

  it('REGRESSION: never emits the fabricated OPP-OPPORTUNITY-2026 code or a Project Manager placeholder', () => {
    // The bug produced these exact strings from approval metadata. Assert the
    // entire serialised view contains neither, for the real case AND the
    // missing-project case.
    for (const proj of [project, null]) {
      for (const req of [requester, null]) {
        const view = mapOpportunityApprovalDetail({ approval, project: proj, requester: req })
        const serialised = JSON.stringify(view)
        expect(serialised).not.toContain('OPP-OPPORTUNITY-2026')
        expect(serialised).not.toMatch(/OPP-[A-Z]+-2026/)
        expect(view.requester.name).not.toBe('Project Manager')
        expect(view.requester.role).not.toBe('Project Manager')
        // No fabricated opportunity code was ever invented.
        if (!proj) expect(view.opportunity.opportunityCode).toBeUndefined()
      }
    }
  })
})

describe('mapOpportunityApprovalDetail — explicit unavailable states', () => {
  it('missing project fails visibly (available:false) and safely — no fabricated data', () => {
    const view = mapOpportunityApprovalDetail({ approval, project: null, requester })
    expect(view.projectAvailable).toBe(false)
    expect(view.linkedProject.available).toBe(false)
    expect(view.linkedProject.attemptedId).toBe(PROJECT_ID)
    expect(view.linkedProject.name).toBeNull()
    expect(view.linkedProject.technology).toBeNull()
    expect(view.linkedProject.capacityMw).toBeNull()
    // The G0 surface renders em dashes because there is nothing to show.
    expect(view.opportunity.opportunityName).toBeUndefined()
    expect(view.opportunity.technologyType).toBeUndefined()
  })

  it('missing requester profile yields an explicit "Requester unavailable" marker', () => {
    const view = mapOpportunityApprovalDetail({ approval, project, requester: null })
    expect(view.requester.available).toBe(false)
    expect(view.requester.name).toBe('Requester unavailable')
    expect(view.requester.name).not.toBe('Project Manager')
  })
})

describe('resolveLinkedProject — tenant isolation', () => {
  it("another tenant's project cannot be resolved", () => {
    const foreign: RawProject = { ...project, tenant_id: OTHER_TENANT }
    expect(resolveLinkedProject(approval, foreign)).toBeNull()

    const view = mapOpportunityApprovalDetail({ approval, project: foreign, requester })
    expect(view.projectAvailable).toBe(false)
    expect(view.linkedProject.available).toBe(false)
    // The foreign project's data must not leak anywhere in the view.
    expect(JSON.stringify(view)).not.toContain('Jordan Solar Farm')
  })

  it("another tenant's requester profile cannot populate the requester", () => {
    const foreignReq: RawRequester = { ...requester, tenant_id: OTHER_TENANT }
    const view = mapOpportunityApprovalDetail({ approval, project, requester: foreignReq })
    expect(view.requester.available).toBe(false)
    expect(JSON.stringify(view.requester)).not.toContain('maher@farah.jo')
  })

  it('a project whose id differs from object_id is refused (stale/forged reference)', () => {
    const mismatched: RawProject = { ...project, id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }
    expect(resolveLinkedProject(approval, mismatched)).toBeNull()
  })

  it('non-opportunity approvals never resolve a project', () => {
    const nonOpp: RawApproval = { ...approval, object_type: 'purchase_order' }
    expect(resolveLinkedProject(nonOpp, project)).toBeNull()
  })
})

describe('computeInitials', () => {
  it('handles multi-word, single-word, and empty names', () => {
    expect(computeInitials('Maher Al-Farraj')).toBe('MA')
    expect(computeInitials('Maher Mohammad  Al-Farraj')).toBe('MA')
    expect(computeInitials('Solaris')).toBe('SO')
    expect(computeInitials('')).toBe('?')
    expect(computeInitials(null)).toBe('?')
  })
})
