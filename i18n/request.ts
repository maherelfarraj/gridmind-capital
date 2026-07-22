import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export function isValidLocale(l: unknown): l is Locale {
  return LOCALES.includes(l as Locale)
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value
  const locale: Locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE

  const messages = (await import(`../i18n/messages/${locale}.json`)).default

  return {
    locale,
    messages,
    timeZone: 'Asia/Riyadh',
  }
})
