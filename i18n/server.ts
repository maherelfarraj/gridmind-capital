// Server-only: uses next/headers and must never be imported by client modules.
// Pure locale constants live in ./config — safe for both server and client.
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isValidLocale, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('NEXT_LOCALE')?.value
  const locale: Locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE

  const messages = (await import(`./messages/${locale}.json`)).default

  return {
    locale,
    messages,
    timeZone: 'Asia/Riyadh',
  }
})
