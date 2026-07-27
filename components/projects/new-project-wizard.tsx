'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight,
  Wand2, Building2, MapPin, DollarSign, Calendar, FileText,
  User, Loader2, X, Plus, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createProject } from '@/app/actions/projects'
import { G0IntakeForm } from '@/components/stage-gate/g0-intake-form'

/* ─────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────── */

export interface ProjectFormData {
  code: string
  name: string
  description: string
  technology_type: string
  capacity_mw: number | null
  client_name: string
  client_contact: string
  client_email: string
  location: string
  latitude: number | null
  longitude: number | null
  epc_contractor: string
  owner_engineer: string
  budget_amount: number | null
  currency: string
  start_date: string | null
  target_cod: string | null
  project_manager_id: string
  confirm: boolean
}

export interface NewProjectWizardProps {
  users?: { id: string; full_name: string; role: string; avatar_url: string | null }[]
  onSubmit?: (data: ProjectFormData) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

type StepErrors = Partial<Record<keyof ProjectFormData | 'confirm', string>>

/* Keep old export name alive for the page.tsx import */
export type NewProjectFormData = ProjectFormData

/* ─────────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: 'Basic Info',        description: 'Project code and name'   },
  { id: 2, label: 'Client Details',    description: 'Client and location'     },
  { id: 3, label: 'Budget & Timeline', description: 'Financials and dates'    },
  { id: 4, label: 'Review',            description: 'Confirm and submit'      },
] as const

const TECHNOLOGY_OPTIONS = [
  { value: 'Solar PV',                   label: 'Solar PV'                   },
  { value: 'Offshore Wind',              label: 'Offshore Wind'              },
  { value: 'Onshore Wind',               label: 'Onshore Wind'               },
  { value: 'Hydroelectric',              label: 'Hydroelectric'              },
  { value: 'Concentrated Solar Power',   label: 'Concentrated Solar Power (CSP)' },
  { value: 'Battery Storage',            label: 'Battery Storage'            },
  { value: 'Hybrid',                     label: 'Hybrid'                     },
  { value: 'Other',                      label: 'Other'                      },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SAR', label: 'SAR' },
  { value: 'AED', label: 'AED' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CNY', label: 'CNY' },
  { value: 'INR', label: 'INR' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'CHF', label: 'CHF' },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', SAR: '﷼', AED: 'د.إ',
  JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$', CHF: 'Fr',
}

const DRAFT_KEY = 'gridmind-new-project-draft'

/* ─────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────── */

function generateCode(): string {
  const now = new Date()
  const yr  = now.getFullYear()
  const rnd = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0')
  return `GMC-${yr}-${rnd}`
}

function formatBudget(amount: number | null, currency: string): string {
  if (!amount || isNaN(amount)) return '—'
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  if (amount >= 1_000_000_000) return `${sym}${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000)     return `${sym}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)         return `${sym}${(amount / 1_000).toFixed(1)}K`
  return `${sym}${amount.toLocaleString()}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function displayValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/* ─────────────────────────────────────────────────────────────────
   Validation
───────────────────────────────────────────────────────────────── */

function validateStep(step: number, data: ProjectFormData): StepErrors {
  const errors: StepErrors = {}

  if (step === 1) {
    if (!data.code.trim())
      errors.code = 'Project code is required.'
    else if (data.code.trim().length < 3)
      errors.code = 'Code must be at least 3 characters.'

    if (!data.name.trim())
      errors.name = 'Project name is required.'
    else if (data.name.trim().length < 3 || data.name.trim().length > 100)
      errors.name = 'Project name must be between 3 and 100 characters.'

    if (!data.technology_type)
      errors.technology_type = 'Technology type is required.'
  }

  if (step === 2) {
    if (!data.client_name.trim())
      errors.client_name = 'Client name is required.'
    else if (data.client_name.trim().length < 2)
      errors.client_name = 'Client name must be at least 2 characters.'

    if (data.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client_email))
      errors.client_email = 'Please enter a valid email address.'
  }

  if (step === 3) {
    if (data.start_date && data.target_cod && data.target_cod <= data.start_date)
      errors.target_cod = 'Target COD must be after the start date.'
  }

  if (step === 4) {
    if (!data.confirm)
      errors.confirm = 'You must confirm the information is accurate.'
  }

  return errors
}

/* ─────────────────────────────────────────────────────────────────
   StepIndicator
───────────────────────────────────────────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Wizard steps" className="mb-8">
      {/* Mobile progress bar */}
      <div className="sm:hidden mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500 font-medium">Step {current} of {STEPS.length}</span>
          <span className="font-semibold text-slate-900 dark:text-foreground">{STEPS[current - 1].label}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0a192f] dark:bg-[#64ffda] transition-all duration-500"
            style={{ width: `${(current / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop stepper */}
      <ol className="hidden sm:flex items-center w-full">
        {STEPS.map((step, idx) => {
          const done   = current > step.id
          const active = current === step.id
          const isLast = idx === STEPS.length - 1

          return (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center flex-shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center size-8 rounded-full text-sm font-bold transition-all duration-300 select-none',
                    done   && 'bg-green-500 text-white',
                    active && 'bg-[#0a192f] dark:bg-[#112240] text-white ring-2 ring-[#0a192f]/20 dark:ring-[#64ffda]/20',
                    !done && !active && 'bg-white dark:bg-card border-2 border-slate-300 dark:border-border text-slate-400 dark:text-muted-foreground',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="size-4" aria-hidden /> : <span>{step.id}</span>}
                </div>
                <p className={cn(
                  'text-xs mt-2 whitespace-nowrap',
                  active  ? 'font-medium text-slate-900 dark:text-foreground' : 'text-slate-500 dark:text-muted-foreground',
                )}>
                  {step.label}
                </p>
              </li>

              {!isLast && (
                <div className="flex-1 mx-2 mb-4">
                  <div className={cn(
                    'h-0.5 w-full rounded-full transition-all duration-500',
                    done ? 'bg-green-400' : 'bg-slate-200 dark:bg-border',
                  )} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Field helpers
───────────────────────────────────────────────────────────────── */

function FieldWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>
}

function FieldLabel({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 dark:text-foreground select-none">
      {children}
      {required && <span className="text-red-500 ml-1" aria-hidden>*</span>}
    </label>
  )
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500 dark:text-muted-foreground">{children}</p>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-500" role="alert">{message}</p>
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Step 1: Basic Info
───────────────────────────────────────────────────────────────── */

interface Step1Props {
  data: ProjectFormData
  errors: StepErrors
  onChange: (field: keyof ProjectFormData, value: string | number | null) => void
  onAutoGenerate: () => void
}

function Step1({ data, errors, onChange, onAutoGenerate }: Step1Props) {
  const descId = React.useId()
  const descLen = data.description.length

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Basic Information"
        subtitle="Enter the fundamental project details"
      />

      {/* Project Code */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-code" required>Project Code</FieldLabel>
        <div className="flex gap-2">
          <input
            id="field-code"
            value={data.code}
            onChange={(e) => onChange('code', e.target.value)}
            placeholder="e.g., SOL-2026-001"
            className={cn(
              'flex-1 rounded-lg border bg-white dark:bg-input/30 px-3 py-2 text-sm font-mono text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none transition-colors',
              'focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20',
              errors.code ? 'border-red-400' : 'border-slate-200 dark:border-border',
            )}
          />
          <button
            type="button"
            onClick={onAutoGenerate}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-xs font-medium text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors shrink-0"
            aria-label="Auto-generate project code"
          >
            <Wand2 className="size-3.5" aria-hidden />
            Auto-generate
          </button>
        </div>
        <FieldHelper>Auto-generated based on technology and year</FieldHelper>
        <FieldError message={errors.code} />
      </FieldWrapper>

      {/* Project Name */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-name" required>Project Name</FieldLabel>
        <input
          id="field-name"
          value={data.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., Al Dhafra Solar PV - Phase 1"
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-input/30 px-3 py-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none transition-colors',
            'focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20',
            errors.name ? 'border-red-400' : 'border-slate-200 dark:border-border',
          )}
        />
        <FieldError message={errors.name} />
      </FieldWrapper>

      {/* Description */}
      <FieldWrapper>
        <FieldLabel htmlFor={descId}>Description <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <div className="relative">
          <textarea
            id={descId}
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe the project scope and objectives..."
            rows={4}
            maxLength={500}
            className={cn(
              'w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 pb-6 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none transition-colors resize-y',
              'focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20',
            )}
          />
          <span className="absolute bottom-2 right-3 text-xs text-slate-400 dark:text-muted-foreground pointer-events-none">
            {descLen} / 500
          </span>
        </div>
      </FieldWrapper>

      {/* Technology Type */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-tech" required>Technology Type</FieldLabel>
        <Select
          id="field-tech"
          options={TECHNOLOGY_OPTIONS}
          value={data.technology_type}
          onValueChange={(v) => onChange('technology_type', v ?? '')}
          placeholder="Select technology type"
          error={errors.technology_type}
          fullWidth
        />
      </FieldWrapper>

      {/* Capacity */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-capacity">Capacity (MW) <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <div className="relative">
          <input
            id="field-capacity"
            type="number"
            value={data.capacity_mw ?? ''}
            onChange={(e) => onChange('capacity_mw', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="e.g., 2000"
            className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none transition-colors focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20"
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 dark:text-muted-foreground pointer-events-none">MW</span>
        </div>
        <FieldHelper>Megawatts of installed capacity</FieldHelper>
      </FieldWrapper>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Step 2: Client Details
───────────────────────────────────────────────────────────────── */

interface Step2Props {
  data: ProjectFormData
  errors: StepErrors
  onChange: (field: keyof ProjectFormData, value: string | number | null) => void
}

function Step2({ data, errors, onChange }: Step2Props) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Client Details"
        subtitle="Identify the project owner and stakeholders"
      />

      {/* Client Name */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-client" required>Client Name</FieldLabel>
        <Input
          id="field-client"
          value={data.client_name}
          onChange={(e) => onChange('client_name', e.target.value)}
          placeholder="e.g., Emirates Water and Electricity Company"
          error={errors.client_name}
          leadingIcon={<Building2 />}
          fullWidth
        />
      </FieldWrapper>

      {/* Primary Contact */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-contact">Primary Contact <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <Input
          id="field-contact"
          value={data.client_contact}
          onChange={(e) => onChange('client_contact', e.target.value)}
          placeholder="Contact person name"
          leadingIcon={<User />}
          fullWidth
        />
      </FieldWrapper>

      {/* Contact Email */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-email">Contact Email <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <Input
          id="field-email"
          type="email"
          value={data.client_email}
          onChange={(e) => onChange('client_email', e.target.value)}
          placeholder="contact@client.com"
          error={errors.client_email}
          fullWidth
        />
      </FieldWrapper>

      {/* Location */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-location">Project Location <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <Input
          id="field-location"
          value={data.location}
          onChange={(e) => onChange('location', e.target.value)}
          placeholder="e.g., Al Dhafra, Abu Dhabi, UAE"
          leadingIcon={<MapPin />}
          fullWidth
        />
        <FieldHelper>City, Region, Country</FieldHelper>
      </FieldWrapper>

      {/* Coordinates */}
      <FieldWrapper>
        <FieldLabel>Coordinates <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <div className="flex gap-4">
          <input
            type="number"
            value={data.latitude ?? ''}
            onChange={(e) => onChange('latitude', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="24.4539"
            className="flex-1 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20 transition-colors"
            aria-label="Latitude"
          />
          <input
            type="number"
            value={data.longitude ?? ''}
            onChange={(e) => onChange('longitude', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="54.3773"
            className="flex-1 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20 transition-colors"
            aria-label="Longitude"
          />
        </div>
        <FieldHelper>GPS coordinates for mapping</FieldHelper>
      </FieldWrapper>

      {/* EPC Contractor */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-epc">EPC Contractor <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <Input
          id="field-epc"
          value={data.epc_contractor}
          onChange={(e) => onChange('epc_contractor', e.target.value)}
          placeholder="e.g., GridMind EPC Solutions"
          fullWidth
        />
      </FieldWrapper>

      {/* Owner Engineer */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-oe">Owner Engineer <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <Input
          id="field-oe"
          value={data.owner_engineer}
          onChange={(e) => onChange('owner_engineer', e.target.value)}
          placeholder="e.g., GridMind Engineering"
          fullWidth
        />
      </FieldWrapper>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Step 3: Budget & Timeline
────────────────────────────────────────────────────────────���──── */

interface Step3Props {
  data: ProjectFormData
  errors: StepErrors
  onChange: (field: keyof ProjectFormData, value: string | number | null) => void
  users: { id: string; full_name: string; role: string; avatar_url: string | null }[]
}

function Step3({ data, errors, onChange, users }: Step3Props) {
  const budgetFormatted = React.useMemo(
    () => data.budget_amount
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }).format(data.budget_amount)
      : null,
    [data.budget_amount, data.currency],
  )

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.full_name} — ${u.role}` }))

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Budget &amp; Timeline"
        subtitle="Define financial parameters and key dates"
      />

      {/* Budget row */}
      <FieldWrapper>
        <FieldLabel>Budget Amount <span className="font-normal text-slate-400 dark:text-muted-foreground">(optional)</span></FieldLabel>
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Select
              options={CURRENCY_OPTIONS}
              value={data.currency}
              onValueChange={(v) => onChange('currency', v ?? 'USD')}
              fullWidth
            />
          </div>
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-muted-foreground pointer-events-none" aria-hidden />
            <input
              type="number"
              value={data.budget_amount ?? ''}
              onChange={(e) => onChange('budget_amount', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="e.g., 1200000000"
              className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20 transition-colors"
            />
          </div>
        </div>
        {budgetFormatted && (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">{budgetFormatted}</p>
        )}
        <FieldHelper>Total project budget in selected currency</FieldHelper>
        <FieldError message={errors.budget_amount as string | undefined} />
      </FieldWrapper>

      {/* Start Date + Target COD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldWrapper>
          <FieldLabel htmlFor="field-start">Project Start Date</FieldLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-muted-foreground pointer-events-none" aria-hidden />
            <input
              id="field-start"
              type="date"
              value={data.start_date ?? ''}
              onChange={(e) => onChange('start_date', e.target.value || null)}
              className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-foreground outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20 transition-colors"
            />
          </div>
        </FieldWrapper>

        <FieldWrapper>
          <FieldLabel htmlFor="field-cod">Target Commercial Operation Date</FieldLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-muted-foreground pointer-events-none" aria-hidden />
            <input
              id="field-cod"
              type="date"
              value={data.target_cod ?? ''}
              onChange={(e) => onChange('target_cod', e.target.value || null)}
              className={cn(
                'w-full rounded-lg border bg-white dark:bg-input/30 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-foreground outline-none focus:border-[#0a192f] focus:ring-2 focus:ring-[#0a192f]/10 dark:focus:border-ring dark:focus:ring-ring/20 transition-colors',
                errors.target_cod ? 'border-red-400' : 'border-slate-200 dark:border-border',
              )}
            />
          </div>
          <FieldHelper>Expected date of commercial operation</FieldHelper>
          <FieldError message={errors.target_cod} />
        </FieldWrapper>
      </div>

      {/* Duration hint */}
      {data.start_date && data.target_cod && data.target_cod > data.start_date && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border px-4 py-2.5">
          <Calendar className="size-4 text-slate-400 dark:text-muted-foreground shrink-0" aria-hidden />
          {(() => {
            const months = Math.round((new Date(data.target_cod).getTime() - new Date(data.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
            return (
              <span className="text-sm text-slate-600 dark:text-muted-foreground">
                Project duration: <span className="font-semibold text-slate-900 dark:text-foreground">{months} months</span>
                {' '}({(months / 12).toFixed(1)} years)
              </span>
            )
          })()}
        </div>
      )}

      {/* Project Manager */}
      <FieldWrapper>
        <FieldLabel htmlFor="field-pm" required>Project Manager</FieldLabel>
        {userOptions.length > 0 ? (
          <Select
            id="field-pm"
            options={userOptions}
            value={data.project_manager_id}
            onValueChange={(v) => onChange('project_manager_id', v ?? '')}
            placeholder="Select project manager"
            fullWidth
          />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-muted px-3 py-2">
            <User className="size-4 text-slate-400 dark:text-muted-foreground shrink-0" aria-hidden />
            <span className="text-sm text-slate-500 dark:text-muted-foreground italic">No users available — will be assigned on creation</span>
          </div>
        )}
        <FieldError message={errors.project_manager_id} />
      </FieldWrapper>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Step 4: Review
───────────────────────────────────────────────────────────────── */

interface Step4Props {
  data: ProjectFormData
  errors: StepErrors
  confirm: boolean
  onConfirmChange: (v: boolean) => void
  onEdit: (step: number) => void
  onSubmit: () => void
  onCancel: () => void
  submitting: boolean
  users: { id: string; full_name: string; role: string; avatar_url: string | null }[]
}

interface ReviewGridRow { label: string; value: string }

function ReviewGrid({ rows }: { rows: ReviewGridRow[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs uppercase tracking-wider font-medium text-slate-500 dark:text-muted-foreground mb-0.5">{label}</dt>
          <dd className="text-sm font-medium text-slate-900 dark:text-foreground break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewSection({
  title,
  onEdit,
  step,
  children,
}: {
  title: string
  onEdit: (s: number) => void
  step: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-muted/40 border border-slate-200 dark:border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function Step4({ data, errors, confirm, onConfirmChange, onEdit, onSubmit, onCancel, submitting, users }: Step4Props) {
  const pmName = users.find((u) => u.id === data.project_manager_id)?.full_name ?? (data.project_manager_id || '—')

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Review &amp; Submit"
        subtitle="Verify all project details before creation"
      />

      {/* Warning banner */}
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10 px-4 py-3.5"
      >
        <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">This project will start at Project Intake phase</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            All projects begin in the Intake phase. You will need Executive Sponsor approval to proceed to Gate G1.
          </p>
        </div>
      </div>

      {/* Review sections */}
      <div className="flex flex-col gap-4">
        <ReviewSection title="Basic Information" onEdit={onEdit} step={1}>
          <ReviewGrid rows={[
            { label: 'Code',        value: data.code },
            { label: 'Name',        value: data.name },
            { label: 'Technology',  value: data.technology_type },
            { label: 'Capacity',    value: data.capacity_mw ? `${data.capacity_mw} MW` : '—' },
            { label: 'Description', value: data.description || '—' },
          ]} />
        </ReviewSection>

        <ReviewSection title="Client Details" onEdit={onEdit} step={2}>
          <ReviewGrid rows={[
            { label: 'Client Name',     value: data.client_name },
            { label: 'Contact',         value: data.client_contact },
            { label: 'Email',           value: data.client_email },
            { label: 'Location',        value: data.location },
            { label: 'Coordinates',     value: (data.latitude && data.longitude) ? `${data.latitude}, ${data.longitude}` : '—' },
            { label: 'EPC Contractor',  value: data.epc_contractor },
            { label: 'Owner Engineer',  value: data.owner_engineer },
          ]} />
        </ReviewSection>

        <ReviewSection title="Budget &amp; Timeline" onEdit={onEdit} step={3}>
          <ReviewGrid rows={[
            { label: 'Budget',           value: data.budget_amount ? formatBudget(data.budget_amount, data.currency) : '—' },
            { label: 'Currency',         value: data.currency },
            { label: 'Start Date',       value: formatDate(data.start_date) },
            { label: 'Target COD',       value: formatDate(data.target_cod) },
            { label: 'Project Manager',  value: pmName },
          ]} />
        </ReviewSection>
      </div>

      {/* Confirm + Submit */}
      <div className="border-t border-slate-200 dark:border-border pt-6 flex flex-col gap-4">
        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            id="wizard-confirm"
            checked={confirm}
            onChange={(e) => onConfirmChange(e.target.checked)}
            className={cn(
              'mt-0.5 size-4 shrink-0 cursor-pointer rounded border-2 accent-[#0a192f]',
              errors.confirm && !confirm && 'outline outline-red-400',
            )}
          />
          <span className="text-sm text-slate-700 dark:text-foreground leading-snug">
            I confirm that all project information is accurate and complete
          </span>
        </label>
        {errors.confirm && <FieldError message={errors.confirm} />}

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors',
            'bg-[#0a192f] hover:bg-slate-800 dark:bg-[#112240] dark:hover:bg-[#0a192f]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {submitting ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden /><span>Creating...</span></>
          ) : (
            <><CheckCircle2 className="size-4" aria-hidden /><span>Create Project</span></>
          )}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-border px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors"
        >
          <X className="size-4" aria-hidden />
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Success Overlay
───────────────────────────────────────────────────────────────── */

function SuccessOverlay({
  code,
  onViewProject,
  onCreateAnother,
  onBack,
}: {
  code: string
  onViewProject: () => void
  onCreateAnother: () => void
  onBack: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center text-center px-6 max-w-md">
        <CheckCircle2
          className="size-16 text-green-500 animate-bounce mb-4"
          aria-hidden
        />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-foreground mt-2">Project Created Successfully!</h2>
        <p className="text-lg font-mono text-slate-600 dark:text-muted-foreground mt-2">{code}</p>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-2 max-w-sm">
          The project has been created. An approval request has been sent to the Executive Sponsor.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={onViewProject}
            className="flex items-center gap-2 rounded-lg bg-[#0a192f] dark:bg-[#112240] px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            View Project <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onCreateAnother}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors"
          >
            <Plus className="size-4" aria-hidden /> Create Another
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Draft resume banner
───────────────────────────────────────────────────────────────── */

function DraftBanner({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-900/10 px-4 py-3 mb-6">
      <FileText className="size-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden />
      <p className="text-sm text-sky-800 dark:text-sky-300 flex-1">You have an unsaved draft. Resume where you left off?</p>
      <button type="button" onClick={onResume} className="text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline shrink-0">Resume</button>
      <button type="button" onClick={onDiscard} className="text-xs text-slate-500 dark:text-muted-foreground hover:underline shrink-0">Discard</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Initial form state
───────────────────────────────────────────────────────────────── */

const INITIAL_DATA: ProjectFormData = {
  code:               '',
  name:               '',
  description:        '',
  technology_type:    '',
  capacity_mw:        null,
  client_name:        '',
  client_contact:     '',
  client_email:       '',
  location:           '',
  latitude:           null,
  longitude:          null,
  epc_contractor:     '',
  owner_engineer:     '',
  budget_amount:      null,
  currency:           'USD',
  start_date:         null,
  target_cod:         null,
  project_manager_id: '',
  confirm:            false,
}

/* ─────────────────────────────────────────────────────────────────
   Main Wizard Component
───────────────────────────────────────────────────────────────── */

export function NewProjectWizard({
  users       = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
}: NewProjectWizardProps) {
  const [step,       setStep]       = React.useState(1)
  const [data,       setData]       = React.useState<ProjectFormData>({ ...INITIAL_DATA, code: generateCode() })
  const [errors,     setErrors]     = React.useState<StepErrors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted,  setSubmitted]  = React.useState(false)
  const [showDraft,  setShowDraft]  = React.useState(false)
  const [savedCode,  setSavedCode]  = React.useState('')
  const contentRef  = React.useRef<HTMLDivElement>(null)

  /* Draft load on mount */
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) setShowDraft(true)
    } catch { /* ignore */ }
  }, [])

  /* Auto-save every 30 s */
  React.useEffect(() => {
    if (submitted) return
    const id = setInterval(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data })) } catch { /* ignore */ }
    }, 30_000)
    return () => clearInterval(id)
  }, [step, data, submitted])

  const handleChange = React.useCallback(
    (field: keyof ProjectFormData, value: string | number | null | boolean) => {
      setData(prev => ({ ...prev, [field]: value }))
      setErrors(prev => ({ ...prev, [field]: undefined }))
    },
    [],
  )

  const scrollTop = () => contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

  const handleNext = () => {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) { setErrors(stepErrors); return }
    setErrors({})
    setStep(s => Math.min(s + 1, STEPS.length))
    scrollTop()
  }

  const handleBack = () => {
    setErrors({})
    setStep(s => Math.max(s - 1, 1))
    scrollTop()
  }

  const handleEdit = (targetStep: number) => {
    setErrors({})
    setStep(targetStep)
    scrollTop()
  }

  const handleSubmit = async () => {
    const stepErrors = validateStep(4, data)
    if (Object.keys(stepErrors).length > 0) { setErrors(stepErrors); return }
    setSubmitting(true)
    try {
      await onSubmit?.(data)
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      setSavedCode(data.code)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResumeDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const { step: s, data: d } = JSON.parse(raw) as { step: number; data: ProjectFormData }
      setStep(s)
      setData(d)
    } catch { /* ignore */ }
    setShowDraft(false)
  }

  const handleDiscardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
    setShowDraft(false)
  }

  const handleCreateAnother = () => {
    setData({ ...INITIAL_DATA, code: generateCode() })
    setStep(1)
    setErrors({})
    setSubmitted(false)
  }

  /* Success overlay */
  if (submitted) {
    return (
      <SuccessOverlay
        code={savedCode}
        onViewProject={() => onCancel?.()}
        onCreateAnother={handleCreateAnother}
        onBack={() => onCancel?.()}
      />
    )
  }

  const isLastStep = step === STEPS.length
  const busy = submitting || isSubmitting

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-0">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to Projects
          </button>
        )}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground tracking-tight mt-4">New Project</h1>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1 mb-6">
          Create a new EPC project following the 8-phase gate system
        </p>
        <StepIndicator current={step} />
      </div>

      {/* Scrollable content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
        {showDraft && (
          <DraftBanner onResume={handleResumeDraft} onDiscard={handleDiscardDraft} />
        )}

        {/* Step content card */}
        <div
          key={step}
          className="rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card shadow-sm p-8 animate-fade-in"
        >
          {step === 1 && (
            <Step1 data={data} errors={errors} onChange={handleChange} onAutoGenerate={() => handleChange('code', generateCode())} />
          )}
          {step === 2 && (
            <Step2 data={data} errors={errors} onChange={handleChange} />
          )}
          {step === 3 && (
            <Step3 data={data} errors={errors} onChange={handleChange} users={users} />
          )}
          {step === 4 && (
            <Step4
              data={data}
              errors={errors}
              confirm={data.confirm}
              onConfirmChange={(v) => handleChange('confirm', v)}
              onEdit={handleEdit}
              onSubmit={handleSubmit}
              onCancel={() => onCancel?.()}
              submitting={busy}
              users={users}
            />
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          {/* Previous */}
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border px-4 py-2 text-sm font-medium text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4" aria-hidden /> Previous
            </button>
          ) : (
            <div />
          )}

          {/* Error hint — only show on steps 1-3; step 4 has inline error on the submit button */}
          {Object.values(errors).some(Boolean) && !isLastStep && (
            <p className="hidden sm:block text-xs text-red-500 flex-1 text-center" role="alert">
              Please fix the errors above to continue.
            </p>
          )}

          {/* Next / hidden on step 4 (submit is inside Step4 content) */}
          {!isLastStep && (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 rounded-lg bg-[#0a192f] dark:bg-[#112240] hover:bg-slate-800 dark:hover:bg-[#0a192f] px-5 py-2 text-sm font-semibold text-white transition-colors"
            >
              Next <ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Page wrapper
───────────────────────────────────────────────────────────────── */

// ─────────────────────────────────────────────────────────────────
//  G0 Step — shown after successful project creation
// ─────────────────────────────────────────────────────────────────

function G0Step({
  projectId,
  projectCode,
  projectName,
  onSkip,
  onDone,
}: {
  projectId: string
  projectCode: string
  projectName: string
  onSkip: () => void
  onDone: () => void
}) {
  const [submitted, setSubmitted] = React.useState(false)

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="size-16 rounded-full bg-[#64ffda]/10 flex items-center justify-center">
          <CheckCircle className="size-8 text-[#64ffda]" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Project Intake Submitted</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            The Project Intake package has been saved and the review team has been notified.
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="mt-2 flex items-center gap-2 rounded-lg bg-[#0a192f] dark:bg-[#112240] hover:bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          View Project <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Optional — Complete Now or Later</p>
          <h2 className="text-xl font-bold text-foreground">Project Intake</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in the G0 package for <span className="font-mono text-[#64ffda]">{projectCode}</span> to start the approval workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Skip for now
        </button>
      </div>
      <G0IntakeForm
        projectId={projectId}
        projectCode={projectCode}
        projectName={projectName}
        onSubmitted={() => setSubmitted(true)}
      />
    </div>
  )
}

export function NewProjectWizardPage() {
  const router = useRouter()
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [createdProject, setCreatedProject] = React.useState<{ id: string; code: string; name: string } | null>(null)
  const [showG0, setShowG0] = React.useState(false)

  // Normalise a date value (YYYY-MM-DD | MM/DD/YYYY | Date) → 'YYYY-MM-DD' or ''
  const toIsoDate = (val: string | Date | undefined | null): string => {
    if (!val) return ''
    if (val instanceof Date) return val.toISOString().split('T')[0]
    const s = String(val).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [m, d, y] = s.split('/')
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
    const parsed = new Date(s)
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
  }

  const handleSubmit = async (data: ProjectFormData) => {
    setSubmitError(null)
    const result = await createProject({
      name:               data.name,
      code:               data.code,
      technology:         data.technology_type,
      capacity_mw:        data.capacity_mw ?? 0,
      location:           data.location || '',
      country:            (data.location || '').split(',').at(-1)?.trim() ?? '',
      budget_usd:         data.budget_amount ?? 0,
      start_date:         toIsoDate(data.start_date),
      target_completion:  toIsoDate(data.target_cod),
      description:        data.description || undefined,
    })

    if ('error' in result) {
      setSubmitError(result.error)
      throw new Error(result.error)
    }

    setCreatedProject({ id: result.id, code: data.code, name: data.name })
    router.refresh()
    // Show G0 step after the wizard's own success overlay fades
    setTimeout(() => setShowG0(true), 2800)
  }

  // G0 step shown after wizard success overlay
  if (showG0 && createdProject) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <G0Step
              projectId={createdProject.id}
              projectCode={createdProject.code}
              projectName={createdProject.name}
              onSkip={() => router.push(`/projects/${createdProject.id}`)}
              onDone={() => router.push(`/projects/${createdProject.id}`)}
            />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {submitError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
      <Card className="shadow-sm min-h-[600px] flex flex-col overflow-hidden">
        <NewProjectWizard
          users={[]}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/projects')}
        />
      </Card>
    </div>
  )
}
