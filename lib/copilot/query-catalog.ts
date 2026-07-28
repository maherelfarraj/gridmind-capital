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

// Catalog is currently demonstration-level
// Production catalog will map user intents to specific read actions
// For now, queries return empty results and rely on LLM prose fallback

// Export an empty catalog
// The system will match intents and fall through to prose LLM responses
export const COPILOT_CATALOG: CatalogQuery[] = []

// Helper to find catalog query by ID
export const getCatalogQueryById = (id: string): CatalogQuery | null => {
  return COPILOT_CATALOG.find((q) => q.id === id) || null
}
