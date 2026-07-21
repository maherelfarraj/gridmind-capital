'use client'

import * as React from 'react'
import type { Locale } from '@/i18n/config'
import { defaultLocale } from '@/i18n/config'

type Messages = Record<string, Record<string, string>>

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LocaleContext = React.createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (k) => k,
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    if (typeof window === 'undefined') return defaultLocale
    return (localStorage.getItem('gmc_locale') as Locale) ?? defaultLocale
  })
  const [messages, setMessages] = React.useState<Messages>({})

  React.useEffect(() => {
    import(`@/i18n/messages/${locale}.json`)
      .then((mod) => setMessages(mod.default as Messages))
      .catch(() => {})
  }, [locale])

  // Apply dir + lang to <html>
  React.useEffect(() => {
    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  const setLocale = React.useCallback((next: Locale) => {
    localStorage.setItem('gmc_locale', next)
    setLocaleState(next)
  }, [])

  const t = React.useCallback((key: string): string => {
    const [ns, k] = key.includes('.') ? key.split('.') : ['common', key]
    return messages[ns]?.[k] ?? key
  }, [messages])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return React.useContext(LocaleContext)
}
