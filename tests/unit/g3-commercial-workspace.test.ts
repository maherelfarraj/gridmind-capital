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

    it('all deliverables start unuploaded', () => {
      const form = initializeG3Form()
      expect(form.deliverables.every((d) => !d.uploaded)).toBe(true)
      expect(form.deliverables.every((d) => d.uploadedAt === null)).toBe(true)
    })

    it('all staffing roles start unassigned', () => {
      const form = initializeG3Form()
      expect(form.staffingRoles.every((r) => !r.assignedTo)).toBe(true)
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

    it('becomes ready when all requirements met', () => {
      const form = initializeG3Form()
      // 4/5 milestones
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      form.commercialMilestones[2].completed = true
      form.commercialMilestones[3].completed = true
      // 4/5 checkpoints
      form.financialCheckpoints[0].completed = true
      form.financialCheckpoints[1].completed = true
      form.financialCheckpoints[2].completed = true
      form.financialCheckpoints[3].completed = true
      // All 6 deliverables
      form.deliverables.forEach((d) => {
        d.uploaded = true
        d.uploadedAt = new Date().toISOString()
      })
      // All 4 roles
      form.staffingRoles.forEach((r, i) => {
        r.assignedTo = { id: `role-${i}`, name: `Person ${i}` }
      })
      // Executive summary
      form.executiveSummary = 'Commercial and financial close ready for approval.'

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.completionPercentage).toBe(100)
    })

    it('calculates correct completion percentage when partially complete', () => {
      const form = initializeG3Form()
      // 2/5 milestones (50% towards 4 needed)
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      // 0/5 checkpoints (0%)
      // 3/6 deliverables (50%)
      form.deliverables[0].uploaded = true
      form.deliverables[1].uploaded = true
      form.deliverables[2].uploaded = true
      // 2/4 roles (50%)
      form.staffingRoles[0].assignedTo = { id: 'r1', name: 'Person 1' }
      form.staffingRoles[1].assignedTo = { id: 'r2', name: 'Person 2' }
      // No summary (0%)

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.completionPercentage).toBeGreaterThan(0)
      expect(result.completionPercentage).toBeLessThan(100)
    })

    it('requires only 4/5 milestones (5th not needed)', () => {
      const form = initializeG3Form()
      form.commercialMilestones[0].completed = true
      form.commercialMilestones[1].completed = true
      form.commercialMilestones[2].completed = true
      form.commercialMilestones[3].completed = true
      // 5th milestone left incomplete - should still be ready
      form.financialCheckpoints.forEach((c) => (c.completed = true))
      form.deliverables.forEach((d) => {
        d.uploaded = true
        d.uploadedAt = new Date().toISOString()
      })
      form.staffingRoles.forEach((r, i) => {
        r.assignedTo = { id: `role-${i}`, name: `Person ${i}` }
      })
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.incompleteMilestones).toHaveLength(0) // No blockers for incomplete items
      expect(result.ready).toBe(true)
    })

    it('requires only 4/5 checkpoints (5th not needed)', () => {
      const form = initializeG3Form()
      form.commercialMilestones.forEach((m) => (m.completed = true))
      form.financialCheckpoints[0].completed = true
      form.financialCheckpoints[1].completed = true
      form.financialCheckpoints[2].completed = true
      form.financialCheckpoints[3].completed = true
      // 5th checkpoint left incomplete - should still be ready
      form.deliverables.forEach((d) => {
        d.uploaded = true
        d.uploadedAt = new Date().toISOString()
      })
      form.staffingRoles.forEach((r, i) => {
        r.assignedTo = { id: `role-${i}`, name: `Person ${i}` }
      })
      form.executiveSummary = 'Summary'

      const result = assessG3Readiness(form)
      expect(result.incompleteCheckpoints).toHaveLength(0) // No blockers for incomplete items
      expect(result.ready).toBe(true)
    })
  })
})
