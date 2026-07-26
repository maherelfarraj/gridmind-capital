/**
 * Display convention for NULLABLE numeric columns (money, capacity, …).
 *
 * A NULL in the database means "nobody has set this yet". A 0 means "this is
 * genuinely zero". Those are different facts and must never render the same
 * way: `projects.capacity_mw = 0` is correct for a substation or grid upgrade
 * (LYR-GRD, HLS-SUB), while `projects.budget_usd = NULL` means the budget is
 * still unknown. Coercing NULL to 0 fabricates a real-looking "$0" figure that
 * a reader cannot distinguish from a deliberately-zero value.
 *
 * The repo-wide `num(v) = v == null ? 0 : Number(v)` mapper convention exists
 * because PostgREST returns PG `numeric` columns as STRINGS, so arithmetic and
 * `.toFixed()` break without coercion. That convention is right for aggregates
 * but it destroys NULL before the UI can ever see it. Use `numOrNull` instead
 * on any column that is nullable and rendered directly to a user.
 */

/** Canonical label for "no value recorded". */
export const NOT_SET_LABEL = 'Not set'

/**
 * Coerce a PostgREST numeric (string) value to a number while PRESERVING
 * null/undefined. Returns null for empty strings and non-finite values too, so
 * a malformed column reads as "not set" rather than a bogus 0 or NaN.
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

/** Capacity with unit, or "Not set" when NULL. A real 0 renders as "0 MW". */
export function formatCapacity(
  value: number | null | undefined,
  unit = 'MW',
): string {
  if (value == null) return NOT_SET_LABEL
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`
}
