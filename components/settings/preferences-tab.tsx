'use client'

import * as React from 'react'
import { Sun, Moon, Monitor, Check, Globe, Hash, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { setLocaleAction, setDigitStyleAction } from '@/app/actions/locale'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

type ThemeOption = 'light' | 'dark' | 'system'
type DigitStyleOption = 'western' | 'arabic_indic'

const DATE_FORMATS = [
  { id: 'iso', label: 'ISO 8601', example: '2026-07-21' },
  { id: 'us',  label: 'US',      example: '07/21/2026' },
  { id: 'eu',  label: 'EU',      example: '21/07/2026' },
]

const DENSITY_OPTIONS = [
  { id: 'comfortable', label: 'Comfortable', desc: 'Default spacing, easy to scan' },
  { id: 'compact',     label: 'Compact',     desc: 'Denser UI, more content visible' },
]

export function PreferencesTab({ onSave }: { onSave: () => void }) {
  const locale = useLocale()
  const router = useRouter()
  const { toast } = useToast()

  const [theme, setTheme]           = React.useState<ThemeOption>('system')
  const [dateFormat, setDateFormat] = React.useState('iso')
  const [density, setDensity]       = React.useState('comfortable')
  const [animations, setAnimations] = React.useState(true)
  const [tooltips, setTooltips]     = React.useState(true)

  // Language + digit style wired to the DB / cookie.
  const [pendingLocale, setPendingLocale]           = React.useState<string>(locale)
  const [digitStyle, setDigitStyle]                 = React.useState<DigitStyleOption>('western')
  const [savingLocale, setSavingLocale]             = React.useState(false)
  const [savingDigit, setSavingDigit]               = React.useState(false)

  const isArabic = pendingLocale === 'ar'

  const themeIcons: Record<ThemeOption, React.ComponentType<{ className?: string }>> = {
    light: Sun, dark: Moon, system: Monitor,
  }

  async function applyLocale(newLocale: string) {
    if (newLocale === locale && newLocale === pendingLocale) return
    setSavingLocale(true)
    try {
      await setLocaleAction(newLocale as 'en' | 'ar')
      // Hard navigation so the root layout re-renders with the new lang/dir.
      router.refresh()
      toast({ title: newLocale === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English', variant: 'success' })
    } catch {
      toast({ title: 'Failed to save language preference', variant: 'danger' })
      setPendingLocale(locale)
    } finally {
      setSavingLocale(false)
    }
  }

  async function applyDigitStyle(style: DigitStyleOption) {
    setDigitStyle(style)
    setSavingDigit(true)
    try {
      await setDigitStyleAction(style)
      toast({ title: style === 'arabic_indic' ? 'Arabic-Indic digits enabled' : 'Western digits enabled', variant: 'success' })
    } catch {
      toast({ title: 'Failed to save digit preference', variant: 'danger' })
    } finally {
      setSavingDigit(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Appearance / Theme */}
      <PrefSection title="Appearance" desc="Choose how GridMind looks on your device.">
        <div className="grid grid-cols-3 gap-3">
          {(['light', 'dark', 'system'] as ThemeOption[]).map((t) => {
            const Icon = themeIcons[t]
            const active = theme === t
            return (
              <button key={t} onClick={() => setTheme(t)}
                className={cn('relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
                {active && <Check className="absolute top-2 end-2 size-3 text-primary" />}
                <div className={cn('size-8 rounded-lg flex items-center justify-center',
                  t === 'light' ? 'bg-amber-100 text-amber-600'
                  : t === 'dark' ? 'bg-slate-800 text-slate-200'
                  : 'bg-muted text-muted-foreground')}>
                  <Icon className="size-4" />
                </div>
                <span className="text-xs font-semibold capitalize text-foreground">{t}</span>
              </button>
            )
          })}
        </div>
      </PrefSection>

      {/* Language & Region */}
      <PrefSection
        title="Language & Region"
        desc="Set your preferred language and regional number format. Changes apply immediately."
      >
        {/* Language selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3" aria-hidden />
            Interface Language
          </label>
          <div className="flex gap-2">
            {[
              { value: 'en', label: 'English',       sub: 'LTR' },
              { value: 'ar', label: 'العربية',        sub: 'RTL' },
            ].map((lang) => {
              const active = pendingLocale === lang.value
              return (
                <button
                  key={lang.value}
                  onClick={() => { setPendingLocale(lang.value); applyLocale(lang.value) }}
                  disabled={savingLocale}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-4 transition-all text-sm font-semibold',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted/40',
                  )}
                >
                  {savingLocale && active
                    ? <Loader2 className="size-4 animate-spin" aria-hidden />
                    : <span className="text-base">{lang.label}</span>
                  }
                  <span className="text-[10px] font-mono text-muted-foreground">{lang.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Digit style — only meaningful for Arabic */}
        {isArabic && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Hash className="size-3" aria-hidden />
              Digit Style
              {savingDigit && <Loader2 className="size-3 animate-spin ms-1" aria-hidden />}
            </label>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'western',      label: 'Western',       example: '1,234,567', desc: 'Recommended for business reports' },
                { id: 'arabic_indic', label: 'Arabic-Indic',  example: '١٬٢٣٤٬٥٦٧', desc: 'Native Arabic numerals' },
              ] as { id: DigitStyleOption; label: string; example: string; desc: string }[]).map((d) => (
                <button key={d.id} onClick={() => applyDigitStyle(d.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border-2 p-3 text-start flex-1 min-w-[140px] transition-all',
                    digitStyle === d.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40',
                  )}>
                  <div className={cn('mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                    digitStyle === d.id ? 'border-primary' : 'border-muted-foreground')}>
                    {digitStyle === d.id && <div className="size-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{d.label}</p>
                    <p className="text-xs font-mono text-primary/80 mt-0.5">{d.example}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{d.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Date Format</label>
          <div className="flex flex-wrap gap-2">
            {DATE_FORMATS.map((f) => (
              <button key={f.id} onClick={() => setDateFormat(f.id)}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                  dateFormat === f.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40')}>
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground font-mono" dir="ltr">{f.example}</span>
              </button>
            ))}
          </div>
        </div>
      </PrefSection>

      {/* Display Density */}
      <PrefSection title="Display Density" desc="Control how much information is shown at once.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DENSITY_OPTIONS.map((d) => (
            <button key={d.id} onClick={() => setDensity(d.id)}
              className={cn('flex items-start gap-3 rounded-xl border-2 p-4 text-start transition-all',
                density === d.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
              <div className={cn('mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                density === d.id ? 'border-primary' : 'border-muted-foreground')}>
                {density === d.id && <div className="size-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{d.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </PrefSection>

      {/* Interface Toggles */}
      <PrefSection title="Interface Options">
        <div className="space-y-3">
          {[
            { label: 'Enable animations', desc: 'Smooth transitions and micro-interactions', value: animations, set: setAnimations },
            { label: 'Show tooltips',      desc: 'Display helpful hints on hover',           value: tooltips,   set: setTooltips },
          ].map(({ label, desc, value, set }) => (
            <div key={label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={value} onCheckedChange={set} />
            </div>
          ))}
        </div>
      </PrefSection>

      <div className="flex justify-end pt-2 border-t border-border">
        <button onClick={onSave}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Save Preferences
        </button>
      </div>
    </div>
  )
}

function PrefSection({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}
