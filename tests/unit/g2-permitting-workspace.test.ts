import { describe, it, expect } from 'vitest'
import {
  assessG2Readiness,
  initializeG2Form,
  G2FormData,
  REQUIRED_PERMITTING_MILESTONES,
  REQUIRED_GRID_MILESTONES,
  REQUIRED_STAFFING_ROLES,
  REQUIRED_DELIVERABLES,
} from '@/lib/gates/g2-requirements'

describe('G2 Permitting Workspace', () => {
  describe('G2FormData initialization', () => {
    it('initializes blank form with all required items uncompleted', () => {
      const form = initializeG2Form()
      expect(form.permittingMilestones).toHaveLength(3)
      expect(form.gridMilestones).toHaveLength(3)
      expect(form.staffingRoles).toHaveLength(4)
      expect(form.deliverables).toHaveLength(4)
      expect(form.permittingMilestones.every((m) => !m.completed)).toBe(true)
      expect(form.gridMilestones.every((m) => !m.completed)).toBe(true)
      expect(form.staffingRoles.every((r) => !r.assignedTo)).toBe(true)
      expect(form.deliverables.every((d) => !d.uploaded)).toBe(true)
    })
  })

  describe('assessG2Readiness: empty/incomplete states', () => {
    it('returns not-ready (0%) for blank form', () => {
      const form = initializeG2Form()
      const result = assessG2Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.completionPercentage).toBe(0)
      expect(result.blockers.length).toBeGreaterThan(0)
    })

    it('returns not-ready for null form', () => {
      const result = assessG2Readiness(null)
      expect(result.ready).toBe(false)
      expect(result.completionPercentage).toBe(0)
      expect(result.blockers).toContain('No submission data provided')
    })

    it('identifies missing permitting milestones as blocker', () => {
      const form = initializeG2Form()
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'test', name: 'Test User' }))
      form.deliverables.forEach((d) => (d.uploaded = true))
      const result = assessG2Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('permitting'))).toBe(true)
    })

    it('identifies unassigned staffing roles as blocker', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.deliverables.forEach((d) => (d.uploaded = true))
      const result = assessG2Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('staffing'))).toBe(true)
      expect(result.unassignedRoles.length).toBeGreaterThan(0)
    })

    it('identifies missing deliverables as blocker', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'test', name: 'Test' }))
      const result = assessG2Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('deliverable'))).toBe(true)
      expect(result.missingDeliverables.length).toBeGreaterThan(0)
    })
  })

  describe('assessG2Readiness: completion percentage', () => {
    it('calculates 0% for blank form', () => {
      const form = initializeG2Form()
      const result = assessG2Readiness(form)
      expect(result.completionPercentage).toBe(0)
    })

    it('calculates 25% when only permitting milestones complete', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      const result = assessG2Readiness(form)
      expect(result.completionPercentage).toBeGreaterThanOrEqual(20)
      expect(result.completionPercentage).toBeLessThanOrEqual(30)
    })

    it('calculates 100% when all items complete', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.deliverables.forEach((d) => (d.uploaded = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'test', name: 'Test' }))
      const result = assessG2Readiness(form)
      expect(result.completionPercentage).toBe(100)
    })
  })

  describe('assessG2Readiness: ready state', () => {
    it('returns ready=true when all requirements met', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'test', name: 'Test User' }))
      form.deliverables.forEach((d) => (d.uploaded = true))
      form.summary = 'G2 submission complete'

      const result = assessG2Readiness(form)
      expect(result.ready).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.completionPercentage).toBe(100)
    })

    it('returns not-ready if even one item incomplete', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'test', name: 'Test' }))
      form.deliverables.forEach((d) => (d.uploaded = true))
      // Leave one grid milestone incomplete
      form.gridMilestones[0].completed = false

      const result = assessG2Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
    })
  })

  describe('Required items constants', () => {
    it('has exactly 3 required permitting milestones', () => {
      expect(REQUIRED_PERMITTING_MILESTONES).toHaveLength(3)
      expect(REQUIRED_PERMITTING_MILESTONES.every((m) => m.id && m.name)).toBe(true)
    })

    it('has exactly 3 required grid milestones', () => {
      expect(REQUIRED_GRID_MILESTONES).toHaveLength(3)
      expect(REQUIRED_GRID_MILESTONES.every((m) => m.id && m.name)).toBe(true)
    })

    it('has exactly 4 required staffing roles', () => {
      expect(REQUIRED_STAFFING_ROLES).toHaveLength(4)
      expect(REQUIRED_STAFFING_ROLES.every((r) => r.roleId && r.roleName)).toBe(true)
    })

    it('has exactly 4 required deliverables', () => {
      expect(REQUIRED_DELIVERABLES).toHaveLength(4)
      expect(REQUIRED_DELIVERABLES.every((d) => d.id && d.name && d.category)).toBe(true)
    })
  })

  describe('No fabrication: missing data shows explicit states', () => {
    it('form items have no placeholder/default assignees', () => {
      const form = initializeG2Form()
      form.staffingRoles.forEach((r) => {
        expect(r.assignedTo).toBeNull()
        expect(r.assignedTo).not.toEqual({ id: 'default', name: 'Default Engineer' })
      })
    })

    it('missing deliverables are explicitly marked uploaded=false', () => {
      const form = initializeG2Form()
      form.deliverables.forEach((d) => {
        expect(d.uploaded).toBe(false)
        expect(d.uploadedAt).toBeNull()
        expect(d.fileName).toBeNull()
      })
    })

    it('unstarted milestones are explicitly marked completed=false', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => {
        expect(m.completed).toBe(false)
      })
      form.gridMilestones.forEach((m) => {
        expect(m.completed).toBe(false)
      })
    })
  })

  describe('Edge cases', () => {
    it('handles form with partial completion', () => {
      const form = initializeG2Form()
      form.permittingMilestones[0].completed = true
      form.gridMilestones[1].completed = true
      form.deliverables[2].uploaded = true
      form.staffingRoles[0].assignedTo = { id: '1', name: 'Alice' }

      const result = assessG2Readiness(form)
      expect(result.completionPercentage).toBeGreaterThan(0)
      expect(result.completionPercentage).toBeLessThan(100)
      expect(result.ready).toBe(false)
    })

    it('tracks exactly which deliverables are missing', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.staffingRoles.forEach((r) => (r.assignedTo = { id: 'x', name: 'X' }))
      form.deliverables[0].uploaded = true
      form.deliverables[1].uploaded = true

      const result = assessG2Readiness(form)
      expect(result.missingDeliverables).toHaveLength(2)
      expect(result.missingDeliverables.map((d) => d.id)).toEqual(['grid-application', 'utility-correspondence'])
    })

    it('tracks exactly which roles are unassigned', () => {
      const form = initializeG2Form()
      form.permittingMilestones.forEach((m) => (m.completed = true))
      form.gridMilestones.forEach((m) => (m.completed = true))
      form.deliverables.forEach((d) => (d.uploaded = true))
      form.staffingRoles[0].assignedTo = { id: '1', name: 'Alice' }

      const result = assessG2Readiness(form)
      expect(result.unassignedRoles).toHaveLength(3)
      const assignedIds = form.staffingRoles.filter((r) => r.assignedTo).map((r) => r.roleId)
      expect(assignedIds).toContain('grid-engineer')
    })
  })
})
