// Client-side helpers for query matching and selection
import { COPILOT_CATALOG } from './query-catalog'

/**
 * Exact phrase mapping for suggested questions → catalog IDs
 * Deterministic routing for high-confidence operational queries
 */
const SUGGESTED_QUESTION_MAP: Record<string, string> = {
  'what gate is moz farm on?': 'active-gates',
  'what approvals are waiting on me?': 'pending-approvals',
  'show overdue items on moz farm': 'overdue-projects',
  'which permits expire this month?': 'expiring-permits',
  'summarize project risks': 'urgent-risks',
  'any incidents this week?': 'recent-incidents',
}

/**
 * Find the best matching catalog query for a user question.
 * Returns the query ID if matched, or null if no match.
 * First tries exact phrase matching for suggested questions (deterministic).
 * Then falls back to intent keyword matching for natural questions.
 */
export const matchQueryIntent = (question: string): string | null => {
  const q = question.toLowerCase().trim()

  // 1. Try exact phrase match (suggested questions)
  if (SUGGESTED_QUESTION_MAP[q]) {
    return SUGGESTED_QUESTION_MAP[q]
  }

  // 2. Fall back to intent keyword matching
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
