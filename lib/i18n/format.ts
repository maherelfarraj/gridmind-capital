/**
 * lib/i18n/format.ts
 * ──────────────────
 * Locale-aware date, number, and currency formatters for GridMind Capital.
 *
 * Default business rule (per spec):
 *   - Western (Latin) digits with Arabic month names for business consistency.
 *   - When digit_style === 'arabic_indic', use the ar-u-nu-arab numbering system.
 *
 * These helpers work in both client components and server actions/emails.
 */

export type DigitStyle = 'western' | 'arabic_indic'

/** Resolve the Intl locale string to use for number/date formatting. */
function resolveLocale(locale: string, digitStyle: DigitStyle = 'western'): string {
  if (locale !== 'ar') return locale
  // BCP 47 extension: -u-nu-latn forces Latin (Western) digits in Arabic locale.
  // -u-nu-arab forces Arabic-Indic digits.
  return digitStyle === 'arabic_indic' ? 'ar-u-nu-arab' : 'ar-u-nu-latn'
}

/**
 * Format a Date (or ISO string) for display.
 *
 * Default for Arabic: Western digits + Arabic month names
 *   → "22 يوليو 2026"
 * With arabic_indic:
 *   → "٢٢ يوليو ٢٠٢٦"
 */
export function formatDate(
  value: Date | string | null | undefined,
  locale: string,
  digitStyle: DigitStyle = 'western',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return '—'

  const resolved = resolveLocale(locale, digitStyle)
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }

  try {
    return new Intl.DateTimeFormat(resolved, defaultOptions).format(date)
  } catch {
    return date.toLocaleDateString('en-US', defaultOptions)
  }
}

/**
 * Format a date as a short string (e.g. "22 Jul 2026" / "٢٢ يول ٢٠٢٦").
 */
export function formatDateShort(
  value: Date | string | null | undefined,
  locale: string,
  digitStyle: DigitStyle = 'western',
): string {
  return formatDate(value, locale, digitStyle, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a monetary amount.
 *
 * Defaults to USD; pass currencyCode to override.
 * Amounts always render with LTR direction (caller should wrap in <LtrSpan>).
 */
export function formatCurrency(
  value: number | null | undefined,
  locale: string,
  digitStyle: DigitStyle = 'western',
  currencyCode = 'USD',
): string {
  if (value == null || isNaN(value)) return '—'
  const resolved = resolveLocale(locale, digitStyle)
  try {
    return new Intl.NumberFormat(resolved, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }
}

/**
 * Format a plain number (integer or decimal).
 */
export function formatNumber(
  value: number | null | undefined,
  locale: string,
  digitStyle: DigitStyle = 'western',
  options?: Intl.NumberFormatOptions,
): string {
  if (value == null || isNaN(value)) return '—'
  const resolved = resolveLocale(locale, digitStyle)
  try {
    return new Intl.NumberFormat(resolved, options).format(value)
  } catch {
    return String(value)
  }
}

/**
 * Format a percentage (0–100 scale → "42%").
 */
export function formatPercent(
  value: number | null | undefined,
  locale: string,
  digitStyle: DigitStyle = 'western',
): string {
  if (value == null || isNaN(value)) return '—'
  const resolved = resolveLocale(locale, digitStyle)
  try {
    return new Intl.NumberFormat(resolved, { style: 'percent' }).format(value / 100)
  } catch {
    return `${Math.round(value)}%`
  }
}

/**
 * Hook: returns formatters pre-bound to the current next-intl locale.
 * Use inside React components.
 *
 * @example
 *   const { formatDate, formatCurrency } = useFormatters()
 *   <LtrSpan>{formatCurrency(row.amount)}</LtrSpan>
 */
export function useFormatters(locale: string, digitStyle: DigitStyle = 'western') {
  return {
    formatDate:     (v: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
                      formatDate(v, locale, digitStyle, opts),
    formatDateShort: (v: Date | string | null | undefined) =>
                      formatDateShort(v, locale, digitStyle),
    formatCurrency: (v: number | null | undefined, currency?: string) =>
                      formatCurrency(v, locale, digitStyle, currency),
    formatNumber:   (v: number | null | undefined, opts?: Intl.NumberFormatOptions) =>
                      formatNumber(v, locale, digitStyle, opts),
    formatPercent:  (v: number | null | undefined) =>
                      formatPercent(v, locale, digitStyle),
  }
}

/**
 * Canonical label for "no value recorded" (NULL vs 0 distinction).
 *
 * Re-exported from lib/format-nullable.ts for backward compatibility.
 * Use this in UI when displaying NULL numeric columns.
 */
export const NOT_SET_LABEL = 'Not set'

/**
 * Coerce a PostgREST numeric (string) to number while PRESERVING null/undefined.
 * Use on nullable columns that render directly to users.
 */
export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** True when a value should render as "Not set". */
export function isNotSet(v: number | null | undefined): boolean {
  return v == null
}
