import { describe, it, expect } from 'vitest'
import {
  DELIVERABLE_CATEGORY_MAP,
  STAFFING_ROLE_CODE_MAP,
  REQUIRED_DELIVERABLE_IDS,
  REQUIRED_STAFFING_ROLE_IDS,
  isCategoryAllowedForDeliverable,
  isRoleCodeAllowedForStaffing,
  REQUIRED_DELIVERABLES,
  REQUIRED_STAFFING_ROLES,
} from '@/lib/gates/g3-requirements'

// ---------------------------------------------------------------------------
// Exact deliverable -> document category matching
// ---------------------------------------------------------------------------
describe('G3 exact deliverable/category matching', () => {
  it('maps every required deliverable id to at least one category', () => {
    // Drift guard: the map keys must exactly cover the required deliverable ids.
    expect(Object.keys(DELIVERABLE_CATEGORY_MAP).sort()).toEqual([...REQUIRED_DELIVERABLE_IDS].sort())
  })

  it('map keys stay in sync with REQUIRED_DELIVERABLES', () => {
    // If a deliverable is added/renamed but the map is not updated, this fails.
    expect(REQUIRED_DELIVERABLE_IDS).toEqual(REQUIRED_DELIVERABLES.map((d) => d.id))
  })

  it('accepts a document whose category is allowed for the deliverable', () => {
    expect(isCategoryAllowedForDeliverable('signed-ppa', 'commercial')).toBe(true)
    expect(isCategoryAllowedForDeliverable('epc-contract', 'procurement')).toBe(true)
    expect(isCategoryAllowedForDeliverable('financial-model', 'financial')).toBe(true)
    expect(isCategoryAllowedForDeliverable('insurance', 'insurance')).toBe(true)
    expect(isCategoryAllowedForDeliverable('lender-term-sheet', 'financial')).toBe(true)
    expect(isCategoryAllowedForDeliverable('legal-opinion', 'legal')).toBe(true)
  })

  it('rejects a valid document whose category is wrong for THIS deliverable', () => {
    // A real, on-project document with the wrong category must not be accepted.
    expect(isCategoryAllowedForDeliverable('signed-ppa', 'financial')).toBe(false)
    expect(isCategoryAllowedForDeliverable('epc-contract', 'commercial')).toBe(false)
    expect(isCategoryAllowedForDeliverable('legal-opinion', 'procurement')).toBe(false)
  })

  it('rejects unknown deliverable ids and null/empty categories', () => {
    expect(isCategoryAllowedForDeliverable('not-a-deliverable', 'commercial')).toBe(false)
    expect(isCategoryAllowedForDeliverable('signed-ppa', null)).toBe(false)
    expect(isCategoryAllowedForDeliverable('signed-ppa', undefined)).toBe(false)
    expect(isCategoryAllowedForDeliverable('signed-ppa', '')).toBe(false)
  })

  it('is case-sensitive: category must match exactly', () => {
    expect(isCategoryAllowedForDeliverable('signed-ppa', 'Commercial')).toBe(false)
    expect(isCategoryAllowedForDeliverable('signed-ppa', 'COMMERCIAL')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Exact staffing seat -> roles.code matching
// ---------------------------------------------------------------------------
describe('G3 exact staffing/role-code matching', () => {
  it('maps every required staffing role id to at least one role code', () => {
    expect(Object.keys(STAFFING_ROLE_CODE_MAP).sort()).toEqual([...REQUIRED_STAFFING_ROLE_IDS].sort())
  })

  it('map keys stay in sync with REQUIRED_STAFFING_ROLES', () => {
    expect(REQUIRED_STAFFING_ROLE_IDS).toEqual(REQUIRED_STAFFING_ROLES.map((r) => r.roleId))
  })

  it('uses four distinct role codes so four different people can be seated', () => {
    const codes = Object.values(STAFFING_ROLE_CODE_MAP).flat()
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.length).toBe(4)
  })

  it('accepts a member assigned through an allowed role code', () => {
    expect(isRoleCodeAllowedForStaffing('commercial-manager', 'DEV')).toBe(true)
    expect(isRoleCodeAllowedForStaffing('finance-lead', 'FIN')).toBe(true)
    expect(isRoleCodeAllowedForStaffing('legal-counsel', 'LEG')).toBe(true)
    expect(isRoleCodeAllowedForStaffing('transaction-advisor', 'PD')).toBe(true)
  })

  it('rejects a valid team member assigned through the wrong role code', () => {
    // A real project_team member with the wrong role code must not fill this seat.
    expect(isRoleCodeAllowedForStaffing('finance-lead', 'DEV')).toBe(false)
    expect(isRoleCodeAllowedForStaffing('legal-counsel', 'FIN')).toBe(false)
    expect(isRoleCodeAllowedForStaffing('commercial-manager', 'LEG')).toBe(false)
  })

  it('rejects unknown staffing ids and null/empty role codes', () => {
    expect(isRoleCodeAllowedForStaffing('not-a-seat', 'FIN')).toBe(false)
    expect(isRoleCodeAllowedForStaffing('finance-lead', null)).toBe(false)
    expect(isRoleCodeAllowedForStaffing('finance-lead', undefined)).toBe(false)
    expect(isRoleCodeAllowedForStaffing('finance-lead', '')).toBe(false)
  })

  it('is case-sensitive: role code must match exactly', () => {
    expect(isRoleCodeAllowedForStaffing('finance-lead', 'fin')).toBe(false)
    expect(isRoleCodeAllowedForStaffing('finance-lead', 'Fin')).toBe(false)
  })
})
