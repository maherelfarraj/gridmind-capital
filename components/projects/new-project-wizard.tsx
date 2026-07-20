'use client'

import * as React from 'react'
import {
  CheckCircle2, ChevronRight, AlertTriangle, Zap,
  Building2, MapPin, DollarSign, Calendar, FileText,
  ArrowLeft, ArrowRight, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/* ── Types ──────────────────────────────────────────────────── */

export interface NewProjectFormData {
  // Step 1 — Basic Info
  code: string
  name: string
  description: string
  // Step 2 — Client Details
  clientName: string
  location: string
  // Step 3 — Budget & Timeline
  budgetAmount: string
  currency: string
  startDate: string
  targetCod: string
}

type StepErrors = Partial<Record<keyof NewProjectFormData, string>>

export interface NewProjectWizardProps {
  /** Called when the form is submitted with valid data */
  onSubmit?: (data: NewProjectFormData) => Promise<void> | void
  /** Called when the user cancels the wizard */
  onCancel?: () => void
  /** Pre-fill values (e.g. to edit an existing draft) */
  defaultValues?: Partial<NewProjectFormData>
}

/* ── Constants ──────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: 'Basic Info',        description: 'Project code and name' },
  { id: 2, label: 'Client Details',    description: 'Client and location' },
  { id: 3, label: 'Budget & Timeline', description: 'Financials and dates' },
  { id: 4, label: 'Review',            description: 'Confirm and submit' },
] as const

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'AED', label: 'AED — UAE Dirham' },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', SAR: '﷼', AED: 'د.إ',
}

/** Generate a project code: GMC-YYYYMM-XXXX */
function generateCode(): string {
  const now = new Date()
  const yr  = now.getFullYear()
  const mo  = String(now.getMonth() + 1).padStart(2, '0')
  const rnd = Math.floor(1000 + Math.random() * 9000)
  return `GMC-${yr}${mo}-${rnd}`
}

function formatBudget(amount: string, currency: string): string {
  const n = parseFloat(amount)
  if (isNaN(n)) return '—'
  const sym = CURRENCY_SYMBOLS[currency] ?? currency
  if (n >= 1_000_000_000) return `${sym}${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `${sym}${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${sym}${(n / 1_000).toFixed(1)}K`
  return `${sym}${n.toLocaleString()}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso
  }
}

/* ── Step Indicator ──────────────────────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Wizard steps" className="w-full">
      {/* Mobile: progress bar */}
      <div className="flex items-center justify-between mb-1.5 sm:hidden">
        <span className="text-xs font-medium text-muted-foreground">
          Step {current} of {STEPS.length}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {STEPS[current - 1].label}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted mb-6 sm:hidden overflow-hidden">
        <div
          className="h-full rounded-full bg-[#64ffda] transition-all duration-500"
          style={{ width: `${((current) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Desktop: circles + connectors */}
      <ol className="hidden sm:flex items-center w-full mb-10">
        {STEPS.map((step, idx) => {
          const done    = current > step.id
          const active  = current === step.id
          const future  = current < step.id
          const isLast  = idx === STEPS.length - 1

          return (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center flex-shrink-0">
                {/* Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center size-9 rounded-full border-2 text-sm font-bold transition-all duration-300 select-none',
                    done   && 'border-[#64ffda] bg-[#64ffda] text-[#0a192f]',
                    active && 'border-[#64ffda] bg-[#0a192f] text-[#64ffda] ring-4 ring-[#64ffda]/20 dark:bg-[#112240]',
                    future && 'border-border bg-card text-muted-foreground',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                {/* Label */}
                <div className="mt-2 text-center">
                  <p className={cn(
                    'text-xs font-semibold whitespace-nowrap',
                    active  ? 'text-foreground' : 'text-muted-foreground',
                    done    && 'text-[#64ffda]',
                  )}>
                    {step.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden lg:block">
                    {step.description}
                  </p>
                </div>
              </li>

              {/* Connector */}
              {!isLast && (
                <div className="flex-1 mx-2 mb-5">
                  <div className={cn(
                    'h-0.5 w-full rounded-full transition-all duration-500',
                    done ? 'bg-[#64ffda]' : 'bg-border',
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

/* ── Step 1: Basic Info ─────────────────────────────────────── */

interface Step1Props {
  data: Pick<NewProjectFormData, 'code' | 'name' | 'description'>
  errors: StepErrors
  onChange: (field: keyof NewProjectFormData, value: string) => void
  onRegenerateCode: () => void
}

function Step1({ data, errors, onChange, onRegenerateCode }: Step1Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Basic Information</h2>
        <p className="text-sm text-muted-foreground">
          Set the project code, name, and a brief description.
        </p>
      </div>

      {/* Project Code */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground select-none">
          Project Code <span className="text-muted-foreground font-normal">(auto-generated)</span>
        </label>
        <div className="flex gap-2">
          <Input
            value={data.code}
            onChange={(e) => onChange('code', e.target.value)}
            error={errors.code}
            className="font-mono text-sm"
            aria-label="Project code"
            fullWidth
          />
          <Button
            variant="outline"
            size="default"
            onClick={onRegenerateCode}
            type="button"
            className="shrink-0"
            aria-label="Regenerate project code"
          >
            <Zap className="size-3.5" />
            Regenerate
          </Button>
        </div>
        {errors.code && (
          <p className="text-xs text-[#ef4444]">{errors.code}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Unique identifier — used in all documents and reports.
        </p>
      </div>

      {/* Project Name */}
      <Input
        label="Project Name"
        required
        value={data.name}
        onChange={(e) => onChange('name', e.target.value)}
        error={errors.name}
        placeholder="e.g. Sirius 400MW Solar Farm"
        helperText="Minimum 3 characters."
        fullWidth
      />

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="project-description"
          className="text-sm font-medium text-foreground select-none"
        >
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="project-description"
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Brief project overview, scope, and objectives..."
          rows={4}
          className={cn(
            'w-full rounded-lg border border-border bg-input/30 px-3 py-2',
            'font-sans text-sm text-foreground placeholder:text-muted-foreground',
            'outline-none transition-colors duration-150 resize-y',
            'focus:border-ring focus:ring-2 focus:ring-ring/30',
            'disabled:pointer-events-none disabled:opacity-40',
          )}
          aria-describedby="project-description-helper"
        />
        <p id="project-description-helper" className="text-xs text-muted-foreground">
          This will appear in project reports and gate submissions.
        </p>
      </div>
    </div>
  )
}

/* ── Step 2: Client Details ──────────────────────────────────── */

interface Step2Props {
  data: Pick<NewProjectFormData, 'clientName' | 'location'>
  errors: StepErrors
  onChange: (field: keyof NewProjectFormData, value: string) => void
}

function Step2({ data, errors, onChange }: Step2Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Client Details</h2>
        <p className="text-sm text-muted-foreground">
          Identify the client and the project location.
        </p>
      </div>

      <Input
        label="Client Name"
        required
        value={data.clientName}
        onChange={(e) => onChange('clientName', e.target.value)}
        error={errors.clientName}
        placeholder="e.g. Saudi Aramco Energy"
        leadingIcon={<Building2 />}
        helperText="Full legal name of the client organisation."
        fullWidth
      />

      <Input
        label="Location"
        value={data.location}
        onChange={(e) => onChange('location', e.target.value)}
        error={errors.location}
        placeholder="e.g. Riyadh, Saudi Arabia"
        leadingIcon={<MapPin />}
        helperText="City, region, or country where the project is located."
        fullWidth
      />
    </div>
  )
}

/* ── Step 3: Budget & Timeline ───────────────────────────────── */

interface Step3Props {
  data: Pick<NewProjectFormData, 'budgetAmount' | 'currency' | 'startDate' | 'targetCod'>
  errors: StepErrors
  onChange: (field: keyof NewProjectFormData, value: string) => void
}

function Step3({ data, errors, onChange }: Step3Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Budget &amp; Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Set the initial budget and key dates. These can be updated at any gate.
        </p>
      </div>

      {/* Budget row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="Budget Amount"
            type="number"
            value={data.budgetAmount}
            onChange={(e) => onChange('budgetAmount', e.target.value)}
            error={errors.budgetAmount}
            placeholder="e.g. 480000000"
            leadingIcon={<DollarSign />}
            helperText="Enter the full amount (not abbreviated)."
            fullWidth
          />
        </div>
        <div className="w-44 shrink-0">
          <Select
            label="Currency"
            options={CURRENCY_OPTIONS}
            value={data.currency}
            onValueChange={(v) => onChange('currency', v ?? 'USD')}
            fullWidth
          />
        </div>
      </div>

      {/* Live preview */}
      {data.budgetAmount && (
        <div className="flex items-center gap-2 rounded-lg bg-[#64ffda]/5 border border-[#64ffda]/20 px-4 py-2.5">
          <DollarSign className="size-4 text-[#64ffda] shrink-0" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Formatted:</span>
          <span className="font-mono font-semibold text-[#64ffda]">
            {formatBudget(data.budgetAmount, data.currency)}
          </span>
        </div>
      )}

      {/* Dates row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Start Date"
          type="date"
          value={data.startDate}
          onChange={(e) => onChange('startDate', e.target.value)}
          error={errors.startDate}
          leadingIcon={<Calendar />}
          helperText="Planned project mobilisation date."
          fullWidth
        />
        <Input
          label="Target Commercial Operation Date (COD)"
          type="date"
          value={data.targetCod}
          onChange={(e) => onChange('targetCod', e.target.value)}
          error={errors.targetCod}
          leadingIcon={<Calendar />}
          helperText="Expected energisation / handover date."
          fullWidth
        />
      </div>

      {/* Duration hint */}
      {data.startDate && data.targetCod && (
        (() => {
          const start = new Date(data.startDate)
          const end   = new Date(data.targetCod)
          const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
          if (months <= 0) return null
          return (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5">
              <Calendar className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">
                Project duration: <span className="font-semibold text-foreground">{months} months</span>{' '}
                ({(months / 12).toFixed(1)} years)
              </span>
            </div>
          )
        })()
      )}
    </div>
  )
}

/* ── Step 4: Review ──────────────────────────────────────────── */

interface Step4Props {
  data: NewProjectFormData
  onEdit: (step: number) => void
}

function ReviewRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        <p className={cn('text-sm text-foreground break-words', mono && 'font-mono')}>{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
      </div>
    </div>
  )
}

function Step4({ data, onEdit }: Step4Props) {
  const currLabel = CURRENCY_OPTIONS.find(o => o.value === data.currency)?.label.split(' — ')[1] ?? data.currency

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Review &amp; Submit</h2>
        <p className="text-sm text-muted-foreground">
          Confirm all details before creating the project.
        </p>
      </div>

      {/* Warning banner */}
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/8 px-4 py-3.5"
      >
        <AlertTriangle className="size-5 text-[#f59e0b] shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-[#f59e0b]">Starting at G0 — Opportunity Accepted</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This project will be created at Gate 0. Deliverables and approvals must be completed before advancing to G1.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Basic Information</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onEdit(1)} type="button">
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <ReviewRow icon={<Zap />}      label="Project Code" value={data.code} mono />
            <ReviewRow icon={<FileText />} label="Project Name" value={data.name} />
            <ReviewRow icon={<FileText />} label="Description"  value={data.description || undefined} />
          </CardContent>
        </Card>

        {/* Client */}
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Client Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onEdit(2)} type="button">
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <ReviewRow icon={<Building2 />} label="Client Name" value={data.clientName} />
            <ReviewRow icon={<MapPin />}    label="Location"    value={data.location} />
          </CardContent>
        </Card>

        {/* Budget & Timeline — full width */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-0 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Budget &amp; Timeline</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onEdit(3)} type="button">
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="py-3 sm:pr-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Budget</p>
                <p className="font-mono font-bold text-lg text-foreground">{formatBudget(data.budgetAmount, data.currency)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{currLabel}</p>
              </div>
              <div className="py-3 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Start Date</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(data.startDate)}</p>
              </div>
              <div className="py-3 sm:px-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Target COD</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(data.targetCod)}</p>
              </div>
              <div className="py-3 sm:pl-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Initial Gate</p>
                <Badge variant="gate" className="mt-0.5">G0 — Opportunity Accepted</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ── Validation ──────────────────────────────────────────────── */

function validateStep(step: number, data: NewProjectFormData): StepErrors {
  const errors: StepErrors = {}

  if (step === 1) {
    if (!data.code.trim())
      errors.code = 'Project code is required.'
    else if (!/^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/.test(data.code.trim()))
      errors.code = 'Code must follow format: PREFIX-ID-SUFFIX (uppercase).'

    if (!data.name.trim())
      errors.name = 'Project name is required.'
    else if (data.name.trim().length < 3)
      errors.name = 'Project name must be at least 3 characters.'
  }

  if (step === 2) {
    if (!data.clientName.trim())
      errors.clientName = 'Client name is required.'
  }

  if (step === 3) {
    if (data.budgetAmount && isNaN(parseFloat(data.budgetAmount)))
      errors.budgetAmount = 'Budget must be a valid number.'
    if (data.budgetAmount && parseFloat(data.budgetAmount) <= 0)
      errors.budgetAmount = 'Budget must be greater than zero.'
    if (data.startDate && data.targetCod && data.targetCod <= data.startDate)
      errors.targetCod = 'Target COD must be after the start date.'
  }

  return errors
}

/* ── Main Wizard ─────────────────────────────────────────────── */

const INITIAL_DATA: NewProjectFormData = {
  code:         '',
  name:         '',
  description:  '',
  clientName:   '',
  location:     '',
  budgetAmount: '',
  currency:     'USD',
  startDate:    '',
  targetCod:    '',
}

export function NewProjectWizard({
  onSubmit,
  onCancel,
  defaultValues,
}: NewProjectWizardProps) {
  const [step,       setStep]       = React.useState(1)
  const [data,       setData]       = React.useState<NewProjectFormData>({
    ...INITIAL_DATA,
    code: generateCode(),
    ...defaultValues,
  })
  const [errors,     setErrors]     = React.useState<StepErrors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted,  setSubmitted]  = React.useState(false)

  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleChange = React.useCallback(
    (field: keyof NewProjectFormData, value: string) => {
      setData(prev => ({ ...prev, [field]: value }))
      // Clear error on change
      setErrors(prev => ({ ...prev, [field]: undefined }))
    },
    [],
  )

  const handleNext = () => {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep(s => Math.min(s + 1, STEPS.length))
    // Scroll content to top
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    setErrors({})
    setStep(s => Math.max(s - 1, 1))
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEdit = (targetStep: number) => {
    setErrors({})
    setStep(targetStep)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit?.(data)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success screen ── */
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
        <div className="flex size-16 items-center justify-center rounded-full bg-[#64ffda]/15 ring-4 ring-[#64ffda]/20 mb-5">
          <CheckCircle2 className="size-8 text-[#64ffda]" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Project Created!</h2>
        <p className="text-muted-foreground mb-2 max-w-sm">
          <span className="font-mono font-semibold text-foreground">{data.code}</span>{' '}
          — {data.name} has been created and is now at{' '}
          <span className="font-semibold text-foreground">G0 — Opportunity Accepted</span>.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Complete the G0 deliverables to advance the project to G1.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Back to Projects
          </Button>
          <Button variant="gate" onClick={() => { setSubmitted(false); setStep(1); setData({ ...INITIAL_DATA, code: generateCode(), ...defaultValues }) }}>
            Create Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 shrink-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">New Project</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create a new project in the GridMind EPC platform.
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} type="button" aria-label="Cancel wizard">
              Cancel
            </Button>
          )}
        </div>

        <StepIndicator current={step} />
      </div>

      {/* Scrollable content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-6 pb-4 min-h-0"
      >
        <div
          key={step}
          className="animate-fade-in"
        >
          {step === 1 && (
            <Step1
              data={data}
              errors={errors}
              onChange={handleChange}
              onRegenerateCode={() => handleChange('code', generateCode())}
            />
          )}
          {step === 2 && (
            <Step2
              data={data}
              errors={errors}
              onChange={handleChange}
            />
          )}
          {step === 3 && (
            <Step3
              data={data}
              errors={errors}
              onChange={handleChange}
            />
          )}
          {step === 4 && (
            <Step4
              data={data}
              onEdit={handleEdit}
            />
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="shrink-0 px-6 py-4 border-t border-border bg-card">
        <div className="flex items-center justify-between gap-3">
          {/* Back */}
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
            type="button"
            aria-label="Previous step"
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>

          {/* Step counter (mobile) */}
          <span className="text-xs text-muted-foreground sm:hidden font-medium">
            {step} / {STEPS.length}
          </span>

          {/* Error summary */}
          {Object.keys(errors).length > 0 && (
            <p className="hidden sm:block text-xs text-[#ef4444] flex-1 text-center" role="alert">
              Please fix the errors above to continue.
            </p>
          )}

          {/* Next / Submit */}
          {step < STEPS.length ? (
            <Button
              variant="default"
              onClick={handleNext}
              type="button"
              aria-label="Next step"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              variant="gate"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
              type="button"
              aria-label="Create project"
            >
              {submitting ? 'Creating...' : 'Create Project'}
              {!submitting && <CheckCircle2 className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Page wrapper (demo) ─────────────────────────────────────── */

export function NewProjectWizardPage() {
  const [submitted, setSubmitted] = React.useState<NewProjectFormData | null>(null)

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="shadow-lg min-h-[600px] flex flex-col overflow-hidden">
        <NewProjectWizard
          onSubmit={async (data) => {
            // Simulate network delay
            await new Promise(r => setTimeout(r, 1400))
            setSubmitted(data)
          }}
        />
      </Card>

      {/* Debug panel */}
      {submitted && (
        <Card className="mt-6" accent>
          <CardHeader>
            <CardTitle className="text-sm text-[#64ffda]">Submitted Data (dev)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
