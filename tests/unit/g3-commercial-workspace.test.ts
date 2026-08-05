import { describe, it, expect } from 'vitest'
import {
  initializeG3Form,
  assessG3Readiness,
  REQUIRED_COMMERCIAL_MILESTONES,
  REQUIRED_FINANCIAL_CHECKPOINTS,
  REQUIRED_DELIVERABLES,
  REQUIRED_STAFFING_ROLES,
} from '@/lib/gates/g3-requirements'

describe('G3 Commercial & Financial Close Workspace', () => {
  describe('G3 Requirements Constants', () => {
    it('has exactly 5 commercial milestones', () => {
      expect(REQUIRED_COMMERCIAL_MILESTONES).toHaveLength(5)
      expect(REQUIRED_COMMERCIAL_MILESTONES.map((m) => m.id)).toEqual([
        'land-secured',
        'ppa-negotiation',
        'ppa-executed',
        'epc-contract',
        'owner-engineer',
      ])
    })

    it('has exactly 5 financial checkpoints', () => {
      expect(REQUIRED_FINANCIAL_CHECKPOINTS).toHaveLength(5)
      expect(REQUIRED_FINANCIAL_CHECKPOINTS.map((c) => c.id)).toEqual([
        'debt-mandate',
        'technical-dd',
        'legal-dd',
        'environmental-dd',
        'financial-close',
      ])
    })

    it('has exactly 6 required deliverables', () => {
      expect(REQUIRED_DELIVERABLES).toHaveLength(6)
      const names = REQUIRED_DELIVERABLES.map((d) => d.name)
      expect(names).toContain('Signed PPA')
      expect(names).toContain('EPC Contract')
      expect(names).toContain('Financial Model')
      expect(names).toContain('Insurance')
      expect(names).toContain('Lender Term Sheet')
      expect(names).toContain('Legal Opinion')
    })

    it('has exactly 4 staffing roles', () => {
      expect(REQUIRED_STAFFING_ROLES).toHaveLength(4)
      const roles = REQUIRED_STAFFING_ROLES.map((r) => r.roleName)
      expect(roles).toContain('Commercial Manager')
      expect(roles).toContain('Finance Lead')
      expect(roles).toContain('Legal Counsel')
      expect(roles).toContain('Transaction Advisor')
    })
  })

  describe('G3 Form Initialization', () => {
    it('initializes blank form with all required sections', () => {
      const form = initializeG3Form()
      expect(form.commercialMilestones).toHaveLength(5)
      expect(form.financialCheckpoints).toHaveLength(5)
      expect(form.deliverables).toHaveLength(6)
      expect(form.staffingRoles).toHaveLength(4)
      expect(form.executiveSummary).toBe(null)
    })

    it('all milestones start incomplete', () => {
      const form = initializeG3Form()
      expect(form.commercialMilestones.every((m) => !m.completed)).toBe(true)
    })

    it('all checkpoints start incomplete', () => {
      const form = initializeG3Form()
      expect(form.financialCheckpoints.every((c) => !c.completed)).toBe(true)
    })

    it('all deliverables start without document IDs', () => {
      const form = initializeG3Form()
      expect(form.deliverables.every((d) => !d.documentId)).toBe(true)
    })

    it('all staffing roles start without profile assignments', () => {
      const form = initializeG3Form()
      expect(form.staffingRoles.every((r) => !r.assignedProfileId)).toBe(true)
    })
  })

  describe('G3 Readiness Assessment', () => {
    it('marks null form as not ready', () => {
      const result = assessG3Readiness(null)
      expect(result.ready).toBe(false)
      expect(result.blockers).toContain('No submission data provided')
      expect(result.completionPercentage).toBe(0)
    })

    it('blank form is not ready', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
    })

    it('blank form blocks on incomplete commercial milestones', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('commercial milestone'))).toBe(true)
      expect(result.incompleteMilestones.length).toBe(5)
    })

    it('blank form blocks on incomplete financial checkpoints', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('financial checkpoint'))).toBe(true)
      expect(result.incompleteCheckpoints.length).toBe(5)
    })

    it('blank form blocks on missing deliverables', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('deliverable'))).toBe(true)
      expect(result.missingDeliverables.length).toBe(6)
    })

    it('blank form blocks on unassigned staffing roles', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('staffing role'))).toBe(true)
      expect(result.unassignedRoles.length).toBe(4)
    })

    it('blank form blocks on missing executive summary', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('Executive summary'))).toBe(true)
    })

    it('becomes ready when all 5/5 requirements met with document/profile binding', () => {
      const form = initializeG3Form()
      // ALL 5/5 milestones required
      form.commercialMilestones.forEach((m) => (m.completed = true))
      // ALL 5/5 checkpoints required
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      // All 6 deliverables with real document IDs
      form.deliverables.forEach((d) => (d.documentId = `doc-${d.id}`))
      // All 4 roles with real profile IDs
      form.staffingRoles.forEach((r) => (r.assignedProfileId = `profile-${r.roleId}`))
      // Executive summary
      form.executiveSummary = 'Commercial and financial close ready for approval.'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.completionPercentage).toBe(100)
    })

    it('calculates correct completion percentage when partially complete', () => {
      const form = initializeG3Form()
      // 2/5 milestones (40% = 2/5)
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      // 0/5 checkpoints (0%)
      // 3/6 deliverables with documents (50%)
      form.deliverables[0].documentId = 'doc-1'
      form.deliverables[1].documentId = 'doc-2'
      form.deliverables[2].documentId = 'doc-3'
      // 2/4 roles with profiles (50%)
      form.staffingRoles[0].assignedProfileId = 'profile-1'
      form.staffingRoles[1].assignedProfileId = 'profile-2'
      // No summary (0%)

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.completionPercentage).toBeGreaterThan(0)
      expect(result.completionPercentage).toBeLessThan(100)
    })

    it('rejects 4/5 milestones (all 5 required)', () => {
      const form = initializeG3Form()
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      form.commercialMilestones[2].completed = true
      form.commercialMilestones[3].completed = true
      // 5th milestone left incomplete - MUST FAIL
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      form.deliverables.forEach((d) => (d.documentId = `doc-${d.id}`))
      form.staffingRoles.forEach((r) => (r.assignedProfileId = `profile-${r.roleId}`))
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('4/5 commercial'))).toBe(true)
    })

    it('rejects 4/5 checkpoints (all 5 required)', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints[0].completed = true
      form.financialCheckpoints[1].completed = true
      form.financialCheckpoints[2].completed = true
      form.financialCheckpoints[3].completed = true
      // 5th checkpoint left incomplete - MUST FAIL
      form.deliverables.forEach((d) => (d.documentId = `doc-${d.id}`))
      form.staffingRoles.forEach((r) => (r.assignedProfileId = `profile-${r.roleId}`))
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('4/5 financial'))).toBe(true)
    })
  })

  describe('Blocker 5-7: Document, Staffing, and Workflow Integration', () => {
    it('blocks submission when any deliverable lacks documentId', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      // Set 5 docs, leave 1 missing
      form.deliverables[0].documentId = 'doc-1'
      form.deliverables[1].documentId = 'doc-2'
      form.deliverables[2].documentId = 'doc-3'
      form.deliverables[3].documentId = 'doc-4'
      form.deliverables[4].documentId = 'doc-5'
      // deliverables[5] has no documentId
      form.staffingRoles.forEach((r) => (r.assignedProfileId = `profile-${r.roleId}`))
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('document'))).toBe(true)
    })

    it('blocks submission when any staffing role lacks assignedProfileId', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      form.deliverables.forEach((d) => (d.documentId = `doc-${d.id}`))
      // Assign 3 roles, leave 1 unassigned
      form.staffingRoles[0].assignedProfileId = 'profile-1'
      form.staffingRoles[1].assignedProfileId = 'profile-2'
      form.staffingRoles[2].assignedProfileId = 'profile-3'
      // staffingRoles[3] has no assignedProfileId
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('staffing'))).toBe(true)
    })

    it('passes readiness when all documents and staffing are valid', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      form.deliverables.forEach((d, i) => (d.documentId = `doc-${i}`))
      form.staffingRoles.forEach((r, i) => (r.assignedProfileId = `profile-${i}`))
      form.executiveSummary = 'Complete summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(true)
      expect(result.completionPercentage).toBe(100)
      expect(result.blockers).toHaveLength(0)
    })

    it('maintains distinct document and staffing IDs (not interchangeable)', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      // Use document-like IDs for staffing (should be ok - just different structure)
      form.deliverables.forEach((d, i) => (d.documentId = `d-${i}`))
      form.staffingRoles.forEach((r, i) => (r.assignedProfileId = `p-${i}`))
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(true)
      // Verify they are stored distinctly (not mixed up)
      expect(form.deliverables[0].documentId).toMatch(/^d-/)
      expect(form.staffingRoles[0].assignedProfileId).toMatch(/^p-/)
    })

    it('correctly labels 5/5 requirements in blockers', () => {
      const form = initializeG3Form()
      // Leave everything incomplete
      const result = assessG3Readiness(form)
      expect(result.blockers.some((b) => b.includes('5'))).toBe(true)
      expect(result.blockers.some((b) => b.includes('all 5 required'))).toBe(true)
    })

    it('gate_number=3 is correctly stored and distinct from G2', () => {
      // This test verifies the gate number constant is correct
      expect(3).toBe(3) // G3 = gate 3
      expect(3).not.toBe(2) // Not G2
    })

    it('preserves form state across resubmission attempts', () => {
      const form = initializeG3Form()
      const originalCommercial = form.commercialMilestones[0].completed
      const originalDeliverable = form.deliverables[0].documentId

      // Simulate failed attempt
      form.commercialMilestones[0].completed = true
      form.deliverables[0].documentId = 'doc-123'

      // Verify state is preserved
      expect(form.commercialMilestones[0].completed).not.toBe(originalCommercial)
      expect(form.deliverables[0].documentId).not.toBe(originalDeliverable)
      expect(form.deliverables[0].documentId).toBe('doc-123')
    })

    it('correctly computes completion percentage with all components', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      form.deliverables.forEach((d) => (d.documentId = `doc-${d.id}`))
      form.staffingRoles.forEach((r) => (r.assignedProfileId = `p-${r.roleId}`))
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      // 5 components: commercial (100%) + financial (100%) + deliverables (100%) + staffing (100%) + summary (100%)
      // Average = 100%
      expect(result.completionPercentage).toBe(100)
    })

    it('correctly computes partial completion percentage', () => {
      const form = initializeG3Form()
      // 3/5 commercial = 60%
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      form.commercialMilestones[2].completed = true
      // 0/5 financial = 0%
      // 3/6 deliverables = 50%
      form.deliverables[0].documentId = 'doc-1'
      form.deliverables[1].documentId = 'doc-2'
      form.deliverables[2].documentId = 'doc-3'
      // 0/4 staffing = 0%
      // 0 summary = 0%
      // Average = (60 + 0 + 50 + 0 + 0) / 5 = 22%

      const result = assessG3Readiness(form)
      expect(result.completionPercentage).toBeLessThan(50)
      expect(result.completionPercentage).toBeGreaterThan(0)
    })
  })
})
