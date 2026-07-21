'use client'

import * as React from 'react'
import { Globe } from 'lucide-react'
import { useLocale } from '@/lib/i18n/locale-context'
import { locales, localeConfig } from '@/i18n/config'
import { cn } from '@/lib/utils'

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = localeConfig[locale]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
      >
        <Globe size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute top-full mt-1 end-0 z-50 min-w-[140px] rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden"
        >
          {locales.map((loc) => {
            const config = localeConfig[loc]
            const isActive = locale === loc
            return (
              <button
                key={loc}
                role="option"
                aria-selected={isActive}
                onClick={() => { setLocale(loc); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start transition-colors',
                  isActive
                    ? 'bg-[#64ffda]/10 text-[#64ffda] font-medium'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <span aria-hidden="true">{config.flag}</span>
                <span className="flex-1">{config.label}</span>
                {isActive && (
                  <span className="size-1.5 rounded-full bg-[#64ffda] shrink-0" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
