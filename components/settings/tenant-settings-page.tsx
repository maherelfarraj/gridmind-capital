'use client'

import * as React from 'react'
import {
  Building2,
  Globe,
  Bell,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Mail,
  Smartphone,
  MonitorSmartphone,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar', group: 'Major' },
  { value: 'EUR', label: 'EUR — Euro', group: 'Major' },
  { value: 'GBP', label: 'GBP — British Pound', group: 'Major' },
  { value: 'JPY', label: 'JPY — Japanese Yen', group: 'Major' },
  { value: 'CHF', label: 'CHF — Swiss Franc', group: 'Major' },
  { value: 'SAR', label: 'SAR — Saudi Riyal', group: 'Middle East' },
  { value: 'AED', label: 'AED — UAE Dirham', group: 'Middle East' },
  { value: 'QAR', label: 'QAR — Qatari Riyal', group: 'Middle East' },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar', group: 'Middle East' },
  { value: 'BHD', label: 'BHD — Bahraini Dinar', group: 'Middle East' },
  { value: 'OMR', label: 'OMR — Omani Rial', group: 'Middle East' },
  { value: 'JOD', label: 'JOD — Jordanian Dinar', group: 'Middle East' },
  { value: 'EGP', label: 'EGP — Egyptian Pound', group: 'Africa' },
  { value: 'ZAR', label: 'ZAR — South African Rand', group: 'Africa' },
  { value: 'NGN', label: 'NGN — Nigerian Naira', group: 'Africa' },
  { value: 'KES', label: 'KES — Kenyan Shilling', group: 'Africa' },
  { value: 'MAD', label: 'MAD — Moroccan Dirham', group: 'Africa' },
  { value: 'CAD', label: 'CAD — Canadian Dollar', group: 'Americas' },
  { value: 'AUD', label: 'AUD — Australian Dollar', group: 'Oceania' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar', group: 'Oceania' },
  { value: 'SGD', label: 'SGD — Singapore Dollar', group: 'Asia Pacific' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar', group: 'Asia Pacific' },
  { value: 'CNY', label: 'CNY — Chinese Yuan', group: 'Asia Pacific' },
  { value: 'INR', label: 'INR — Indian Rupee', group: 'Asia Pacific' },
  { value: 'KRW', label: 'KRW — South Korean Won', group: 'Asia Pacific' },
  { value: 'MYR', label: 'MYR — Malaysian Ringgit', group: 'Asia Pacific' },
  { value: 'THB', label: 'THB — Thai Baht', group: 'Asia Pacific' },
  { value: 'IDR', label: 'IDR — Indonesian Rupiah', group: 'Asia Pacific' },
  { value: 'PHP', label: 'PHP — Philippine Peso', group: 'Asia Pacific' },
  { value: 'VND', label: 'VND — Vietnamese Dong', group: 'Asia Pacific' },
  { value: 'PKR', label: 'PKR — Pakistani Rupee', group: 'Asia Pacific' },
  { value: 'BRL', label: 'BRL — Brazilian Real', group: 'Americas' },
  { value: 'MXN', label: 'MXN — Mexican Peso', group: 'Americas' },
  { value: 'CLP', label: 'CLP — Chilean Peso', group: 'Americas' },
  { value: 'COP', label: 'COP — Colombian Peso', group: 'Americas' },
  { value: 'ARS', label: 'ARS — Argentine Peso', group: 'Americas' },
  { value: 'PEN', label: 'PEN — Peruvian Sol', group: 'Americas' },
  { value: 'SEK', label: 'SEK — Swedish Krona', group: 'Europe' },
  { value: 'NOK', label: 'NOK — Norwegian Krone', group: 'Europe' },
  { value: 'DKK', label: 'DKK — Danish Krone', group: 'Europe' },
  { value: 'PLN', label: 'PLN — Polish Zloty', group: 'Europe' },
  { value: 'CZK', label: 'CZK — Czech Koruna', group: 'Europe' },
  { value: 'HUF', label: 'HUF — Hungarian Forint', group: 'Europe' },
  { value: 'RON', label: 'RON — Romanian Leu', group: 'Europe' },
  { value: 'TRY', label: 'TRY — Turkish Lira', group: 'Europe' },
  { value: 'RUB', label: 'RUB — Russian Ruble', group: 'Europe' },
  { value: 'UAH', label: 'UAH — Ukrainian Hryvnia', group: 'Europe' },
  { value: 'ILS', label: 'ILS — Israeli Shekel', group: 'Middle East' },
  { value: 'IRR', label: 'IRR — Iranian Rial', group: 'Middle East' },
  { value: 'XAF', label: 'XAF — CFA Franc BEAC', group: 'Africa' },
  { value: 'XOF', label: 'XOF — CFA Franc BCEAO', group: 'Africa' },
]

const TIMEZONES = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time', group: 'Universal' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)', group: 'Americas' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)', group: 'Americas' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)', group: 'Americas' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)', group: 'Americas' },
  { value: 'America/Toronto', label: 'America/Toronto', group: 'Americas' },
  { value: 'America/Vancouver', label: 'America/Vancouver', group: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo', group: 'Americas' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)', group: 'Europe' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)', group: 'Europe' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)', group: 'Europe' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid', group: 'Europe' },
  { value: 'Europe/Rome', label: 'Europe/Rome', group: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam', group: 'Europe' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw', group: 'Europe' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul', group: 'Europe' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow', group: 'Europe' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)', group: 'Middle East' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST)', group: 'Middle East' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait', group: 'Middle East' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar', group: 'Middle East' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT)', group: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)', group: 'Asia' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST)', group: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT)', group: 'Asia' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)', group: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT)', group: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)', group: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)', group: 'Asia' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)', group: 'Asia' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)', group: 'Oceania' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne', group: 'Oceania' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST)', group: 'Oceania' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)', group: 'Oceania' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET)', group: 'Africa' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT)', group: 'Africa' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)', group: 'Africa' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)', group: 'Africa' },
]

