'use client'

import * as React from 'react'
import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { setLocaleAction, LOCALES, type Locale } from '@/app/actions/locale'
import { cn } from '@/lib/utils'

const LOCALE_CONFIG: Record<Locale, { label: string; labelNative: string }> = {
  en: { label: 'English', labelNative: 'English' },
  ar: { label: 'Arabic', labelNative: 'العربية' },
}

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const [open, setOpen] = React.useState(false)
  const [switching, setSwitching] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSwitch(next: Locale) {
    if (next === locale || switching) return
    setOpen(false)
    setSwitching(true)
    await setLocaleAction(next)
    // Full navigation reload so the root layout re-renders with the new
    // SSR locale, setting the correct dir="rtl/ltr" on <html> server-side.
    window.location.reload()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={switching ? 'Switching language…' : 'Change language'}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors duration-150',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          switching && 'opacity-50 cursor-not-allowed',
        )}
      >
        <Globe size={14} aria-hidden="true" />
        <span aria-hidden="true">{locale === 'ar' ? 'عر' : 'EN'}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute top-full mt-1 end-0 z-50 min-w-[152px] rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden"
        >
          {LOCALES.map((loc) => {
            const cfg = LOCALE_CONFIG[loc]
            const isActive = locale === loc
            return (
              <button
                key={loc}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSwitch(loc)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="flex-1">
                  {cfg.labelNative}
                  {cfg.labelNative !== cfg.label && (
                    <span className="ms-1.5 text-xs text-muted-foreground font-normal">
                      {cfg.label}
                    </span>
                  )}
                </span>
                {isActive && (
                  <span className="size-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
