/**
 * Provenance tracking constants, types, and formatters.
 */

export type ProvenanceSource = 'pilot_assumption' | 'contract' | 'financial_model' | 'lender_facility' | 'interconnection' | 'term_sheet' | 'custom'

export const PROVENANCE_SOURCES = ['pilot_assumption', 'contract', 'financial_model', 'lender_facility', 'interconnection', 'term_sheet'] as const

export const EDITABLE_SOURCES = ['contract', 'financial_model', 'lender_facility', 'interconnection', 'term_sheet'] as const

export const TRACKED_FIELDS = ['budget_usd', 'capacity_mw', 'start_date', 'target_completion', 'country', 'location', 'technology', 'bess_mwh'] as const

export type TrackedField = typeof TRACKED_FIELDS[number]

export interface ProvenanceEntry {
  source: ProvenanceSource | null
  at?: string
}

/**
 * Label for a provenance source, suitable for display.
 */
export function sourceLabel(source: ProvenanceSource | null | undefined): string {
  switch (source) {
    case 'pilot_assumption':
      return 'Pilot Assumption'
    case 'contract':
      return 'Contract'
    case 'financial_model':
      return 'Financial Model'
    case 'lender_facility':
      return 'Lender Facility'
    case 'interconnection':
      return 'Interconnection'
    case 'term_sheet':
      return 'Term Sheet'
    case 'custom':
      return 'Custom'
    default:
      return 'Unrecorded'
  }
}

/**
 * Display name for a tracked field.
 */
export function fieldLabel(field: TrackedField | string): string {
  const labels: Record<string, string> = {
    budget_usd: 'Total Budget',
    capacity_mw: 'Capacity',
    start_date: 'Start Date',
    target_completion: 'Target Completion',
    country: 'Country',
    location: 'Location',
    technology: 'Technology',
    bess_mwh: 'BESS (MWh)',
  }
  return labels[field] ?? field
}

/**
 * Determine if a source is "verified" (not pilot_assumption).
 */
export function isVerified(source: ProvenanceSource | null | undefined): boolean {
  return source != null && source !== 'pilot_assumption' && source !== 'custom'
}

/**
 * Get CSS class for a source badge (color/styling).
 */
export function sourceColorClass(source: ProvenanceSource | null | undefined): string {
  if (isVerified(source)) return 'text-emerald-700'
  if (source === 'pilot_assumption') return 'text-neutral-500'
  return 'text-neutral-400'
}
