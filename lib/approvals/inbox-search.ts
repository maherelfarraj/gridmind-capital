/**
 * Pure search-match predicate for the approval inbox.
 *
 * Extracted from the inbox component so it can be unit-tested in the node env
 * and so the desktop inbox and mobile list cannot drift on what "search"
 * means. An opportunity approval must be findable by BOTH its
 * title/project code (`object_code`) AND the linked project's name
 * (`project_name`) — the latter was previously not searchable at all.
 */
export interface SearchableApproval {
  object_code: string
  object_type: string
  requested_by_name: string
  approver_role: string
  /** Linked project name for opportunity approvals; null when not applicable. */
  project_name?: string | null
}

export function approvalMatchesQuery(record: SearchableApproval, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystacks = [
    record.object_code,
    record.object_type,
    record.requested_by_name,
    record.approver_role,
    record.project_name ?? '',
  ]
  return haystacks.some((h) => h.toLowerCase().includes(q))
}
