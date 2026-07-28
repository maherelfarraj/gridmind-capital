// GridMind Copilot Query Catalog — Whitelisted operational queries
// These queries are dispatched based on user intent keywords
// Each query binds to existing read actions, ensuring no new raw DB access

export type CatalogRow = Record<string, any>

export type CatalogColumn = {
  header: string
  key: string
  type?: 'text' | 'number' | 'date' | 'currency'
  sortable?: boolean
}

export interface CatalogQuery {
  id: string
  label: string
  intents: string[]
  run: () => Promise<CatalogRow[]>
  columns: CatalogColumn[]
  rowLink?: (row: CatalogRow) => string | null
}

// Suggested operational queries (operational dashboard shortcuts)
// These are routed via exact phrase match in matchQueryIntent for deterministic results
export const COPILOT_CATALOG: CatalogQuery[] = [
  {
    id: 'active-gates',
    label: 'Active Gates',
    intents: ['what gate', 'current phase', 'active phase'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
  {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    intents: ['approvals', 'waiting', 'pending'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
  {
    id: 'overdue-projects',
    label: 'Overdue Projects',
    intents: ['overdue', 'late', 'delayed'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
  {
    id: 'expiring-permits',
    label: 'Expiring Permits',
    intents: ['permits', 'expire', 'expiring'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
  {
    id: 'urgent-risks',
    label: 'Urgent Risks',
    intents: ['risks', 'incidents', 'problems'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
  {
    id: 'recent-incidents',
    label: 'Recent Incidents',
    intents: ['incidents', 'issues', 'problems', 'week'],
    run: async () => [], // Falls back to prose response
    columns: [],
  },
]

// Helper to find catalog query by ID
export const getCatalogQueryById = (id: string): CatalogQuery | null => {
  return COPILOT_CATALOG.find((q) => q.id === id) || null
}
