// Client-side helpers for query matching and selection
import { COPILOT_CATALOG } from './query-catalog'

/**
 * Find the best matching catalog query for a user question.
 * Returns the query ID if matched, or null if no match.
 */
export const matchQueryIntent = (question: string): string | null => {
  const q = question.toLowerCase()
  for (const query of COPILOT_CATALOG) {
    for (const intent of query.intents) {
      if (q.includes(intent.toLowerCase())) {
        return query.id
      }
    }
  }
  return null
}

/**
 * Get a catalog query by ID.
 */
export const getCatalogQueryById = (id: string) => {
  return COPILOT_CATALOG.find((q) => q.id === id) || null
}

/**
 * Get the 3 nearest catalog queries by intent similarity.
 */
export const getNearestQueries = (question: string, count: number = 3) => {
  const q = question.toLowerCase()
  const scored = COPILOT_CATALOG.map((query) => {
    let score = 0
    for (const intent of query.intents) {
      const intentWords = intent.toLowerCase().split(/\s+/)
      for (const word of intentWords) {
        if (q.includes(word)) score += 1
      }
    }
    return { query, score }
  })
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, count).map((s) => s.query)
}
