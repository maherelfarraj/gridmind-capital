import { describe, it, expect } from 'vitest'
import { approvalMatchesQuery, type SearchableApproval } from '@/lib/approvals/inbox-search'

const record: SearchableApproval = {
  object_code: 'PRJ-2026-384',
  object_type: 'opportunity',
  requested_by_name: 'Maher Al-Farraj',
  approver_role: 'Project Director',
  project_name: 'Jordan Solar Farm – Phase 1',
}

describe('approvalMatchesQuery', () => {
  it('matches by approval title / project code', () => {
    expect(approvalMatchesQuery(record, 'PRJ-2026-384')).toBe(true)
    expect(approvalMatchesQuery(record, 'prj-2026')).toBe(true)
  })

  it('matches by linked project NAME (the previously non-searchable field)', () => {
    expect(approvalMatchesQuery(record, 'Jordan Solar')).toBe(true)
    expect(approvalMatchesQuery(record, 'jordan')).toBe(true)
    expect(approvalMatchesQuery(record, 'phase 1')).toBe(true)
  })

  it('matches by object type and requester', () => {
    expect(approvalMatchesQuery(record, 'opportunity')).toBe(true)
    expect(approvalMatchesQuery(record, 'maher')).toBe(true)
  })

  it('empty query matches everything', () => {
    expect(approvalMatchesQuery(record, '')).toBe(true)
    expect(approvalMatchesQuery(record, '   ')).toBe(true)
  })

  it('non-matching query returns false', () => {
    expect(approvalMatchesQuery(record, 'wind farm')).toBe(false)
  })

  it('does not throw and does not match a name query when project_name is absent', () => {
    const noProject: SearchableApproval = { ...record, project_name: null }
    expect(approvalMatchesQuery(noProject, 'Jordan Solar')).toBe(false)
    // Still searchable by its own code.
    expect(approvalMatchesQuery(noProject, 'PRJ-2026-384')).toBe(true)
  })
})
