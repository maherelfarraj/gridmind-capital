/**
 * Pure locale constants — no server-only imports.
 * Safe to import from both Server Components and Client Components.
 */
export const locales = ['en', 'ar'] as const
/** Uppercase alias used across the codebase. */
export const LOCALES = locales
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const DEFAULT_LOCALE: Locale = 'en'

export function isValidLocale(l: unknown): l is Locale {
  return locales.includes(l as Locale)
}

export const localeConfig: Record<Locale, { label: string; dir: 'ltr' | 'rtl'; flag: string }> = {
  en: { label: 'English', dir: 'ltr', flag: '🇬🇧' },
  ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
}
