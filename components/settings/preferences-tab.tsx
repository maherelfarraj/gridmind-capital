'use client'

import * as React from 'react'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type ThemeOption = 'light' | 'dark' | 'system'

const LANGUAGES = ['English', 'Arabic (عربي)', 'French (Français)', 'Spanish (Español)', 'German (Deutsch)']
const DATE_FORMATS = [
  { id: 'iso', label: 'ISO 8601', example: '2026-07-21' },
  { id: 'us',  label: 'US',      example: '07/21/2026' },
  { id: 'eu',  label: 'EU',      example: '21/07/2026' },
]
const NUMBER_FORMATS = [
  { id: 'comma',  label: 'Comma decimal',  example: '1.234,56' },
  { id: 'period', label: 'Period decimal', example: '1,234.56' },
]
const LANDING_PAGES = ['Dashboard', 'My Tasks', 'Inbox', 'Projects', 'Approvals']
const DENSITY_OPTIONS = [
  { id: 'comfortable', label: 'Comfortable', desc: 'Default spacing, easy to scan' },
  { id: 'compact',     label: 'Compact',     desc: 'Denser UI, more content visible' },
]

export function PreferencesTab({ onSave }: { onSave: () => void }) {
  const [theme, setTheme]         = React.useState<ThemeOption>('system')
  const [language, setLanguage]   = React.useState('English')
  const [dateFormat, setDateFormat] = React.useState('iso')
  const [numberFormat, setNumberFormat] = React.useState('period')
  const [landingPage, setLandingPage] = React.useState('Dashboard')
  const [density, setDensity]     = React.useState('comfortable')
  const [animations, setAnimations] = React.useState(true)
  const [tooltips, setTooltips]   = React.useState(true)

  const themeIcons: Record<ThemeOption, React.ComponentType<{ className?: string }>> = {
    light: Sun, dark: Moon, system: Monitor
  }

  return (
    <div className="space-y-6">
      {/* Theme */}
      <PrefSection title="Appearance" desc="Choose how GridMind looks on your device.">
        <div className="grid grid-cols-3 gap-3">
          {(['light', 'dark', 'system'] as ThemeOption[]).map((t) => {
            const Icon = themeIcons[t]
            const active = theme === t
            return (
              <button key={t} onClick={() => setTheme(t)}
                className={cn('relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
                {active && <Check className="absolute top-2 right-2 size-3 text-primary" />}
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

      {/* Language */}
      <PrefSection title="Language & Region" desc="Set your preferred language and regional formats.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50">
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Default Landing Page</label>
            <select value={landingPage} onChange={(e) => setLandingPage(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50">
              {LANDING_PAGES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Date format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Date Format</label>
          <div className="flex flex-wrap gap-2">
            {DATE_FORMATS.map((f) => (
              <button key={f.id} onClick={() => setDateFormat(f.id)}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                  dateFormat === f.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40')}>
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{f.example}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Number format */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Number Format</label>
          <div className="flex flex-wrap gap-2">
            {NUMBER_FORMATS.map((f) => (
              <button key={f.id} onClick={() => setNumberFormat(f.id)}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all',
                  numberFormat === f.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40')}>
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{f.example}</span>
              </button>
            ))}
          </div>
        </div>
      </PrefSection>

      {/* Density */}
      <PrefSection title="Display Density" desc="Control how much information is shown at once.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DENSITY_OPTIONS.map((d) => (
            <button key={d.id} onClick={() => setDensity(d.id)}
              className={cn('flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all',
                density === d.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40')}>
              <div className={cn('mt-0.5 size-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
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

      {/* Toggles */}
      <PrefSection title="Interface Options">
        <div className="space-y-3">
          {[
            { label: 'Enable animations', desc: 'Smooth transitions and micro-interactions', value: animations, set: setAnimations },
            { label: 'Show tooltips',      desc: 'Display helpful hints on hover',           value: tooltips,   set: setTooltips  },
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
        <button onClick={onSave} className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
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
