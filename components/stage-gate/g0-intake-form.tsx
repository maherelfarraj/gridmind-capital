'use client'

/**
 * G0 Opportunity Assessment Form
 * 5-step wizard: Basic Info → Technical → Commercial → Risk → Review & Submit
 * Uses React Hook Form + Zod, Framer Motion step transitions.
 */

import * as React from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import {
  ChevronRight, ArrowLeft, ArrowRight, Send,
  Check, AlertTriangle, CheckCircle, Wand2,
  Clock, AlertCircle, Flame, ShieldCheck,
  Plus, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { submitG0FormAction, type G0FormData } from '@/app/actions/gate-submissions'

// ─── Zod schemas per step ────────────────────────────────────

const riskSchema = z.object({
  name:        z.string().min(1, 'Required'),
  probability: z.enum(['Low', 'Medium', 'High']),
  impact:      z.enum(['Low', 'Medium', 'High']),
})

const stakeholderSchema = z.object({
  name:         z.string().min(1, 'Required'),
  role:         z.string().min(1, 'Required'),
  organization: z.string().min(1, 'Required'),
  influence:    z.enum(['High', 'Medium', 'Low']),
  interest:     z.enum(['High', 'Medium', 'Low']),
})

const step1Schema = z.object({
  opportunityName: z.string().min(3, 'Min 3 characters').max(100, 'Max 100 characters'),
  opportunityCode: z.string().min(1, 'Required'),
  description:     z.string().min(50, 'Min 50 characters').max(500, 'Max 500 characters'),
  source:          z.string().min(1, 'Required'),
  priority:        z.enum(['Low', 'Medium', 'High', 'Critical']),
})

const step2Schema = z.object({
  technologyType:      z.string().min(1, 'Required'),
  estimatedCapacityMw: z.string().min(1, 'Required'),
  siteLocation:        z.string().min(1, 'Required'),
  gridConnection:      z.string().min(1, 'Required'),
  landAvailability:    z.string().min(1, 'Required'),
  environmentalFlags:  z.array(z.string()),
  technicalNotes:      z.string().max(300).optional(),
})

const step3Schema = z.object({
  clientName:      z.string().min(1, 'Required'),
  clientType:      z.string().min(1, 'Required'),
  budgetMin:       z.string().min(1, 'Required'),
  budgetMax:       z.string().min(1, 'Required'),
  currency:        z.string().min(1, 'Required'),
  fundingStatus:   z.string().min(1, 'Required'),
  ppaStatus:       z.string().min(1, 'Required'),
  expectedIrr:     z.string().optional(),
  commercialNotes: z.string().max(300).optional(),
})

const step4Schema = z.object({
  overallRisk:     z.enum(['Low', 'Medium', 'High']),
  risks:           z.array(riskSchema).min(1, 'At least one risk required'),
  mitigationNotes: z.string().max(300).optional(),
  stakeholders:    z.array(stakeholderSchema).min(1, 'At least one stakeholder required'),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema)
type FormValues = z.infer<typeof fullSchema>

const STEPS = ['Basic Info', 'Technical', 'Commercial', 'Risk', 'Review & Submit']

const ENV_FLAGS = [
  'EIA Required',
  'Protected Area Nearby',
  'Wildlife Corridor',
  'Coastal Zone',
  'Agricultural Land',
]

// ─── Helpers ─────────────────────────────────────────────────

const inputCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition'

const selectCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition'

const textareaCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400 transition resize-y'

function FieldWrapper({
  label, required, error, hint, children,
}: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
    </div>
  )
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn('text-xs', value.length > max ? 'text-red-500' : 'text-slate-400')}>
      {value.length} / {max}
    </span>
  )
}

