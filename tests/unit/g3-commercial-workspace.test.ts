import { describe, it, expect } from 'vitest'
import {
  initializeG3Form,
  assessG3Readiness,
  isG3Complete,
  REQUIRED_CONTRACT_TYPES,
  REQUIRED_APPROVALS,
  REQUIRED_BUDGET_CATEGORIES,
} from '@/lib/gates/g3-requirements'

describe('G3 Commercial & Financial Close Workspace', () => {
  describe('G3 Requirements Constants', () => {
    it('has exactly 3 required contract types', () => {
      expect(REQUIRED_CONTRACT_TYPES).toHaveLength(3)
      expect(REQUIRED_CONTRACT_TYPES).toContain('offtake')
      expect(REQUIRED_CONTRACT_TYPES).toContain('epc')
      expect(REQUIRED_CONTRACT_TYPES).toContain('financing')
    })

    it('has exactly 2 required approvals', () => {
      expect(REQUIRED_APPROVALS).toHaveLength(2)
      expect(REQUIRED_APPROVALS).toContain('board_approval')
      expect(REQUIRED_APPROVALS).toContain('executive_sign_off')
    })

    it('has 5 budget categories', () => {
      expect(REQUIRED_BUDGET_CATEGORIES).toHaveLength(5)
      expect(REQUIRED_BUDGET_CATEGORIES).toContain('Civil Works')
      expect(REQUIRED_BUDGET_CATEGORIES).toContain('Equipment')
      expect(REQUIRED_BUDGET_CATEGORIES).toContain('Financing')
    })
  })

  describe('G3 Form Initialization', () => {
    it('initializes blank form with all required structures', () => {
      const form = initializeG3Form()
      expect(form.budget).toHaveLength(5)
      expect(form.contracts).toHaveLength(3)
      expect(form.approvals).toHaveLength(2)
      expect(form.financing).toHaveLength(0)
    })

    it('all budget categories are pending with no amounts', () => {
      const form = initializeG3Form()
      expect(form.budget.every((b) => b.status === 'pending')).toBe(true)
      expect(form.budget.every((b) => b.budgetedAmount === null)).toBe(true)
    })

    it('all contracts start as draft and unsigned', () => {
      const form = initializeG3Form()
      expect(form.contracts.every((c) => c.status === 'draft')).toBe(true)
      expect(form.contracts.every((c) => c.signedDate === null)).toBe(true)
    })

    it('all approvals start unsigned', () => {
      const form = initializeG3Form()
      expect(form.approvals.every((a) => a.signedDate === null)).toBe(true)
    })

    it('missing contracts are explicitly marked unsigned', () => {
      const form = initializeG3Form()
      expect(form.contracts).toHaveLength(3)
      expect(form.contracts.every((c) => c.signedDate === null)).toBe(true)
    })
  })

  describe('G3 Readiness Assessment', () => {
    it('marks null form as not ready', () => {
      const result = assessG3Readiness(null)
      expect(result.ready).toBe(false)
      expect(result.blockers).toContain('No submission data provided')
      expect(result.completionPercentage).toBe(0)
    })

    it('blank form is not ready (contracts not signed)', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.ready).toBe(false)
      expect(result.blockers.some((b) => b.includes('contract'))).toBe(true)
    })

    it('tracks unsigned approvals', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.unsignedApprovals).toHaveLength(2)
      expect(result.blockers.some((b) => b.includes('executive approval'))).toBe(true)
    })

    it('calculates unfinanced amount when budget exceeds financing', () => {
      const form = initializeG3Form()
      form.budget[0].budgetedAmount = 10_000_000
      form.budget[1].budgetedAmount = 5_000_000
      form.financing.push({
        id: 'debt-1',
        sourceType: 'debt',
        source: 'Bank Loan',
        amount: 10_000_000,
        terms: '10 years',
        status: 'committed',
      })
      const result = assessG3Readiness(form)
      expect(result.unfinancedAmount).toBe(5_000_000)
    })

    it('marks form as ready when all contracts signed, financing committed, approvals signed', () => {
      const form = initializeG3Form()
      form.budget.forEach((b) => (b.budgetedAmount = 1_000_000))
      form.contracts.forEach((c) => (c.signedDate = '2026-08-05'))
      form.financing.push({
        id: 'debt',
        sourceType: 'debt',
        source: 'Bank',
        amount: 15_000_000,
        terms: '10 years',
        status: 'committed',
      })
      form.approvals.forEach((a) => (a.signedDate = '2026-08-05'))

      const result = assessG3Readiness(form)
      expect(result.ready).toBe(true)
      expect(result.blockers).toHaveLength(0)
    })

    it('completion percentage increases as items are filled', () => {
      const form = initializeG3Form()
      const blank = assessG3Readiness(form)
      expect(blank.completionPercentage).toBe(0)

      form.budget.forEach((b) => (b.budgetedAmount = 1_000_000))
      form.contracts.forEach((c) => (c.signedDate = '2026-08-05'))
      const partial = assessG3Readiness(form)
      expect(partial.completionPercentage).toBeGreaterThan(0)

      form.financing.push({
        id: 'debt',
        sourceType: 'debt',
        source: 'Bank',
        amount: 15_000_000,
        terms: '10 years',
        status: 'committed',
      })
      form.approvals.forEach((a) => (a.signedDate = '2026-08-05'))
      const complete = assessG3Readiness(form)
      expect(complete.completionPercentage).toBeGreaterThanOrEqual(partial.completionPercentage)
    })
  })

  describe('G3 Completeness Check', () => {
    it('blank form is not complete', () => {
      const form = initializeG3Form()
      expect(isG3Complete(form)).toBe(false)
    })

    it('form with only contracts signed is not complete (missing financing, approvals)', () => {
      const form = initializeG3Form()
      form.contracts.forEach((c) => (c.signedDate = '2026-08-05'))
      expect(isG3Complete(form)).toBe(false)
    })

    it('fully populated form is complete', () => {
      const form = initializeG3Form()
      form.budget.forEach((b) => (b.budgetedAmount = 1_000_000))
      form.contracts.forEach((c) => (c.signedDate = '2026-08-05'))
      form.financing.push({
        id: 'debt',
        sourceType: 'debt',
        source: 'Bank',
        amount: 15_000_000,
        terms: '10 years',
        status: 'committed',
      })
      form.approvals.forEach((a) => (a.signedDate = '2026-08-05'))
      expect(isG3Complete(form)).toBe(true)
    })
  })

  describe('G3 No Fabrication Guarantee', () => {
    it('missing contracts return empty counterparty, not placeholder', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      expect(result.missingContracts.every((c) => c.counterparty === null)).toBe(true)
    })

    it('unfinanced lines never include guessed amounts', () => {
      const form = initializeG3Form()
      form.budget[0].budgetedAmount = 5_000_000
      form.financing.push({
        id: 'debt',
        sourceType: 'debt',
        source: 'Bank',
        amount: 5_000_000,
        terms: '10 years',
        status: 'committed',
      })
      const result = assessG3Readiness(form)
      expect(result.unfinancedAmount).toBe(0)
    })

    it('unsigned approvals return null for all fields', () => {
      const form = initializeG3Form()
      const result = assessG3Readiness(form)
      result.unsignedApprovals.forEach((a) => {
        expect(a.approverName).toBeNull()
        expect(a.approverTitle).toBeNull()
        expect(a.signedDate).toBeNull()
      })
    })
  })
})
