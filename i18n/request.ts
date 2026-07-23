import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isValidLocale, type Locale } from './config'

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