/* ─────────────────────────────────────────────
   Toggle Switch
───────────────────────────────────────────── */
interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  disabled?: boolean
}

function Toggle({ checked, onChange, id, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-40',
        checked ? 'bg-[#64ffda]' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}

/* ─────────────────────────────────────────────
   Section header atom
───────────────────────────────────────────── */
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[#64ffda]">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div>
        <h2 className="font-sans text-base font-semibold text-card-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Field row: label + control side by side on md+
───────────────────────────────────────────── */
function FieldRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_1.5fr] md:items-start">
      <div>
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Divider
───────────────────────────────────────────── */
function Divider() {
  return <div className="border-t border-border" />
}

/* ─────────────────────────────────────────────
   Toast-style inline feedback
───────────────────────────────────────────── */
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function SaveFeedback({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium',
        'transition-all duration-300',
        state === 'saving' && 'border-border bg-muted text-muted-foreground',
        state === 'saved' && 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]',
        state === 'error' && 'border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]',
      )}
    >
      {state === 'saving' && (
        <>
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving changes…
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Settings saved successfully
        </>
      )}
      {state === 'error' && (
        <>
          <AlertTriangle className="size-4" aria-hidden="true" />
          Failed to save. Please try again.
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Form state
───────────────────────────────────────────── */
interface FormState {
  orgName: string
  currency: string
  timezone: string
  thresholdLow: string
  thresholdMedium: string
  thresholdHigh: string
  notifyEmail: boolean
  notifyPush: boolean
  notifyInApp: boolean
  escalationHours: string
}

interface FormErrors {
  orgName?: string
  thresholdLow?: string
  thresholdMedium?: string
  thresholdHigh?: string
  escalationHours?: string
}

const DEFAULT_FORM: FormState = {
  orgName: 'GridMind Capital Ltd.',
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  thresholdLow: '500000',
  thresholdMedium: '5000000',
  thresholdHigh: '25000000',
  notifyEmail: true,
  notifyPush: false,
  notifyInApp: true,
  escalationHours: '48',
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.orgName.trim()) errors.orgName = 'Organization name is required'
  else if (form.orgName.trim().length < 3) errors.orgName = 'Must be at least 3 characters'

  const low = Number(form.thresholdLow)
  const med = Number(form.thresholdMedium)
  const high = Number(form.thresholdHigh)

  if (!form.thresholdLow || isNaN(low) || low < 0) errors.thresholdLow = 'Enter a valid amount'
  if (!form.thresholdMedium || isNaN(med) || med < 0) errors.thresholdMedium = 'Enter a valid amount'
  if (!form.thresholdHigh || isNaN(high) || high < 0) errors.thresholdHigh = 'Enter a valid amount'
  if (!errors.thresholdLow && !errors.thresholdMedium && low >= med) {
    errors.thresholdMedium = 'Must be greater than Low threshold'
  }
  if (!errors.thresholdMedium && !errors.thresholdHigh && med >= high) {
    errors.thresholdHigh = 'Must be greater than Medium threshold'
  }

  const esc = Number(form.escalationHours)
  if (!form.escalationHours || isNaN(esc) || esc < 1 || esc > 8760) {
    errors.escalationHours = 'Enter a value between 1 and 8760 hours'
  }
  return errors
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export function TenantSettingsPage() {
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM)
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [touched, setTouched] = React.useState<Partial<Record<keyof FormState, boolean>>>({})

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // Live-validate touched fields
      if (touched[key]) {
        const e = validate(next)
        setErrors(prev => ({ ...prev, [key]: e[key as keyof FormErrors] }))
      }
      return next
    })
  }

  function touch(key: keyof FormState) {
    setTouched(prev => ({ ...prev, [key]: true }))
    const e = validate(form)
    setErrors(prev => ({ ...prev, [key]: e[key as keyof FormErrors] }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    // Mark all validatable fields as touched
    setTouched({ orgName: true, thresholdLow: true, thresholdMedium: true, thresholdHigh: true, escalationHours: true })
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaveState('saving')
    // Simulate API call
    await new Promise(r => setTimeout(r, 1400))
    // Mock: randomly fail 20% of the time to show error state
    if (Math.random() < 0.2) {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 4000)
    } else {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3500)
    }
  }

  const currencySymbol = { USD: '$', EUR: '€', GBP: '£', SAR: 'SAR', AED: 'AED' }[form.currency] ?? form.currency

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">

      {/* Page header */}
      <div>
        <h1 className="font-sans text-2xl font-bold tracking-tight text-foreground">
          Tenant Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization configuration and notification preferences.
        </p>
      </div>

      <form onSubmit={handleSave} noValidate aria-label="Tenant settings form">

        {/* ── 1. General ── */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Building2}
              title="General"
              description="Basic organization identity and subscription details."
            />
          </CardHeader>
          <CardContent className="pt-2">
            <FieldRow
              label="Organization Name"
              description="Displayed across the platform and in PDF exports."
              htmlFor="org-name"
            >
              <Input
                id="org-name"
                value={form.orgName}
                onChange={e => setField('orgName', e.target.value)}
                onBlur={() => touch('orgName')}
                error={errors.orgName}
                placeholder="e.g. GridMind Capital Ltd."
                fullWidth
                required
              />
            </FieldRow>

            <Divider />

            <FieldRow label="Plan" description="Your current subscription tier.">
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="gate">Enterprise</Badge>
                <span className="text-xs text-muted-foreground">Renewable EPC Edition</span>
              </div>
            </FieldRow>

            <Divider />

            <FieldRow label="Status" description="Current tenant operational status.">
              <div className="flex items-center gap-2 pt-1">
                <span className="inline-flex size-2 rounded-full bg-[#22c55e] ring-2 ring-[#22c55e]/30" aria-hidden="true" />
                <Badge variant="approved">Active</Badge>
                <span className="text-xs text-muted-foreground">Since Jan 2024</span>
              </div>
            </FieldRow>
          </CardContent>
        </Card>

        {/* ── 2. Currency & Thresholds ── */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Globe}
              title="Currency & Thresholds"
              description="Set the default currency and approval trigger amounts."
            />
          </CardHeader>
          <CardContent className="pt-2">

            <FieldRow
              label="Default Currency"
              description="Used for all budget displays and export reports."
            >
              <Select
                options={CURRENCIES}
                value={form.currency}
                onValueChange={v => setField('currency', v ?? 'USD')}
                placeholder="Select currency"
                fullWidth
              />
            </FieldRow>

            <Divider />

            <FieldRow
              label="Timezone"
              description="Controls schedule timestamps and notification delivery times."
            >
              <Select
                options={TIMEZONES}
                value={form.timezone}
                onValueChange={v => setField('timezone', v ?? 'UTC')}
                placeholder="Select timezone"
                fullWidth
              />
            </FieldRow>

            <Divider />

            {/* Threshold row — 3 inline inputs */}
            <div className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_1.5fr]">
              <div>
                <p className="text-sm font-medium text-foreground">Approval Thresholds</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Transactions above each threshold trigger the corresponding approval workflow tier.
                </p>
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    Currency: <span className="font-semibold text-foreground">{form.currency}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { key: 'thresholdLow', tier: 'Low', color: 'text-[#22c55e]' },
                      { key: 'thresholdMedium', tier: 'Medium', color: 'text-[#f59e0b]' },
                      { key: 'thresholdHigh', tier: 'High', color: 'text-[#ef4444]' },
                    ] as const
                  ).map(({ key, tier, color }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className={cn('text-xs font-semibold', color)}>{tier}</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {currencySymbol}
                        </span>
                        <input
                          id={key}
                          type="number"
                          min={0}
                          step={1000}
                          value={form[key]}
                          onChange={e => setField(key, e.target.value)}
                          onBlur={() => touch(key)}
                          aria-label={`${tier} threshold amount in ${form.currency}`}
                          className={cn(
                            'w-full rounded-lg border bg-input/30 py-2 pl-7 pr-2 font-mono text-sm text-foreground',
                            'outline-none transition-colors',
                            'focus:border-ring focus:ring-2 focus:ring-ring/30',
                            errors[key]
                              ? 'border-[#ef4444] focus:ring-[#ef4444]/20'
                              : 'border-border hover:border-ring/50',
                          )}
                        />
                      </div>
                      {errors[key] && (
                        <p className="text-[11px] text-[#ef4444]">{errors[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ordering: Low &lt; Medium &lt; High. All values in {form.currency}.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ── 3. Notifications ── */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <SectionHeader
              icon={Bell}
              title="Notifications"
              description="Control how and when the platform sends alerts to your team."
            />
          </CardHeader>
          <CardContent className="pt-2">

            {/* Toggle rows */}
            {(
              [
                {
                  key: 'notifyEmail' as const,
                  icon: Mail,
                  label: 'Email Notifications',
                  description: 'Send approval requests, gate alerts, and digests to user email addresses.',
                },
                {
                  key: 'notifyPush' as const,
                  icon: Smartphone,
                  label: 'Push Notifications',
                  description: 'Deliver real-time alerts to mobile devices via the GridMind mobile app.',
                },
                {
                  key: 'notifyInApp' as const,
                  icon: MonitorSmartphone,
                  label: 'In-App Notifications',
                  description: 'Show notification bell alerts inside the platform for all active sessions.',
                },
              ]
            ).map(({ key, icon: Icon, label, description }, i, arr) => (
              <React.Fragment key={key}>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <label
                        htmlFor={`toggle-${key}`}
                        className="block text-sm font-medium text-foreground cursor-pointer"
                      >
                        {label}
                      </label>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <Toggle
                    id={`toggle-${key}`}
                    checked={form[key]}
                    onChange={v => setField(key, v)}
                  />
                </div>
                {i < arr.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            <Divider />

            {/* Auto-escalation */}
            <FieldRow
              label="Auto-escalation Delay"
              description="Unactioned approvals are automatically escalated after this many hours."
              htmlFor="escalation-hours"
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-1">
                  <Clock
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    id="escalation-hours"
                    type="number"
                    min={1}
                    max={8760}
                    step={1}
                    value={form.escalationHours}
                    onChange={e => setField('escalationHours', e.target.value)}
                    onBlur={() => touch('escalationHours')}
                    aria-describedby="escalation-hint"
                    placeholder="48"
                    className={cn(
                      'w-full rounded-lg border bg-input/30 py-2 pl-9 pr-16 font-mono text-sm text-foreground',
                      'outline-none transition-colors',
                      'focus:border-ring focus:ring-2 focus:ring-ring/30',
                      errors.escalationHours
                        ? 'border-[#ef4444] focus:ring-[#ef4444]/20'
                        : 'border-border hover:border-ring/50',
                    )}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    hours
                  </span>
                </div>
                {/* Quick-set chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[24, 48, 72, 168].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setField('escalationHours', String(h))}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                        form.escalationHours === String(h)
                          ? 'border-[#64ffda]/50 bg-[#64ffda]/10 text-[#64ffda]'
                          : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {h === 168 ? '1w' : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>
              {errors.escalationHours && (
                <p className="mt-1.5 text-xs text-[#ef4444]">{errors.escalationHours}</p>
              )}
              {!errors.escalationHours && (
                <p id="escalation-hint" className="mt-1.5 text-xs text-muted-foreground">
                  Recommended: 48h for standard projects, 24h for critical gate reviews.
                </p>
              )}
            </FieldRow>

          </CardContent>
        </Card>

        {/* ── Sticky save footer ── */}
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-4 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
          <SaveFeedback state={saveState} />
          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={() => {
                setForm(DEFAULT_FORM)
                setErrors({})
                setTouched({})
                setSaveState('idle')
              }}
              disabled={saveState === 'saving'}
            >
              Reset
            </Button>
            <Button
              type="submit"
              variant="gate"
              size="default"
              loading={saveState === 'saving'}
              disabled={saveState === 'saving'}
            >
              <Save className="size-4" aria-hidden="true" />
              Save Changes
            </Button>
          </div>
        </div>

      </form>
    </div>
  )
}