function ReviewSection({
  title, onEdit, children,
}: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-sky-600 hover:underline underline-offset-2"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function ReviewGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">{label}</dt>
          <dd className="text-sm text-slate-900 dark:text-slate-100 font-medium">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    Low:      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    Medium:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    High:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={cn('inline-block px-2 py-0.5 text-xs font-medium rounded', map[priority] ?? map.Medium)}>
      {priority}
    </span>
  )
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Low:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    Medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    High:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={cn('inline-block px-2 py-0.5 text-xs font-medium rounded', map[level] ?? map.Medium)}>
      {level}
    </span>
  )
}

// ─── Auto-generate code ──────────────────────────────────────

function generateCode(name: string): string {
  if (!name) return ''
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(' ').filter(Boolean)
  const prefix = words.slice(0, 3).map((w) => w.slice(0, 3)).join('')
  const year = new Date().getFullYear()
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `OPP-${prefix.slice(0, 3)}-${year}-${rand}`
}

// ─── Default values ──────────────────────────────────────────

const DEFAULT: FormValues = {
  opportunityName:     '',
  opportunityCode:     '',
  description:         '',
  source:              '',
  priority:            'Medium',
  technologyType:      '',
  estimatedCapacityMw: '',
  siteLocation:        '',
  gridConnection:      '',
  landAvailability:    '',
  environmentalFlags:  [],
  technicalNotes:      '',
  clientName:          '',
  clientType:          '',
  budgetMin:           '',
  budgetMax:           '',
  currency:            'USD',
  fundingStatus:       '',
  ppaStatus:           '',
  expectedIrr:         '',
  commercialNotes:     '',
  overallRisk:         'Medium',
  risks:               [{ name: '', probability: 'Medium', impact: 'Medium' }],
  mitigationNotes:     '',
  stakeholders:        [{ name: '', role: '', organization: '', influence: 'High', interest: 'High' }],
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  projectId?:   string
  projectCode?: string
  projectName?: string
  /**
   * Called after successful submission.
   * - If provided as (data) => Promise<void>, the form delegates ALL server actions
   *   to the caller (external orchestration mode — no internal submitG0FormAction call).
   * - If provided as () => void (legacy), the form handles submission internally.
   */
  onSubmitted?: ((data: G0FormData) => Promise<void>) | (() => void)
  initialData?: Partial<FormValues>
  readOnly?:    boolean
  /** If true, shows as standalone page (includes breadcrumb + AppLayout padding) */
  standalone?:  boolean
  /** When true the Submit button shows a loading spinner (used by external orchestration) */
  isSubmittingExternal?: boolean
}

// ─── Main component ──────────────────────────────────────────

