/**
 * lib/digits.ts — DEPRECATED (kept for backward compatibility)
 * ──────────────
 * REDIRECT to lib/i18n/format.ts (canonical source).
 *
 * This module is retired in Batch 18 Phase 4. Use lib/i18n/format.ts directly.
 *
 * Backward-compatible re-exports:
 * - formatNumber        → formatNumber('en', 'western')
 * - formatCurrencyAmount → formatCurrency(..., 'USD')
 * - formatPercent       → formatPercent(...)
 * - toLocaleDigits      → use formatNumber directly
 *
 * Migrate to: import { formatNumber, formatCurrency, formatPercent } from '@/lib/i18n/format'
 */

export type DigitStyle = 'western' | 'arabic_indic'

// For backward compatibility, re-export from canonical source
export { formatNumber, formatCurrency as formatCurrencyAmount, formatPercent } from '@/lib/i18n/format'

/** Western → Arabic-Indic digit map (U+0660–U+0669). */
const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const

/**
 * DEPRECATED: toLocaleDigits — kept for backward compatibility.
 * Shape the ASCII digits inside an already-formatted display string.
 *
 * Use this only for pre-formatted strings where you can't re-parse to a number.
 * For raw numbers, use formatNumber directly from lib/i18n/format.ts.
 */
export function toLocaleDigits(
  input: string | null | undefined,
  digitStyle: DigitStyle = 'western',
): string {
  if (input == null) return '—'
  if (digitStyle !== 'arabic_indic') return input
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)])
}
