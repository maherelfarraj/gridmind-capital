/**
 * lib/format-nullable.ts — DEPRECATED (kept for backward compatibility)
 * ───────────────────────
 * Null-aware display formatting utilities.
 *
 * IMPORTANT: This module is retired in Batch 18 Phase 4 as a canonical formatting source.
 * Key utilities (formatMoney, formatCapacity, formatLocation) remain here for backward compatibility.
 *
 * These functions handle the critical NULL vs 0 distinction:
 * - NULL (no value recorded) → "Not set"
 * - 0 (genuine zero) → "$0" or "0 MW"
 *
 * Migrate new code to lib/i18n/format.ts for locale-aware formatters.
 */

/** Canonical label for "no value recorded". */
export const NOT_SET_LABEL = 'Not set'

/**
 * Coerce a PostgREST numeric (string) value to a number while PRESERVING null/undefined.
 * Returns null for empty strings and non-finite values too.
 * A genuine 0 is preserved as 0.
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

/** Compact USD for a value that is known to exist: $1.20B / $45.0M / $3,000. */
export function formatMoneyCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Compact USD, or "Not set" when the value is NULL.
 * Note a real 0 still formats as "$0" — that is a value, not a blank.
 */
export function formatMoney(value: number | null | undefined): string {
  return value == null ? NOT_SET_LABEL : formatMoneyCompact(value)
}

/** Full-precision USD, or "Not set" when NULL. */
export function formatMoneyExact(value: number | null | undefined): string {
  if (value == null) return NOT_SET_LABEL
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * "site, country" for display, tolerating either part being NULL and avoiding duplicated country.
 * Returns "Not set" only when both parts are absent.
 */
export function formatLocation(
  site: string | null | undefined,
  country: string | null | undefined,
): string {
  const s = site?.trim() || null
  const c = country?.trim() || null
  if (!s) return c ?? NOT_SET_LABEL
  if (!c) return s
  const alreadyNamed = new RegExp(`(^|,\\s*)${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(s)
  return alreadyNamed ? s : `${s}, ${c}`
}

/** Capacity with unit, or "Not set" when NULL. A real 0 renders as "0 MW". */
export function formatCapacity(
  value: number | null | undefined,
  unit = 'MW',
): string {
  if (value == null) return NOT_SET_LABEL
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}