export function G0IntakeForm({
  projectId, projectCode, projectName,
  onSubmitted, initialData, readOnly = false, standalone = false,
  isSubmittingExternal = false,
}: Props) {
  const [activeStep, setActiveStep] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted,  setSubmitted]  = React.useState(false)
  const [confirm,    setConfirm]    = React.useState(false)
  const [direction,  setDirection]  = React.useState(1) // 1 = forward, -1 = back

  const {
    register, control, handleSubmit, watch, setValue, trigger, setError, clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { ...DEFAULT, ...initialData },
    mode: 'onBlur',
  })

  const { fields: riskFields, append: appendRisk, remove: removeRisk } = useFieldArray({
    control, name: 'risks',
  })

  const { fields: stakeholderFields, append: appendStakeholder, remove: removeStakeholder } = useFieldArray({
    control, name: 'stakeholders',
  })

  const watchedValues = watch()

  // ── Step validation via Zod parse ────────────────────────

  const stepSchemas = [step1Schema, step2Schema, step3Schema, step4Schema]

  async function goNext() {
    const vals = watchedValues
    const schema = stepSchemas[activeStep]
    if (!schema) { setDirection(1); setActiveStep((s) => s + 1); return }
    const result = schema.safeParse(vals)
    if (!result.success) {
      // Set errors on relevant fields
      const fieldErrors = result.error.flatten().fieldErrors
      ;(Object.keys(fieldErrors) as (keyof FormValues)[]).forEach((key) => {
        const msgs = (fieldErrors as Record<string, string[] | undefined>)[key as string]
        if (msgs?.[0]) setError(key, { message: msgs[0] })
      })
      return
    }
    clearErrors()
    setDirection(1)
    setActiveStep((s) => s + 1)
  }

  function goBack() {
    clearErrors()
    setDirection(-1)
    setActiveStep((s) => s - 1)
  }

  function jumpToStep(i: number) {
    clearErrors()
    setDirection(i > activeStep ? 1 : -1)
    setActiveStep(i)
  }

  // ── Submit ───────────────────────────────────────────────

  async function onSubmit(raw: FormValues) {
    if (!confirm) return
    const result = fullSchema.safeParse(raw)
    if (!result.success) return
    const data = result.data
    setSubmitting(true)

    const payload: G0FormData = {
      // New fields
      opportunityName:     data.opportunityName,
      opportunityCode:     data.opportunityCode,
      description:         data.description,
      source:              data.source,
      priority:            data.priority,
      technologyType:      data.technologyType,
      estimatedCapacityMw: data.estimatedCapacityMw,
      siteLocation:        data.siteLocation,
      gridConnection:      data.gridConnection,
      landAvailability:    data.landAvailability,
      environmentalFlags:  data.environmentalFlags,
      technicalNotes:      data.technicalNotes ?? '',
      clientName:          data.clientName,
      clientType:          data.clientType,
      budgetMin:           data.budgetMin,
      budgetMax:           data.budgetMax,
      currency:            data.currency,
      fundingStatus:       data.fundingStatus,
      ppaStatus:           data.ppaStatus,
      expectedIrr:         data.expectedIrr ?? '',
      commercialNotes:     data.commercialNotes ?? '',
      overallRisk:         data.overallRisk,
      risks:               data.risks,
      mitigationNotes:     data.mitigationNotes ?? '',
      stakeholders:        data.stakeholders,
      // Legacy compat fields
      projectSponsor:      data.clientName,
      hostCountry:         data.siteLocation.split(',').at(-1)?.trim() ?? '',
      technology:          data.technologyType,
      capacityMwp:         data.estimatedCapacityMw,
      capexEstimateUsd:    data.budgetMin,
      targetIrrPct:        data.expectedIrr ?? '',
      requestedDecision:   'proceed-g1',
    }

    // External orchestration mode: caller owns all server actions
    if (onSubmitted && onSubmitted.length > 0) {
      await (onSubmitted as (data: G0FormData) => Promise<void>)(payload)
      setSubmitting(false)
      setSubmitted(true)
      return
    }

    // Internal mode: form handles submission itself
    const { error } = await submitG0FormAction(payload, projectId ?? 'standalone')
    setSubmitting(false)
    if (!error) {
      setSubmitted(true)
      ;(onSubmitted as (() => void) | undefined)?.()
    }
  }

  // ── Framer Motion variants ───────────────────────────────

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  }

  // ── Success overlay ──────────────────────────────────────

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20 text-center gap-5"
      >
        <div className="size-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle className="size-10 text-green-500 animate-bounce" aria-hidden />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Opportunity Submitted for G0 Approval!
          </h2>
          <p className="mt-2 text-sm font-mono text-sky-600 dark:text-sky-400">
            {watchedValues.opportunityCode}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The Executive Sponsor has been notified
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {projectId && (
            <Link
              href={`/projects/${projectId}`}
              className="px-5 py-2.5 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition"
            >
              View Opportunity
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setSubmitted(false); setActiveStep(0); setConfirm(false) }}
            className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Create Another
          </button>
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Back to Projects
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-6', standalone && 'max-w-4xl mx-auto px-6 py-6')}>

      {/* Breadcrumb */}
      {standalone && (
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <Link href="/projects" className="text-sky-600 hover:underline">Projects</Link>
          <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
          <span className="text-slate-500">New Opportunity</span>
        </nav>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              G0 Opportunity Assessment
            </h1>
            <span className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-xs font-bold px-2 py-1 rounded">
              G0
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Validate project opportunity and secure initial stakeholder commitment
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0" role="tablist" aria-label="Form steps">
        {STEPS.map((label, i) => {
          const isActive    = i === activeStep
          const isCompleted = i < activeStep

          return (
            <React.Fragment key={label}>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Step ${i + 1}: ${label}`}
                onClick={() => i < activeStep && jumpToStep(i)}
                disabled={i > activeStep}
                className="flex flex-col items-center gap-1 group disabled:cursor-not-allowed"
              >
                <div className={cn(
                  'size-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  isCompleted && 'bg-green-500 text-white',
                  isActive    && 'bg-[#0a192f] dark:bg-sky-600 text-white ring-2 ring-[#0a192f]/20 dark:ring-sky-600/30',
                  !isCompleted && !isActive && 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-400',
                )}>
                  {isCompleted ? <Check className="size-4" aria-hidden /> : i + 1}
                </div>
                <span className={cn(
                  'text-xs font-medium hidden sm:block',
                  isActive    && 'text-slate-900 dark:text-slate-100',
                  isCompleted && 'text-green-600 dark:text-green-400',
                  !isCompleted && !isActive && 'text-slate-400',
                )}>
                  {label}
                </span>
              </button>

              {i < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors',
                  i < activeStep ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700',
                )} aria-hidden />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Step content */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 sm:p-8 min-h-[420px]">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={activeStep}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              {/* ── STEP 1: Basic Info ── */}
              {activeStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Basic Information</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fundamental project opportunity details</p>
                  </div>

                  <div className="flex flex-col gap-6">
                    <FieldWrapper label="Opportunity Name" required error={errors.opportunityName?.message}>
                      <input
                        {...register('opportunityName')}
                        className={inputCls}
                        placeholder="e.g., Al Dhafra Solar PV Opportunity"
                      />
                    </FieldWrapper>

                    <FieldWrapper label="Opportunity Code" required error={errors.opportunityCode?.message}>
                      <div className="flex gap-2">
                        <input
                          {...register('opportunityCode')}
                          className={cn(inputCls, 'flex-1')}
                          placeholder="e.g., OPP-SOL-2026-001"
                        />
                        <button
                          type="button"
                          onClick={() => setValue('opportunityCode', generateCode(watchedValues.opportunityName), { shouldValidate: true })}
                          className="flex items-center gap-1.5 px-3 h-9 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
                        >
                          <Wand2 className="size-3.5" aria-hidden /> Auto-generate
                        </button>
                      </div>
                    </FieldWrapper>

                    <FieldWrapper label="Description" required error={errors.description?.message}>
                      <textarea
                        {...register('description')}
                        rows={4}
                        className={textareaCls}
                        placeholder="Describe the opportunity and initial scope..."
                      />
                      <div className="flex justify-end mt-1">
                        <CharCount value={watchedValues.description ?? ''} max={500} />
                      </div>
                    </FieldWrapper>

                    <FieldWrapper label="Opportunity Source" required error={errors.source?.message} hint="How did this opportunity arise?">
                      <select {...register('source')} className={selectCls}>
                        <option value="">Select source</option>
                        {['Direct Client', 'Tender', 'Partnership', 'Acquisition', 'Internal', 'Referral', 'Other'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FieldWrapper>

                    <FieldWrapper label="Priority" required error={errors.priority?.message}>
                      <Controller
                        control={control}
                        name="priority"
                        render={({ field }) => (
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                { value: 'Low',      icon: Clock,          cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
                                { value: 'Medium',   icon: AlertCircle,    cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
                                { value: 'High',     icon: Flame,          cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
                                { value: 'Critical', icon: AlertTriangle,  cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700' },
                              ] as const
                            ).map(({ value, icon: Icon, cls }) => (
                              <label
                                key={value}
                                className={cn(
                                  'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all',
                                  field.value === value
                                    ? cn(cls, 'ring-2 ring-offset-1 ring-current')
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800',
                                )}
                              >
                                <input type="radio" className="sr-only" value={value} checked={field.value === value} onChange={() => field.onChange(value)} />
                                <Icon className="size-3.5" aria-hidden />
                                {value}
                              </label>
                            ))}
                          </div>
                        )}
                      />
                    </FieldWrapper>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Technical ── */}
              {activeStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Technical Screening</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Preliminary technical feasibility assessment</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldWrapper label="Technology Type" required error={errors.technologyType?.message}>
                      <select {...register('technologyType')} className={selectCls}>
                        <option value="">Select technology</option>
                        {['Solar PV', 'Offshore Wind', 'Onshore Wind', 'Hydroelectric', 'CSP', 'Battery Storage', 'Hybrid', 'Other'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </FieldWrapper>

                    <FieldWrapper label="Estimated Capacity (MW)" required error={errors.estimatedCapacityMw?.message}>
                      <div className="relative">
                        <input
                          {...register('estimatedCapacityMw')}
                          type="number"
                          min="1"
                          max="50000"
                          className={cn(inputCls, 'pr-12')}
                          placeholder="e.g., 2000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">MW</span>
                      </div>
                    </FieldWrapper>

                    <FieldWrapper label="Proposed Site Location" required error={errors.siteLocation?.message} hint="City, Region, Country">
                      <input {...register('siteLocation')} className={inputCls} placeholder="e.g., Al Dhafra, Abu Dhabi, UAE" />
                    </FieldWrapper>

                    <FieldWrapper label="Grid Connection Availability" required error={errors.gridConnection?.message} hint="Status of grid interconnection agreement">
                      <select {...register('gridConnection')} className={selectCls}>
                        <option value="">Select status</option>
                        {['Confirmed', 'Likely', 'Possible', 'Uncertain', 'None'].map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </FieldWrapper>

                    <FieldWrapper label="Land Availability" required error={errors.landAvailability?.message} hint="Status of land rights">
                      <select {...register('landAvailability')} className={selectCls}>
                        <option value="">Select status</option>
                        {['Owned', 'Leased', 'Under Negotiation', 'To Be Acquired', 'Unknown'].map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                  </div>

                  <FieldWrapper label="Environmental Screening" hint="Check all applicable environmental factors">
                    <Controller
                      control={control}
                      name="environmentalFlags"
                      render={({ field }) => (
                        <div className="flex flex-col gap-2.5">
                          {ENV_FLAGS.map((flag) => (
                            <label key={flag} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.value.includes(flag)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...field.value, flag]
                                    : field.value.filter((f) => f !== flag)
                                  field.onChange(next)
                                }}
                                className="size-4 rounded border-slate-300 dark:border-slate-600 accent-sky-600"
                              />
                              {flag}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Technical Notes" hint="Any preliminary technical observations">
                    <textarea {...register('technicalNotes')} rows={3} className={textareaCls} placeholder="Any preliminary technical observations..." />
                    <div className="flex justify-end mt-1">
                      <CharCount value={watchedValues.technicalNotes ?? ''} max={300} />
                    </div>
                  </FieldWrapper>
                </div>
              )}

              {/* ── STEP 3: Commercial ── */}
              {activeStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Commercial Screening</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Initial commercial viability assessment</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldWrapper label="Client / Offtaker" required error={errors.clientName?.message}>
                      <input {...register('clientName')} className={inputCls} placeholder="e.g., Emirates Water and Electricity Company" />
                    </FieldWrapper>

                    <FieldWrapper label="Client Type" required error={errors.clientType?.message}>
                      <select {...register('clientType')} className={selectCls}>
                        <option value="">Select type</option>
                        {['Government', 'Utility', 'IPP', 'Corporate', 'Investment Fund', 'Other'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                  </div>

                  <FieldWrapper label="Estimated Budget Range" required hint="Preliminary budget estimate" error={errors.budgetMin?.message ?? errors.budgetMax?.message}>
                    <div className="flex items-center gap-2">
                      <select {...register('currency')} className={cn(selectCls, 'w-24 shrink-0')}>
                        {['USD', 'EUR', 'GBP', 'SAR', 'AED'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input {...register('budgetMin')} type="number" className={cn(inputCls, 'flex-1')} placeholder="500000000" />
                      <span className="text-slate-400 text-sm">–</span>
                      <input {...register('budgetMax')} type="number" className={cn(inputCls, 'flex-1')} placeholder="1500000000" />
                    </div>
                  </FieldWrapper>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FieldWrapper label="Funding Status" required error={errors.fundingStatus?.message} hint="Status of project financing">
                      <select {...register('fundingStatus')} className={selectCls}>
                        <option value="">Select status</option>
                        {['Fully Funded', 'Partially Funded', 'Under Financing', 'To Be Secured', 'Unknown'].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </FieldWrapper>

                    <FieldWrapper label="Power Purchase Agreement" required error={errors.ppaStatus?.message} hint="Status of offtake agreement">
                      <select {...register('ppaStatus')} className={selectCls}>
                        <option value="">Select status</option>
                        {['Signed', 'Under Negotiation', 'Tendered', 'To Be Tendered', 'Not Applicable'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </FieldWrapper>

                    <FieldWrapper label="Expected IRR (%)" hint="Internal rate of return target">
                      <div className="relative">
                        <input
                          {...register('expectedIrr')}
                          type="number"
                          step="0.1"
                          className={cn(inputCls, 'pr-8')}
                          placeholder="e.g., 8.5"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
                      </div>
                    </FieldWrapper>
                  </div>

                  <FieldWrapper label="Commercial Notes" hint="Any preliminary commercial observations">
                    <textarea {...register('commercialNotes')} rows={3} className={textareaCls} placeholder="Any preliminary commercial observations..." />
                    <div className="flex justify-end mt-1">
                      <CharCount value={watchedValues.commercialNotes ?? ''} max={300} />
                    </div>
                  </FieldWrapper>
                </div>
              )}

              {/* ── STEP 4: Risk ── */}
              {activeStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Risk Screening</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Preliminary risk identification</p>
                  </div>

                  {/* Overall risk */}
                  <FieldWrapper label="Overall Risk Level" required>
                    <Controller
                      control={control}
                      name="overallRisk"
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              { value: 'Low',    icon: ShieldCheck,   cls: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700' },
                              { value: 'Medium', icon: AlertCircle,   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
                              { value: 'High',   icon: AlertTriangle, cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700' },
                            ] as const
                          ).map(({ value, icon: Icon, cls }) => (
                            <label
                              key={value}
                              className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all',
                                field.value === value
                                  ? cn(cls, 'ring-2 ring-offset-1 ring-current')
                                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800',
                              )}
                            >
                              <input type="radio" className="sr-only" value={value} checked={field.value === value} onChange={() => field.onChange(value)} />
                              <Icon className="size-3.5" aria-hidden />
                              {value}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                  </FieldWrapper>

                  {/* Risk rows */}
                  <FieldWrapper label="Key Identified Risks" required error={typeof errors.risks?.message === 'string' ? errors.risks.message : undefined}>
                    <div className="space-y-2">
                      {riskFields.map((field, i) => (
                        <div key={field.id} className="flex gap-2 items-start">
                          <input
                            {...register(`risks.${i}.name`)}
                            className={cn(inputCls, 'flex-1')}
                            placeholder={`Risk ${i + 1}`}
                          />
                          <select {...register(`risks.${i}.probability`)} className={cn(selectCls, 'w-28 shrink-0')}>
                            <option value="Low">Low prob.</option>
                            <option value="Medium">Med prob.</option>
                            <option value="High">High prob.</option>
                          </select>
                          <select {...register(`risks.${i}.impact`)} className={cn(selectCls, 'w-28 shrink-0')}>
                            <option value="Low">Low impact</option>
                            <option value="Medium">Med impact</option>
                            <option value="High">High impact</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => riskFields.length > 1 && removeRisk(i)}
                            disabled={riskFields.length <= 1}
                            className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 disabled:opacity-30 transition shrink-0"
                            aria-label="Remove risk"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => appendRisk({ name: '', probability: 'Medium', impact: 'Medium' })}
                        className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        <Plus className="size-3.5" aria-hidden /> Add Risk
                      </button>
                    </div>
                  </FieldWrapper>

                  <FieldWrapper label="Preliminary Mitigation Approach" hint="How might these risks be mitigated?">
                    <textarea {...register('mitigationNotes')} rows={3} className={textareaCls} placeholder="How might these risks be mitigated?" />
                    <div className="flex justify-end mt-1">
                      <CharCount value={watchedValues.mitigationNotes ?? ''} max={300} />
                    </div>
                  </FieldWrapper>

                  {/* Stakeholders */}
                  <FieldWrapper label="Key Stakeholders" required error={typeof errors.stakeholders?.message === 'string' ? errors.stakeholders.message : undefined}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            {['Name', 'Role', 'Organization', 'Influence', 'Interest', ''].map((h) => (
                              <th key={h} className="pb-2 pr-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {stakeholderFields.map((field, i) => (
                            <tr key={field.id} className="group">
                              <td className="py-1.5 pr-2">
                                <input {...register(`stakeholders.${i}.name`)} className={cn(inputCls, 'min-w-[120px]')} placeholder="Name" />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input {...register(`stakeholders.${i}.role`)} className={cn(inputCls, 'min-w-[100px]')} placeholder="Role" />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input {...register(`stakeholders.${i}.organization`)} className={cn(inputCls, 'min-w-[120px]')} placeholder="Organization" />
                              </td>
                              <td className="py-1.5 pr-2">
                                <select {...register(`stakeholders.${i}.influence`)} className={cn(selectCls, 'min-w-[90px]')}>
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <select {...register(`stakeholders.${i}.interest`)} className={cn(selectCls, 'min-w-[90px]')}>
                                  <option value="High">High</option>
                                  <option value="Medium">Medium</option>
                                  <option value="Low">Low</option>
                                </select>
                              </td>
                              <td className="py-1.5">
                                <button
                                  type="button"
                                  onClick={() => stakeholderFields.length > 1 && removeStakeholder(i)}
                                  disabled={stakeholderFields.length <= 1}
                                  className="size-8 flex items-center justify-center rounded border border-transparent text-slate-400 hover:text-red-500 hover:border-red-200 disabled:opacity-30 transition"
                                  aria-label="Remove stakeholder"
                                >
                                  <X className="size-3.5" aria-hidden />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={() => appendStakeholder({ name: '', role: '', organization: '', influence: 'High', interest: 'High' })}
                      className="mt-2 flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <Plus className="size-3.5" aria-hidden /> Add Stakeholder
                    </button>
                  </FieldWrapper>
                </div>
              )}

              {/* ── STEP 5: Review & Submit ── */}
              {activeStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Review & Submit</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verify all opportunity details before submission</p>
                  </div>

                  {/* Warning banner */}
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg p-4">
                    <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This opportunity will be submitted for G0 approval</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Executive Sponsor approval is required to proceed to G1</p>
                    </div>
                  </div>

                  {/* Review sections */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-6 divide-y divide-slate-200 dark:divide-slate-700">

                    <ReviewSection title="Basic Information" onEdit={() => jumpToStep(0)}>
                      <ReviewGrid items={[
                        { label: 'Name',        value: watchedValues.opportunityName },
                        { label: 'Code',        value: <span className="font-mono">{watchedValues.opportunityCode}</span> },
                        { label: 'Source',      value: watchedValues.source },
                        { label: 'Priority',    value: <PriorityBadge priority={watchedValues.priority} /> },
                        { label: 'Description', value: watchedValues.description },
                      ]} />
                    </ReviewSection>

                    <div className="pt-6">
                      <ReviewSection title="Technical Screening" onEdit={() => jumpToStep(1)}>
                        <ReviewGrid items={[
                          { label: 'Technology',   value: watchedValues.technologyType },
                          { label: 'Capacity',     value: watchedValues.estimatedCapacityMw ? `${watchedValues.estimatedCapacityMw} MW` : '' },
                          { label: 'Location',     value: watchedValues.siteLocation },
                          { label: 'Grid',         value: watchedValues.gridConnection },
                          { label: 'Land',         value: watchedValues.landAvailability },
                          { label: 'Environmental', value: watchedValues.environmentalFlags.join(', ') || 'None flagged' },
                        ]} />
                      </ReviewSection>
                    </div>

                    <div className="pt-6">
                      <ReviewSection title="Commercial Screening" onEdit={() => jumpToStep(2)}>
                        <ReviewGrid items={[
                          { label: 'Client',         value: watchedValues.clientName },
                          { label: 'Client Type',    value: watchedValues.clientType },
                          { label: 'Budget Range',   value: watchedValues.budgetMin && watchedValues.budgetMax ? `${watchedValues.currency} ${Number(watchedValues.budgetMin).toLocaleString()} – ${Number(watchedValues.budgetMax).toLocaleString()}` : '' },
                          { label: 'Funding',        value: watchedValues.fundingStatus },
                          { label: 'PPA Status',     value: watchedValues.ppaStatus },
                          { label: 'Expected IRR',   value: watchedValues.expectedIrr ? `${watchedValues.expectedIrr}%` : '—' },
                        ]} />
                      </ReviewSection>
                    </div>

                    <div className="pt-6">
                      <ReviewSection title="Risk Screening" onEdit={() => jumpToStep(3)}>
                        <div className="mb-3">
                          <span className="text-xs text-slate-500">Overall Risk: </span>
                          <RiskBadge level={watchedValues.overallRisk} />
                        </div>
                        <div className="space-y-1.5 mb-4">
                          {watchedValues.risks.filter((r) => r.name).map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-slate-700 dark:text-slate-300 flex-1">{r.name}</span>
                              <RiskBadge level={r.probability} />
                              <RiskBadge level={r.impact} />
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-slate-500 mb-2">Stakeholders</p>
                          {watchedValues.stakeholders.filter((s) => s.name).map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                              <span className="text-slate-500">{s.role}</span>
                              <span className="text-slate-400 text-xs">{s.organization}</span>
                            </div>
                          ))}
                        </div>
                      </ReviewSection>
                    </div>
                  </div>

                  {/* Confirm checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirm}
                      onChange={(e) => setConfirm(e.target.checked)}
                      className="size-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 accent-sky-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      I confirm this opportunity is ready for G0 review
                    </span>
                  </label>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
          {activeStep > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <ArrowLeft className="size-4" aria-hidden /> Previous
            </button>
          ) : (
            <div />
          )}

          {activeStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              Next <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!confirm || submitting || isSubmittingExternal}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0a192f] dark:bg-sky-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {(submitting || isSubmittingExternal) ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="size-4" aria-hidden />
                  Submit for G0 Approval
                </>
              )}
            </button>
          )}
        </div>
        {activeStep === STEPS.length - 1 && (
          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-2">
            The Executive Sponsor will be notified to review
          </p>
        )}
      </form>
    </div>
  )
}
