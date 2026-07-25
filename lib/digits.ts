/**
 * lib/digits.ts
 * ─────────────
 * Thin convenience wrapper for digit-aware number formatting.
 *
 * The full locale-aware suite lives in lib/i18n/format.ts.
 * This module exposes the simple two-argument form that KPI cards and tables
 * call directly — no need to import the full formatters suite.
 *
 * @example
 *   import { formatNumber, formatCurrencyAmount } from '@/lib/digits'
 *
 *   // In a KPI card (RTL-aware, no locale needed for pure digit formatting):
 *   <span dir="ltr">{formatNumber(1234567, digitStyle)}</span>
 *
 *   // With currency:
 *   <LtrSpan>{formatCurrencyAmount(3_500_000, digitStyle)}</LtrSpan>
 */

export type DigitStyle = 'western' | 'arabic_indic'

/**
 * Format a plain integer or decimal with digit-style awareness.
 *
 * - 'western'      → Latin digits, system locale  →  "1,234,567"
 * - 'arabic_indic' → Arabic-Indic digits           → "١٬٢٣٤٬٥٦٧"
 *
 * Always returns a string; null/undefined/NaN → "—".
 */
export function formatNumber(
  value: number | null | undefined,
  digitStyle: DigitStyle = 'western',
  options?: Intl.NumberFormatOptions,
): string {
  if (value == null || isNaN(value)) return '—'
  const locale = digitStyle === 'arabic_indic' ? 'ar-u-nu-arab' : 'en-u-nu-latn'
  try {
    return new Intl.NumberFormat(locale, options).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Format a monetary amount with digit-style awareness (USD default).
 *
 * Currency amounts should always be wrapped in <LtrSpan> or dir="ltr"
 * in RTL layouts so the currency symbol sits at the correct visual edge.
 */
export function formatCurrencyAmount(
  value: number | null | undefined,
  digitStyle: DigitStyle = 'western',
  currencyCode = 'USD',
): string {
  if (value == null || isNaN(value)) return '—'
  const locale = digitStyle === 'arabic_indic' ? 'ar-u-nu-arab' : 'en-u-nu-latn'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${value.toLocaleString()}`
  }
}

/** Western → Arabic-Indic digit map (U+0660–U+0669). */
const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const

/**
 * Shape the ASCII digits inside an already-formatted display string to the
 * requested digit style, leaving all non-digit characters (currency symbols,
 * unit suffixes like "MW", separators, "%", "B"/"M") untouched.
 *
 * Use this for KPI values and table cells that arrive pre-formatted as strings
 * (e.g. "$4.82B", "6,240 MW", "72%") where re-parsing to a number would lose
 * the units. For raw numbers, prefer formatNumber/formatCurrencyAmount instead.
 *
 * - 'western'      → returned unchanged            → "6,240 MW"
 * - 'arabic_indic' → ASCII 0-9 mapped to ٠-٩       → "٦,٢٤٠ MW"
 */
export function toLocaleDigits(
  input: string | null | undefined,
  digitStyle: DigitStyle = 'western',
): string {
  if (input == null) return '—'
  if (digitStyle !== 'arabic_indic') return input
  return input.replace(/[0-9]/g, (d) => ARABIC_INDIC_DIGITS[Number(d)])
}

/**
 * Format a percentage (0–100 scale → "42 %" or "٤٢ %").
 */
export function formatPercent(
  value: number | null | undefined,
  digitStyle: DigitStyle = 'western',
): string {
  if (value == null || isNaN(value)) return '—'
  const locale = digitStyle === 'arabic_indic' ? 'ar-u-nu-arab' : 'en-u-nu-latn'
  try {
    return new Intl.NumberFormat(locale, { style: 'percent' }).format(value / 100)
  } catch {
    return `${Math.round(value)}%`
  }
}
