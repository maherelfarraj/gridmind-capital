'use client'

import * as React from 'react'
import { Sun, Moon, Monitor, Check, Globe, Hash, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { setLocaleAction, setDigitStyleAction } from '@/app/actions/locale'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useDigitStyle } from '@/lib/session-context'

type ThemeOption = 'light' | 'dark' | 'system'
type DigitStyleOption = 'western' | 'arabic_indic'

const DATE_FORMAT_IDS = ['iso', 'us', 'eu'] as const
const DATE_FORMAT_EXAMPLES: Record<string, string> = {
  iso: '2026-07-21',
  us:  '07/21/2026',
  eu:  '21/07/2026',
}

export function PreferencesTab({ onSave }: { onSave: () => void }) {
  const locale = useLocale()
  const sessionDigitStyle = useDigitStyle()
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')

  const [theme, setTheme]           = React.useState<ThemeOption>('system')
  const [dateFormat, setDateFormat] = React.useState('iso')
  const [density, setDensity]       = React.useState('comfortable')
  const [animations, setAnimations] = React.useState(true)
  const [tooltips, setTooltips]     = React.useState(true)

  // Language + digit style wired to the DB / cookie.
  const [pendingLocale, setPendingLocale]           = React.useState<string>(locale)
  const [digitStyle, setDigitStyle]                 = React.useState<DigitStyleOption>(sessionDigitStyle)
  const [savingLocale, setSavingLocale]             = React.useState(false)
  const [savingDigit, setSavingDigit]               = React.useState(false)

  const isArabic = pendingLocale === 'ar'

  const themeOptions: { id: ThemeOption; Icon: React.ComponentType<{ className?: string }>; colorClass: string }[] = [
    { id: 'light',  Icon: Sun,     colorClass: 'bg-amber-100 text-amber-600' },
    { id: 'dark',   Icon: Moon,    colorClass: 'bg-slate-800 text-slate-200' },
    { id: 'system', Icon: Monitor, colorClass: 'bg-muted text-muted-foreground' },
  ]

  async function applyLocale(newLocale: string) {
    if (newLocale === locale && newLocale === pendingLocale) return
    setSavingLocale(true)
    try {
      await setLocaleAction(newLocale as 'en' | 'ar')
      // Hard navigation so the root layout re-renders with the new lang/dir.
      router.refresh()
      toast({
        title: newLocale === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English',
        variant: 'success',
      })
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
      toast({
        title: style === 'arabic_indic'
          ? t('languageRegion.arabicIndic')
          : t('languageRegion.western'),
        variant: 'success',
      })
    } catch {
      toast({ title: 'Failed to save digit preference', variant: 'danger' })
    } finally {
      setSavingDigit(false)
    }
  }

  const digitOptions: { id: DigitStyleOption; labelKey: 'western' | 'arabicIndic'; exampleKey: 'westernExample' | 'arabicIndicExample'; descKey: 'westernDesc' | 'arabicIndicDesc' }[] = [
    { id: 'western',      labelKey: 'western',     exampleKey: 'westernExample',     descKey: 'westernDesc' },
    { id: 'arabic_indic', labelKey: 'arabicIndic',  exampleKey: 'arabicIndicExample', descKey: 'arabicIndicDesc' },
  ]

  const densityOptions: { id: string; labelKey: 'comfortable' | 'compact'; descKey: 'comfortableDesc' | 'compactDesc' }[] = [
    { id: 'comfortable', labelKey: 'comfortable', descKey: 'comfortableDesc' },
    { id: 'compact',     labelKey: 'compact',     descKey: 'compactDesc' },
  ]

  const interfaceOptions = [
    {
      label: t('accessibility.animations'),
      desc:  t('accessibility.animationsDesc'),
      value: animations,
      set:   setAnimations,
    },
    {
      label: t('accessibility.tooltips'),
      desc:  t('accessibility.tooltipsDesc'),
      value: tooltips,
      set:   setTooltips,
    },
  ]

  return (
    <div className="space-y-6">

      {/* Appearance / Theme */}
      <PrefSection title={t('appearance.title')} desc={t('appearance.desc')}>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map(({ id, Icon, colorClass }) => {
            const active = theme === id
            const themeLabel: Record<ThemeOption, string> = {
              light:  t('appearance.light'),
              dark:   t('appearance.dark'),
              system: t('appearance.system'),
            }
            return (
              <button key={id} onClick={() => setTheme(id)}
                className={cn('relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
                {active && <Check className="absolute top-2 end-2 size-3 text-primary" />}
                <div className={cn('size-8 rounded-lg flex items-center justify-center', colorClass)}>
                  <Icon className="size-4" />
                </div>
                <span className="text-xs font-semibold text-foreground">{themeLabel[id]}</span>
              </button>
            )
          })}
        </div>
      </PrefSection>

      {/* Language & Region */}
      <PrefSection
        title={t('languageRegion.title')}
        desc={t('languageRegion.desc')}
      >
        {/* Language selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3" aria-hidden />
            {t('languageRegion.interfaceLanguage')}
          </label>
          <div className="flex gap-2">
            {[
              { value: 'en', label: 'English',  sub: t('languageRegion.ltr') },
              { value: 'ar', label: 'العربية',   sub: t('languageRegion.rtl') },
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
              {t('languageRegion.digitStyle')}
              {savingDigit && <Loader2 className="size-3 animate-spin ms-1" aria-hidden />}
            </label>
            <div className="flex gap-2 flex-wrap">
              {digitOptions.map((d) => (
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
                    <p className="text-sm font-semibold text-foreground">{t(`languageRegion.${d.labelKey}`)}</p>
                    <p className="text-xs font-mono text-primary/80 mt-0.5">{t(`languageRegion.${d.exampleKey}`)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t(`languageRegion.${d.descKey}`)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('dateFormat.title')}
          </label>
          <div className="flex flex-wrap gap-2">
            {DATE_FORMAT_IDS.map((id) => (
              <button key={id} onClick={() => setDateFormat(id)}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                  dateFormat === id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40')}>
                <span className="font-medium">{t(`dateFormat.${id}`)}</span>
                <span className="text-xs text-muted-foreground font-mono" dir="ltr">{DATE_FORMAT_EXAMPLES[id]}</span>
              </button>
            ))}
          </div>
        </div>
      </PrefSection>

      {/* Display Density */}
      <PrefSection title={t('density.title')} desc={isArabic ? 'التحكم في كمية المعلومات المعروضة دفعةً واحدة.' : 'Control how much information is shown at once.'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {densityOptions.map((d) => (
            <button key={d.id} onClick={() => setDensity(d.id)}
              className={cn('flex items-start gap-3 rounded-xl border-2 p-4 text-start transition-all',
                density === d.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
              <div className={cn('mt-0.5 size-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                density === d.id ? 'border-primary' : 'border-muted-foreground')}>
                {density === d.id && <div className="size-2 rounded-full bg-primary" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t(`density.${d.labelKey}`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`density.${d.descKey}`)}</p>
              </div>
            </button>
          ))}
        </div>
      </PrefSection>

      {/* Interface Toggles */}
      <PrefSection title={t('accessibility.title')}>
        <div className="space-y-3">
          {interfaceOptions.map(({ label, desc, value, set }) => (
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
          {tCommon('save')}
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
